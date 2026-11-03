create or replace function public.get_room_snapshot(p_room_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_is_host boolean;
  v_players jsonb;
  v_answers jsonb;
  v_questions jsonb;
  v_quiz_snapshot jsonb;
begin
  select * into v_room from public.rooms r where r.id = p_room_id;
  if not found then raise exception 'room-not-found'; end if;

  v_is_host := v_room.host_id = auth.uid();
  if not v_is_host and not public.is_room_member(p_room_id) then
    raise exception 'room-access-denied';
  end if;

  select s.snapshot into v_quiz_snapshot
  from public.room_quiz_snapshots s
  where s.room_id = p_room_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ranked.user_id,
      'nickname', ranked.nickname,
      'avatar', ranked.avatar,
      'score', case
        when v_is_host
          or v_room.phase = 'podium'
          or (
            v_room.phase = 'leaderboard'
            and v_room.question_index = jsonb_array_length(v_quiz_snapshot -> 'questions') - 1
          )
          then ranked.score
        when ranked.user_id = auth.uid() and v_room.phase = 'question'
          then ranked.score - ranked.last_gain
        when ranked.user_id = auth.uid() then ranked.score
        else 0
      end,
      'last_gain', case
        when (v_is_host or ranked.user_id = auth.uid()) and v_room.phase <> 'question'
          then ranked.last_gain
        else 0
      end,
      'rank', ranked.rank
    ) order by ranked.rank
  ), '[]'::jsonb)
  into v_players
  from (
    select
      p.user_id,
      p.nickname,
      p.avatar,
      s.score,
      s.last_gain,
      row_number() over (order by s.score desc, p.nickname, p.joined_at, p.user_id) as rank
    from public.room_players p
    join public.room_player_scores s
      on s.room_id = p.room_id and s.user_id = p.user_id
    where p.room_id = p_room_id
  ) ranked;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'player_id', a.user_id,
      'choice', a.choice,
      'at', extract(epoch from a.answered_at) * 1000
    )
  ), '[]'::jsonb)
  into v_answers
  from public.room_answers a
  where a.room_id = p_room_id
    and a.question_index = v_room.question_index
    and (v_is_host or a.user_id = auth.uid());

  select coalesce(jsonb_agg(
    case
      when v_is_host
        or v_room.phase = 'podium'
        or item.ordinality - 1 < v_room.question_index
        or (
          v_room.phase in ('reveal', 'leaderboard')
          and item.ordinality - 1 = v_room.question_index
        )
        then item.question
      else item.question - 'correctIndex'
    end order by item.ordinality
  ), '[]'::jsonb)
  into v_questions
  from jsonb_array_elements(v_quiz_snapshot -> 'questions') with ordinality as item(question, ordinality);

  return jsonb_build_object(
    'room', jsonb_build_object(
      'id', v_room.id,
      'pin', v_room.pin,
      'quizId', v_room.quiz_id,
      'phase', v_room.phase,
      'questionIndex', v_room.question_index,
      'phaseStartedAt', extract(epoch from v_room.phase_started_at) * 1000,
      'durationMs', v_room.duration_ms
    ),
    'quiz', jsonb_build_object(
      'id', v_quiz_snapshot -> 'id',
      'title', v_quiz_snapshot -> 'title',
      'description', v_quiz_snapshot -> 'description',
      'questions', v_questions,
      'updatedAt', v_quiz_snapshot -> 'updatedAt'
    ),
    'players', v_players,
    'answers', v_answers
  );
end;
$$;

revoke all on function public.get_room_snapshot(uuid) from public;
grant execute on function public.get_room_snapshot(uuid) to authenticated;
