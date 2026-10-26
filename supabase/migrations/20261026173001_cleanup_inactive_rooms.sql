-- Delete rooms nobody used for a while (feature 19, room cleanup).
--
-- Additive: one new column with a default (existing rows get the time of the
-- migration) and one new function; no policy changes.
--
-- rooms.created_at: rooms had no creation time, so a room nobody ever joined
-- (no events) couldn't be aged. `default now()` fills it for new rooms; rooms
-- that exist when this runs get the migration's time, so they are kept for
-- at least `max_idle` after the deploy.
alter table public.rooms
  add column if not exists created_at timestamp with time zone not null
  default now();

-- cleanup_inactive_rooms deletes every room that was created more than
-- `max_idle` ago and has no event newer than `max_idle` (its last event is
-- older, or it has none) and returns how many it deleted. With
-- `dry_run => true` it only counts them (the admin panel's confirmation).
-- Their events and results go with them (room_events and solves reference
-- rooms with ON DELETE CASCADE). `max_idle` below one hour is refused, so a
-- typo can't wipe rooms in play.
--
-- room_events.ts is `timestamp without time zone` written by now() in UTC.
--
-- Security: SECURITY DEFINER with search_path pinned; callable ONLY by the
-- service role (the admin panel after the admin check, and the hourly
-- cleanup job). EXECUTE is revoked from public, anon and authenticated.
create or replace function public.cleanup_inactive_rooms(
  max_idle interval,
  dry_run boolean default false
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  if max_idle is null or max_idle < interval '1 hour' then
    raise exception 'max_idle must be at least 1 hour (got %)', max_idle;
  end if;

  if dry_run then
    select count(*) into removed
    from public.rooms r
    where r.created_at < now() - max_idle
      and not exists (
        select 1 from public.room_events e
        where e.room_id = r.id
          and e.ts >= (now() at time zone 'utc') - max_idle
      );
    return removed;
  end if;

  with deleted as (
    delete from public.rooms r
    where r.created_at < now() - max_idle
      and not exists (
        select 1 from public.room_events e
        where e.room_id = r.id
          and e.ts >= (now() at time zone 'utc') - max_idle
      )
    returning r.id
  )
  select count(*) into removed from deleted;
  return removed;
end;
$$;

revoke all on function public.cleanup_inactive_rooms(interval, boolean) from public, anon, authenticated;
grant execute on function public.cleanup_inactive_rooms(interval, boolean) to service_role;
