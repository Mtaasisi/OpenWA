#!/usr/bin/env python3
"""Copy OpenWA data from local SQLite (dev) into Neon Postgres (production)."""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any

PROJECT_DIR = Path(__file__).resolve().parent.parent
DEFAULT_SQLITE = PROJECT_DIR / "data" / "openwa.sqlite"

# Insert order respects foreign keys.
TABLES = [
    "ai_config",
    "branch_ai_profiles",
    "branch_payment_accounts",
    "crm_inauzwa_sync_settings",
    "crm_products",
    "crm_product_variants",
    "ai_chat_conversations",
    "ai_chat_messages",
    "ai_reply_events",
    "ai_escalations",
    "quick_reply_templates",
    "followup_message_templates",
    "followup_rules",
    "followup_autopilot_settings",
]

BOOL_COLS_CACHE: dict[str, set[str]] = {}


def pg_conn() -> str:
    url = os.environ.get("DATABASE_URL")
    if url:
        return url
    host = os.environ.get("DATABASE_HOST")
    if not host:
        raise SystemExit("Set DATABASE_URL or DATABASE_HOST/USER/PASSWORD/NAME")
    user = os.environ["DATABASE_USERNAME"]
    password = os.environ["DATABASE_PASSWORD"]
    name = os.environ.get("DATABASE_NAME", "openwa")
    port = os.environ.get("DATABASE_PORT", "5432")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}?sslmode=require"


def psql(sql: str) -> None:
    subprocess.run(["psql", pg_conn(), "-v", "ON_ERROR_STOP=1", "-c", sql], check=True)


def psql_copy(sql: str) -> None:
    subprocess.run(["psql", pg_conn(), "-v", "ON_ERROR_STOP=1"], input=sql, text=True, check=True)


def bool_columns(table: str) -> set[str]:
    if table in BOOL_COLS_CACHE:
        return BOOL_COLS_CACHE[table]
    q = (
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name='{table}' AND data_type='boolean'"
    )
    out = subprocess.check_output(["psql", pg_conn(), "-At", "-c", q], text=True)
    cols = {line.strip() for line in out.splitlines() if line.strip()}
    BOOL_COLS_CACHE[table] = cols
    return cols


def pg_columns(table: str) -> list[str]:
    q = (
        "SELECT column_name FROM information_schema.columns "
        f"WHERE table_schema='public' AND table_name='{table}' ORDER BY ordinal_position"
    )
    out = subprocess.check_output(["psql", pg_conn(), "-At", "-c", q], text=True)
    return [line.strip() for line in out.splitlines() if line.strip()]


def sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]


def format_value(col: str, val: Any, bool_cols: set[str]) -> str:
    if val is None:
        return "NULL"
    if col in bool_cols:
        return "TRUE" if val in (1, True, "1", "true", "TRUE") else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bytes):
        val = val.decode("utf-8", errors="replace")
    text = str(val)
    if text.startswith("[") or text.startswith("{"):
        escaped = text.replace("'", "''")
        return f"'{escaped}'"
    escaped = text.replace("'", "''")
    return f"'{escaped}'"


def upsert_table(conn: sqlite3.Connection, table: str, dry_run: bool) -> int:
    sq_cols = sqlite_columns(conn, table)
    pg_cols = pg_columns(table)
    cols = [c for c in sq_cols if c in pg_cols]
    if not cols:
        print(f"  skip {table}: no shared columns")
        return 0

    rows = conn.execute(f"SELECT {', '.join(cols)} FROM {table}").fetchall()
    if not rows:
        print(f"  {table}: 0 rows (nothing to copy)")
        return 0

    bool_cols = bool_columns(table)
    conflict_col = "id"
    if table == "branch_ai_profiles":
        conflict_col = '"branchId"'
    elif table == "followup_autopilot_settings":
        conflict_col = "id"

    set_clause = ", ".join(
        f'"{c}" = EXCLUDED."{c}"' if c != conflict_col.strip('"') else f'"{c}" = EXCLUDED."{c}"'
        for c in cols
        if c != conflict_col.strip('"')
    )

    statements: list[str] = []
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        values_sql = []
        for row in chunk:
            vals = ", ".join(format_value(cols[j], row[j], bool_cols) for j in range(len(cols)))
            values_sql.append(f"({vals})")
        quoted_cols = ", ".join(f'"{c}"' for c in cols)
        sql = (
            f'INSERT INTO "{table}" ({quoted_cols}) VALUES {", ".join(values_sql)} '
            f'ON CONFLICT ({conflict_col}) DO UPDATE SET {set_clause};'
        )
        statements.append(sql)

    print(f"  {table}: {len(rows)} rows")
    if dry_run:
        return len(rows)

    for stmt in statements:
        psql_copy(stmt)
    return len(rows)


def replace_table(conn: sqlite3.Connection, table: str, dry_run: bool) -> int:
    """Tables with no stable upsert — truncate then insert."""
    sq_cols = sqlite_columns(conn, table)
    pg_cols = pg_columns(table)
    cols = [c for c in sq_cols if c in pg_cols]
    rows = conn.execute(f"SELECT {', '.join(cols)} FROM {table}").fetchall()
    if not rows:
        print(f"  {table}: 0 rows")
        return 0

    bool_cols = bool_columns(table)
    print(f"  {table}: replace {len(rows)} rows")
    if dry_run:
        return len(rows)

    psql(f'TRUNCATE TABLE "{table}" CASCADE;')
    batch_size = 100
    quoted_cols = ", ".join(f'"{c}"' for c in cols)
    for i in range(0, len(rows), batch_size):
        chunk = rows[i : i + batch_size]
        values_sql = []
        for row in chunk:
            vals = ", ".join(format_value(cols[j], row[j], bool_cols) for j in range(len(cols)))
            values_sql.append(f"({vals})")
        psql_copy(f'INSERT INTO "{table}" ({quoted_cols}) VALUES {", ".join(values_sql)};')
    return len(rows)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sqlite", default=str(DEFAULT_SQLITE))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite)
    if not sqlite_path.is_file():
        raise SystemExit(f"SQLite not found: {sqlite_path}")

    conn = sqlite3.connect(sqlite_path)
    total = 0
    print(f"Source: {sqlite_path}")
    print(f"Target: {pg_conn().split('@')[1].split('?')[0]}")

    upsert_tables = {
        "ai_config",
        "branch_ai_profiles",
        "branch_payment_accounts",
        "crm_inauzwa_sync_settings",
        "crm_products",
        "crm_product_variants",
        "quick_reply_templates",
        "followup_message_templates",
        "followup_rules",
        "followup_autopilot_settings",
        "ai_chat_conversations",
        "ai_chat_messages",
    }
    replace_tables = {"ai_reply_events", "ai_escalations"}

    for table in TABLES:
        if table in replace_tables:
            total += replace_table(conn, table, args.dry_run)
        elif table in upsert_tables:
            total += upsert_table(conn, table, args.dry_run)
        else:
            total += upsert_table(conn, table, args.dry_run)

    print(f"Done. {total} row operations.")


if __name__ == "__main__":
    main()
