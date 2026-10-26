-- Only the site admin may change a room's settings (the answer timer).
--
-- room_events accepts inserts from the anon and authenticated roles (the
-- browser key), so a modified client could insert a `set_settings` event
-- directly and skip the admin check of POST /room/:roomId/settings. From now
-- on that route inserts the event with the service role (which bypasses RLS)
-- and the insert policy for everyone else rejects this one event type. Every
-- other event type is accepted exactly as before.
--
-- Additive and backward compatible: no data changes, events already in the
-- table stay as they are (and stay valid on replay), the select policy and
-- realtime publication are untouched.
alter policy "Enable insert for all users" on public.room_events
  with check (type <> 'set_settings');
