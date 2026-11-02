revoke select on public.quizzes from anon;
grant select on public.quizzes to authenticated;

drop policy if exists "Anyone can read published quizzes" on public.quizzes;
drop policy if exists "Permanent users can read published quizzes" on public.quizzes;
create policy "Permanent users can read published quizzes"
  on public.quizzes for select to authenticated
  using (
    is_public = true
    and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
  );
