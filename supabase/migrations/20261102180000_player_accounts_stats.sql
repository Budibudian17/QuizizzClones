create table if not exists public.player_game_results (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null,
  quiz_title text not null,
  pin text not null,
  final_rank integer not null check (final_rank > 0),
  final_score integer not null check (final_score >= 0),
  correct_answers integer not null check (correct_answers >= 0),
  total_questions integer not null check (total_questions > 0),
  played_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists player_game_results_user_played_idx
  on public.player_game_results (user_id, played_at desc);

alter table public.player_game_results enable row level security;

drop policy if exists "Players can read their own game statistics"
  on public.player_game_results;
create policy "Players can read their own game statistics"
  on public.player_game_results for select to authenticated
  using (
    user_id = (select auth.uid())
    and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  );

grant select on public.player_game_results to authenticated;

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
      'score', case
        when v_is_host then ranked.score
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

create or replace function public.record_player_game_result(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_player public.room_players%rowtype;
  v_snapshot jsonb;
  v_score integer;
  v_rank integer;
  v_correct_answers integer;
  v_total_questions integer;
begin
  if auth.uid() is null
    or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'permanent-player-account-required';
  end if;

  select * into v_room
  from public.rooms r
  where r.id = p_room_id and r.phase = 'podium';
  if not found then raise exception 'game-not-finished'; end if;

  select * into v_player
  from public.room_players p
  where p.room_id = p_room_id and p.user_id = auth.uid();
  if not found then raise exception 'player-not-in-room'; end if;

  select s.score into v_score
  from public.room_player_scores s
  where s.room_id = p_room_id and s.user_id = auth.uid();
  if not found then raise exception 'player-score-not-found'; end if;

  select count(*) + 1 into v_rank
  from public.room_players p
  join public.room_player_scores s
    on s.room_id = p.room_id and s.user_id = p.user_id
  where p.room_id = p_room_id
    and (
      s.score > v_score
      or (s.score = v_score and p.nickname < v_player.nickname)
      or (s.score = v_score and p.nickname = v_player.nickname and p.joined_at < v_player.joined_at)
      or (
        s.score = v_score
        and p.nickname = v_player.nickname
        and p.joined_at = v_player.joined_at
        and p.user_id < v_player.user_id
      )
    );

  select s.snapshot into v_snapshot
  from public.room_quiz_snapshots s
  where s.room_id = p_room_id;

  v_total_questions := jsonb_array_length(v_snapshot -> 'questions');

  select count(*) into v_correct_answers
  from public.room_answers a
  where a.room_id = p_room_id
    and a.user_id = auth.uid()
    and a.choice = (
      (v_snapshot -> 'questions' -> a.question_index ->> 'correctIndex')::integer
    );

  insert into public.player_game_results (
    room_id,
    user_id,
    nickname,
    quiz_title,
    pin,
    final_rank,
    final_score,
    correct_answers,
    total_questions
  )
  values (
    p_room_id,
    auth.uid(),
    v_player.nickname,
    v_snapshot ->> 'title',
    v_room.pin,
    v_rank,
    v_score,
    v_correct_answers,
    v_total_questions
  )
  on conflict (room_id, user_id) do nothing;
end;
$$;

revoke all on function public.get_room_snapshot(uuid) from public;
revoke all on function public.record_player_game_result(uuid) from public;
grant execute on function public.get_room_snapshot(uuid) to authenticated;
grant execute on function public.record_player_game_result(uuid) to authenticated;
