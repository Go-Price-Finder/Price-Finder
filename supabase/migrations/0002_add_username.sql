-- Price Finder — username support
-- Populates public.users.display_name from the username chosen at sign-up
-- and enforces the same format rules at the database level that
-- lib/validation.ts already enforces client-side and in signUpAction.
--
-- Run this after 0001_initial_schema.sql (SQL editor, or `supabase db push`).

-- ---------------------------------------------------------------------------
-- Format + uniqueness constraints
--
-- Mirrors lib/validation.ts: USERNAME_MIN = 3, USERNAME_MAX = 20,
-- USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/. Existing rows with a null
-- display_name (accounts created before this migration) are unaffected —
-- the check only fires on non-null values, so nothing breaks retroactively.
-- ---------------------------------------------------------------------------
alter table public.users
  add constraint users_display_name_format check (
    display_name is null
    or (
      char_length(display_name) between 3 and 20
      and display_name ~ '^[A-Za-z0-9_-]+$'
    )
  );

-- Case-insensitive uniqueness ("Jane" and "jane" shouldn't both be
-- claimable) — a unique index rather than a unique constraint so it can
-- target lower(display_name) and skip nulls.
create unique index users_display_name_lower_idx
  on public.users (lower(display_name))
  where display_name is not null;

-- ---------------------------------------------------------------------------
-- Trigger update
--
-- signUpAction now passes the chosen username via
-- options.data.display_name on auth.signUp(), which Supabase stores on
-- auth.users.raw_user_meta_data. Replace handle_new_user() so the profile
-- row it creates picks that value up.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, created_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'display_name',
    new.created_at
  );
  return new;
end;
$$;

-- The trigger itself (on_auth_user_created) already points at this
-- function by name, so no change is needed there — replacing the function
-- body is enough.
