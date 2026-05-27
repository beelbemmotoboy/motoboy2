create table if not exists public.mesas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  nome text not null,
  numero text not null,
  descricao text,
  status text not null default 'livre',
  qr_code_url text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, numero),
  constraint mesas_status_check check (status in ('ativa', 'inativa', 'livre', 'ocupada'))
);

create table if not exists public.categorias_cardapio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  nome text not null,
  descricao text,
  ordem integer not null default 0,
  status text not null default 'ativa',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint categorias_cardapio_status_check check (status in ('ativa', 'inativa'))
);

create table if not exists public.produtos_cardapio (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  categoria_id uuid not null references public.categorias_cardapio(id) on delete restrict,
  nome text not null,
  descricao text,
  preco numeric(10,2) not null default 0,
  imagem_url text,
  status text not null default 'ativo',
  disponivel boolean not null default true,
  tempo_medio_preparo integer,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint produtos_cardapio_status_check check (status in ('ativo', 'inativo')),
  constraint produtos_cardapio_preco_check check (preco >= 0),
  constraint produtos_cardapio_tempo_check check (tempo_medio_preparo is null or tempo_medio_preparo >= 0)
);

create table if not exists public.pedidos_garcon (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  mesa_id uuid not null references public.mesas(id) on delete restrict,
  numero_pedido text not null,
  status text not null default 'novo',
  observacao_geral text,
  subtotal numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  origem text not null default 'mesa_qrcode',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, numero_pedido),
  constraint pedidos_garcon_status_check check (status in ('novo', 'confirmado', 'em_preparo', 'pronto', 'entregue', 'cancelado')),
  constraint pedidos_garcon_origem_check check (origem in ('mesa_qrcode', 'garcom', 'balcao')),
  constraint pedidos_garcon_valores_check check (subtotal >= 0 and total >= 0)
);

create table if not exists public.itens_pedido_garcon (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_garcon(id) on delete cascade,
  produto_id uuid references public.produtos_cardapio(id) on delete set null,
  nome_produto text not null,
  quantidade integer not null,
  preco_unitario numeric(10,2) not null,
  subtotal numeric(10,2) not null,
  observacao text,
  criado_em timestamptz not null default now(),
  constraint itens_pedido_garcon_quantidade_check check (quantidade > 0),
  constraint itens_pedido_garcon_valores_check check (preco_unitario >= 0 and subtotal >= 0)
);

alter table public.mesas enable row level security;
alter table public.categorias_cardapio enable row level security;
alter table public.produtos_cardapio enable row level security;
alter table public.pedidos_garcon enable row level security;
alter table public.itens_pedido_garcon enable row level security;

create index if not exists mesas_empresa_id_idx on public.mesas(empresa_id);
create index if not exists categorias_cardapio_empresa_id_idx on public.categorias_cardapio(empresa_id);
create index if not exists produtos_cardapio_empresa_id_idx on public.produtos_cardapio(empresa_id);
create index if not exists produtos_cardapio_categoria_id_idx on public.produtos_cardapio(categoria_id);
create index if not exists pedidos_garcon_empresa_id_idx on public.pedidos_garcon(empresa_id);
create index if not exists pedidos_garcon_mesa_id_idx on public.pedidos_garcon(mesa_id);
create index if not exists pedidos_garcon_status_idx on public.pedidos_garcon(status);
create index if not exists pedidos_garcon_criado_em_idx on public.pedidos_garcon(criado_em);
create index if not exists itens_pedido_garcon_pedido_id_idx on public.itens_pedido_garcon(pedido_id);

create or replace function public.set_garcon_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_mesas_atualizado_em'
      and tgrelid = 'public.mesas'::regclass
  ) then
    execute 'create trigger set_mesas_atualizado_em before update on public.mesas for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_categorias_cardapio_atualizado_em'
      and tgrelid = 'public.categorias_cardapio'::regclass
  ) then
    execute 'create trigger set_categorias_cardapio_atualizado_em before update on public.categorias_cardapio for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_produtos_cardapio_atualizado_em'
      and tgrelid = 'public.produtos_cardapio'::regclass
  ) then
    execute 'create trigger set_produtos_cardapio_atualizado_em before update on public.produtos_cardapio for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_pedidos_garcon_atualizado_em'
      and tgrelid = 'public.pedidos_garcon'::regclass
  ) then
    execute 'create trigger set_pedidos_garcon_atualizado_em before update on public.pedidos_garcon for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_mesas'
      and tgrelid = 'public.mesas'::regclass
  ) then
    execute 'create trigger audit_mesas after insert or update or delete on public.mesas for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_categorias_cardapio'
      and tgrelid = 'public.categorias_cardapio'::regclass
  ) then
    execute 'create trigger audit_categorias_cardapio after insert or update or delete on public.categorias_cardapio for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_produtos_cardapio'
      and tgrelid = 'public.produtos_cardapio'::regclass
  ) then
    execute 'create trigger audit_produtos_cardapio after insert or update or delete on public.produtos_cardapio for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_pedidos_garcon'
      and tgrelid = 'public.pedidos_garcon'::regclass
  ) then
    execute 'create trigger audit_pedidos_garcon after insert or update or delete on public.pedidos_garcon for each row execute function public.write_audit_log()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'audit_itens_pedido_garcon'
      and tgrelid = 'public.itens_pedido_garcon'::regclass
  ) then
    execute 'create trigger audit_itens_pedido_garcon after insert or update or delete on public.itens_pedido_garcon for each row execute function public.write_audit_log()';
  end if;
end $$;

create or replace function public.can_manage_store(target_store_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select public.is_system_admin()
    or target_store_id = public.current_profile_store_id()
    or exists (
      select 1
      from public.stores s
      where s.id = target_store_id
        and public.can_manage_city(s.city_id)
    );
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'mesas'
      and policyname = 'mesas_manage_by_store_scope'
  ) then
    execute 'create policy "mesas_manage_by_store_scope" on public.mesas for all to authenticated using (public.can_manage_store(empresa_id)) with check (public.can_manage_store(empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'categorias_cardapio'
      and policyname = 'categorias_cardapio_manage_by_store_scope'
  ) then
    execute 'create policy "categorias_cardapio_manage_by_store_scope" on public.categorias_cardapio for all to authenticated using (public.can_manage_store(empresa_id)) with check (public.can_manage_store(empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'produtos_cardapio'
      and policyname = 'produtos_cardapio_manage_by_store_scope'
  ) then
    execute 'create policy "produtos_cardapio_manage_by_store_scope" on public.produtos_cardapio for all to authenticated using (public.can_manage_store(empresa_id) and exists (select 1 from public.categorias_cardapio c where c.id = produtos_cardapio.categoria_id and c.empresa_id = produtos_cardapio.empresa_id)) with check (public.can_manage_store(empresa_id) and exists (select 1 from public.categorias_cardapio c where c.id = produtos_cardapio.categoria_id and c.empresa_id = produtos_cardapio.empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'pedidos_garcon'
      and policyname = 'pedidos_garcon_manage_by_store_scope'
  ) then
    execute 'create policy "pedidos_garcon_manage_by_store_scope" on public.pedidos_garcon for all to authenticated using (public.can_manage_store(empresa_id)) with check (public.can_manage_store(empresa_id) and exists (select 1 from public.mesas m where m.id = pedidos_garcon.mesa_id and m.empresa_id = pedidos_garcon.empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'itens_pedido_garcon'
      and policyname = 'itens_pedido_garcon_manage_by_store_scope'
  ) then
    execute 'create policy "itens_pedido_garcon_manage_by_store_scope" on public.itens_pedido_garcon for all to authenticated using (exists (select 1 from public.pedidos_garcon p where p.id = itens_pedido_garcon.pedido_id and public.can_manage_store(p.empresa_id))) with check (exists (select 1 from public.pedidos_garcon p where p.id = itens_pedido_garcon.pedido_id and public.can_manage_store(p.empresa_id)))';
  end if;
end $$;

grant select, insert, update, delete on public.mesas to authenticated;
grant select, insert, update, delete on public.categorias_cardapio to authenticated;
grant select, insert, update, delete on public.produtos_cardapio to authenticated;
grant select, insert, update, delete on public.pedidos_garcon to authenticated;
grant select, insert, update, delete on public.itens_pedido_garcon to authenticated;

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
                  'tempo_medio_preparo', p.tempo_medio_preparo
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

create or replace function public.criar_pedido_garcon_publico(
  target_empresa_id uuid,
  target_mesa_id uuid,
  observacao_pedido text,
  itens_pedido jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  novo_pedido_id uuid;
  novo_numero text;
  item jsonb;
  produto_id uuid;
  produto record;
  quantidade_item integer;
  observacao_item text;
  subtotal_item numeric(10,2);
  total_calculado numeric(10,2) := 0;
begin
  if itens_pedido is null or jsonb_typeof(itens_pedido) <> 'array' or jsonb_array_length(itens_pedido) = 0 then
    raise exception 'Informe ao menos um item para enviar o pedido.';
  end if;

  if not exists (
    select 1
    from public.stores s
    join public.mesas m on m.empresa_id = s.id
    where s.id = target_empresa_id
      and m.id = target_mesa_id
      and s.active = true
      and m.status <> 'inativa'
  ) then
    raise exception 'Mesa indisponivel para pedidos.';
  end if;

  novo_numero := concat('G-', to_char(now() at time zone 'America/Sao_Paulo', 'YYMMDD-HH24MISS'), '-', upper(substr(gen_random_uuid()::text, 1, 4)));

  insert into public.pedidos_garcon (
    empresa_id,
    mesa_id,
    numero_pedido,
    status,
    observacao_geral,
    subtotal,
    total,
    origem
  )
  values (
    target_empresa_id,
    target_mesa_id,
    novo_numero,
    'novo',
    nullif(btrim(coalesce(observacao_pedido, '')), ''),
    0,
    0,
    'mesa_qrcode'
  )
  returning id into novo_pedido_id;

  for item in select value from jsonb_array_elements(itens_pedido) as itens(value) loop
    produto_id := (item ->> 'produto_id')::uuid;
    quantidade_item := coalesce(nullif(item ->> 'quantidade', '')::integer, 0);

    if quantidade_item <= 0 then
      raise exception 'Quantidade invalida no pedido.';
    end if;

    select p.id, p.nome, p.preco
    into produto
    from public.produtos_cardapio p
    where p.id = produto_id
      and p.empresa_id = target_empresa_id
      and p.status = 'ativo'
      and p.disponivel = true;

    if not found then
      raise exception 'Produto indisponivel no cardapio.';
    end if;

    observacao_item := nullif(btrim(coalesce(item ->> 'observacao', '')), '');
    subtotal_item := produto.preco * quantidade_item;
    total_calculado := total_calculado + subtotal_item;

    insert into public.itens_pedido_garcon (
      pedido_id,
      produto_id,
      nome_produto,
      quantidade,
      preco_unitario,
      subtotal,
      observacao
    )
    values (
      novo_pedido_id,
      produto.id,
      produto.nome,
      quantidade_item,
      produto.preco,
      subtotal_item,
      observacao_item
    );
  end loop;

  update public.pedidos_garcon
  set subtotal = total_calculado,
      total = total_calculado
  where id = novo_pedido_id;

  update public.mesas
  set status = 'ocupada'
  where id = target_mesa_id
    and empresa_id = target_empresa_id
    and status in ('ativa', 'livre');

  return jsonb_build_object(
    'pedido_id', novo_pedido_id,
    'numero_pedido', novo_numero,
    'total', total_calculado
  );
exception
  when invalid_text_representation then
    raise exception 'Dados invalidos no pedido.';
end;
$$;

grant execute on function public.buscar_cardapio_garcon_publico(uuid, uuid) to anon, authenticated;
grant execute on function public.criar_pedido_garcon_publico(uuid, uuid, text, jsonb) to anon, authenticated;

alter table public.mesas replica identity full;
alter table public.categorias_cardapio replica identity full;
alter table public.produtos_cardapio replica identity full;
alter table public.pedidos_garcon replica identity full;
alter table public.itens_pedido_garcon replica identity full;

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    return;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos_garcon'
  ) then
    alter publication supabase_realtime add table public.pedidos_garcon;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'itens_pedido_garcon'
  ) then
    alter publication supabase_realtime add table public.itens_pedido_garcon;
  end if;
end $$;

notify pgrst, 'reload schema';
