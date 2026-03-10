#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <SUPABASE_URL> <SUPABASE_ANON_KEY> [TABLE_NAME]"
  exit 1
fi

SUPABASE_URL="${1%/}"
SUPABASE_KEY="$2"
TABLE="${3:-links}"
REST_URL="$SUPABASE_URL/rest/v1/$TABLE"
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
RAND="$(date +%s)-$RANDOM"
TEST_URL="https://example.com/supabase-smoke-$RAND"
TEST_NOTE="smoke-test-$RAND"

HDR1=( -H "apikey: $SUPABASE_KEY" -H "Authorization: Bearer $SUPABASE_KEY" -H "Content-Type: application/json" )

echo "[1/4] insert test row"
INSERT_CODE=$(curl -sS -o /tmp/supabase_insert.json -w "%{http_code}" \
  "${HDR1[@]}" -H "Prefer: return=representation" \
  -X POST "$REST_URL" \
  -d "{\"url\":\"$TEST_URL\",\"note\":\"$TEST_NOTE\",\"source\":\"smoke\",\"status\":\"pending\",\"created_at\":\"$TS\"}")
cat /tmp/supabase_insert.json || true
printf "\nHTTP %s\n\n" "$INSERT_CODE"

if [ "$INSERT_CODE" -lt 200 ] || [ "$INSERT_CODE" -ge 300 ]; then
  echo "Insert failed"
  exit 2
fi

if command -v jq >/dev/null 2>&1; then
  ROW_ID=$(jq -r '.[0].id // empty' /tmp/supabase_insert.json)
else
  ROW_ID=""
fi

echo "[2/4] select by url"
SELECT_URL="$REST_URL?select=id,url,note,source,status,created_at&url=eq.$(python3 - <<PY
import urllib.parse
print(urllib.parse.quote('''$TEST_URL''', safe=''))
PY
)"
SELECT_CODE=$(curl -sS -o /tmp/supabase_select.json -w "%{http_code}" "${HDR1[@]}" "$SELECT_URL")
cat /tmp/supabase_select.json || true
printf "\nHTTP %s\n\n" "$SELECT_CODE"

if [ "$SELECT_CODE" -lt 200 ] || [ "$SELECT_CODE" -ge 300 ]; then
  echo "Select failed"
  exit 3
fi

echo "[3/4] delete row"
if [ -n "$ROW_ID" ]; then
  DEL_FILTER="id=eq.$ROW_ID"
else
  DEL_FILTER="url=eq.$(python3 - <<PY
import urllib.parse
print(urllib.parse.quote('''$TEST_URL''', safe=''))
PY
)"
fi
DELETE_CODE=$(curl -sS -o /tmp/supabase_delete.json -w "%{http_code}" "${HDR1[@]}" -X DELETE "$REST_URL?$DEL_FILTER")
cat /tmp/supabase_delete.json || true
printf "\nHTTP %s\n\n" "$DELETE_CODE"

if [ "$DELETE_CODE" -lt 200 ] || [ "$DELETE_CODE" -ge 300 ]; then
  echo "Delete failed"
  exit 4
fi

echo "[4/4] verify deleted"
VERIFY_CODE=$(curl -sS -o /tmp/supabase_verify.json -w "%{http_code}" "${HDR1[@]}" "$SELECT_URL")
cat /tmp/supabase_verify.json || true
printf "\nHTTP %s\n\n" "$VERIFY_CODE"

if [ "$VERIFY_CODE" -lt 200 ] || [ "$VERIFY_CODE" -ge 300 ]; then
  echo "Verify failed"
  exit 5
fi

echo "OK: Supabase REST for table '$TABLE' works (insert/select/delete)."
