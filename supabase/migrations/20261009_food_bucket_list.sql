begin;

create table public.food_bucket_list (
  user_id uuid not null references auth.users(id) on delete cascade,
  generation_id uuid not null references public.generations(id) on delete cascade,
  status text not null default 'want_to_go' check (status in ('want_to_go', 'been_there')),
  created_at timestamptz not null default now(),
  primary key (user_id, generation_id)
);

create index food_bucket_list_user_created_idx
  on public.food_bucket_list (user_id, created_at desc);

alter table public.food_bucket_list enable row level security;

create policy "Read own bucket list" on public.food_bucket_list
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Save to own bucket list" on public.food_bucket_list
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own bucket list" on public.food_bucket_list
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "Remove from own bucket list" on public.food_bucket_list
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.food_bucket_list from anon;
grant select, insert, update, delete on public.food_bucket_list to authenticated;

commit;
