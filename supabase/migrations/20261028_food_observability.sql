-- Food project only. Additive migration; existing generations/votes and policies remain intact.
begin;
create table public.food_generation_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  user_input text not null check (length(user_input) between 3 and 200),
  cuisine text, neighborhood text,
  chain_version text not null default 'nyc-food-pick-v1',
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  generation_id uuid unique references public.generations(id) on delete set null,
  selected_step_id uuid,
  result_title text, result_content text,
  error_code text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  duration_ms integer
);
create table public.food_generation_steps (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.food_generation_requests(id),
  step_number integer not null check (step_number between 1 and 2),
  kind text not null check (kind in ('recommendation','variety_retry')),
  provider text not null, model text not null,
  prompt text not null check (length(prompt) between 1 and 30000),
  settings jsonb not null,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  output_text text, output_truncated boolean not null default false,
  parsed_result jsonb, validation_passed boolean,
  usage jsonb, error_code text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz, duration_ms integer,
  unique(request_id,step_number)
);
alter table public.food_generation_requests add constraint food_selected_step_fk
  foreign key(selected_step_id) references public.food_generation_steps(id);
create index food_requests_created_idx on public.food_generation_requests(created_at desc,id);
create index food_requests_user_idx on public.food_generation_requests(user_id,created_at desc);
alter table public.food_generation_requests enable row level security;
alter table public.food_generation_steps enable row level security;
revoke all on public.food_generation_requests,public.food_generation_steps from public,anon,authenticated;
grant select on public.food_generation_requests,public.food_generation_steps to authenticated;
create policy "Food admins read requests" on public.food_generation_requests for select to authenticated
  using ((select public.week6_is_superadmin()));
create policy "Food admins read steps" on public.food_generation_steps for select to authenticated
  using ((select public.week6_is_superadmin()));

-- Narrow write functions always derive ownership from the verified caller.
-- No direct browser INSERT/UPDATE/DELETE grants or service-role credentials.
create function public.food_start_request(p_input text,p_cuisine text default null,p_neighborhood text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
  if auth.uid() is null then raise insufficient_privilege; end if;
  if length(coalesce(p_cuisine,''))>70 or length(coalesce(p_neighborhood,''))>70 then raise invalid_parameter_value; end if;
  insert into public.food_generation_requests(user_id,user_input,cuisine,neighborhood)
    values(auth.uid(),p_input,p_cuisine,p_neighborhood) returning id into rid;
  return rid;
end;$$;
create function public.food_start_step(p_request_id uuid,p_prompt text,p_kind text,p_model text,p_settings jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid; n integer;
begin
  perform 1 from public.food_generation_requests where id=p_request_id and user_id=auth.uid() and status='running' for update;
  if not found then raise insufficient_privilege; end if;
  if length(p_model)>150 or length(p_settings::text)>10000 then raise invalid_parameter_value; end if;
  select count(*)+1 into n from public.food_generation_steps where request_id=p_request_id;
  if n>2 or (n=1 and p_kind<>'recommendation') or (n=2 and p_kind<>'variety_retry') or exists(
    select 1 from public.food_generation_steps where request_id=p_request_id and status='running'
  ) then raise invalid_parameter_value; end if;
  insert into public.food_generation_steps(request_id,step_number,kind,provider,model,prompt,settings)
    values(p_request_id,n,p_kind,'Google',p_model,p_prompt,p_settings) returning id into sid;
  return sid;
end;$$;
create function public.food_finish_step(p_step_id uuid,p_output text,p_truncated boolean,p_result jsonb,p_valid boolean,p_usage jsonb,p_error_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if length(coalesce(p_output,''))>80000 or length(coalesce(p_result::text,''))>10000 or length(coalesce(p_usage::text,''))>4000 or length(coalesce(p_error_code,''))>100 then raise invalid_parameter_value; end if;
  update public.food_generation_steps s set output_text=p_output,output_truncated=coalesce(p_truncated,false),parsed_result=p_result,
    validation_passed=p_valid,usage=p_usage,error_code=p_error_code,status=case when p_error_code is null then 'succeeded' else 'failed' end,
    completed_at=clock_timestamp(),duration_ms=greatest(0,least(2147483647,extract(epoch from(clock_timestamp()-s.created_at))*1000))::integer
    where s.id=p_step_id and s.status='running' and exists(
      select 1 from public.food_generation_requests r where r.id=s.request_id and r.user_id=auth.uid() and r.status='running'
    );
  if not found then raise insufficient_privilege; end if;
end;$$;
create function public.food_complete_request(p_request_id uuid,p_step_id uuid,p_title text,p_content text,p_prompt text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.generations%rowtype;
begin
  perform 1 from public.food_generation_requests where id=p_request_id and user_id=auth.uid() and status='running' for update;
  if not found then raise insufficient_privilege; end if;
  perform 1 from public.food_generation_steps where id=p_step_id and request_id=p_request_id and status='succeeded' and validation_passed=true
    and parsed_result->>'title'=p_title and parsed_result->>'content'=p_content;
  if not found or length(p_title)>90 or length(p_content)>10000 or length(p_prompt)>1000 then raise invalid_parameter_value; end if;
  insert into public.generations(user_id,prompt,title,content) values(auth.uid(),p_prompt,p_title,p_content) returning * into g;
  update public.food_generation_requests set status='succeeded',generation_id=g.id,selected_step_id=p_step_id,
    result_title=p_title,result_content=p_content,completed_at=clock_timestamp(),
    duration_ms=greatest(0,least(2147483647,extract(epoch from(clock_timestamp()-created_at))*1000))::integer where id=p_request_id;
  return jsonb_build_object('id',g.id,'prompt',g.prompt,'title',g.title,'content',g.content,'request_id',p_request_id);
end;$$;
create function public.food_fail_request(p_request_id uuid,p_error_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if length(coalesce(p_error_code,''))>100 then raise invalid_parameter_value; end if;
  update public.food_generation_requests set status='failed',error_code=p_error_code,completed_at=clock_timestamp(),
    duration_ms=greatest(0,least(2147483647,extract(epoch from(clock_timestamp()-created_at))*1000))::integer
    where id=p_request_id and user_id=auth.uid() and status='running';
  if not found then raise insufficient_privilege; end if;
end;$$;
revoke all on function public.food_start_request(text,text,text),public.food_start_step(uuid,text,text,text,jsonb),
  public.food_finish_step(uuid,text,boolean,jsonb,boolean,jsonb,text),public.food_complete_request(uuid,uuid,text,text,text),public.food_fail_request(uuid,text) from public,anon;
grant execute on function public.food_start_request(text,text,text),public.food_start_step(uuid,text,text,text,jsonb),
  public.food_finish_step(uuid,text,boolean,jsonb,boolean,jsonb,text),public.food_complete_request(uuid,uuid,text,text,text),public.food_fail_request(uuid,text) to authenticated;
commit;
