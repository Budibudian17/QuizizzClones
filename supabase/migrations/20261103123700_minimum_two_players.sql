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
    phase = 'question',
    question_index = 0,
    phase_started_at = clock_timestamp(),
    duration_ms = coalesce((v_question ->> 'timerSec')::integer, 20) * 1000
  where id = p_room_id;

  update public.room_player_scores set last_gain = 0 where room_id = p_room_id;
  update public.room_players set answered_question_index = null where room_id = p_room_id;
end;
$$;
