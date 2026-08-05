#!/usr/bin/env bash
#
# Applies supabase/migrations to the hosted project over a direct Postgres
# connection. Deliberately Docker-free: `supabase db push --db-url` dials the
# database over the network, so nothing local needs to be running.
#
# Usage: pnpm db:push [--include-seed]

set -euo pipefail

ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "error: $ENV_FILE not found. Copy .env.example and fill it in." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
. "./$ENV_FILE"
set +a

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  cat >&2 <<'MSG'
error: SUPABASE_DB_URL is not set in .env.local

  Dashboard -> Project Settings -> Database -> Connection string -> URI

  Copy the session-mode string (port 5432) verbatim. This is the database
  password, which is NOT the same as the publishable/secret API keys.
MSG
  exit 1
fi

# The transaction pooler cannot run this schema's DDL: CREATE EXTENSION,
# EXCLUDE constraints, and SECURITY DEFINER functions all need a session.
case "$SUPABASE_DB_URL" in
  *:6543/*)
    echo "error: that is the transaction pooler (port 6543)." >&2
    echo "       Migrations need the session-mode string on port 5432." >&2
    exit 1
    ;;
esac

echo "Pushing migrations to the hosted project (no Docker involved)..."
exec pnpm exec supabase db push --db-url "$SUPABASE_DB_URL" "$@"
