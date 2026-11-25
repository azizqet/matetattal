#!/usr/bin/env bash
# Applies all migrations to a throw-away local Postgres and runs the SQL test suite.
# Usage: PGHOST=/var/tmp/fikra-pg PGPORT=54329 supabase/tests/run_local.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGUSER=${PGUSER:-postgres}
DB=fikra_test
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d $DB -f tests/00_supabase_stub.sql
for f in migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$f" || { echo "FAILED: $f"; exit 1; }
done
echo "✓ migrations applied"
for t in tests/[1-9]*.sql; do
  echo "── $t"
  psql -q -v ON_ERROR_STOP=1 -d $DB -f "$t"
done
echo "✓ all SQL tests passed"
