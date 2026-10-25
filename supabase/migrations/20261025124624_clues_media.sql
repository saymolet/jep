-- Media (pictures, audio, video) shown with a clue and with its answer.
-- Each column holds a JSON array of {type, src, alt?} blocks, or null.
-- Additive and nullable: existing rows and older app versions are unaffected.
alter table "public"."clues"
add column "media" jsonb,
add column "answer_media" jsonb;
