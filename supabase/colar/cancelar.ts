// Função cancelar do Orçamento Falado. Cole este arquivo inteiro no editor da função no Supabase.
// Gerado de supabase/functions/_shared/cobranca.js.
// Lógica das funções de cobrança. Sem dependências: roda no Deno (Supabase Edge Functions)
// e no Node (testes). `amb` traz as variáveis de ambiente; `f` é o fetch.

const ORIGENS = ['https://matheuszampolli1.github.io', 'http://localhost:8765'];

function cors(req) {
  const o = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ORIGENS.includes(o) ? o : ORIGENS[0],
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'vary': 'origin',
  };
}
function resposta(req, status, corpo) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(req), 'content-type': 'application/json' } });
}

// Sandbox ou produção sai do prefixo da própria chave: $aact_hmlg_ (sandbox) ou $aact_prod_.
function asaasBase(chave) {
  return String(chave).startsWith('$aact_prod_') ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}
function cpfCnpjValido(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) {
    if (/^(\d)\1+$/.test(d)) return false;
    for (const t of [9, 10]) {
      let s = 0; for (let i = 0; i < t; i++) s += Number(d[i]) * (t + 1 - i);
      if (((s * 10) % 11) % 10 !== Number(d[t])) return false;
    }
    return true;
  }
  if (d.length === 14) {
    if (/^(\d)\1+$/.test(d)) return false;
    const calc = (n) => { const p = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = p.reduce((a, x, i) => a + Number(d[i]) * x, 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
    return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
  }
  return false;
}

function hojeBrasil(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora); // AAAA-MM-DD
}

function clientes(amb, f) {
  const sbKey = amb.SUPABASE_SERVICE_ROLE_KEY;
  const sbHead = { apikey: sbKey, authorization: 'Bearer ' + sbKey, 'content-type': 'application/json' };
  async function rpc(nome, args) {
    const r = await f(amb.SUPABASE_URL + '/rest/v1/rpc/' + nome, { method: 'POST', headers: sbHead, body: JSON.stringify(args) });
    const t = await r.text();
    if (!r.ok) throw new Error('banco ' + nome + ': ' + r.status + ' ' + t);
    return t ? JSON.parse(t) : null;
  }
  async function linha(tabela, filtro) {
    const r = await f(amb.SUPABASE_URL + '/rest/v1/' + tabela + '?' + filtro + '&select=*', { headers: sbHead });
    if (!r.ok) throw new Error('banco ' + tabela + ': ' + r.status + ' ' + (await r.text()));
    return (await r.json())[0] || null;
  }
  async function usuario(req) {
    const tok = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    if (!tok) return null;
    const r = await f(amb.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: sbKey, authorization: 'Bearer ' + tok } });
    if (!r.ok) return null;
    const u = await r.json();
    return u && u.id ? u : null;
  }
  const base = asaasBase(amb.ASAAS_API_KEY);
  async function asaas(metodo, caminho, corpo) {
    const r = await f(base + caminho, {
      method: metodo,
      headers: { access_token: amb.ASAAS_API_KEY, 'content-type': 'application/json', 'user-agent': 'OrcamentoFalado/1.0' },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = { bruto: t }; }
    if (!r.ok) {
      const msg = j && j.errors ? j.errors.map((e) => e.description).join(' ') : t;
      const err = new Error(msg || ('Asaas ' + r.status)); err.asaas = true; err.status = r.status; throw err;
    }
    return j;
  }
  return { rpc, linha, usuario, asaas };
}

// POST { plano: 'mensal'|'anual', nome, cpfCnpj } -> { link } da fatura (Pix, boleto ou cartão)
function criarAssinar(amb, f = fetch) {
  const c = clientes(amb, f);
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
    if (req.method !== 'POST') return resposta(req, 405, { erro: 'Use POST.' });
    try {
      const u = await c.usuario(req);
      if (!u) return resposta(req, 401, { erro: 'Entre na sua conta para assinar.' });
      const b = await req.json().catch(() => ({}));
      const plano = b.plano === 'anual' ? 'anual' : b.plano === 'mensal' ? 'mensal' : null;
      if (!plano) return resposta(req, 400, { erro: 'Escolha o plano mensal ou anual.' });
      const nome = String(b.nome || '').trim();
      const doc = String(b.cpfCnpj || '').replace(/\D/g, '');
      if (nome.length < 3) return resposta(req, 400, { erro: 'Digite seu nome completo ou o nome da empresa.' });
      if (!cpfCnpjValido(doc)) return resposta(req, 400, { erro: 'CPF ou CNPJ inválido. Confira os números.' });

      const conf = await c.linha('cobranca_config', 'id=eq.1');
      const valor = Number(plano === 'anual' ? conf.preco_anual : conf.preco_mensal);
      const atual = await c.linha('assinaturas', 'user_id=eq.' + u.id);

      // Mesmo plano já em andamento: devolve a fatura em aberto em vez de criar outra.
      if (atual && atual.asaas_subscription && atual.plano === plano && atual.status !== 'cancelada') {
        const pg = await c.asaas('GET', '/subscriptions/' + atual.asaas_subscription + '/payments');
        const aberta = (pg.data || []).find((p) => ['PENDING', 'OVERDUE'].includes(p.status));
        if (aberta) return resposta(req, 200, { link: aberta.invoiceUrl, reaproveitada: true });
        if (atual.pago_ate && new Date(atual.pago_ate) > new Date()) return resposta(req, 200, { jaAssinante: true });
      }

      let cliente = atual && atual.asaas_customer;
      if (cliente) {
        await c.asaas('POST', '/customers/' + cliente, { name: nome, cpfCnpj: doc, email: u.email });
      } else {
        const novo = await c.asaas('POST', '/customers', { name: nome, cpfCnpj: doc, email: u.email, externalReference: u.id, notificationDisabled: false });
        cliente = novo.id;
      }
      // Troca de plano: encerra a assinatura anterior; o tempo já pago continua valendo.
      if (atual && atual.asaas_subscription && atual.status !== 'cancelada') {
        await c.asaas('DELETE', '/subscriptions/' + atual.asaas_subscription).catch(() => null);
      }
      const hoje = hojeBrasil();
      const pagoAte = atual && atual.pago_ate ? hojeBrasil(new Date(atual.pago_ate)) : null;
      const venc = pagoAte && pagoAte > hoje ? pagoAte : hoje;
      const sub = await c.asaas('POST', '/subscriptions', {
        customer: cliente, billingType: 'UNDEFINED', value: valor, nextDueDate: venc,
        cycle: plano === 'anual' ? 'YEARLY' : 'MONTHLY',
        description: 'Orçamento Falado - plano ' + plano, externalReference: u.id,
      });
      const ativa = atual && atual.pago_ate && new Date(atual.pago_ate) > new Date();
      await c.rpc('salvar_assinatura', { p_user: u.id, p_plano: plano, p_customer: cliente, p_subscription: sub.id, p_status: ativa ? 'ativa' : 'pendente' });

      const pg = await c.asaas('GET', '/subscriptions/' + sub.id + '/payments');
      const primeira = (pg.data || [])[0];
      if (primeira) {
        await c.rpc('processar_evento_asaas', { p: { id: 'local_' + primeira.id + '_criada', event: 'PAYMENT_CREATED', payment: primeira } });
      }
      return resposta(req, 200, { link: primeira ? primeira.invoiceUrl : null, vencimento: venc });
    } catch (e) {
      console.error('assinar', e);
      return resposta(req, e.asaas ? 400 : 500, { erro: e.asaas ? 'O Asaas recusou: ' + e.message : 'Não deu para criar a assinatura agora. Tente de novo em alguns minutos.' });
    }
  };
}

// POST -> cancela a renovação; o acesso continua até o fim do período pago.
function criarCancelar(amb, f = fetch) {
  const c = clientes(amb, f);
  return async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
    if (req.method !== 'POST') return resposta(req, 405, { erro: 'Use POST.' });
    try {
      const u = await c.usuario(req);
      if (!u) return resposta(req, 401, { erro: 'Entre na sua conta.' });
      const atual = await c.linha('assinaturas', 'user_id=eq.' + u.id);
      if (!atual || !atual.asaas_subscription || atual.status === 'cancelada') return resposta(req, 200, { ok: true, nada: true });
      await c.asaas('DELETE', '/subscriptions/' + atual.asaas_subscription);
      await c.rpc('salvar_assinatura', { p_user: u.id, p_plano: atual.plano, p_customer: atual.asaas_customer, p_subscription: atual.asaas_subscription, p_status: 'cancelada' });
      return resposta(req, 200, { ok: true, ate: atual.pago_ate });
    } catch (e) {
      console.error('cancelar', e);
      return resposta(req, 500, { erro: 'Não deu para cancelar agora. Tente de novo ou fale com o suporte.' });
    }
  };
}

// Avisos do Asaas. Responde 200 só depois de gravar; em erro devolve 500 para o Asaas reenviar.
function criarWebhook(amb, f = fetch) {
  const c = clientes(amb, f);
  let esperado = '';
  return async (req) => {
    if (req.method !== 'POST') return new Response('ok');
    esperado = esperado || String(amb.ASAAS_WEBHOOK_TOKEN || '');
    if (esperado.length < 32) return new Response('ASAAS_WEBHOOK_TOKEN nao configurado', { status: 500 });
    const tok = req.headers.get('asaas-access-token') || '';
    if (tok.length !== esperado.length || tok !== esperado) return new Response('nao autorizado', { status: 401 });
    let ev;
    try { ev = await req.json(); } catch (e) { return new Response('json invalido', { status: 400 }); }
    try {
      const r = await c.rpc('processar_evento_asaas', { p: ev });
      return new Response(JSON.stringify({ resultado: r }), { headers: { 'content-type': 'application/json' } });
    } catch (e) {
      console.error('webhook', ev && ev.id, e);
      if (ev && ev.id) await c.rpc('esquecer_evento_asaas', { p_id: ev.id }).catch(() => null);
      return new Response('erro', { status: 500 });
    }
  };
}

Deno.serve(criarCancelar(Deno.env.toObject()));
