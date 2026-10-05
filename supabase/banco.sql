-- Orçamento Falado: tabela de dados por conta.
-- Cole tudo no Supabase em SQL Editor → New query → Run. Pode rodar de novo sem estragar nada.

create table if not exists public.itens (
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  colecao   text not null check (colecao in ('perfil', 'docs', 'precos', 'clientes', 'seq')),
  id        text not null check (char_length(id) between 1 and 64),
  dados     jsonb check (dados is null or octet_length(dados::text) < 3000000),
  apagado   boolean not null default false,
  atualizado timestamptz not null default now(),
  primary key (user_id, colecao, id)
);
create index if not exists itens_user_atualizado on public.itens (user_id, atualizado);

-- Cada conta só enxerga e altera as próprias linhas.
alter table public.itens enable row level security;
drop policy if exists "dono le" on public.itens;
drop policy if exists "dono cria" on public.itens;
drop policy if exists "dono altera" on public.itens;
drop policy if exists "dono apaga" on public.itens;
create policy "dono le" on public.itens for select to authenticated using ((select auth.uid()) = user_id);
create policy "dono cria" on public.itens for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "dono altera" on public.itens for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono apaga" on public.itens for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.itens from anon;
grant select, insert, update, delete on public.itens to authenticated;

-- A hora de alteração é sempre a do servidor (é por ela que os aparelhos sincronizam).
create or replace function public.itens_carimbo() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado := now();
  return new;
end $$;
drop trigger if exists itens_carimbo on public.itens;
create trigger itens_carimbo before insert or update on public.itens
  for each row execute function public.itens_carimbo();

-- Botão "Apagar minha conta" (LGPD): apaga o usuário e, em cascata, todos os dados dele.
create or replace function public.apagar_conta() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'sem login'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke execute on function public.apagar_conta() from public, anon;
grant execute on function public.apagar_conta() to authenticated;
