begin;

-- Share totals and the caller's own rating without exposing other voters.
create or replace function public.get_generation_ratings(generation_ids uuid[])
returns table (generation_id uuid, up_count bigint, down_count bigint, my_vote text)
language sql
stable
security definer
set search_path = ''
as $$
  select
    g.id,
    count(v.id) filter (where v.vote = 'up'),
    count(v.id) filter (where v.vote = 'down'),
    max(v.vote) filter (where v.user_id = (select auth.uid()))
  from public.generations g
  left join public.votes v on v.generation_id = g.id
  where g.id = any(generation_ids)
    and (select auth.uid()) is not null
  group by g.id;
$$;

revoke all on function public.get_generation_ratings(uuid[]) from public, anon;
grant execute on function public.get_generation_ratings(uuid[]) to authenticated;

commit;
