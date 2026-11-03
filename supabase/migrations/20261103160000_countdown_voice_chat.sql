alter table public.rooms drop constraint if exists rooms_phase_check;
alter table public.rooms
  add constraint rooms_phase_check
  check (phase in ('lobby', 'countdown', 'question', 'reveal', 'leaderboard', 'podium'));

create or replace function public.start_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_question jsonb;
  v_quiz_snapshot jsonb;
  v_count integer;
begin
  select * into v_room from public.rooms r
  where r.id = p_room_id and r.host_id = auth.uid()
  for update;
  if not found then raise exception 'room-access-denied'; end if;
  if v_room.phase <> 'lobby' then raise exception 'room-not-lobby'; end if;

  select count(*) into v_count from public.room_players p where p.room_id = p_room_id;
  if v_count < 2 then raise exception 'minimum-two-players-required'; end if;

  select s.snapshot into v_quiz_snapshot
  from public.room_quiz_snapshots s where s.room_id = p_room_id;
  v_question := v_quiz_snapshot -> 'questions' -> 0;
  if v_question is null then raise exception 'quiz-has-no-questions'; end if;

  update public.rooms set
    phase = 'countdown',
    question_index = 0,
    phase_started_at = clock_timestamp(),
    duration_ms = 3000
  where id = p_room_id;

  update public.room_player_scores set last_gain = 0 where room_id = p_room_id;
  update public.room_players set answered_question_index = null where room_id = p_room_id;
end;
$$;

create or replace function public.advance_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_quiz_snapshot jsonb;
  v_total_players integer;
  v_total_answers integer;
  v_next_index integer;
  v_next_question jsonb;
  v_now timestamptz := clock_timestamp();
begin
  select * into v_room from public.rooms r
  where r.id = p_room_id and r.host_id = auth.uid()
  for update;
  if not found then raise exception 'room-access-denied'; end if;

  if v_room.phase = 'countdown' then
    if v_now < v_room.phase_started_at + make_interval(secs => v_room.duration_ms / 1000.0) then
      return;
    end if;
    select s.snapshot into v_quiz_snapshot
    from public.room_quiz_snapshots s where s.room_id = p_room_id;
    v_next_question := v_quiz_snapshot -> 'questions' -> v_room.question_index;
    update public.rooms set
      phase = 'question',
      phase_started_at = v_now,
      duration_ms = coalesce((v_next_question ->> 'timerSec')::integer, 20) * 1000
    where id = p_room_id;
  elsif v_room.phase = 'question' then
    select count(*) into v_total_players from public.room_players p where p.room_id = p_room_id;
    select count(*) into v_total_answers from public.room_answers a
    where a.room_id = p_room_id and a.question_index = v_room.question_index;
    if v_total_players > v_total_answers
      and v_now < v_room.phase_started_at + make_interval(secs => v_room.duration_ms / 1000.0) then
      return;
    end if;
    update public.rooms set phase = 'reveal', phase_started_at = v_now, duration_ms = 6000
    where id = p_room_id;
  elsif v_room.phase = 'reveal' then
    if v_now < v_room.phase_started_at + make_interval(secs => v_room.duration_ms / 1000.0) then
      return;
    end if;
    update public.rooms set phase = 'leaderboard', phase_started_at = v_now, duration_ms = 6500
    where id = p_room_id;
  elsif v_room.phase = 'leaderboard' then
    if v_now < v_room.phase_started_at + make_interval(secs => v_room.duration_ms / 1000.0) then
      return;
    end if;
    v_next_index := v_room.question_index + 1;
    select s.snapshot into v_quiz_snapshot
    from public.room_quiz_snapshots s where s.room_id = p_room_id;
    v_next_question := v_quiz_snapshot -> 'questions' -> v_next_index;

    if v_next_question is null then
      update public.rooms set phase = 'podium', phase_started_at = v_now, duration_ms = 0
      where id = p_room_id;
    else
      update public.rooms set
        phase = 'question',
        question_index = v_next_index,
        phase_started_at = v_now,
        duration_ms = coalesce((v_next_question ->> 'timerSec')::integer, 20) * 1000
      where id = p_room_id;
      update public.room_player_scores set last_gain = 0 where room_id = p_room_id;
      update public.room_players set answered_question_index = null where room_id = p_room_id;
    end if;
  end if;
end;
$$;

drop policy if exists "Room members can receive voice signals" on realtime.messages;
create policy "Room members can receive voice signals"
  on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'voice:%'
    and exists (
      select 1 from public.rooms r
      where r.id::text = substring(realtime.topic() from 7)
        and (r.host_id = (select auth.uid()) or public.is_room_member(r.id))
    )
  );

drop policy if exists "Room members can send voice signals" on realtime.messages;
create policy "Room members can send voice signals"
  on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'voice:%'
    and exists (
      select 1 from public.rooms r
      where r.id::text = substring(realtime.topic() from 7)
        and (r.host_id = (select auth.uid()) or public.is_room_member(r.id))
    )
  );

revoke all on function public.start_room(uuid) from public;
grant execute on function public.start_room(uuid) to authenticated;
revoke all on function public.advance_room(uuid) from public;
grant execute on function public.advance_room(uuid) to authenticated;
