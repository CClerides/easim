-- 0003 — Functions and triggers

-- Claim exactly one available eSIM profile for a plan, atomically.
--
-- The whole point is the `for update skip locked` in the subquery:
--
--   for update   locks the chosen row so no other transaction can take it
--   skip locked  makes a concurrent claim pick a *different* row instead of
--                waiting behind this one
--
-- Two customers checking out the same plan at the same instant therefore get
-- two different profiles, with no queueing and no chance of both receiving
-- the same one. Without skip locked they would serialise; without for update
-- they could both read the same row as available.
--
-- Returns zero rows when the pool is empty, which the caller treats as
-- out-of-stock rather than as an error.
--
-- `setof` rather than a bare composite type, deliberately: a function
-- returning `esim_profiles` yields a row of all-NULL columns when nothing was
-- claimed, which callers have to special-case. `setof` yields an empty array
-- instead, so "no stock" reads as an empty list everywhere.
create or replace function claim_esim_profile(p_plan_id uuid)
returns setof esim_profiles
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update esim_profiles
  set status = 'reserved'
  where id = (
    select id from esim_profiles
    where plan_id = p_plan_id and status = 'available'
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

-- Give every new auth user a profiles row, so RLS has something to read and
-- the app always has a role for them.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();
