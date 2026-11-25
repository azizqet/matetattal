#!/usr/bin/env bash
# FAZZA database restore (DATA). The target must already have the schema: run `supabase db push`
# (or `supabase db reset` locally) first so migrations, RLS, functions and buckets exist.
# Usage:
#   CONFIRM=yes SUPABASE_DB_URL='postgresql://...' ./restore.sh backups/20261125T010203Z
#   CONFIRM=yes BACKUP_PASSPHRASE='...' SUPABASE_DB_URL='...' ./restore.sh backups/20261125T010203Z.tar.enc
#   CONFIRM=yes LOCAL=1 ./restore.sh <dir>
set -euo pipefail
SRC="${1:?backup directory or .tar.enc file}"
[[ "${CONFIRM:-}" == "yes" ]] || { echo "Refusing: this REPLACES all data in the target. Re-run with CONFIRM=yes"; exit 2; }
if [[ "${LOCAL:-}" == "1" ]]; then DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"; else DB_URL="${SUPABASE_DB_URL:?set SUPABASE_DB_URL or LOCAL=1}"; fi

WORK="$SRC"
if [[ "$SRC" == *.tar.enc ]]; then
  : "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE required to decrypt}"
  TMP="$(mktemp -d)"
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$SRC" | tar -C "$TMP" -xf -
  WORK="$(find "$TMP" -mindepth 1 -maxdepth 1 -type d | head -1)"
fi
(cd "$WORK" && sha256sum -c SHA256SUMS)

TABLES=$(psql "$DB_URL" -Atc "select string_agg(format('%I.%I', schemaname, tablename), ', ') from pg_tables where schemaname = 'public'")
psql "$DB_URL" -v ON_ERROR_STOP=1 <<SQL
begin;
set session_replication_role = replica;
truncate $TABLES, storage.objects, storage.buckets, auth.users cascade;
\i $WORK/data.sql
select setval(pg_get_serial_sequence(format('%I.%I', schemaname, tablename), 'id'), coalesce((select max(id) from public.ledger_entries), 1))
  from pg_tables where schemaname = 'public' and tablename = 'ledger_entries';
commit;
SQL
echo "Restore completed from $WORK"
