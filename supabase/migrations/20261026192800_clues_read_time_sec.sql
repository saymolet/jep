-- Per-question reading time hint (seconds) imported from SIGame packs (v4
-- <atom time="…">, v5 <item duration="hh:mm:ss">) or set in a .jep.json
-- (`readTimeSec`). Used by a room's "Auto" reading time instead of the
-- text/media-based estimate. null = no hint.
-- Additive and nullable: existing rows and older app versions are unaffected;
-- the clues table's existing policies cover the new column.
alter table "public"."clues"
add column "read_time_sec" smallint
  constraint clues_read_time_sec_range check (read_time_sec between 0 and 60);
