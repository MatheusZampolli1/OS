// Testa o webhook do Asaas (supabase/functions/_shared/cobranca.js) com Asaas e Supabase simulados.
// Rodar: node fonte/testes/cobranca.js
var fs = require('fs'), os = require('os'), path = require('path'), url = require('url');

var fonte = fs.readFileSync(path.join(__dirname, '../../supabase/functions/_shared/cobranca.js'), 'utf8');
var tmp = path.join(os.tmpdir(), 'cobranca-teste-' + process.pid + '.mjs');
fs.writeFileSync(tmp, fonte);

var TOKEN = 'a'.repeat(40);
var amb = { ASAAS_WEBHOOK_TOKEN: TOKEN, ASAAS_API_KEY: '$aact_hmlg_teste', SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'chave' };
var ok = 0, falhas = 0;
function confere(nome, cond, extra) { if (cond) ok++; else { falhas++; console.log('FALHA: ' + nome + (extra ? '\n   ' + extra : '')); } }

// asaas: { status, corpo } devolvido por GET /payments/:id; registra o que foi para o banco
function ambiente(asaas) {
  var chamadas = { rpc: [], asaas: [] };
  function f(u, opts) {
    u = String(u);
    if (u.indexOf('api-sandbox.asaas.com/v3/payments/') >= 0) {
      chamadas.asaas.push(u);
      if (asaas instanceof Error) return Promise.reject(asaas);
      return Promise.resolve(new Response(JSON.stringify(asaas.corpo), { status: asaas.status }));
    }
    if (u.indexOf('/rest/v1/rpc/') >= 0) {
      chamadas.rpc.push({ nome: u.split('/rpc/')[1], args: JSON.parse(opts.body) });
      return Promise.resolve(new Response(JSON.stringify('creditado 1 mes(es)'), { status: 200 }));
    }
    return Promise.resolve(new Response('{}', { status: 404 }));
  }
  return { f: f, chamadas: chamadas };
}
function pedido(corpo, token) {
  return new Request('https://x.supabase.co/functions/v1/asaas-webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'asaas-access-token': token === undefined ? TOKEN : token }, body: JSON.stringify(corpo),
  });
}
var evento = function (nome, valor) { return { id: 'evt_' + Math.random(), event: nome, payment: { id: 'pay_1', status: 'CONFIRMED', value: valor === undefined ? 29.9 : valor, subscription: 'sub_1', customer: 'cus_1' } }; };

(async function () {
  var m = await import(url.pathToFileURL(tmp).href);
  var r, e, texto;

  // token errado
  e = ambiente({ status: 200, corpo: {} });
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_CONFIRMED'), 'b'.repeat(40)));
  confere('token errado -> 401', r.status === 401);
  confere('token errado não consulta o Asaas nem grava', e.chamadas.asaas.length === 0 && e.chamadas.rpc.length === 0);

  // aviso forjado: diz pago, mas no Asaas está pendente
  e = ambiente({ status: 200, corpo: { id: 'pay_1', status: 'PENDING', value: 29.9, subscription: 'sub_1', customer: 'cus_1' } });
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_CONFIRMED')));
  texto = await r.text();
  confere('pago forjado -> 200 ignorado', r.status === 200 && texto.indexOf('ignorado') >= 0, texto);
  confere('pago forjado não grava no banco', e.chamadas.rpc.length === 0);

  // id de pagamento que não existe
  e = ambiente({ status: 404, corpo: { errors: [{ description: 'Não encontrado' }] } });
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_CONFIRMED')));
  confere('pagamento inexistente -> 200 ignorado, sem gravar', r.status === 200 && e.chamadas.rpc.length === 0);

  // atraso forjado de um pagamento que está em dia
  e = ambiente({ status: 200, corpo: { id: 'pay_1', status: 'PENDING', value: 29.9 } });
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_OVERDUE')));
  confere('atraso forjado não grava', r.status === 200 && e.chamadas.rpc.length === 0);

  // aviso legítimo: grava o pagamento que o Asaas devolveu, não o valor do aviso
  e = ambiente({ status: 200, corpo: { id: 'pay_1', status: 'RECEIVED', value: 29.9, subscription: 'sub_1', customer: 'cus_1' } });
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_RECEIVED', 9999)));
  confere('aviso legítimo -> 200', r.status === 200);
  confere('grava uma vez', e.chamadas.rpc.length === 1 && e.chamadas.rpc[0].nome === 'processar_evento_asaas');
  confere('usa o valor do Asaas (29,9), não o do aviso (9999)', e.chamadas.rpc[0] && e.chamadas.rpc[0].args.p.payment.value === 29.9, JSON.stringify(e.chamadas.rpc[0]));

  // Asaas fora do ar: 500 para o Asaas reenviar
  e = ambiente(new Error('rede caiu'));
  r = await m.criarWebhook(amb, e.f)(pedido(evento('PAYMENT_CONFIRMED')));
  confere('Asaas fora do ar -> 500 (reenvio)', r.status === 500 && e.chamadas.rpc.filter(function (c) { return c.nome === 'processar_evento_asaas'; }).length === 0);

  // aviso sem pagamento segue direto para o banco
  e = ambiente({ status: 200, corpo: {} });
  r = await m.criarWebhook(amb, e.f)(pedido({ id: 'evt_x', event: 'SUBSCRIPTION_DELETED' }));
  confere('sem pagamento não consulta o Asaas', r.status === 200 && e.chamadas.asaas.length === 0 && e.chamadas.rpc.length === 1);

  // token mais curto que 32 caracteres no ambiente: recusa tudo
  e = ambiente({ status: 200, corpo: {} });
  r = await m.criarWebhook(Object.assign({}, amb, { ASAAS_WEBHOOK_TOKEN: 'curto' }), e.f)(pedido(evento('PAYMENT_CONFIRMED'), 'curto'));
  confere('token configurado curto demais -> 500', r.status === 500);

  console.log(ok + '/' + (ok + falhas) + ' verificações certas');
  try { fs.unlinkSync(tmp); } catch (x) {}
  process.exit(falhas ? 1 : 0);
})();
