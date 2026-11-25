#!/usr/bin/env bash
# FAZZA database backup (roles + schema + data incl. auth users and storage metadata).
# Usage:
#   SUPABASE_DB_URL='postgresql://postgres.<ref>:<password>@<host>:5432/postgres' BACKUP_PASSPHRASE='...' ./backup.sh
#   LOCAL=1 ./backup.sh            # local development stack
# Output: $BACKUP_DIR/<UTC timestamp>/ (or an encrypted .tar.enc when BACKUP_PASSPHRASE is set)
# Storage FILES (photos/documents) are backed up separately — see docs/BACKUP.md.
set -euo pipefail
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/$STAMP"
mkdir -p "$OUT"
if [[ "${LOCAL:-}" == "1" ]]; then TARGET=(--local); else : "${SUPABASE_DB_URL:?set SUPABASE_DB_URL or LOCAL=1}"; TARGET=(--db-url "$SUPABASE_DB_URL"); fi

supabase db dump "${TARGET[@]}" --role-only -f "$OUT/roles.sql"
supabase db dump "${TARGET[@]}" -f "$OUT/schema.sql"
supabase db dump "${TARGET[@]}" --data-only --use-copy -f "$OUT/data.sql" \
  -x storage.buckets_analytics,storage.buckets_vectors,storage.iceberg_namespaces,storage.iceberg_tables,storage.vector_indexes,public.rate_limits
(cd "$OUT" && sha256sum roles.sql schema.sql data.sql > SHA256SUMS)

if [[ -n "${BACKUP_PASSPHRASE:-}" ]]; then
  tar -C "$BACKUP_DIR" -cf - "$STAMP" | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$OUT.tar.enc"
  rm -rf "$OUT"
  echo "$OUT.tar.enc"
else
  echo "$OUT"
fi
