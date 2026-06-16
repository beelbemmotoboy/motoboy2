create policy "obras_schedule_logs_delete_account" on public.obras_schedule_daily_logs
for delete to authenticated
using (public.obras_can_access_project(project_id) and public.obras_can_write());
