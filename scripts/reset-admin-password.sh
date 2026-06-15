#!/usr/bin/env bash
# Reset a dashboard user's password in main.sqlite (local or VPS via docker).
# Usage:
#   ./scripts/reset-admin-password.sh NEW_PASSWORD
#   ./scripts/reset-admin-password.sh NEW_PASSWORD --docker openwa-api
#   EMAIL=other@x.com ./scripts/reset-admin-password.sh NEW_PASSWORD

set -euo pipefail

EMAIL="${EMAIL:-admin@inauzwa.com}"
PASS="${1:-}"
DOCKER_CONTAINER="${2:-}"

if [[ -z "$PASS" ]]; then
  echo "Usage: $0 NEW_PASSWORD [--docker CONTAINER_NAME]" >&2
  exit 1
fi

if [[ "${2:-}" == "--docker" ]]; then
  DOCKER_CONTAINER="${3:?container name required}"
fi

NODE_SCRIPT="
const bcrypt=require('bcrypt');
const sqlite3=require('sqlite3');
const pass=process.env.RESET_PASS;
const email=process.env.RESET_EMAIL;
bcrypt.hash(pass,12).then(hash=>{
  const db=new sqlite3.Database('/app/data/main.sqlite');
  db.run(
    'UPDATE users SET passwordHash=?, refreshTokenVersion=refreshTokenVersion+1 WHERE email=?',
    [hash, email],
    function(err){
      if(err){console.error(err);process.exit(1);}
      if(this.changes===0){console.error('No user found for',email);process.exit(1);}
      console.log('Password updated for',email);
      db.close();
    }
  );
}).catch(e=>{console.error(e);process.exit(1);});
"

if [[ -n "$DOCKER_CONTAINER" ]]; then
  docker exec -e RESET_PASS="$PASS" -e RESET_EMAIL="$EMAIL" "$DOCKER_CONTAINER" \
    node -e "$NODE_SCRIPT"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  DB="${SCRIPT_DIR}/../data/main.sqlite"
  [[ -f "$DB" ]] || { echo "Missing $DB — run from project with data volume" >&2; exit 1; }
  RESET_PASS="$PASS" RESET_EMAIL="$EMAIL" node -e "
const bcrypt=require('bcrypt');
const sqlite3=require('sqlite3');
const pass=process.env.RESET_PASS;
const email=process.env.RESET_EMAIL;
const dbPath='$DB';
bcrypt.hash(pass,12).then(hash=>{
  const db=new sqlite3.Database(dbPath);
  db.run(
    'UPDATE users SET passwordHash=?, refreshTokenVersion=refreshTokenVersion+1 WHERE email=?',
    [hash, email],
    function(err){
      if(err){console.error(err);process.exit(1);}
      if(this.changes===0){console.error('No user found for',email);process.exit(1);}
      console.log('Password updated for',email,'in',dbPath);
      db.close();
    }
  );
}).catch(e=>{console.error(e);process.exit(1);});
"
fi
