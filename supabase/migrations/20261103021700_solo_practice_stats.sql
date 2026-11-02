create table if not exists public.player_solo_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_title text not null,
  total_questions integer not null check (total_questions between 1 and 50),
  answered_questions integer not null check (
    answered_questions >= 0 and answered_questions <= total_questions
  ),
  correct_answers integer not null check (
    correct_answers >= 0 and correct_answers <= answered_questions
  ),
  played_at timestamptz not null default now()
);

create index if not exists player_solo_results_user_played_idx
  on public.player_solo_results (user_id, played_at desc);

alter table public.player_solo_results enable row level security;

drop policy if exists "Players can read their own solo practice statistics"
  on public.player_solo_results;
create policy "Players can read their own solo practice statistics"
  on public.player_solo_results for select to authenticated
  using (
    user_id = (select auth.uid())
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
  );

grant select on public.player_solo_results to authenticated;

create or replace function public.record_player_solo_result(
  p_result_id uuid,
  p_quiz_title text,
  p_total_questions integer,
  p_answered_questions integer,
  p_correct_answers integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result_id uuid;
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'permanent-player-account-required';
  end if;

  if p_quiz_title is null
    or p_result_id is null
    or length(btrim(p_quiz_title)) = 0
    or length(p_quiz_title) > 200
    or p_total_questions < 1
    or p_total_questions > 50
    or p_answered_questions < 0
    or p_answered_questions > p_total_questions
    or p_correct_answers < 0
    or p_correct_answers > p_answered_questions then
    raise exception 'invalid-solo-result';
  end if;

  insert into public.player_solo_results (
    id,
    user_id,
    quiz_title,
    total_questions,
    answered_questions,
    correct_answers
  )
  values (
    p_result_id,
    auth.uid(),
    btrim(p_quiz_title),
    p_total_questions,
    p_answered_questions,
    p_correct_answers
  )
  on conflict (id) do nothing
  returning id into v_result_id;

  return coalesce(v_result_id, p_result_id);
end;
$$;

revoke all on function public.record_player_solo_result(uuid, text, integer, integer, integer) from public;
grant execute on function public.record_player_solo_result(uuid, text, integer, integer, integer)
  to authenticated;
