-- Tá Orçado: aprovação por link.
-- O profissional manda um link junto com o orçamento; o cliente abre no celular, vê o orçamento
-- e toca em "Aprovar" ou "Pedir alteração". O app avisa quando o cliente abriu e quando respondeu.
-- Rode depois de banco.sql, admin.sql, cobranca.sql e ativacao.sql. Pode rodar de novo sem estragar nada.

create table if not exists public.links_orcamento (
  token         text primary key check (token ~ '^[0-9a-f]{32}$'),  -- 128 bits aleatórios, criado no aparelho
  user_id       uuid not null references auth.users(id) on delete cascade,
  doc_id        text not null check (char_length(doc_id) between 1 and 64),
  dados         jsonb not null check (octet_length(dados::text) < 600000), -- cópia só do que o cliente vê
  criado        timestamptz not null default now(),
  atualizado    timestamptz not null default now(),
  aberto_em     timestamptz,           -- primeira vez que o cliente abriu
  ultimo_aberto timestamptz,
  aberturas     integer not null default 0,
  resposta      text check (resposta in ('aprovado', 'alteracao')),
  respondido_em timestamptz,
  resposta_nome text check (char_length(resposta_nome) <= 120),
  resposta_obs  text check (char_length(resposta_obs) <= 1000),
  unique (user_id, doc_id)
);

-- O dono só lê (para saber se o cliente abriu e o que respondeu). Gravar é só pelas funções abaixo.
alter table public.links_orcamento enable row level security;
drop policy if exists "dono le" on public.links_orcamento;
create policy "dono le" on public.links_orcamento for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.links_orcamento from anon, authenticated;
grant select on public.links_orcamento to authenticated;

-- App do profissional: cria ou atualiza o link de um orçamento. Precisa estar com o plano liberado.
-- Orçamento já aprovado pelo link fica como foi aprovado (é o registro do que o cliente aceitou).
-- Se o cliente tinha pedido alteração e o orçamento mudou, ele pode responder de novo.
-- Devolve o token que vale para esse orçamento (o primeiro criado continua valendo).
drop function if exists public.publicar_orcamento(text, text, jsonb);
create or replace function public.publicar_orcamento(p_token text, p_doc_id text, p_dados jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); t text;
begin
  if uid is null then raise exception 'sem login'; end if;
  if not public.tem_acesso() then raise exception 'plano não está ativo'; end if;
  insert into public.links_orcamento as l (token, user_id, doc_id, dados)
  values (p_token, uid, p_doc_id, p_dados)
  on conflict (user_id, doc_id) do update
    set dados = excluded.dados,
        atualizado = now(),
        resposta = case when l.resposta = 'alteracao' and l.dados is distinct from excluded.dados then null else l.resposta end,
        respondido_em = case when l.resposta = 'alteracao' and l.dados is distinct from excluded.dados then null else l.respondido_em end
    where l.resposta is distinct from 'aprovado';
  select token into t from public.links_orcamento where user_id = uid and doc_id = p_doc_id;
  return t;
end $$;
revoke execute on function public.publicar_orcamento(text, text, jsonb) from public, anon;
grant execute on function public.publicar_orcamento(text, text, jsonb) to authenticated;

-- Página pública do cliente: mostra o orçamento do link e conta a abertura.
-- Quem abre o próprio link (o dono, logado no mesmo celular) não conta como "cliente abriu".
create or replace function public.ver_orcamento(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.links_orcamento;
begin
  select * into l from public.links_orcamento where token = p_token;
  if not found then return null; end if;
  if auth.uid() is distinct from l.user_id then
    update public.links_orcamento
       set aberturas = aberturas + 1, aberto_em = coalesce(aberto_em, now()), ultimo_aberto = now()
     where token = p_token;
  end if;
  return jsonb_build_object('dados', l.dados, 'resposta', l.resposta, 'respondido_em', l.respondido_em,
                            'resposta_nome', l.resposta_nome, 'resposta_obs', l.resposta_obs,
                            'dono', auth.uid() is not distinct from l.user_id);
end $$;
revoke execute on function public.ver_orcamento(text) from public;
grant execute on function public.ver_orcamento(text) to anon, authenticated;

-- Página pública do cliente: aprovar ou pedir alteração. Depois de aprovado, não muda mais.
create or replace function public.responder_orcamento(p_token text, p_resposta text, p_nome text, p_obs text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.links_orcamento;
begin
  if p_resposta not in ('aprovado', 'alteracao') then raise exception 'resposta inválida'; end if;
  select * into l from public.links_orcamento where token = p_token for update;
  if not found then raise exception 'link não encontrado'; end if;
  if auth.uid() is not distinct from l.user_id then raise exception 'o próprio profissional não responde pelo cliente'; end if;
  if l.resposta = 'aprovado' then raise exception 'orçamento já aprovado'; end if;
  if p_resposta = 'alteracao' and coalesce(btrim(p_obs), '') = '' then raise exception 'escreva o que quer mudar'; end if;
  update public.links_orcamento
     set resposta = p_resposta, respondido_em = now(),
         resposta_nome = left(nullif(btrim(p_nome), ''), 120), resposta_obs = left(nullif(btrim(p_obs), ''), 1000)
   where token = p_token;
  return jsonb_build_object('resposta', p_resposta, 'respondido_em', now());
end $$;
revoke execute on function public.responder_orcamento(text, text, text, text) from public;
grant execute on function public.responder_orcamento(text, text, text, text) to anon, authenticated;

-- Orçamento apagado no app: o link para de funcionar.
create or replace function public.links_apagar_com_doc() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.colecao = 'docs' and new.apagado then
    delete from public.links_orcamento where user_id = new.user_id and doc_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists links_apagar_com_doc on public.itens;
create trigger links_apagar_com_doc after insert or update on public.itens
  for each row execute function public.links_apagar_com_doc();
