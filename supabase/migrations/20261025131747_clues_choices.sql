-- Options for multiple choice clues: a JSON array of 2-6 strings, one of
-- which equals the clue's answer, or null for a normal clue.
-- Additive and nullable: existing rows and older app versions are unaffected.
alter table "public"."clues"
add column "choices" jsonb;
