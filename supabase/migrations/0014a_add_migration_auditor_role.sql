-- Least-privilege role for the CI migration-history check.
-- Created WITHOUT a password deliberately: the password is set by a human via
-- the Supabase SQL Editor and stored in GitHub Actions secrets. No AI session
-- reads or types the value. Until a password is set the role cannot log in.
--
-- Privilege is exactly one table, read-only. Narrower than the anon key, which
-- is public and reads every RLS-permitted row across every table.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'migration_auditor') then
    create role migration_auditor login;
  end if;
end $$;

grant usage on schema supabase_migrations to migration_auditor;
grant select on supabase_migrations.schema_migrations to migration_auditor;

-- Explicitly withhold everything else: no public schema access, no future
-- grants inherited from PUBLIC on new objects.
revoke all on schema public from migration_auditor;