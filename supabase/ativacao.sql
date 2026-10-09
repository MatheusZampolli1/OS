-- Tá Orçado: medição de ativação (quem abre o app e chega a gerar o primeiro PDF).
-- Rode depois de banco.sql, admin.sql e cobranca.sql. Pode rodar de novo sem estragar nada.
-- Guarda só contagens anônimas: um número aleatório por aparelho, o tipo do evento e a hora.
-- Nenhum dado de cliente, valor ou texto do orçamento vem para cá.

create table if not exists public.eventos_app (
  id bigserial primary key,
  aparelho uuid not null,                 -- número aleatório criado no aparelho, sem ligação com a pessoa
  user_id uuid references auth.users(id) on delete set null,
  tipo text not null check (tipo in ('abriu', 'exemplo_pdf', 'pdf', 'visita_pdf')),
  em timestamptz not null default now()
);
create index if not exists eventos_app_tipo on public.eventos_app (tipo, em);
create index if not exists eventos_app_aparelho on public.eventos_app (aparelho, em);
create index if not exists eventos_app_em on public.eventos_app (em);
alter table public.eventos_app enable row level security;
drop policy if exists "qualquer um registra" on public.eventos_app;
create policy "qualquer um registra" on public.eventos_app for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));
revoke all on public.eventos_app from anon, authenticated;
grant insert on public.eventos_app to anon, authenticated;
grant usage on sequence public.eventos_app_id_seq to anon, authenticated;

-- Limite: um aparelho registra até 60 eventos por hora e o app inteiro até 5000 por hora.
-- Passou disso, o evento é descartado em silêncio (o app não percebe e o funil não infla).
-- security definer porque anon pode inserir, mas não ler a tabela que está sendo contada.
create or replace function public.limitar_eventos_app() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.eventos_app where aparelho = new.aparelho and em > now() - interval '1 hour') >= 60 then return null; end if;
  if (select count(*) from public.eventos_app where em > now() - interval '1 hour') >= 5000 then return null; end if;
  return new;
end $$;
revoke execute on function public.limitar_eventos_app() from public, anon, authenticated;
drop trigger if exists limitar_eventos_app on public.eventos_app;
create trigger limitar_eventos_app before insert on public.eventos_app
  for each row execute function public.limitar_eventos_app();

-- Painel do dono: funil dos últimos 30 dias e ativação das contas.
create or replace function public.painel_ativacao() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.admins where user_id = auth.uid()) then raise exception 'acesso negado'; end if;
  return (
    with ev as (select * from public.eventos_app where em > now() - interval '30 days'),
    por_aparelho as (
      select aparelho,
             min(em) filter (where tipo = 'abriu') as abriu,
             min(em) filter (where tipo = 'exemplo_pdf') as exemplo,
             min(em) filter (where tipo = 'pdf') as pdf
      from ev group by aparelho),
    contas as (
      select u.id, u.created_at,
             (select min(o.criado) from public.orcamentos_resumo o where o.user_id = u.id) as primeiro
      from auth.users u where not exists (select 1 from public.admins a where a.user_id = u.id))
    select jsonb_build_object(
      'aparelhos', (select count(*) from por_aparelho where abriu is not null),
      'viram_exemplo', (select count(*) from por_aparelho where exemplo is not null),
      'geraram_pdf', (select count(*) from por_aparelho where pdf is not null),
      'pdfs', (select count(*) from ev where tipo = 'pdf'),
      'visitas_pdf', (select count(*) from ev where tipo = 'visita_pdf'),
      'minutos_ate_pdf', (select round(percentile_cont(0.5) within group (order by extract(epoch from pdf - abriu) / 60)::numeric, 1)
                          from por_aparelho where pdf is not null and abriu is not null and pdf >= abriu),
      'contas', (select count(*) from contas),
      'contas_ativadas', (select count(*) from contas where primeiro is not null),
      'horas_ate_1o_orcamento', (select round(percentile_cont(0.5) within group (order by greatest(0, extract(epoch from primeiro - created_at)) / 3600)::numeric, 1)
                                 from contas where primeiro is not null))
  );
end $$;
revoke execute on function public.painel_ativacao() from public, anon;
grant execute on function public.painel_ativacao() to authenticated;
