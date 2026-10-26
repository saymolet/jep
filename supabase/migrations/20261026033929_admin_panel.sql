-- Admin panel (feature 18): three read-only SQL functions for the dashboard,
-- the rooms list and the storage cleanup.
--
-- Additive: new functions only; no table, index or policy changes.
--
-- Security: the functions are SECURITY DEFINER (they read storage.objects and
-- the database size, which the API roles can't) and are callable ONLY by the
-- service role, which the app uses on the server after checking the admin
-- password. EXECUTE is revoked from public, anon and authenticated (Supabase
-- grants it to them on new functions by default).

-- admin_stats returns the dashboard counts as one JSON object.
-- room_events.ts is `timestamp without time zone` written by now() in UTC.
create or replace function public.admin_stats()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'games_public', (select count(*) from public.games where visibility = 'PUBLIC'),
    'games_unlisted', (select count(*) from public.games where visibility = 'UNLISTED'),
    'games_private', (select count(*) from public.games where visibility = 'PRIVATE'),
    'accounts', (select count(*) from public.accounts),
    'rooms', (select count(*) from public.rooms),
    'rooms_active_24h', (
      select count(distinct e.room_id) from public.room_events e
      where e.ts >= (now() at time zone 'utc') - interval '24 hours'
    ),
    'rooms_active_7d', (
      select count(distinct e.room_id) from public.room_events e
      where e.ts >= (now() at time zone 'utc') - interval '7 days'
    ),
    'room_events', (select count(*) from public.room_events),
    'reports', (select count(*) from public.reports),
    'media_objects', (
      select count(*) from storage.objects o where o.bucket_id = 'game-media'
    ),
    'media_bytes', (
      select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
      from storage.objects o where o.bucket_id = 'game-media'
    ),
    'database_bytes', pg_database_size(current_database())
  );
$$;

-- admin_media_objects lists every file in the "game-media" bucket (path,
-- size in bytes, upload time) for the orphaned-media scan. Deleting goes
-- through the Storage API, never through this table.
create or replace function public.admin_media_objects()
returns table (name text, size bigint, created_at timestamp with time zone)
language sql
stable
security definer
set search_path = ''
as $$
  select o.name, coalesce((o.metadata ->> 'size')::bigint, 0), o.created_at
  from storage.objects o
  where o.bucket_id = 'game-media'
  order by o.name;
$$;

-- admin_recent_rooms lists rooms, most recently active first (rooms without
-- events last), with their game and number of events. `max_count` is capped
-- at 100.
create or replace function public.admin_recent_rooms(
  max_count integer,
  skip integer
)
returns table (
  room_id bigint,
  room_name text,
  game_id uuid,
  game_title text,
  last_activity timestamp without time zone,
  event_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with activity as (
    select e.room_id, max(e.ts) as last_ts, count(*) as n
    from public.room_events e
    group by e.room_id
  )
  select r.id, r.name::text, r.game_id, g.title::text, a.last_ts,
    coalesce(a.n, 0)
  from public.rooms r
  join public.games g on g.id = r.game_id
  left join activity a on a.room_id = r.id
  order by a.last_ts desc nulls last, r.id desc
  limit least(greatest(coalesce(max_count, 0), 0), 100)
  offset greatest(coalesce(skip, 0), 0);
$$;

revoke all on function public.admin_stats() from public, anon, authenticated;
revoke all on function public.admin_media_objects() from public, anon, authenticated;
revoke all on function public.admin_recent_rooms(integer, integer) from public, anon, authenticated;
grant execute on function public.admin_stats() to service_role;
grant execute on function public.admin_media_objects() to service_role;
grant execute on function public.admin_recent_rooms(integer, integer) to service_role;
