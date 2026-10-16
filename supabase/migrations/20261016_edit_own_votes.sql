begin;

-- Users can revise only their own existing vote; uniqueness is unchanged.
create policy "Users can update their own votes" on public.votes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can remove their own votes" on public.votes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant update, delete on public.votes to authenticated;

commit;
