-- "Your games in progress" on the home page (feature 17): find the rooms a
-- user joined, most recently active first, without scanning every event.
--
-- Additive: one new partial index and one new read-only function; no table
-- or policy changes.
--
-- Index: a player joins a room with a `join` event whose payload carries
-- their userId (guest cookie id or account id). Only `join` rows are indexed
-- (a small fraction of room_events), on the payload's userId. A plain
-- `create index` (not `concurrently`, which can't run inside the migration's
-- transaction) briefly blocks writes to room_events while it is built; at
-- our size that is well under a second.
create index if not exists room_events_join_user_id_idx
  on public.room_events ((payload ->> 'userId'))
  where type = 'join';

-- user_rooms_in_progress lists rooms where one of `user_ids` ever joined and
-- that had any event since `since`, newest activity first, at most
-- `max_count` (capped at 50). Whether the user is still a player and whether
-- the game is over is decided by the server, which replays each room.
--
-- SECURITY INVOKER: row-level security of the caller applies. room_events and
-- rooms are already readable by everyone (anon included), so this exposes
-- nothing new; it only makes the lookup cheap. The `type = 'join'` literal
-- lets the planner use the partial index above.
create or replace function public.user_rooms_in_progress(
  user_ids text[],
  since timestamp without time zone,
  max_count integer
)
returns table (
  room_id bigint,
  room_name text,
  game_id uuid,
  last_activity timestamp without time zone
)
language sql
stable
security invoker
set search_path = ''
as $$
  with joined as (
    select distinct e.room_id
    from public.room_events e
    where e.type = 'join'
      and (e.payload ->> 'userId') = any (user_ids[1:4])
  )
  select r.id, r.name::text, r.game_id, last.ts
  from joined j
  join public.rooms r on r.id = j.room_id
  cross join lateral (
    select max(e.ts) as ts
    from public.room_events e
    where e.room_id = j.room_id
  ) last
  where last.ts >= since
  order by last.ts desc, r.id desc
  limit least(greatest(coalesce(max_count, 0), 0), 50);
$$;
