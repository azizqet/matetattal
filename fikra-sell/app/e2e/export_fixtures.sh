#!/usr/bin/env bash
# Exports reference tables (no users, no ads) from the local test database into e2e/fixtures.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p fixtures
for t in categories category_fields governorates areas app_settings pages; do
  psql -d "${PGDATABASE:-fikra_test}" -Atc "select coalesce(json_agg(x order by 1),'[]') from (select * from public.$t) x" > "fixtures/$t.json"
done
echo "fixtures exported"
