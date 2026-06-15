alter table public.obras_projects
  add column if not exists quadra text,
  add column if not exists lote text;

alter table public.obras_project_schedule_items
  drop constraint if exists obras_project_schedule_items_parent_item_id_fkey;

alter table public.obras_project_schedule_items
  add constraint obras_project_schedule_items_parent_item_id_fkey
  foreign key (parent_item_id)
  references public.obras_project_schedule_items(id)
  on delete cascade;

create or replace function public.obras_prevent_project_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.obras_current_role() not in ('owner', 'admin', 'engenheiro')
    and (
      new.nome is distinct from old.nome
      or new.cliente is distinct from old.cliente
      or new.endereco is distinct from old.endereco
      or new.cidade_id is distinct from old.cidade_id
      or new.bairro_id is distinct from old.bairro_id
      or new.cidade is distinct from old.cidade
      or new.bairro is distinct from old.bairro
      or new.quadra is distinct from old.quadra
      or new.lote is distinct from old.lote
      or new.area_construida is distinct from old.area_construida
      or new.area_terreno is distinct from old.area_terreno
      or new.pavimentos is distinct from old.pavimentos
      or new.responsavel is distinct from old.responsavel
      or new.observacoes is distinct from old.observacoes
    )
  then
    raise exception 'Apenas proprietarios, administradores e engenheiros podem alterar o cadastro da obra.';
  end if;

  return new;
end;
$$;

drop trigger if exists obras_prevent_project_profile_update on public.obras_projects;
create trigger obras_prevent_project_profile_update
before update on public.obras_projects
for each row execute function public.obras_prevent_project_profile_update();

revoke all on function public.obras_prevent_project_profile_update() from public, anon;
grant execute on function public.obras_prevent_project_profile_update() to authenticated;
