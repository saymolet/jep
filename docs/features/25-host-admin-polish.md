# Feature 25 — Host and admin polish

**Branch:** `feat/host-admin-polish`
**Status:** ✅ implemented & tested
**Migration:** none
**New dependencies:** none

Owner (verbatim): "Increase the time to start button pressing, include options of 40 seconds
and up / Make the button of "skip question" apper near false or true for host / Can we increase
the limit to 200mb? / Add the possibility to kick players for admin / Add the ability to change
the name and image before joining the game, for now i can only do that when in game / Remove the
pause for timer and leave only the global pause"

- **Buzz window ("Time to buzz in")** also offers 30, 40, 60, 90 and 120 s
  (`BUZZ_WINDOW_OPTIONS`, room timers panel; see feature 21).
- **Host Skip:** a **⏭ Skip** button (`host-skip`, confirm `host-skip-yes`) sits next to
  Right / Wrong while a player answers, and under the status line while the question is read or
  the buzzers are open. It uses the admin route's `skip` intent tagged `host: true`, like the
  admin panel's skip: no score changes, board control stays.
- **SIGame packs up to 200 MB** (`MAX_SIQ_SIZE`); 600 MB unzipped in total. A single media file
  is still at most 50 MB (Supabase). nginx `client_max_body_size` is 210m on the server.
- **Admin kick:** each player row in the admin panel's Scores section has **🚪 Kick player**
  (`admin-kick`, confirm `admin-kick-yes`). It is admin only, not for the host. It sends the
  existing admin Kick (`DELETE /room/:id/player`). The button is disabled during a question
  ("Players can be kicked between questions.") and for the last player.
- **Name before joining:** the join dialog has a **Your name** field (`join-name`) next to the
  avatar picker, which was already there. The name is used to join or to host, and is
  remembered on this device (`jep-name` in localStorage, `app/utils/join-name.ts`). An empty
  field falls back to the default name.
- **No clock pause:** the game clock is display only (`ClockDisplay`, `game-clock`). Its ⏸/▶
  toggle and the `/room/:id/toggle-clock` route are gone. The game's Pause still stops the
  clock. Old `toggle_clock` events still replay.

## Tests

- Unit: `app/utils/join-name.test.ts`; the room timers panel lists the new buzz options.
- e2e: `admin-interventions-room.spec.ts` ("a guest names themselves before joining; the admin
  kicks them"), `host-role-room.spec.ts` (the host's Skip next to Right / Wrong).
