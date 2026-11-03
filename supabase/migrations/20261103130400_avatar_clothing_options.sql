alter table public.room_players
  alter column avatar set default
    '{"character":"cat","color":"amber","hat":"none","glasses":"none","bag":"none","hair":"short","shirt":"teal","pants":"navy"}'::jsonb;

update public.room_players
set avatar = avatar || jsonb_build_object(
  'hair', coalesce(avatar ->> 'hair', 'short'),
  'shirt', coalesce(avatar ->> 'shirt', 'teal'),
  'pants', coalesce(avatar ->> 'pants', 'navy')
);

create or replace function public.set_room_player_avatar(p_room_id uuid, p_avatar jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_phase text;
begin
  if auth.uid() is null or not public.is_room_member(p_room_id) then
    raise exception 'room-player-access-denied';
  end if;

  select r.phase into v_room_phase
  from public.rooms r
  where r.id = p_room_id
  for update;

  if v_room_phase is distinct from 'lobby' then
    raise exception 'avatar-customization-closed';
  end if;

  if jsonb_typeof(p_avatar) is distinct from 'object'
    or coalesce(p_avatar ->> 'character', '') not in ('cat', 'fox', 'frog', 'bear', 'robot', 'bird')
    or coalesce(p_avatar ->> 'color', '') not in ('amber', 'rose', 'mint', 'sky', 'violet', 'lime')
    or coalesce(p_avatar ->> 'hat', '') not in ('none', 'cap', 'beanie', 'crown')
    or coalesce(p_avatar ->> 'glasses', '') not in ('none', 'round', 'square', 'sunglasses')
    or coalesce(p_avatar ->> 'bag', '') not in ('none', 'backpack', 'sling')
    or coalesce(p_avatar ->> 'hair', '') not in ('none', 'short', 'long', 'curly')
    or coalesce(p_avatar ->> 'shirt', '') not in ('teal', 'coral', 'indigo', 'cream', 'plum')
    or coalesce(p_avatar ->> 'pants', '') not in ('navy', 'charcoal', 'olive', 'denim')
  then
    raise exception 'invalid-player-avatar';
  end if;

  update public.room_players
  set avatar = jsonb_build_object(
    'character', p_avatar ->> 'character',
    'color', p_avatar ->> 'color',
    'hat', p_avatar ->> 'hat',
    'glasses', p_avatar ->> 'glasses',
    'bag', p_avatar ->> 'bag',
    'hair', p_avatar ->> 'hair',
    'shirt', p_avatar ->> 'shirt',
    'pants', p_avatar ->> 'pants'
  )
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

revoke all on function public.set_room_player_avatar(uuid, jsonb) from public;
grant execute on function public.set_room_player_avatar(uuid, jsonb) to authenticated;
