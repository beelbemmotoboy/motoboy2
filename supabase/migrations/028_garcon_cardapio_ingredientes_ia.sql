alter table public.produtos_cardapio
  add column if not exists permite_adicionais boolean not null default false,
  add column if not exists origem_cadastro text not null default 'manual';

create table if not exists public.ingredientes_cardapio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  nome text not null,
  descricao text,
  unidade_medida text not null default 'un',
  custo_unitario numeric(10,2) not null default 0,
  estoque_minimo numeric(10,3) not null default 0,
  status text not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, nome),
  constraint ingredientes_cardapio_status_check check (status in ('ativo', 'inativo')),
  constraint ingredientes_cardapio_custo_check check (custo_unitario >= 0),
  constraint ingredientes_cardapio_estoque_check check (estoque_minimo >= 0)
);

create table if not exists public.produtos_ingredientes_cardapio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  produto_id uuid not null references public.produtos_cardapio(id) on delete cascade,
  ingrediente_id uuid not null references public.ingredientes_cardapio(id) on delete restrict,
  tipo text not null default 'base',
  quantidade numeric(10,3),
  preco_adicional numeric(10,2) not null default 0,
  obrigatorio boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (produto_id, ingrediente_id, tipo),
  constraint produtos_ingredientes_tipo_check check (tipo in ('base', 'adicional')),
  constraint produtos_ingredientes_quantidade_check check (quantidade is null or quantidade >= 0),
  constraint produtos_ingredientes_preco_check check (preco_adicional >= 0)
);

create table if not exists public.importacoes_cardapio_ia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  nome_arquivo text,
  tipo_arquivo text,
  pesquisa text,
  resultado jsonb not null default '{}'::jsonb,
  status text not null default 'analisado',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint importacoes_cardapio_ia_status_check check (status in ('analisado', 'gravado', 'descartado', 'erro'))
);

alter table public.ingredientes_cardapio enable row level security;
alter table public.produtos_ingredientes_cardapio enable row level security;
alter table public.importacoes_cardapio_ia enable row level security;

create index if not exists ingredientes_cardapio_empresa_id_idx on public.ingredientes_cardapio(empresa_id);
create index if not exists ingredientes_cardapio_status_idx on public.ingredientes_cardapio(status);
create index if not exists produtos_ingredientes_empresa_id_idx on public.produtos_ingredientes_cardapio(empresa_id);
create index if not exists produtos_ingredientes_produto_id_idx on public.produtos_ingredientes_cardapio(produto_id);
create index if not exists produtos_ingredientes_ingrediente_id_idx on public.produtos_ingredientes_cardapio(ingrediente_id);
create index if not exists importacoes_cardapio_ia_empresa_id_idx on public.importacoes_cardapio_ia(empresa_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_ingredientes_cardapio_atualizado_em'
      and tgrelid = 'public.ingredientes_cardapio'::regclass
  ) then
    execute 'create trigger set_ingredientes_cardapio_atualizado_em before update on public.ingredientes_cardapio for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_produtos_ingredientes_cardapio_atualizado_em'
      and tgrelid = 'public.produtos_ingredientes_cardapio'::regclass
  ) then
    execute 'create trigger set_produtos_ingredientes_cardapio_atualizado_em before update on public.produtos_ingredientes_cardapio for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_importacoes_cardapio_ia_atualizado_em'
      and tgrelid = 'public.importacoes_cardapio_ia'::regclass
  ) then
    execute 'create trigger set_importacoes_cardapio_ia_atualizado_em before update on public.importacoes_cardapio_ia for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_ingredientes_cardapio'
      and tgrelid = 'public.ingredientes_cardapio'::regclass
  ) then
    execute 'create trigger audit_ingredientes_cardapio after insert or update or delete on public.ingredientes_cardapio for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_produtos_ingredientes_cardapio'
      and tgrelid = 'public.produtos_ingredientes_cardapio'::regclass
  ) then
    execute 'create trigger audit_produtos_ingredientes_cardapio after insert or update or delete on public.produtos_ingredientes_cardapio for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_importacoes_cardapio_ia'
      and tgrelid = 'public.importacoes_cardapio_ia'::regclass
  ) then
    execute 'create trigger audit_importacoes_cardapio_ia after insert or update or delete on public.importacoes_cardapio_ia for each row execute function public.write_audit_log()';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ingredientes_cardapio'
      and policyname = 'ingredientes_cardapio_manage_by_store_scope'
  ) then
    execute 'create policy "ingredientes_cardapio_manage_by_store_scope" on public.ingredientes_cardapio for all to authenticated using (public.can_manage_store(empresa_id)) with check (public.can_manage_store(empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos_ingredientes_cardapio'
      and policyname = 'produtos_ingredientes_manage_by_store_scope'
  ) then
    execute 'create policy "produtos_ingredientes_manage_by_store_scope" on public.produtos_ingredientes_cardapio for all to authenticated using (public.can_manage_store(empresa_id) and exists (select 1 from public.produtos_cardapio p where p.id = produtos_ingredientes_cardapio.produto_id and p.empresa_id = produtos_ingredientes_cardapio.empresa_id) and exists (select 1 from public.ingredientes_cardapio i where i.id = produtos_ingredientes_cardapio.ingrediente_id and i.empresa_id = produtos_ingredientes_cardapio.empresa_id)) with check (public.can_manage_store(empresa_id) and exists (select 1 from public.produtos_cardapio p where p.id = produtos_ingredientes_cardapio.produto_id and p.empresa_id = produtos_ingredientes_cardapio.empresa_id) and exists (select 1 from public.ingredientes_cardapio i where i.id = produtos_ingredientes_cardapio.ingrediente_id and i.empresa_id = produtos_ingredientes_cardapio.empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'importacoes_cardapio_ia'
      and policyname = 'importacoes_cardapio_ia_manage_by_store_scope'
  ) then
    execute 'create policy "importacoes_cardapio_ia_manage_by_store_scope" on public.importacoes_cardapio_ia for all to authenticated using (public.can_manage_store(empresa_id)) with check (public.can_manage_store(empresa_id))';
  end if;
end $$;

grant select, insert, update, delete on public.ingredientes_cardapio to authenticated;
grant select, insert, update, delete on public.produtos_ingredientes_cardapio to authenticated;
grant select, insert, update, delete on public.importacoes_cardapio_ia to authenticated;

create or replace function public.garcon_listar_cardapio_admin(target_empresa_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'categorias', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem, c.nome) from public.categorias_cardapio c where c.empresa_id = target_empresa_id), '[]'::jsonb),
    'produtos', coalesce((select jsonb_agg(to_jsonb(p) order by p.nome) from public.produtos_cardapio p where p.empresa_id = target_empresa_id), '[]'::jsonb),
    'ingredientes', coalesce((select jsonb_agg(to_jsonb(i) order by i.nome) from public.ingredientes_cardapio i where i.empresa_id = target_empresa_id), '[]'::jsonb),
    'vinculos', coalesce((select jsonb_agg(to_jsonb(v) order by v.tipo) from public.produtos_ingredientes_cardapio v where v.empresa_id = target_empresa_id), '[]'::jsonb)
  )
  where public.can_manage_store(target_empresa_id);
$$;

create or replace function public.garcon_salvar_ingrediente(
  target_empresa_id uuid,
  target_nome text,
  target_unidade_medida text default 'un',
  target_descricao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  ingrediente_id uuid;
begin
  if not public.can_manage_store(target_empresa_id) then
    raise exception 'Sem permissao para gerenciar esta loja.';
  end if;

  insert into public.ingredientes_cardapio (empresa_id, nome, unidade_medida, descricao)
  values (target_empresa_id, btrim(target_nome), coalesce(nullif(btrim(target_unidade_medida), ''), 'un'), nullif(btrim(coalesce(target_descricao, '')), ''))
  on conflict (empresa_id, nome)
  do update set
    unidade_medida = excluded.unidade_medida,
    descricao = coalesce(excluded.descricao, public.ingredientes_cardapio.descricao)
  returning id into ingrediente_id;

  return ingrediente_id;
end;
$$;

grant execute on function public.garcon_listar_cardapio_admin(uuid) to authenticated;
grant execute on function public.garcon_salvar_ingrediente(uuid, text, text, text) to authenticated;

create or replace function public.buscar_cardapio_garcon_publico(target_empresa_id uuid, target_mesa_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'empresa', jsonb_build_object(
      'id', s.id,
      'nome', coalesce(s.fantasy_name, s.name),
      'logo_url', s.logo_url,
      'aberta', s.is_open
    ),
    'mesa', jsonb_build_object(
      'id', m.id,
      'nome', m.nome,
      'numero', m.numero,
      'descricao', m.descricao
    ),
    'categorias', coalesce((
      select jsonb_agg(categoria_json order by ordem_categoria, nome_categoria)
      from (
        select
          c.ordem as ordem_categoria,
          c.nome as nome_categoria,
          jsonb_build_object(
            'id', c.id,
            'nome', c.nome,
            'descricao', c.descricao,
            'ordem', c.ordem,
            'produtos', coalesce((
              select jsonb_agg(
                jsonb_build_object(
                  'id', p.id,
                  'nome', p.nome,
                  'descricao', p.descricao,
                  'preco', p.preco,
                  'imagem_url', p.imagem_url,
                  'disponivel', p.disponivel,
                  'tempo_medio_preparo', p.tempo_medio_preparo,
                  'permite_adicionais', p.permite_adicionais,
                  'ingredientes', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id', i.id,
                      'nome', i.nome,
                      'tipo', pi.tipo,
                      'quantidade', pi.quantidade,
                      'preco_adicional', pi.preco_adicional,
                      'obrigatorio', pi.obrigatorio
                    ) order by pi.tipo, i.nome)
                    from public.produtos_ingredientes_cardapio pi
                    join public.ingredientes_cardapio i on i.id = pi.ingrediente_id
                    where pi.produto_id = p.id
                      and i.status = 'ativo'
                  ), '[]'::jsonb)
                )
                order by p.nome
              )
              from public.produtos_cardapio p
              where p.empresa_id = s.id
                and p.categoria_id = c.id
                and p.status = 'ativo'
                and p.disponivel = true
            ), '[]'::jsonb)
          ) as categoria_json
        from public.categorias_cardapio c
        where c.empresa_id = s.id
          and c.status = 'ativa'
      ) categorias
    ), '[]'::jsonb)
  )
  from public.stores s
  join public.mesas m on m.empresa_id = s.id
  where s.id = target_empresa_id
    and m.id = target_mesa_id
    and s.active = true
    and m.status <> 'inativa';
$$;

alter table public.ingredientes_cardapio replica identity full;
alter table public.produtos_ingredientes_cardapio replica identity full;
alter table public.importacoes_cardapio_ia replica identity full;
