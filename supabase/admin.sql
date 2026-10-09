-- Orçamento Falado: painel do dono.
-- Cole tudo no SQL Editor → New query → Run. Pode rodar de novo sem estragar nada.
-- Quem é admin fica na tabela admins. Ninguém pelo site consegue ler ou mudar essa tabela.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;   -- sem nenhuma política: só o próprio banco lê
revoke all on public.admins from anon, authenticated;

-- Primeira vez: troque SEU-EMAIL-AQUI pelo e-mail da sua conta no app e rode. Se o e-mail não existir, nada acontece.
-- (Antes o admin era "a conta mais antiga"; rodar de novo depois de apagar a sua conta promovia outra pessoa.)
insert into public.admins (user_id)
select id from auth.users where lower(email) = lower('SEU-EMAIL-AQUI')
on conflict do nothing;

-- Número que veio do app, aceitando texto ou número.
create or replace function public.num(j jsonb) returns numeric
language plpgsql immutable set search_path = '' as $$
begin
  return coalesce((j #>> '{}')::numeric, 0);
exception when others then
  return 0;
end $$;

-- Totais de cada orçamento, calculados como o app calcula.
create or replace view public.orcamentos_resumo with (security_invoker = true) as
select i.user_id, i.id, i.atualizado,
       to_timestamp(public.num(i.dados -> 'criadoEm') / 1000) as criado,
       coalesce(i.dados ->> 'status', '') as status,
       greatest(0, s.subtotal - case when i.dados #>> '{desconto,tipo}' = '%'
                                     then s.subtotal * public.num(i.dados #> '{desconto,valor}') / 100
                                     else public.num(i.dados #> '{desconto,valor}') end) as total,
       coalesce((select sum(public.num(p -> 'valor')) from jsonb_array_elements(coalesce(i.dados -> 'pagamentos', '[]')) p), 0) as recebido
from public.itens i
cross join lateral (
  select coalesce(sum(public.num(it -> 'qtd') * public.num(it -> 'valorUnit')), 0) as subtotal
  from jsonb_array_elements(coalesce(i.dados -> 'itens', '[]')) it
) s
where i.colecao = 'docs' and not i.apagado;
revoke all on public.orcamentos_resumo from anon, authenticated;

-- Tudo que o painel mostra, numa chamada. Só responde para quem está em admins.
create or replace function public.painel_admin() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'acesso negado';
  end if;
  select jsonb_build_object(
    'agora', now(),
    'contas', (select count(*) from auth.users),
    'confirmadas', (select count(*) from auth.users where email_confirmed_at is not null),
    'novas_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'novas_30d', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'ativas_7d', (select count(distinct user_id) from public.itens where atualizado > now() - interval '7 days'),
    'ativas_30d', (select count(distinct user_id) from public.itens where atualizado > now() - interval '30 days'),
    'orcamentos', (select count(*) from public.orcamentos_resumo),
    'orcamentos_30d', (select count(*) from public.orcamentos_resumo where criado > now() - interval '30 days'),
    'aprovados', (select count(*) from public.orcamentos_resumo where status = 'aprovado' or recebido > 0),
    'valor_orcado', (select coalesce(sum(total), 0) from public.orcamentos_resumo),
    'valor_recebido', (select coalesce(sum(recebido), 0) from public.orcamentos_resumo),
    'cadastros_dia', (
      select coalesce(jsonb_agg(jsonb_build_object('dia', d::date, 'n', coalesce(c.n, 0)) order by d), '[]')
      from generate_series(current_date - 29, current_date, interval '1 day') d
      left join (select created_at::date dia, count(*) n from auth.users group by 1) c on c.dia = d::date),
    'cidades', (
      select coalesce(jsonb_agg(jsonb_build_object('cidade', cidade, 'n', n) order by n desc), '[]')
      from (select initcap(trim(dados ->> 'cidade')) cidade, count(*) n from public.itens
            where colecao = 'perfil' and not apagado and coalesce(trim(dados ->> 'cidade'), '') <> ''
            group by 1 order by 2 desc limit 10) x),
    'lista', (
      select coalesce(jsonb_agg(x order by x.criado desc), '[]') from (
        select u.email, u.created_at as criado, u.last_sign_in_at as ultimo_login,
               u.email_confirmed_at is not null as confirmada,
               p.dados ->> 'nome' as empresa, p.dados ->> 'cidade' as cidade,
               (select count(*) from public.orcamentos_resumo o where o.user_id = u.id) as orcamentos,
               (select coalesce(sum(total), 0) from public.orcamentos_resumo o where o.user_id = u.id) as orcado,
               (select coalesce(sum(recebido), 0) from public.orcamentos_resumo o where o.user_id = u.id) as recebido,
               (select max(atualizado) from public.itens i where i.user_id = u.id) as ultima_atividade,
               exists (select 1 from public.admins a where a.user_id = u.id) as admin
        from auth.users u
        left join public.itens p on p.user_id = u.id and p.colecao = 'perfil' and p.id = 'perfil' and not p.apagado
      ) x)
  ) into r;
  return r;
end $$;
revoke execute on function public.painel_admin() from public, anon;
grant execute on function public.painel_admin() to authenticated;

-- Para conferir quem ficou como admin:
select u.email as admin from public.admins a join auth.users u on u.id = a.user_id;
