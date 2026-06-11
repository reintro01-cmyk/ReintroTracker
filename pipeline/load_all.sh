#!/usr/bin/env bash
# Load sequence for the nutrition database into the linked Supabase project.
#
# Prereqs:
#   1. supabase CLI linked to the project (already done: ref fmaqipsfrfpfpoqzotnk)
#   2. psql installed            ->  brew install libpq && brew link --force libpq
#   3. SUPABASE_DB_URL exported  ->  Dashboard > Project Settings > Database >
#                                     Connection string > URI  (use the DIRECT connection,
#                                     port 5432, not the transaction pooler, for bulk loads)
#
# Order matters: schema -> ingredients (IFCT, then USDA, then optional OFF) -> recipes.
# NOTE: the db.<ref> direct host is IPv6-only now; if it won't resolve, use the
# Session pooler URI (Dashboard > Connect > Session pooler) as SUPABASE_DB_URL.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> 1/5  Applying schema migrations (tables + ingredient_resolved view + OFF support)"
supabase db push

: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to your Postgres URI (Dashboard > Database > Connection string)}"
command -v psql >/dev/null || { echo "psql not found -> brew install libpq && brew link --force libpq"; exit 1; }

PSQL=(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --quiet)

echo "==> 2/5  Loading IFCT ingredients (542, MIT)"
"${PSQL[@]}" -f pipeline/out/ifct_ingredients.sql

echo "==> 3/5  Loading USDA ingredients (8,262, public domain)"
"${PSQL[@]}" -f pipeline/out/usda_ingredients.sql

echo "==> 4/5  Loading recipe corpus (725, facts-only, draft/rejected)"
"${PSQL[@]}" -f pipeline/out/recipes_load.sql

# OFF (branded) loads SEPARATELY and directly into Postgres via DuckDB — it doesn't
# go through psql. Run it on demand (subset with --limit/--countries; a full load can
# exceed Supabase's free 500MB tier):
echo "==> 5/5  Open Food Facts loads directly via DuckDB, e.g.:"
echo "         pipeline/.venv/bin/python pipeline/ingest_off.py --limit 100000"

echo "==> Verifying"
psql "$SUPABASE_DB_URL" -f pipeline/verify.sql
echo "Done. Review the verification output above."
