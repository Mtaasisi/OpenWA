#!/usr/bin/env python3
"""
Deep-scan WhatsApp CSV exports inside a zip archive for customer FAQ patterns.

Usage:
  python3 scripts/analyze-whatsapp-archive.py \\
    --zip "/path/to/Archive.zip" \\
    --report WHATSAPP_FAQ_ANALYSIS_REPORT.md \\
    --json whatsapp-faq-analysis.json
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from io import TextIOWrapper
from pathlib import Path
from typing import Any

WHATSAPP_FILES = [
    "all whatsapp.csv",
    "WhatsApp - 2323 chat sessions.csv",
]

MIN_TEXT_LEN = 3
MAX_TEXT_LEN = 300
MAX_TEMPLATE_WORDS = 15
TOP_TEMPLATES = 25
TOP_EXEMPLARS = 8
QA_MAX_GAP = 3

SYSTEM_NOISE = re.compile(
    r"^(messages to this chat|you joined|created this (group|community)|"
    r"end-to-end encryption|this message was deleted|waiting for this message|null)$",
    re.I,
)

GROUP_SESSION = re.compile(
    r"(community|group|soko|store|hub|kambi|business center|bei ya dubai|"
    r"mazoezi|📍|🇹🇿|💰|📱|restocking|content creators|inauzwa groups)",
    re.I,
)

INTERNAL_SESSION = re.compile(
    r"(restock|staff|inventory|office|action @|content creator|api|delivary|delivery team|"
    r"zagamba jr|zagamba pro|zagamba camera|film store|uza \d|store [ab]\d|camera shop)",
    re.I,
)

STAFF_TO_BOSS = re.compile(
    r"^\s*(boss|mkuu|sir|tajiri|van|bro\s*van|kaka\s*van|habari boss|salama mkuu|"
    r"salama niambie|sawa boss|naomba ucomfirm|umewapa account)\b",
    re.I,
)

BIZ_SESSION = re.compile(r"inauzwa|zagamba", re.I)

AD_BROADCAST = re.compile(
    r"(maongezi yapo|kila kitu kipo|offer kubwa|^\*|```|"
    r"0655695769|0655\d{6}|2556\d{8,}|stock under warranty|ready stock new arrival)",
    re.I,
)

PHONE_RE = re.compile(r"\b(?:\+?255|0)?[67]\d{8}\b")

QUESTION_SIGNAL = re.compile(
    r"(\?|^\s*(bei|price|ngapi|kuna|una|unayo|do you|how much|nataka|naomba|"
    r"please|wapi|where|habari|mambo|vip|niaje|salama|delivery|peleka|ipo|available)\b)",
    re.I,
)

PRODUCT_WORDS = re.compile(
    r"\b(macbook|mac book|iphone|ipad|airpods|apple watch|watch|imac|mac mini|"
    r"mba|mbp|pro max|samsung|charger|chaja|battery|betri|ssd|ram|keyboard|"
    r"screen|display|a\d{4}|dell|lenovo|hp)\b",
    re.I,
)

INTENT_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("greeting", re.compile(
        r"^\s*(habari|mambo|vip|niaje|hello|hi|good morning|good afternoon|"
        r"good evening|poa|sawa|kwema|mzima|salama)\b[\s!?.,]*$",
        re.I,
    )),
    ("price_general", re.compile(
        r"^\s*(bei|price|ngapi|how much|bei gan|bei gani|sh ngapi)\b|"
        r"^\s*(bei|price|ngapi|how much)\s*[\?!.]?\s*$",
        re.I,
    )),
    ("price_with_product", re.compile(
        r"\b(bei|price|ngapi|how much).{0,60}\b(macbook|iphone|ipad|charger|battery|"
        r"pro max|air|watch|samsung|dell|lenovo|mba|mbp|a\d{4})\b|"
        r"\b(macbook|iphone|ipad|charger|battery|pro max|air|watch|samsung|dell|lenovo|"
        r"mba|mbp|a\d{4}).{0,60}\b(bei|price|ngapi|how much)\b",
        re.I,
    )),
    ("availability", re.compile(
        r"\b(ipo|available|stock|kuna|una|unayo|do you have|dukan|in stock|unazo)\b",
        re.I,
    )),
    ("location_delivery", re.compile(
        r"\b(wapi|where|delivery|peleka|mikoani|pickup|duka|shop|address|"
        r"wakati|saa ngapi|open|fungua|funga|funuliwa|location)\b",
        re.I,
    )),
    ("payment_installment", re.compile(
        r"\b(mpesa|lipa|pay|malipo|installment|kodi|deposit|credit|lipa namba)\b",
        re.I,
    )),
    ("condition_used_new", re.compile(
        r"\b(used|new|refurb|cpo|original|copy|fake|dub|hali|brand new|like new)\b",
        re.I,
    )),
    ("spec_compat", re.compile(
        r"\b(ram|storage|gb|tb|inch|model|compatible|inafaa|a\d{4}|m1|m2|m3|m4|"
        r"processor|generation|year)\b",
        re.I,
    )),
    ("accessories", re.compile(
        r"\b(charger|chaja|battery|betri|cable|case|cover|adapter|magic keyboard|"
        r"airpods|screen protector)\b",
        re.I,
    )),
    ("warranty", re.compile(r"\b(warranty|dhamana|guarantee|waranti)\b", re.I)),
    ("icloud_lock", re.compile(r"\b(icloud|bypass|locked|lock|passcode|pass code)\b", re.I)),
    ("trade_in", re.compile(
        r"\b(trade|exchange|kubadilisha|ununua.*kutoa|buy.*sell|nunua.*uzwa)\b",
        re.I,
    )),
]

# Priority order for multi-label classification (first match wins)
INTENT_ORDER = [name for name, _ in INTENT_PATTERNS] + ["other"]

PLAYBOOKS: dict[str, dict[str, str]] = {
    "price_general": {
        "ai_target": "search_products + reply rules",
        "playbook": (
            "Ask which product/model if not stated. Use search_products for live price and stock. "
            "Quote in-stock items only (name, qty, price, variant). End with a sales question."
        ),
        "sw_triggers": "bei, bei gani, bei gan, ngapi, sh ngapi",
        "en_triggers": "price, how much, cost",
    },
    "price_with_product": {
        "ai_target": "search_products + reply rules",
        "playbook": (
            "Search the named product immediately. If variant unclear (RAM/storage/year), ask ONE "
            "compatibility question — do not re-search the whole category when they answer briefly."
        ),
        "sw_triggers": "bei ya iPhone, MacBook bei gani, charger bei",
        "en_triggers": "price for iPhone, how much MacBook",
    },
    "availability": {
        "ai_target": "search_products + reply rules",
        "playbook": (
            "Confirm exact model/variant, then search_products. Say clearly if in stock or not. "
            "If out of stock only, mention briefly — do not list OOS unless nothing matches."
        ),
        "sw_triggers": "kuna, una, unayo, ipo, duke kuna",
        "en_triggers": "do you have, available, in stock",
    },
    "location_delivery": {
        "ai_target": "FAQ.md / search_shop_knowledge",
        "playbook": (
            "Answer store location, hours, pickup, and delivery areas from shop knowledge. "
            "If policy unknown, escalate or say team will confirm — do not invent fees."
        ),
        "sw_triggers": "wapi, delivery, peleka, mikoani, saa ngapi",
        "en_triggers": "where, delivery, pickup, address",
    },
    "payment_installment": {
        "ai_target": "FAQ.md / search_shop_knowledge",
        "playbook": (
            "Explain accepted payment methods (M-Pesa, cash, lipa namba) and installment/deposit "
            "policy from shop knowledge. Never confirm payment received without tool data."
        ),
        "sw_triggers": "mpesa, malipo, lipa namba, kodi",
        "en_triggers": "payment, installment, deposit, pay",
    },
    "condition_used_new": {
        "ai_target": "FAQ.md + reply rules",
        "playbook": (
            "Clarify used vs new vs refurb/CPO/copy. Explain grading and warranty differences. "
            "Search catalog for matching condition."
        ),
        "sw_triggers": "used, dub, hali, original, copy",
        "en_triggers": "used, new, refurb, CPO, condition",
    },
    "spec_compat": {
        "ai_target": "reply rules (intent context)",
        "playbook": (
            "Treat short replies as answers to your previous spec question. Use model codes (A####) "
            "for Mac parts. Do NOT re-run search_products for the original category."
        ),
        "sw_triggers": "GB, RAM, inch, model, inafaa",
        "en_triggers": "RAM, storage, compatible, model year",
    },
    "accessories": {
        "ai_target": "search_products + reply rules",
        "playbook": (
            "Only lead with accessories when customer explicitly asked (battery, charger, case). "
            "Otherwise list devices first, then optional accessories line."
        ),
        "sw_triggers": "betri, chaja, charger, battery",
        "en_triggers": "charger, battery, cable, case",
    },
    "warranty": {
        "ai_target": "FAQ.md / search_shop_knowledge",
        "playbook": "State warranty period and what it covers per product type from shop knowledge.",
        "sw_triggers": "dhamana, warranty",
        "en_triggers": "warranty, guarantee",
    },
    "greeting": {
        "ai_target": "reply rules",
        "playbook": (
            "Brief warm greeting in customer's language — do not repeat hello if thread started. "
            "Immediately ask what they are looking for (one sales question)."
        ),
        "sw_triggers": "habari, mambo, vip, niaje",
        "en_triggers": "hello, hi, good morning",
    },
    "icloud_lock": {
        "ai_target": "FAQ.md + escalate if needed",
        "playbook": (
            "Explain iCloud/lock policy honestly. Escalate bypass or passcode requests to human if "
            "outside standard policy."
        ),
        "sw_triggers": "icloud, bypass, passcode",
        "en_triggers": "icloud, locked, bypass",
    },
    "trade_in": {
        "ai_target": "FAQ.md / escalate",
        "playbook": "Explain trade-in/buy-back policy or escalate to staff for valuation.",
        "sw_triggers": "kubadilisha, nunua uzwa",
        "en_triggers": "trade in, exchange, buy back",
    },
    "other": {
        "ai_target": "context + tools",
        "playbook": (
            "Use full thread context. search_products or search_shop_knowledge as needed. "
            "Escalate if unclear or customer wants a person."
        ),
        "sw_triggers": "(context-dependent)",
        "en_triggers": "(context-dependent)",
    },
}

DRAFT_FAQ: dict[str, list[str]] = {
    "price_general": [
        "Q: Bei gani? / Price? / How much?",
        "A: [Proposed] Karibu! Unatafuta simu, laptop, au accessory gani? Nikutumie bei na stock iliyopo sasa.",
    ],
    "availability": [
        "Q: Kuna iPhone 13? / Do you have MacBook Air?",
        "A: [Proposed] Niangalie stock halisi — ni model/GB/storage gani unayohitaji?",
    ],
    "location_delivery": [
        "Q: Mko wapi? / Delivery mikoani?",
        "A: [Proposed — fill in] Anuani ya duka, masaa ya kufunguliwa, na maeneo ya delivery + gharama.",
    ],
    "payment_installment": [
        "Q: Mnafanya installment? / Lipa namba?",
        "A: [Proposed — fill in] Njia za malipo zinazokubalika na sera ya awamu/installment.",
    ],
    "condition_used_new": [
        "Q: Kuna used? / Original au copy?",
        "A: [Proposed] Tuna [new/used/refurb/CPO]. Kila hali ina bei na dhamana tofauti — unataka aina gani?",
    ],
    "warranty": [
        "Q: Dhamana ipo? / Warranty?",
        "A: [Proposed — fill in] Muda wa dhamana kwa kila aina ya bidhaa.",
    ],
    "greeting": [
        "Q: Mambo / Habari / Hello",
        "A: [Proposed] Mambo vip! Leo naweza kukusaidiaje — unatafuta bidhaa gani?",
    ],
}


@dataclass
class Message:
    session: str
    date: str
    msg_type: str
    sender_id: str
    sender_name: str
    text: str
    tier_a: bool = False
    tier_b: bool = False
    is_ad: bool = False
    is_question: bool = False


@dataclass
class AnalysisStats:
    raw_rows: int = 0
    deduped_rows: int = 0
    incoming_text: int = 0
    excluded_system: int = 0
    excluded_length: int = 0
    excluded_ads: int = 0
    group_sessions: int = 0
    private_sessions: int = 0
    biz_sessions: int = 0
    tier_a_questions: int = 0
    tier_b_questions: int = 0
    tier_c_questions: int = 0
    qa_pairs: int = 0


def msg_key(row: dict[str, str]) -> tuple[str, ...]:
    text = (row.get("Text") or "").strip()
    return (
        (row.get("Chat Session") or "").strip(),
        (row.get("Message Date") or "").strip(),
        (row.get("Type") or "").strip(),
        (row.get("Sender ID") or "").strip(),
        text[:500],
    )


def anonymize(text: str) -> str:
    return PHONE_RE.sub("[PHONE]", text)


def normalize_template(text: str) -> str:
    s = text.lower().strip()
    s = re.sub(r"\d+[\d,.]*", "#", s)
    s = re.sub(r"https?://\S+", "[URL]", s)
    s = re.sub(r"\s+", " ", s)
    return s[:100]


def is_seller_ad(text: str) -> bool:
    if AD_BROADCAST.search(text):
        return True
    if len(text.split()) > 15 and PRODUCT_WORDS.search(text) and re.search(
        r"\b(bei|price)\b", text, re.I
    ):
        return True
    if text.count("\n") >= 3 and len(text) > 80:
        return True
    return False


def classify_intent(text: str) -> str:
    for name, pat in INTENT_PATTERNS:
        if pat.search(text):
            return name
    return "other"


def is_customer_question(text: str, *, tier_a: bool = False) -> bool:
    if tier_a and STAFF_TO_BOSS.search(text):
        return False
    if not QUESTION_SIGNAL.search(text):
        return False
    if classify_intent(text) == "greeting":
        return True
    if len(text.split()) > MAX_TEMPLATE_WORDS:
        return False
    return True


def load_messages(zip_path: Path) -> tuple[list[Message], AnalysisStats]:
    stats = AnalysisStats()
    seen: set[tuple[str, ...]] = set()
    session_incoming: dict[str, list[str]] = defaultdict(list)
    messages: list[Message] = []

    with zipfile.ZipFile(zip_path) as zf:
        for fname in WHATSAPP_FILES:
            if fname not in zf.namelist():
                continue
            with zf.open(fname) as raw:
                reader = csv.DictReader(TextIOWrapper(raw, encoding="utf-8", errors="replace"))
                for row in reader:
                    stats.raw_rows += 1
                    key = msg_key(row)
                    if key in seen:
                        continue
                    seen.add(key)
                    stats.deduped_rows += 1

                    msg_type = (row.get("Type") or "").strip()
                    if msg_type == "Notification":
                        continue

                    text = (row.get("Text") or "").strip()
                    session = (row.get("Chat Session") or "").strip()
                    if not text:
                        continue

                    if len(text) < MIN_TEXT_LEN or len(text) > MAX_TEXT_LEN:
                        if msg_type == "Incoming":
                            stats.excluded_length += 1
                        continue

                    if SYSTEM_NOISE.match(text):
                        if msg_type == "Incoming":
                            stats.excluded_system += 1
                        continue

                    is_ad = is_seller_ad(text)
                    if msg_type == "Incoming":
                        stats.incoming_text += 1
                        if is_ad:
                            stats.excluded_ads += 1
                        session_incoming[session].append(text)

                    messages.append(
                        Message(
                            session=session,
                            date=(row.get("Message Date") or "").strip(),
                            msg_type=msg_type,
                            sender_id=(row.get("Sender ID") or "").strip(),
                            sender_name=(row.get("Sender Name") or "").strip(),
                            text=text,
                            is_ad=is_ad,
                        )
                    )

    group_sessions: set[str] = set()
    for session, texts in session_incoming.items():
        if GROUP_SESSION.search(session) or len(texts) > 500:
            group_sessions.add(session)

    biz_sessions = {s for s in session_incoming if BIZ_SESSION.search(s)}
    internal_biz = {s for s in biz_sessions if INTERNAL_SESSION.search(s)}

    stats.group_sessions = len(group_sessions)
    stats.private_sessions = len(session_incoming) - len(group_sessions)
    stats.biz_sessions = len(biz_sessions) - len(internal_biz)

    for msg in messages:
        if msg.msg_type != "Incoming" or msg.is_ad:
            continue
        tier_a = (
            BIZ_SESSION.search(msg.session)
            and msg.session not in internal_biz
            and msg.session not in group_sessions
        )
        tier_b = msg.session not in group_sessions
        msg.tier_a = tier_a
        msg.tier_b = tier_b
        msg.is_question = is_customer_question(msg.text, tier_a=tier_a)

        if msg.is_question:
            stats.tier_c_questions += 1
            if tier_a:
                stats.tier_a_questions += 1
            if tier_b:
                stats.tier_b_questions += 1

    return messages, stats


def mine_qa_pairs(
    messages: list[Message],
    *,
    tier: str = "b",
) -> list[dict[str, str]]:
    pairs: list[dict[str, str]] = []
    by_session: dict[str, list[Message]] = defaultdict(list)
    session_tier: dict[str, bool] = {}

    for msg in messages:
        by_session[msg.session].append(msg)
        if tier == "a" and msg.tier_a:
            session_tier[msg.session] = True
        elif tier == "b" and msg.tier_b:
            session_tier[msg.session] = True
        elif tier == "c":
            session_tier[msg.session] = True

    for session, thread in by_session.items():
        if not session_tier.get(session):
            continue
        pending_q: str | None = None
        gap = 0
        for msg in thread:
            if msg.msg_type == "Incoming":
                if msg.is_ad:
                    pending_q = None
                    gap = 0
                elif msg.is_question:
                    pending_q = msg.text
                    gap = 0
                else:
                    gap += 1
                    if gap > QA_MAX_GAP:
                        pending_q = None
            elif msg.msg_type == "Outgoing" and pending_q:
                if not is_seller_ad(msg.text) or len(msg.text.split()) <= 25:
                    pairs.append(
                        {
                            "session": session,
                            "question": anonymize(pending_q),
                            "answer": anonymize(msg.text),
                            "intent": classify_intent(pending_q),
                        }
                    )
                pending_q = None
                gap = 0

    return pairs


def analyze_questions(
    messages: list[Message],
    tier: str,
) -> dict[str, Any]:
    """tier: 'a', 'b', or 'c'"""
    questions: list[str] = []
    for msg in messages:
        if msg.msg_type != "Incoming" or msg.is_ad or not msg.is_question:
            continue
        if tier == "a" and not msg.tier_a:
            continue
        if tier == "b" and not msg.tier_b:
            continue
        questions.append(msg.text)

    intent_counts: Counter[str] = Counter()
    intent_examples: dict[str, list[str]] = defaultdict(list)
    intent_templates: dict[str, Counter[str]] = defaultdict(Counter)

    for text in questions:
        intent = classify_intent(text)
        intent_counts[intent] += 1
        anon = anonymize(text)
        if len(intent_examples[intent]) < TOP_EXEMPLARS:
            if anon not in intent_examples[intent]:
                intent_examples[intent].append(anon)
        if len(text.split()) <= MAX_TEMPLATE_WORDS and intent != "greeting":
            intent_templates[intent][normalize_template(text)] += 1

    total = len(questions) or 1
    ranked = intent_counts.most_common()

    top_templates: dict[str, list[tuple[str, int]]] = {}
    for intent, counter in intent_templates.items():
        top_templates[intent] = counter.most_common(TOP_TEMPLATES)

    return {
        "total_questions": len(questions),
        "intent_counts": dict(ranked),
        "intent_percentages": {k: round(100 * v / total, 1) for k, v in ranked},
        "examples": dict(intent_examples),
        "top_templates": top_templates,
    }


def build_json_payload(
    stats: AnalysisStats,
    tier_a: dict[str, Any],
    tier_b: dict[str, Any],
    tier_c: dict[str, Any],
    qa_pairs: list[dict[str, str]],
    zip_path: Path,
) -> dict[str, Any]:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_zip": str(zip_path),
        "whatsapp_files": WHATSAPP_FILES,
        "stats": stats.__dict__,
        "tiers": {
            "A_business": tier_a,
            "B_private": tier_b,
            "C_all": tier_c,
        },
        "qa_pairs_sample": qa_pairs[:200],
        "qa_pairs_total": len(qa_pairs),
        "playbooks": PLAYBOOKS,
    }


def pick_primary_tier(tier_a: dict[str, Any], tier_b: dict[str, Any]) -> tuple[dict[str, Any], str]:
    """Prefer Tier B when Tier A is tiny or mostly internal/other chatter."""
    a_total = tier_a["total_questions"]
    b_total = tier_b["total_questions"]
    a_other_pct = 0.0
    if a_total:
        a_other_pct = 100 * tier_a["intent_counts"].get("other", 0) / a_total
    if a_total >= 200 and a_other_pct < 55:
        return tier_a, "A — Inauzwa/Zagamba business (customer-facing)"
    if b_total >= 50:
        return tier_b, "B — private customer chats"
    return tier_a if a_total >= b_total else tier_b, "A — business (fallback)"


def render_report(
    stats: AnalysisStats,
    tier_a: dict[str, Any],
    tier_b: dict[str, Any],
    tier_c: dict[str, Any],
    qa_pairs: list[dict[str, str]],
    zip_path: Path,
) -> str:
    lines: list[str] = []
    primary, primary_label = pick_primary_tier(tier_a, tier_b)

    lines.append("# WhatsApp FAQ Analysis Report")
    lines.append("")
    lines.append(f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}")
    lines.append(f"Source: `{zip_path}`")
    lines.append(f"Files analyzed: {', '.join(WHATSAPP_FILES)}")
    lines.append("")
    lines.append("> **Phase 1 — review only.** No changes applied to `data/ai-knowledge/` or AI code.")
    lines.append("")

    lines.append("## Executive summary")
    lines.append("")
    lines.append(
        f"This scan processed **{stats.deduped_rows:,}** deduplicated rows "
        f"({stats.raw_rows:,} raw across both CSVs) and **{stats.incoming_text:,}** "
        f"incoming text messages."
    )
    lines.append("")
    lines.append(
        f"- **Tier A (Inauzwa/Zagamba business chats):** {tier_a['total_questions']:,} customer questions"
    )
    lines.append(
        f"- **Tier B (private / non-group chats):** {tier_b['total_questions']:,} customer questions"
    )
    lines.append(
        f"- **Tier C (all deduped incoming):** {tier_c['total_questions']:,} customer questions"
    )
    lines.append("")

    lines.append(f"### Top 15 FAQ intents (primary tier: {primary_label})")
    lines.append("")
    lines.append("| Rank | Intent | Count | % | Swahili triggers | English triggers |")
    lines.append("|------|--------|------:|--:|------------------|------------------|")
    for rank, (intent, count) in enumerate(
        sorted(primary["intent_counts"].items(), key=lambda x: -x[1])[:15],
        start=1,
    ):
        pct = primary["intent_percentages"].get(intent, 0)
        pb = PLAYBOOKS.get(intent, PLAYBOOKS["other"])
        lines.append(
            f"| {rank} | `{intent}` | {count:,} | {pct}% | {pb['sw_triggers']} | {pb['en_triggers']} |"
        )
    lines.append("")

    lines.append("## Noise audit")
    lines.append("")
    lines.append("| Filter | Excluded / classified |")
    lines.append("|--------|----------------------:|")
    lines.append(f"| Raw CSV rows (both files) | {stats.raw_rows:,} |")
    lines.append(f"| After deduplication | {stats.deduped_rows:,} unique rows |")
    lines.append(f"| Incoming text (3–300 chars) | {stats.incoming_text:,} |")
    lines.append(f"| System / encryption notifications | {stats.excluded_system:,} |")
    lines.append(f"| Wrong length (incoming) | {stats.excluded_length:,} |")
    lines.append(f"| Seller broadcast ads (incoming) | {stats.excluded_ads:,} |")
    lines.append(f"| Group / commerce sessions | {stats.group_sessions:,} sessions |")
    lines.append(f"| Private-like sessions | {stats.private_sessions:,} sessions |")
    lines.append(f"| Business (Inauzwa/Zagamba) sessions | {stats.biz_sessions:,} sessions |")
    lines.append(f"| Tier B Q→A pairs mined | {stats.qa_pairs:,} |")
    lines.append("")
    lines.append(
        "**Caveats:** Group channels contain mostly seller broadcasts, not customer FAQs. "
        "Inauzwa/Zagamba-named threads mix customer care with internal staff coordination. "
        "Q→A pairs are informal staff replies — use playbooks below, not raw copy."
    )
    lines.append("")

    lines.append("## Category details")
    lines.append("")
    sorted_intents = sorted(
        primary["intent_counts"].items(),
        key=lambda x: -x[1],
    )[:15]

    for intent, count in sorted_intents:
        pct = primary["intent_percentages"].get(intent, 0)
        pb = PLAYBOOKS.get(intent, PLAYBOOKS["other"])
        lines.append(f"### {intent} ({count:,} — {pct}%)")
        lines.append("")
        lines.append(f"**Future AI target:** {pb['ai_target']}")
        lines.append("")
        lines.append(f"**Suggested playbook:** {pb['playbook']}")
        lines.append("")
        lines.append("**Customer exemplars (anonymized):**")
        for ex in primary["examples"].get(intent, [])[:TOP_EXEMPLARS]:
            lines.append(f"- \"{ex}\"")
        lines.append("")
        templates = primary["top_templates"].get(intent, [])[:10]
        if templates:
            lines.append("**Top repeated phrasings:**")
            for tpl, n in templates:
                lines.append(f"- ({n}×) `{tpl}`")
            lines.append("")
        draft = DRAFT_FAQ.get(intent)
        if draft:
            lines.append("**Draft FAQ (proposed — not applied):**")
            for row in draft:
                lines.append(f"- {row}")
            lines.append("")

    lines.append("## Tier comparison")
    lines.append("")
    lines.append("| Intent | Tier A (business) | Tier B (private) | Tier C (all) |")
    lines.append("|--------|------------------:|-----------------:|-------------:|")
    all_intents = set(tier_a["intent_counts"]) | set(tier_b["intent_counts"]) | set(tier_c["intent_counts"])
    for intent in sorted(all_intents, key=lambda i: -tier_c["intent_counts"].get(i, 0)):
        lines.append(
            f"| `{intent}` | {tier_a['intent_counts'].get(intent, 0):,} | "
            f"{tier_b['intent_counts'].get(intent, 0):,} | "
            f"{tier_c['intent_counts'].get(intent, 0):,} |"
        )
    lines.append("")

    lines.append("## Q→A samples (Tier B private chats — reference only)")
    lines.append("")
    lines.append(
        "These are real staff replies paired with customer questions. "
        "**Do not paste verbatim into FAQ** — many are internal or incomplete."
    )
    lines.append("")
    shown = 0
    for pair in qa_pairs:
        if pair["intent"] in ("price_general", "availability", "price_with_product", "greeting"):
            lines.append(f"**[{pair['intent']}]** Q: \"{pair['question'][:120]}\"")
            lines.append(f"  A: \"{pair['answer'][:160]}\"")
            lines.append("")
            shown += 1
            if shown >= 15:
                break

    lines.append("## Recommended phase 2 actions (after your approval)")
    lines.append("")
    lines.append("1. Copy approved **Draft FAQ** sections into `data/ai-knowledge/FAQ.md` and policy notes into `SHOP.md`.")
    lines.append("2. Fill in placeholders (address, delivery fees, warranty periods, payment methods).")
    lines.append("3. Reindex shop knowledge: Dashboard → Settings → Integrations → AI → **Reindex knowledge**.")
    lines.append("4. Spot-test 10–15 prompts from exemplars above in inbox AI preview.")
    lines.append("5. Only add reply-rule bullets to `ai-inbox-reply-rules.ts` where behavior cannot live in FAQ.")
    lines.append("")
    lines.append("## AI integration map")
    lines.append("")
    lines.append("| Component | Role |")
    lines.append("|-----------|------|")
    lines.append("| `src/modules/ai/ai-inbox-reply-rules.ts` | Tone, intent, stock, language rules |")
    lines.append("| `data/ai-knowledge/FAQ.md` | Policies, hours, delivery, payment, warranty |")
    lines.append("| `data/ai-knowledge/SHOP.md` | Product reply guidance |")
    lines.append("| `search_products` tool | Live price/stock quotes |")
    lines.append("| `search_shop_knowledge` tool | Semantic FAQ lookup at reply time |")
    lines.append("")

    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description="Analyze WhatsApp archive for customer FAQ patterns")
    parser.add_argument(
        "--zip",
        type=Path,
        default=Path.home() / "Desktop/Message backup/Archive.zip",
        help="Path to Archive.zip",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("WHATSAPP_FAQ_ANALYSIS_REPORT.md"),
        help="Output markdown report path",
    )
    parser.add_argument(
        "--json",
        type=Path,
        default=Path("whatsapp-faq-analysis.json"),
        help="Output JSON path",
    )
    args = parser.parse_args()

    if not args.zip.exists():
        raise SystemExit(f"Zip not found: {args.zip}")

    print(f"Loading {args.zip} ...")
    messages, stats = load_messages(args.zip)
    print(f"  Deduped rows: {stats.deduped_rows:,} | Incoming: {stats.incoming_text:,}")

    tier_a = analyze_questions(messages, "a")
    tier_b = analyze_questions(messages, "b")
    tier_c = analyze_questions(messages, "c")
    qa_pairs = mine_qa_pairs(messages, tier="b")
    stats.qa_pairs = len(qa_pairs)

    payload = build_json_payload(stats, tier_a, tier_b, tier_c, qa_pairs, args.zip)
    report = render_report(stats, tier_a, tier_b, tier_c, qa_pairs, args.zip)

    args.json.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    args.report.write_text(report, encoding="utf-8")

    print(f"Wrote {args.report} ({len(report):,} chars)")
    print(f"Wrote {args.json} ({args.json.stat().st_size:,} bytes)")
    print(f"Tier A questions: {tier_a['total_questions']:,}")
    print(f"Tier B questions: {tier_b['total_questions']:,}")


if __name__ == "__main__":
    main()
