create table if not exists public.grupos_de_opcoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.stores(id) on delete cascade,
  produto_id uuid not null references public.produtos_cardapio(id) on delete cascade,
  nome text not null,
  descricao text,
  obrigatorio boolean not null default false,
  multipla_escolha boolean not null default false,
  minimo_escolhas integer not null default 0,
  maximo_escolhas integer not null default 1,
  ordem integer not null default 1,
  status text not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint grupos_de_opcoes_status_check check (status in ('ativo', 'inativo')),
  constraint grupos_de_opcoes_minimo_check check (minimo_escolhas >= 0),
  constraint grupos_de_opcoes_maximo_check check (maximo_escolhas >= 0),
  constraint grupos_de_opcoes_escolhas_check check (maximo_escolhas = 0 or maximo_escolhas >= minimo_escolhas),
  constraint grupos_de_opcoes_unica_check check (multipla_escolha = true or maximo_escolhas = 1)
);

create table if not exists public.opcoes_de_produto (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_de_opcoes(id) on delete cascade,
  empresa_id uuid not null references public.stores(id) on delete cascade,
  nome text not null,
  descricao text,
  preco_adicional numeric(10,2) not null default 0,
  disponivel boolean not null default true,
  ordem integer not null default 1,
  status text not null default 'ativo',
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint opcoes_de_produto_status_check check (status in ('ativo', 'inativo')),
  constraint opcoes_de_produto_preco_check check (preco_adicional >= 0)
);

create table if not exists public.opcoes_item_pedido_garcon (
  id uuid primary key default gen_random_uuid(),
  item_pedido_id uuid not null references public.itens_pedido_garcon(id) on delete cascade,
  grupo_nome text not null,
  opcao_nome text not null,
  preco_adicional numeric(10,2) not null default 0,
  criado_em timestamptz not null default now(),
  constraint opcoes_item_pedido_garcon_preco_check check (preco_adicional >= 0)
);

alter table public.itens_pedido_garcon
  add column if not exists preco_base numeric(10,2);

alter table public.grupos_de_opcoes enable row level security;
alter table public.opcoes_de_produto enable row level security;
alter table public.opcoes_item_pedido_garcon enable row level security;

create index if not exists grupos_de_opcoes_empresa_id_idx on public.grupos_de_opcoes(empresa_id);
create index if not exists grupos_de_opcoes_produto_id_idx on public.grupos_de_opcoes(produto_id);
create index if not exists opcoes_de_produto_empresa_id_idx on public.opcoes_de_produto(empresa_id);
create index if not exists opcoes_de_produto_grupo_id_idx on public.opcoes_de_produto(grupo_id);
create index if not exists opcoes_item_pedido_garcon_item_idx on public.opcoes_item_pedido_garcon(item_pedido_id);

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_grupos_de_opcoes_atualizado_em'
      and tgrelid = 'public.grupos_de_opcoes'::regclass
  ) then
    execute 'create trigger set_grupos_de_opcoes_atualizado_em before update on public.grupos_de_opcoes for each row execute function public.set_garcon_atualizado_em()';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgname = 'set_opcoes_de_produto_atualizado_em'
      and tgrelid = 'public.opcoes_de_produto'::regclass
  ) then
    execute 'create trigger set_opcoes_de_produto_atualizado_em before update on public.opcoes_de_produto for each row execute function public.set_garcon_atualizado_em()';
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'grupos_de_opcoes'
      and policyname = 'grupos_de_opcoes_manage_by_store_scope'
  ) then
    execute 'create policy "grupos_de_opcoes_manage_by_store_scope" on public.grupos_de_opcoes for all to authenticated using (public.can_manage_store(empresa_id) and exists (select 1 from public.produtos_cardapio p where p.id = grupos_de_opcoes.produto_id and p.empresa_id = grupos_de_opcoes.empresa_id)) with check (public.can_manage_store(empresa_id) and exists (select 1 from public.produtos_cardapio p where p.id = grupos_de_opcoes.produto_id and p.empresa_id = grupos_de_opcoes.empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opcoes_de_produto'
      and policyname = 'opcoes_de_produto_manage_by_store_scope'
  ) then
    execute 'create policy "opcoes_de_produto_manage_by_store_scope" on public.opcoes_de_produto for all to authenticated using (public.can_manage_store(empresa_id) and exists (select 1 from public.grupos_de_opcoes g where g.id = opcoes_de_produto.grupo_id and g.empresa_id = opcoes_de_produto.empresa_id)) with check (public.can_manage_store(empresa_id) and exists (select 1 from public.grupos_de_opcoes g where g.id = opcoes_de_produto.grupo_id and g.empresa_id = opcoes_de_produto.empresa_id))';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opcoes_item_pedido_garcon'
      and policyname = 'opcoes_item_pedido_manage_by_store_scope'
  ) then
    execute 'create policy "opcoes_item_pedido_manage_by_store_scope" on public.opcoes_item_pedido_garcon for all to authenticated using (exists (select 1 from public.itens_pedido_garcon i join public.pedidos_garcon p on p.id = i.pedido_id where i.id = opcoes_item_pedido_garcon.item_pedido_id and public.can_manage_store(p.empresa_id))) with check (exists (select 1 from public.itens_pedido_garcon i join public.pedidos_garcon p on p.id = i.pedido_id where i.id = opcoes_item_pedido_garcon.item_pedido_id and public.can_manage_store(p.empresa_id)))';
  end if;
end $$;

grant select, insert, update, delete on public.grupos_de_opcoes to authenticated;
grant select, insert, update, delete on public.opcoes_de_produto to authenticated;
grant select, insert, update, delete on public.opcoes_item_pedido_garcon to authenticated;

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
                  ), '[]'::jsonb),
                  'grupos_de_opcoes', coalesce((
                    select jsonb_agg(jsonb_build_object(
                      'id', g.id,
                      'nome', g.nome,
                      'descricao', g.descricao,
                      'obrigatorio', g.obrigatorio,
                      'multipla_escolha', g.multipla_escolha,
                      'minimo_escolhas', g.minimo_escolhas,
                      'maximo_escolhas', g.maximo_escolhas,
                      'ordem', g.ordem,
                      'status', g.status,
                      'opcoes', coalesce((
                        select jsonb_agg(jsonb_build_object(
                          'id', o.id,
                          'nome', o.nome,
                          'descricao', o.descricao,
                          'preco_adicional', o.preco_adicional,
                          'disponivel', o.disponivel,
                          'ordem', o.ordem,
                          'status', o.status
                        ) order by o.ordem, o.nome)
                        from public.opcoes_de_produto o
                        where o.grupo_id = g.id
                          and o.status = 'ativo'
                      ), '[]'::jsonb)
                    ) order by g.obrigatorio desc, g.ordem, g.nome)
                    from public.grupos_de_opcoes g
                    where g.produto_id = p.id
                      and g.status = 'ativo'
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
  novo_item_id uuid;
  novo_numero text;
  item jsonb;
  opcao_json jsonb;
  produto_id uuid;
  opcao_id uuid;
  produto record;
  grupo record;
  opcao record;
  quantidade_item integer;
  quantidade_grupo integer;
  observacao_item text;
  opcoes_item jsonb;
  adicional_item numeric(10,2);
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
    opcoes_item := coalesce(item -> 'opcoes', '[]'::jsonb);
    adicional_item := 0;

    if quantidade_item <= 0 then
      raise exception 'Quantidade invalida no pedido.';
    end if;

    if jsonb_typeof(opcoes_item) <> 'array' then
      raise exception 'Opcoes invalidas no pedido.';
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

    for grupo in
      select *
      from public.grupos_de_opcoes g
      where g.produto_id = produto.id
        and g.empresa_id = target_empresa_id
        and g.status = 'ativo'
    loop
      select count(*)
      into quantidade_grupo
      from jsonb_array_elements(opcoes_item) selecionada(value)
      join public.opcoes_de_produto o on o.id = (selecionada.value ->> 'id')::uuid
      where o.grupo_id = grupo.id
        and o.empresa_id = target_empresa_id
        and o.status = 'ativo'
        and o.disponivel = true;

      if grupo.obrigatorio and quantidade_grupo < greatest(grupo.minimo_escolhas, 1) then
        raise exception 'Escolha uma opcao obrigatoria em %.', grupo.nome;
      end if;

      if grupo.maximo_escolhas > 0 and quantidade_grupo > grupo.maximo_escolhas then
        raise exception 'Limite de opcoes excedido em %.', grupo.nome;
      end if;

      if grupo.multipla_escolha = false and quantidade_grupo > 1 then
        raise exception 'Escolha apenas uma opcao em %.', grupo.nome;
      end if;
    end loop;

    for opcao_json in select value from jsonb_array_elements(opcoes_item) as opcoes(value) loop
      opcao_id := (opcao_json ->> 'id')::uuid;
      select o.id, o.nome, o.preco_adicional, g.nome as grupo_nome
      into opcao
      from public.opcoes_de_produto o
      join public.grupos_de_opcoes g on g.id = o.grupo_id
      where o.id = opcao_id
        and o.empresa_id = target_empresa_id
        and o.status = 'ativo'
        and o.disponivel = true
        and g.produto_id = produto.id
        and g.empresa_id = target_empresa_id
        and g.status = 'ativo';

      if not found then
        raise exception 'Opcao indisponivel no cardapio.';
      end if;

      adicional_item := adicional_item + opcao.preco_adicional;
    end loop;

    observacao_item := nullif(btrim(coalesce(item ->> 'observacao', '')), '');
    subtotal_item := (produto.preco + adicional_item) * quantidade_item;
    total_calculado := total_calculado + subtotal_item;

    insert into public.itens_pedido_garcon (
      pedido_id,
      produto_id,
      nome_produto,
      quantidade,
      preco_base,
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
      produto.preco + adicional_item,
      subtotal_item,
      observacao_item
    )
    returning id into novo_item_id;

    for opcao_json in select value from jsonb_array_elements(opcoes_item) as opcoes(value) loop
      opcao_id := (opcao_json ->> 'id')::uuid;
      select o.id, o.nome, o.preco_adicional, g.nome as grupo_nome
      into opcao
      from public.opcoes_de_produto o
      join public.grupos_de_opcoes g on g.id = o.grupo_id
      where o.id = opcao_id
        and o.empresa_id = target_empresa_id
        and o.status = 'ativo'
        and o.disponivel = true
        and g.produto_id = produto.id
        and g.empresa_id = target_empresa_id
        and g.status = 'ativo';

      insert into public.opcoes_item_pedido_garcon (
        item_pedido_id,
        grupo_nome,
        opcao_nome,
        preco_adicional
      )
      values (
        novo_item_id,
        opcao.grupo_nome,
        opcao.nome,
        opcao.preco_adicional
      );
    end loop;
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

alter table public.grupos_de_opcoes replica identity full;
alter table public.opcoes_de_produto replica identity full;
alter table public.opcoes_item_pedido_garcon replica identity full;

do $$
begin
  if exists (
    select 1
    from pg_publication
    where pubname = 'supabase_realtime'
  ) then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'grupos_de_opcoes'
    ) then
      alter publication supabase_realtime add table public.grupos_de_opcoes;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opcoes_de_produto'
    ) then
      alter publication supabase_realtime add table public.opcoes_de_produto;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'opcoes_item_pedido_garcon'
    ) then
      alter publication supabase_realtime add table public.opcoes_item_pedido_garcon;
    end if;
  end if;
end $$;
