-- Orçamento Falado: assinatura dos usuários (Asaas).
-- Pode rodar de novo sem estragar nada. A cobrança começa DESLIGADA:
-- só passa a valer quando o dono liga no painel.

-- ---------- configuração ----------
create table if not exists public.cobranca_config (
  id int primary key default 1 check (id = 1),
  ligada_em timestamptz,                       -- null = cobrança desligada, todo mundo usa grátis
  dias_teste int not null default 14,
  dias_tolerancia int not null default 3,      -- depois do vencimento, ainda funciona por estes dias
  preco_mensal numeric(10,2) not null default 29.90,
  preco_anual numeric(10,2) not null default 299.00,
  limite_sem_conta int not null default 3      -- orçamentos permitidos sem conta, com a cobrança ligada
);
insert into public.cobranca_config (id) values (1) on conflict do nothing;
alter table public.cobranca_config add column if not exists preco_trimestral numeric(10,2) not null default 79.90;
alter table public.cobranca_config enable row level security;
drop policy if exists "todos leem" on public.cobranca_config;
create policy "todos leem" on public.cobranca_config for select to anon, authenticated using (true);
revoke insert, update, delete on public.cobranca_config from anon, authenticated;
grant select on public.cobranca_config to anon, authenticated;

-- ---------- assinatura de cada usuário ----------
create table if not exists public.assinaturas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plano text,
  status text not null default 'sem' check (status in ('sem', 'pendente', 'ativa', 'atrasada', 'cancelada')),
  pago_ate timestamptz,
  asaas_customer text,
  asaas_subscription text,
  atualizado timestamptz not null default now()
);
alter table public.assinaturas drop constraint if exists assinaturas_plano_check;
alter table public.assinaturas add constraint assinaturas_plano_check check (plano in ('mensal', 'trimestral', 'anual'));
create index if not exists assinaturas_sub on public.assinaturas (asaas_subscription);
create index if not exists assinaturas_cus on public.assinaturas (asaas_customer);
alter table public.assinaturas enable row level security;
drop policy if exists "dono le" on public.assinaturas;
create policy "dono le" on public.assinaturas for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.assinaturas from anon;
revoke insert, update, delete on public.assinaturas from authenticated;
grant select on public.assinaturas to authenticated;

-- ---------- cobranças (faturas) ----------
create table if not exists public.cobrancas (
  id text primary key,                         -- id da cobrança no Asaas (pay_...)
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription text,
  valor numeric(10,2) not null,
  vencimento date,
  status text not null,                        -- status do Asaas: PENDING, CONFIRMED, RECEIVED, OVERDUE, REFUNDED...
  forma text,
  pago_em date,
  link text,
  creditado boolean not null default false,    -- já somou tempo de acesso
  meses int not null default 1,
  atualizado timestamptz not null default now()
);
create index if not exists cobrancas_user on public.cobrancas (user_id, vencimento desc);
alter table public.cobrancas enable row level security;
drop policy if exists "dono le" on public.cobrancas;
create policy "dono le" on public.cobrancas for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.cobrancas from anon;
revoke insert, update, delete on public.cobrancas from authenticated;
grant select on public.cobrancas to authenticated;

-- eventos já processados (o Asaas pode mandar o mesmo aviso mais de uma vez)
create table if not exists public.asaas_eventos (
  id text primary key,
  evento text,
  recebido timestamptz not null default now(),
  resultado text
);
alter table public.asaas_eventos enable row level security;
revoke all on public.asaas_eventos from anon, authenticated;

-- ---------- acesso ----------
-- Situação de acesso de um usuário. Usada pelo app, pela regra do banco e pelo painel.
create or replace function public.acesso_de(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare c public.cobranca_config; a public.assinaturas; criado timestamptz; teste_ate timestamptz; liberado boolean; motivo text;
begin
  select * into c from public.cobranca_config where id = 1;
  select * into a from public.assinaturas where user_id = p_user;
  select created_at into criado from auth.users where id = p_user;
  if exists (select 1 from public.admins where user_id = p_user) then
    return jsonb_build_object('cobranca_ligada', c.ligada_em is not null, 'liberado', true, 'motivo', 'admin',
      'preco_mensal', c.preco_mensal, 'preco_trimestral', c.preco_trimestral, 'preco_anual', c.preco_anual);
  end if;
  if c.ligada_em is null then
    return jsonb_build_object('cobranca_ligada', false, 'liberado', true, 'motivo', 'gratis',
      'preco_mensal', c.preco_mensal, 'preco_trimestral', c.preco_trimestral, 'preco_anual', c.preco_anual);
  end if;
  teste_ate := greatest(coalesce(criado, now()), c.ligada_em) + make_interval(days => c.dias_teste);
  if a.pago_ate is not null and now() < a.pago_ate + make_interval(days => c.dias_tolerancia) then
    liberado := true; motivo := case when now() < a.pago_ate then 'pago' else 'tolerancia' end;
  elsif now() < teste_ate then
    liberado := true; motivo := 'teste';
  else
    liberado := false; motivo := case when a.pago_ate is not null then 'vencido' else 'teste_acabou' end;
  end if;
  return jsonb_build_object(
    'cobranca_ligada', true, 'liberado', liberado, 'motivo', motivo,
    'teste_ate', teste_ate, 'pago_ate', a.pago_ate,
    'status', coalesce(a.status, 'sem'), 'plano', a.plano,
    'dias_tolerancia', c.dias_tolerancia,
    'preco_mensal', c.preco_mensal, 'preco_trimestral', c.preco_trimestral, 'preco_anual', c.preco_anual);
end $$;
revoke execute on function public.acesso_de(uuid) from public, anon, authenticated;

create or replace function public.meu_acesso() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.acesso_de(auth.uid());
$$;
revoke execute on function public.meu_acesso() from public, anon;
grant execute on function public.meu_acesso() to authenticated;

create or replace function public.tem_acesso() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((public.acesso_de(auth.uid()) ->> 'liberado')::boolean, false);
$$;
revoke execute on function public.tem_acesso() from public, anon;
grant execute on function public.tem_acesso() to authenticated;

-- Sem acesso, a conta continua lendo, exportando e apagando os próprios dados,
-- mas não salva coisas novas na nuvem.
drop policy if exists "dono cria" on public.itens;
drop policy if exists "dono altera" on public.itens;
create policy "dono cria" on public.itens for insert to authenticated
  with check ((select auth.uid()) = user_id and (select public.tem_acesso()));
create policy "dono altera" on public.itens for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id and (select public.tem_acesso()));

-- ---------- chamadas do servidor (Edge Functions, com a chave de serviço) ----------
-- Guarda a assinatura criada no Asaas.
create or replace function public.salvar_assinatura(p_user uuid, p_plano text, p_customer text, p_subscription text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.assinaturas (user_id, plano, status, asaas_customer, asaas_subscription, atualizado)
  values (p_user, p_plano, p_status, p_customer, p_subscription, now())
  on conflict (user_id) do update set
    plano = coalesce(excluded.plano, public.assinaturas.plano),
    status = excluded.status,
    asaas_customer = coalesce(excluded.asaas_customer, public.assinaturas.asaas_customer),
    asaas_subscription = excluded.asaas_subscription,
    atualizado = now();
end $$;

-- Processa um aviso (webhook) do Asaas. Idempotente: o mesmo evento duas vezes não faz nada.
create or replace function public.processar_evento_asaas(p jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ev text := p ->> 'event';
  pg jsonb := p -> 'payment';
  uid uuid; c public.cobranca_config; ass public.assinaturas; atual boolean; cob public.cobrancas; meses int; base timestamptz; res text;
begin
  if p ->> 'id' is null or ev is null then return 'ignorado: sem id'; end if;
  insert into public.asaas_eventos (id, evento) values (p ->> 'id', ev) on conflict do nothing;
  if not found then return 'duplicado'; end if;
  if pg is null then
    update public.asaas_eventos set resultado = 'sem pagamento' where id = p ->> 'id';
    return 'ignorado: sem pagamento';
  end if;

  -- de quem é: pela assinatura, depois pelo cliente
  select user_id into uid from public.assinaturas where asaas_subscription = pg ->> 'subscription' limit 1;
  if uid is null then select user_id into uid from public.assinaturas where asaas_customer = pg ->> 'customer' limit 1; end if;
  if uid is null then select user_id into uid from public.cobrancas where id = pg ->> 'id'; end if;
  if uid is null then
    update public.asaas_eventos set resultado = 'usuario nao encontrado' where id = p ->> 'id';
    return 'ignorado: usuario nao encontrado';
  end if;

  select * into c from public.cobranca_config where id = 1;
  select * into ass from public.assinaturas where user_id = uid;
  -- assinatura atual: o plano dela diz quantos meses vale; senão, deduz pelo valor
  atual := ass.asaas_subscription is not null and ass.asaas_subscription = pg ->> 'subscription';
  meses := case when atual and ass.plano = 'anual' then 12 when atual and ass.plano = 'trimestral' then 3 when atual then 1
                when (pg ->> 'value')::numeric >= c.preco_anual * 0.8 then 12
                when (pg ->> 'value')::numeric >= c.preco_trimestral * 0.8 then 3 else 1 end;

  insert into public.cobrancas (id, user_id, subscription, valor, vencimento, status, forma, pago_em, link, meses, atualizado)
  values (pg ->> 'id', uid, pg ->> 'subscription', (pg ->> 'value')::numeric, (pg ->> 'dueDate')::date, coalesce(pg ->> 'status', ''),
          pg ->> 'billingType', nullif(coalesce(pg ->> 'paymentDate', pg ->> 'confirmedDate'), '')::date, pg ->> 'invoiceUrl', meses, now())
  on conflict (id) do update set
    status = excluded.status, valor = excluded.valor, vencimento = excluded.vencimento, forma = excluded.forma,
    pago_em = coalesce(excluded.pago_em, public.cobrancas.pago_em), link = coalesce(excluded.link, public.cobrancas.link), atualizado = now()
  returning * into cob;

  if ev in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED', 'PAYMENT_RECEIVED_IN_CASH') and not cob.creditado then
    -- soma o período a partir do que for mais tarde: hoje, fim do teste ou fim do que já estava pago
    select greatest(now(), coalesce(a.pago_ate, now()), (public.acesso_de(uid) ->> 'teste_ate')::timestamptz)
      into base from public.assinaturas a where a.user_id = uid;
    base := coalesce(base, greatest(now(), coalesce((public.acesso_de(uid) ->> 'teste_ate')::timestamptz, now())));
    insert into public.assinaturas (user_id, status, pago_ate) values (uid, 'ativa', base + make_interval(months => cob.meses))
    on conflict (user_id) do update set
      -- quem cancelou continua cancelado: o pagamento só estende o acesso, a renovação não volta
      status = case when public.assinaturas.status = 'cancelada' then 'cancelada' else 'ativa' end,
      pago_ate = base + make_interval(months => cob.meses), atualizado = now();
    update public.cobrancas set creditado = true where id = cob.id;
    res := 'creditado ' || cob.meses || ' mes(es)';
  elsif ev in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_RECEIVED_IN_CASH_UNDONE') and cob.creditado then
    update public.assinaturas set pago_ate = pago_ate - make_interval(months => cob.meses), atualizado = now() where user_id = uid;
    update public.cobrancas set creditado = false where id = cob.id;
    res := 'estornado';
  elsif ev = 'PAYMENT_OVERDUE' then
    -- só a fatura da assinatura atual conta; uma fatura velha de um plano trocado não atrasa ninguém
    update public.assinaturas set status = 'atrasada', atualizado = now()
     where user_id = uid and status in ('ativa', 'pendente') and (pg ->> 'subscription' is null or asaas_subscription = pg ->> 'subscription');
    res := 'atrasada';
  else
    res := 'registrado';
  end if;
  update public.asaas_eventos set resultado = res where id = p ->> 'id';
  return res;
end $$;

-- Se o processamento falhar, apaga o registro do evento para o Asaas poder reenviar.
create or replace function public.esquecer_evento_asaas(p_id text) returns void
language sql security definer set search_path = '' as $$ delete from public.asaas_eventos where id = p_id; $$;

revoke execute on function public.salvar_assinatura(uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.processar_evento_asaas(jsonb) from public, anon, authenticated;
revoke execute on function public.esquecer_evento_asaas(text) from public, anon, authenticated;
grant execute on function public.salvar_assinatura(uuid, text, text, text, text) to service_role;
grant execute on function public.processar_evento_asaas(jsonb) to service_role;
grant execute on function public.esquecer_evento_asaas(text) to service_role;
grant execute on function public.acesso_de(uuid) to service_role;
grant select on public.assinaturas, public.cobrancas, public.cobranca_config to service_role;

-- ---------- painel do dono ----------
create or replace function public.admin_cobranca(p_ligar boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then raise exception 'acesso negado'; end if;
  update public.cobranca_config set ligada_em = case when p_ligar then coalesce(ligada_em, now()) else null end where id = 1;
  return (select to_jsonb(c) from public.cobranca_config c where id = 1);
end $$;
revoke execute on function public.admin_cobranca(boolean) from public, anon;
grant execute on function public.admin_cobranca(boolean) to authenticated;

create or replace function public.painel_cobranca() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.cobranca_config;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then raise exception 'acesso negado'; end if;
  select * into c from public.cobranca_config where id = 1;
  return jsonb_build_object(
    'config', to_jsonb(c),
    'ativas', (select count(*) from public.assinaturas where pago_ate > now()),
    'mensais', (select count(*) from public.assinaturas where pago_ate > now() and plano = 'mensal'),
    'anuais', (select count(*) from public.assinaturas where pago_ate > now() and plano = 'anual'),
    'atrasadas', (select count(*) from public.assinaturas where status = 'atrasada'),
    'canceladas', (select count(*) from public.assinaturas where status = 'cancelada'),
    'em_teste', (select count(*) from auth.users u where c.ligada_em is not null
                   and greatest(u.created_at, c.ligada_em) + make_interval(days => c.dias_teste) > now()
                   and not exists (select 1 from public.assinaturas a where a.user_id = u.id and a.pago_ate > now())),
    'trimestrais', (select count(*) from public.assinaturas where pago_ate > now() and plano = 'trimestral'),
    'mrr', (select coalesce(sum(case when plano = 'anual' then c.preco_anual / 12 when plano = 'trimestral' then c.preco_trimestral / 3 else c.preco_mensal end), 0)
              from public.assinaturas where pago_ate > now() and status <> 'cancelada'),
    'recebido_total', (select coalesce(sum(valor), 0) from public.cobrancas where creditado),
    'recebido_30d', (select coalesce(sum(valor), 0) from public.cobrancas where creditado and coalesce(pago_em, atualizado::date) > current_date - 30),
    'por_usuario', (select coalesce(jsonb_object_agg(u.email, jsonb_build_object(
                        'status', coalesce(a.status, 'sem'), 'plano', a.plano, 'pago_ate', a.pago_ate,
                        'liberado', (public.acesso_de(u.id) ->> 'liberado')::boolean)), '{}')
                    from auth.users u left join public.assinaturas a on a.user_id = u.id),
    'ultimas', (select coalesce(jsonb_agg(x order by x.atualizado desc), '[]') from (
                  select u.email, b.valor, b.status, b.forma, b.vencimento, b.pago_em, b.atualizado
                  from public.cobrancas b join auth.users u on u.id = b.user_id
                  order by b.atualizado desc limit 20) x)
  );
end $$;
revoke execute on function public.painel_cobranca() from public, anon;
grant execute on function public.painel_cobranca() to authenticated;

-- Apagar a conta com assinatura ativa deixaria o cartão sendo cobrado sem dono no app.
-- O app cancela a assinatura antes (função cancelar) e só então apaga.
create or replace function public.apagar_conta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  if exists (select 1 from public.assinaturas where user_id = auth.uid() and asaas_subscription is not null
             and status in ('pendente', 'ativa', 'atrasada')) then
    raise exception 'assinatura ativa: cancele a renovacao antes de apagar a conta';
  end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.apagar_conta() from public, anon;
grant execute on function public.apagar_conta() to authenticated;
