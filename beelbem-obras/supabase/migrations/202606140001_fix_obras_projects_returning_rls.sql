drop policy if exists "obras_projects_select_by_account" on public.obras_projects;

create policy "obras_projects_select_by_account" on public.obras_projects
for select to authenticated
using (account_id = public.obras_current_account_id());
