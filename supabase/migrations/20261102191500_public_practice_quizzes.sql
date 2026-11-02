alter table public.quizzes
  add column if not exists is_public boolean not null default false;

create index if not exists quizzes_public_updated_idx
  on public.quizzes (updated_at desc)
  where is_public = true;

grant select on public.quizzes to authenticated;

drop policy if exists "Anyone can read published quizzes" on public.quizzes;
create policy "Permanent users can read published quizzes"
  on public.quizzes for select to authenticated
  using (is_public = true);
