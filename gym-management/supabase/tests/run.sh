#!/usr/bin/env bash
# Chạy toàn bộ migrations + kiểm thử SQL trên một database Postgres trống.
# Cách dùng: PGHOST=... PGPORT=... PGUSER=postgres ./supabase/tests/run.sh
# Database "gym_test" sẽ bị xóa và tạo lại.
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
cd "$(dirname "$0")/.."
DB=gym_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "DROP DATABASE IF EXISTS $DB" -c "CREATE DATABASE $DB"
PSQL="psql -v ON_ERROR_STOP=1 -q -d $DB"

# Giả lập phần Supabase có sẵn: role, schema auth, auth.uid()
$PSQL <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
  AS $f$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $f$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
SQL

for f in migrations/*.sql; do
  echo "→ $f"
  $PSQL -f "$f" >/dev/null
done

$PSQL -f tests/rls_and_rpc_test.sql >/dev/null
echo "✓ Migrations và kiểm thử SQL đều qua"
