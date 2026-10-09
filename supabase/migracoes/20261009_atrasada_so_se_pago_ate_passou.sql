-- Só marca 'atrasada' se o período pago já acabou (pago_ate nulo ou no passado).
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
    -- só a fatura da assinatura atual conta, e só se o período pago já acabou; uma fatura velha de um plano trocado não atrasa ninguém
    update public.assinaturas set status = 'atrasada', atualizado = now()
     where user_id = uid and status in ('ativa', 'pendente') and (pago_ate is null or pago_ate < now()) and (pg ->> 'subscription' is null or asaas_subscription = pg ->> 'subscription');
    res := 'atrasada';
  else
    res := 'registrado';
  end if;
  update public.asaas_eventos set resultado = res where id = p ->> 'id';
  return res;
end $$;
