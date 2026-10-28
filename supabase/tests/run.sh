#!/usr/bin/env bash
# Runs the migrations and the row-level security tests against a SCRATCH
# Postgres database. Needs `psql`.
#
#   createdb padd_test
#   DATABASE_URL=postgres://localhost/padd_test supabase/tests/run.sh
#
# It loads a stand-in for Supabase's built-in pieces, so it must never be
# pointed at your real project; the script refuses anything that looks like it.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a scratch Postgres database}"
case "$DATABASE_URL" in
  *supabase*) echo "Refusing to run against a Supabase URL." >&2; exit 1 ;;
esac

here="$(cd "$(dirname "$0")" && pwd)"
psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql_run -f "$here/supabase_shim.sql"
for migration in "$here"/../migrations/*.sql; do
  echo "== applying $(basename "$migration")"
  psql_run -f "$migration" 2>&1 | grep -v "^psql:.*NOTICE" || true
done
echo "== applying migrations a second time (must be safe to re-run)"
for migration in "$here"/../migrations/*.sql; do
  psql_run -f "$migration" >/dev/null 2>&1
done
echo "== running RLS tests"
psql_run -f "$here/rls_test.sql" 2>&1 | grep -E "ok |FAIL|PASSED|ERROR" 
