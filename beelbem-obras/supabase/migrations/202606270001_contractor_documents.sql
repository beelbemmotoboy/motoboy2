alter table public.obras_documents
  add column if not exists contractor_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'obras_documents_contractor_id_fkey'
      and conrelid = 'public.obras_documents'::regclass
  ) then
    alter table public.obras_documents
      add constraint obras_documents_contractor_id_fkey
      foreign key (contractor_id)
      references public.obras_contractors(id)
      on delete set null;
  end if;
end
$$;

create index if not exists obras_documents_project_contractor_idx
  on public.obras_documents(project_id, contractor_id)
  where contractor_id is not null;
