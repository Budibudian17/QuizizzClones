create table if not exists public.quizzes (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  description text not null default '',
  questions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint quizzes_title_not_empty check (length(trim(title)) > 0),
  constraint quizzes_questions_array check (jsonb_typeof(questions) = 'array')
);

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  pin text not null unique check (pin ~ '^[1-9][0-9]{5}$'),
  quiz_id text not null references public.quizzes (id) on delete restrict,
  host_id uuid not null references auth.users (id) on delete cascade,
  phase text not null default 'lobby'
    check (phase in ('lobby', 'question', 'reveal', 'leaderboard', 'podium')),
  question_index integer not null default 0 check (question_index >= 0),
  phase_started_at timestamptz not null default now(),
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.room_quiz_snapshots (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  snapshot jsonb not null
);

create table if not exists public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  nickname text not null check (length(trim(nickname)) between 1 and 16),
  answered_question_index integer,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create table if not exists public.room_player_scores (
  room_id uuid not null,
  user_id uuid not null,
  score integer not null default 0 check (score >= 0),
  last_gain integer not null default 0 check (last_gain >= 0),
  primary key (room_id, user_id),
  foreign key (room_id, user_id)
    references public.room_players (room_id, user_id) on delete cascade
);

create table if not exists public.room_answers (
  room_id uuid not null,
  user_id uuid not null,
  question_index integer not null check (question_index >= 0),
  choice integer not null check (choice between 0 and 3),
  answered_at timestamptz not null default now(),
  primary key (room_id, user_id, question_index),
  foreign key (room_id, user_id)
    references public.room_players (room_id, user_id) on delete cascade
);

create index if not exists rooms_host_created_idx
  on public.rooms (host_id, created_at desc);
create index if not exists room_players_user_idx on public.room_players (user_id);
create index if not exists room_answers_room_question_idx
  on public.room_answers (room_id, question_index);

grant select, insert, update, delete on public.quizzes to authenticated;
grant select on public.rooms, public.room_players, public.room_answers to authenticated;
grant select on public.room_quiz_snapshots to authenticated;
grant select on public.room_player_scores to authenticated;

alter table public.quizzes enable row level security;
alter table public.rooms enable row level security;
alter table public.room_quiz_snapshots enable row level security;
alter table public.room_players enable row level security;
alter table public.room_player_scores enable row level security;
alter table public.room_answers enable row level security;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_id = (select auth.uid())
  );
$$;

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players p
    where p.room_id = p_room_id and p.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_room_host(uuid) from public;
revoke all on function public.is_room_member(uuid) from public;
grant execute on function public.is_room_host(uuid) to authenticated;
grant execute on function public.is_room_member(uuid) to authenticated;

drop policy if exists "Room hosts can read private quiz snapshots" on public.room_quiz_snapshots;
create policy "Room hosts can read private quiz snapshots"
  on public.room_quiz_snapshots for select to authenticated
  using (public.is_room_host(room_id));

drop policy if exists "Room hosts can read player scores" on public.room_player_scores;
create policy "Room hosts can read player scores"
  on public.room_player_scores for select to authenticated
  using (public.is_room_host(room_id));

drop policy if exists "Quiz owners can read their quizzes" on public.quizzes;
create policy "Quiz owners can read their quizzes"
  on public.quizzes for select to authenticated
  using (owner_id = (select auth.uid()));

drop policy if exists "Quiz owners can create quizzes" on public.quizzes;
create policy "Quiz owners can create quizzes"
  on public.quizzes for insert to authenticated
  with check (owner_id = (select auth.uid()) and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

drop policy if exists "Quiz owners can update their quizzes" on public.quizzes;
create policy "Quiz owners can update their quizzes"
  on public.quizzes for update to authenticated
  using (owner_id = (select auth.uid()) and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
  with check (owner_id = (select auth.uid()) and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

drop policy if exists "Quiz owners can delete their quizzes" on public.quizzes;
create policy "Quiz owners can delete their quizzes"
  on public.quizzes for delete to authenticated
  using (owner_id = (select auth.uid()) and not coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false));

drop policy if exists "Room hosts and members can read rooms" on public.rooms;
create policy "Room hosts and members can read rooms"
  on public.rooms for select to authenticated
  using (host_id = (select auth.uid()) or public.is_room_member(id));

drop policy if exists "Room hosts and members can read players" on public.room_players;
create policy "Room hosts and members can read players"
  on public.room_players for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_host(room_id) or public.is_room_member(room_id));

drop policy if exists "Hosts and answer owners can read answers" on public.room_answers;
create policy "Hosts and answer owners can read answers"
  on public.room_answers for select to authenticated
  using (user_id = (select auth.uid()) or public.is_room_host(room_id));

create or replace function public.ensure_host_room(p_quiz_id text)
returns table (room_id uuid, pin text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.rooms%rowtype;
  v_pin text;
  v_snapshot jsonb;
begin
  if v_user_id is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'host-auth-required';
  end if;

  if not exists (
    select 1 from public.quizzes q
    where q.id = p_quiz_id and q.owner_id = v_user_id
  ) then
    raise exception 'quiz-not-found';
  end if;

  select jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'description', q.description,
    'questions', q.questions,
    'updatedAt', extract(epoch from q.updated_at) * 1000
  )
  into v_snapshot
  from public.quizzes q
  where q.id = p_quiz_id and q.owner_id = v_user_id;

  select * into v_room
  from public.rooms r
  where r.host_id = v_user_id
    and r.quiz_id = p_quiz_id
    and r.phase <> 'podium'
  order by r.created_at desc
  limit 1;

  if found then
    return query select v_room.id, v_room.pin;
    return;
  end if;

  loop
    v_pin := (floor(random() * 900000) + 100000)::integer::text;
    begin
      insert into public.rooms (pin, quiz_id, host_id)
      values (v_pin, p_quiz_id, v_user_id)
      returning * into v_room;
      insert into public.room_quiz_snapshots (room_id, snapshot)
      values (v_room.id, v_snapshot);
      exit;
    exception when unique_violation then
      continue;
    end;
  end loop;

  return query select v_room.id, v_room.pin;
end;
$$;

create or replace function public.join_room(p_pin text, p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_nickname text := left(trim(p_nickname), 16);
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'player-auth-required'; end if;
  if v_nickname = '' then raise exception 'nickname-required'; end if;

  select * into v_room from public.rooms r where r.pin = p_pin for update;
  if not found then raise exception 'room-not-found'; end if;
  if v_room.phase <> 'lobby' then raise exception 'game-in-progress'; end if;

  insert into public.room_players (room_id, user_id, nickname)
  values (v_room.id, v_user_id, v_nickname)
  on conflict (room_id, user_id) do update set nickname = excluded.nickname;

  insert into public.room_player_scores (room_id, user_id)
  values (v_room.id, v_user_id)
  on conflict (room_id, user_id) do nothing;

  return v_room.id;
end;
$$;

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
      'id', p.user_id,
      'nickname', p.nickname,
      'score', case
        when v_is_host or v_room.phase <> 'question' then s.score
        else s.score - s.last_gain
      end,
      'last_gain', case
        when v_is_host or v_room.phase <> 'question' then s.last_gain
        else 0
      end,
      'answered_question_index', p.answered_question_index
    ) order by p.joined_at
  ), '[]'::jsonb)
  into v_players
  from public.room_players p
  join public.room_player_scores s
    on s.room_id = p.room_id and s.user_id = p.user_id
  where p.room_id = p_room_id;

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
  if v_count < 4 then raise exception 'minimum-four-players-required'; end if;

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

create or replace function public.submit_room_answer(p_room_id uuid, p_choice integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms%rowtype;
  v_question jsonb;
  v_quiz_snapshot jsonb;
  v_correct_index integer;
  v_duration integer;
  v_gain integer := 0;
  v_answered_at timestamptz := clock_timestamp();
begin
  if p_choice < 0 or p_choice > 3 then raise exception 'invalid-choice'; end if;

  select * into v_room from public.rooms r
  where r.id = p_room_id and r.phase = 'question'
  for update;
  if not found then raise exception 'question-not-active'; end if;

  if not exists (
    select 1 from public.room_players p
    where p.room_id = p_room_id and p.user_id = auth.uid()
  ) then raise exception 'player-not-in-room'; end if;

  if v_answered_at >= v_room.phase_started_at + make_interval(secs => v_room.duration_ms / 1000.0) then
    raise exception 'answer-deadline-passed';
  end if;

  select s.snapshot into v_quiz_snapshot
  from public.room_quiz_snapshots s where s.room_id = p_room_id;
  v_question := v_quiz_snapshot -> 'questions' -> v_room.question_index;
  v_correct_index := (v_question ->> 'correctIndex')::integer;

  insert into public.room_answers (room_id, user_id, question_index, choice, answered_at)
  values (p_room_id, auth.uid(), v_room.question_index, p_choice, v_answered_at);

  if p_choice = v_correct_index then
    v_gain := round((
      500 + 500 * greatest(0, least(1,
        1 - extract(epoch from (v_answered_at - v_room.phase_started_at)) * 1000 / v_room.duration_ms
      ))
    ) / 10.0)::integer * 10;
  end if;

  update public.room_player_scores set
    score = score + v_gain,
    last_gain = v_gain
  where room_id = p_room_id and user_id = auth.uid();

  update public.room_players set answered_question_index = v_room.question_index
  where room_id = p_room_id and user_id = auth.uid();
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

  if v_room.phase = 'question' then
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

create or replace function public.end_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rooms set phase = 'podium', phase_started_at = clock_timestamp(), duration_ms = 0
  where id = p_room_id and host_id = auth.uid();
  if not found then raise exception 'room-access-denied'; end if;
end;
$$;

revoke all on function public.ensure_host_room(text) from public;
revoke all on function public.join_room(text, text) from public;
revoke all on function public.get_room_snapshot(uuid) from public;
revoke all on function public.start_room(uuid) from public;
revoke all on function public.submit_room_answer(uuid, integer) from public;
revoke all on function public.advance_room(uuid) from public;
revoke all on function public.end_room(uuid) from public;

grant execute on function public.ensure_host_room(text) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;
grant execute on function public.get_room_snapshot(uuid) to authenticated;
grant execute on function public.start_room(uuid) to authenticated;
grant execute on function public.submit_room_answer(uuid, integer) to authenticated;
grant execute on function public.advance_room(uuid) to authenticated;
grant execute on function public.end_room(uuid) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_players;
exception when duplicate_object then null;
end;
$$;

do $$
begin
  alter publication supabase_realtime add table public.room_answers;
exception when duplicate_object then null;
end;
$$;
