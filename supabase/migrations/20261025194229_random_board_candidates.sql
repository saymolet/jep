-- Random board generator (feature 10): sample candidate categories and final
-- questions from PUBLIC games in random order, so the server never loads every
-- clue in the database. Only metadata is returned; the server then fetches the
-- clues of the few categories it picks.
--
-- Additive: two new read-only functions, no table changes.
-- SECURITY INVOKER: row-level security of the caller still applies on top of
-- the explicit `visibility = 'PUBLIC'` filter (never UNLISTED or PRIVATE).

create or replace function public.random_board_categories(max_count integer)
returns table (
  id bigint,
  name text,
  game_id uuid,
  game_title text,
  clue_count integer
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select
    c.id::bigint,
    c.name::text,
    c.game_id,
    g.title::text,
    count(cl.id)::integer
  from public.categories c
  join public.games g on g.id = c.game_id
  join public.clues cl on cl.category_id = c.id and cl.long_form is not true
  where g.visibility = 'PUBLIC'
  group by c.id, g.title
  -- A category needs at least 3 regular (not long-form) questions.
  having count(cl.id) >= 3
  order by random()
  limit least(greatest(coalesce(max_count, 0), 0), 500);
$$;

create or replace function public.random_final_clues(max_count integer)
returns table (
  id bigint,
  category_name text,
  game_id uuid,
  game_title text
)
language sql
volatile
security invoker
set search_path = ''
as $$
  select
    cl.id::bigint,
    c.name::text,
    c.game_id,
    g.title::text
  from public.clues cl
  join public.categories c on c.id = cl.category_id
  join public.games g on g.id = c.game_id
  where g.visibility = 'PUBLIC'
    and cl.long_form is true
  order by random()
  limit least(greatest(coalesce(max_count, 0), 0), 100);
$$;

grant execute on function public.random_board_categories(integer)
  to anon, authenticated, service_role;
grant execute on function public.random_final_clues(integer)
  to anon, authenticated, service_role;
