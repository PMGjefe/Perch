#!/usr/bin/env bash
# Applies the stub platform schema, all migrations and the seed to a scratch database on a
# local Postgres, then runs a few RLS assertions. Usage: PGHOST=/tmp PGPORT=54329 ./scripts/test-migrations.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PGUSER=${PGUSER:-postgres}
DB=perch_test
psql -v ON_ERROR_STOP=1 -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -v ON_ERROR_STOP=1 -q -d $DB -f scripts/supabase-local-stub.sql
for f in supabase/migrations/*.sql; do echo "applying $f"; psql -v ON_ERROR_STOP=1 -q -d $DB -f "$f"; done
echo "applying supabase/seed.sql"; psql -v ON_ERROR_STOP=1 -q -d $DB -f supabase/seed.sql
echo "running RLS assertions"; psql -v ON_ERROR_STOP=1 -q -d $DB -f scripts/rls-assertions.sql
echo OK
