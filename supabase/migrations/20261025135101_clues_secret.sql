-- Secret ("cat in the bag") clues: the player who chooses one must hand it to
-- another player. secret_topic is shown on the hand-over screen (null = the
-- category name) and secret_value overrides the cell value for scoring
-- (null = the cell value). A null secret means a normal clue.
-- Additive and nullable: existing rows and older app versions are unaffected.
alter table "public"."clues"
add column "secret" boolean,
add column "secret_topic" text,
add column "secret_value" bigint;
