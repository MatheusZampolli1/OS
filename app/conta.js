// ===== conta e sincronização =====
// Os dados continuam no celular (o app funciona sem internet). Com a conta, cada alteração
// também sobe para o Supabase, e ao abrir o app em outro aparelho tudo desce de volta.
// Cada orçamento, preço e cliente é uma linha (colecao, id); o servidor carimba a hora
// da alteração, e cada aparelho pede só o que mudou desde a última vez.
(function () {
  var SB_URL = 'https://xzumkgmzmjmlxeigicbt.supabase.co';
  var SB_KEY = 'sb_publishable_5-o29KR-a2F3ZMU7SpWKlw_eTc6X7TM'; // chave pública, feita para ficar no site

  var COLECOES = { 'orc-perfil': 'perfil', 'orc-docs': 'docs', 'orc-precos': 'precos', 'orc-clientes': 'clientes', 'orc-seq': 'seq' };
  var CHAVE_SYNC = 'orc-sync';
  var sb = null, usuario = null, timer = null, rodando = null, pendente = false;

  function el(id) { return document.getElementById(id); }
  function hash(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h >>> 0) + ':' + s.length; }
  function estado() { var s = lerJSON(CHAVE_SYNC, null); return s && s.hashes ? s : { user: null, ultimo: null, hashes: {} }; }
  function salvarEstado(s) { guardar(CHAVE_SYNC, JSON.stringify(s)); }

  // ---------- leitura e escrita das coleções locais ----------
  function itensLocais(col) {
    if (col === 'perfil') return [{ id: 'perfil', dados: perfil || {} }];
    if (col === 'seq') return [{ id: 'seq', dados: { n: Number(ler('orc-seq')) || 0 } }];
    var lista = col === 'docs' ? docs : col === 'precos' ? precos : clientes, mudou = false;
    lista.forEach(function (x) { if (!x.id) { x.id = novoId(); mudou = true; } });
    if (mudou) guardarOriginal('orc-' + col, lista);
    return lista.map(function (x) { return { id: String(x.id), dados: x }; });
  }
  function aplicarRemoto(col, linhas, st) {
    var hs = st.hashes[col] = st.hashes[col] || {};
    var locais = {}; itensLocais(col).forEach(function (x) { locais[x.id] = x.dados; });
    var mudou = false;
    linhas.forEach(function (r) {
      var local = locais[r.id];
      if (col === 'perfil' && local && !Object.keys(local).length) local = undefined; // perfil vazio não disputa com o da nuvem
      // alteração local ainda não enviada (inclusive apagar) vence; ela sobe no próximo envio
      var pendenteLocal = (local === undefined ? undefined : hash(JSON.stringify(local))) !== hs[r.id];
      if (pendenteLocal && col !== 'seq') return;
      if (col === 'perfil') { if (!r.apagado && r.dados) { perfil = r.dados; guardarOriginal('orc-perfil', perfil); mudou = true; } }
      else if (col === 'seq') { var n = Math.max(Number(ler('orc-seq')) || 0, (r.dados && r.dados.n) || 0); guardar('orc-seq', String(n)); }
      else {
        var lista = col === 'docs' ? docs : col === 'precos' ? precos : clientes;
        var i = lista.findIndex(function (x) { return String(x.id) === r.id; });
        if (r.apagado) { if (i >= 0) lista.splice(i, 1); delete hs[r.id]; mudou = true; return; }
        if (i >= 0) lista[i] = r.dados; else lista.push(r.dados);
        mudou = true;
      }
      if (!r.apagado) hs[r.id] = hash(JSON.stringify(col === 'seq' ? { n: Number(ler('orc-seq')) || 0 } : r.dados));
    });
    if (mudou && col !== 'perfil' && col !== 'seq') {
      var l = col === 'docs' ? docs : col === 'precos' ? precos : clientes;
      if (col === 'docs') l.sort(function (a, b) { return (b.criadoEm || 0) - (a.criadoEm || 0); });
      guardarOriginal('orc-' + col, l);
    }
    return mudou;
  }

  // ---------- envio e recebimento ----------
  function enviar() {
    var st = estado(), linhas = [], novos = {};
    Object.keys(COLECOES).forEach(function (k) {
      var col = COLECOES[k], hs = st.hashes[col] || {}, vistos = {};
      novos[col] = {};
      itensLocais(col).forEach(function (x) {
        vistos[x.id] = 1;
        var h = hash(JSON.stringify(x.dados)); novos[col][x.id] = h;
        if (hs[x.id] !== h) linhas.push({ user_id: usuario.id, colecao: col, id: x.id, dados: x.dados, apagado: false });
      });
      Object.keys(hs).forEach(function (id) {
        if (!vistos[id]) linhas.push({ user_id: usuario.id, colecao: col, id: id, dados: null, apagado: true });
      });
    });
    if (!linhas.length) return Promise.resolve(0);
    // em lotes, porque orçamento com assinatura pesa
    var lotes = []; for (var i = 0; i < linhas.length; i += 25) lotes.push(linhas.slice(i, i + 25));
    return lotes.reduce(function (p, lote) {
      return p.then(function () {
        return sb.from('itens').upsert(lote, { onConflict: 'user_id,colecao,id' }).then(function (r) {
          if (r.error) throw r.error;
          var s = estado();
          lote.forEach(function (x) {
            var hs = s.hashes[x.colecao] = s.hashes[x.colecao] || {};
            if (x.apagado) delete hs[x.id]; else hs[x.id] = novos[x.colecao][x.id];
          });
          salvarEstado(s);
        });
      });
    }, Promise.resolve()).then(function () { return linhas.length; });
  }
  function receber() {
    var st = estado(), todas = [];
    function pagina(de) {
      var q = sb.from('itens').select('colecao,id,dados,apagado,atualizado').order('atualizado', { ascending: true }).range(de, de + 199);
      if (st.ultimo) q = q.gte('atualizado', st.ultimo);
      return q.then(function (r) {
        if (r.error) throw r.error;
        todas = todas.concat(r.data);
        return r.data.length === 200 ? pagina(de + 200) : todas;
      });
    }
    return pagina(0).then(function (linhas) {
      var st2 = estado(), mudou = false, porCol = {};
      linhas.forEach(function (r) { (porCol[r.colecao] = porCol[r.colecao] || []).push(r); if (!st2.ultimo || r.atualizado > st2.ultimo) st2.ultimo = r.atualizado; });
      Object.keys(porCol).forEach(function (c) { if (aplicarRemoto(c, porCol[c], st2)) mudou = true; });
      salvarEstado(st2);
      if (mudou) redesenhar();
      return linhas.length;
    });
  }
  function sincronizar() {
    if (!usuario) return Promise.resolve();
    if (rodando) { pendente = true; return rodando; }
    if (!navigator.onLine) { mostrarNuvem('Sem internet. Está salvo no celular e sobe quando a conexão voltar.'); return Promise.resolve(); }
    mostrarNuvem('Sincronizando…');
    rodando = receber().then(enviar).then(function () {
      mostrarNuvem('✓ Salvo na nuvem às ' + new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
    }).catch(function (e) {
      mostrarNuvem('Não deu para salvar na nuvem agora (' + traduzir(e) + '). Está salvo no celular; tento de novo depois.');
    }).then(function () {
      rodando = null;
      if (pendente) { pendente = false; agendar(); }
    });
    return rodando;
  }
  function agendar() { if (!usuario) return; clearTimeout(timer); timer = setTimeout(sincronizar, 1500); }

  // toda gravação local agenda um envio
  var guardarOriginal = window.guardarJSON;
  var guardarTexto = window.guardar;
  window.guardarJSON = function (k, v) { guardarOriginal(k, v); if (COLECOES[k]) agendar(); };
  window.guardar = function (k, v) { var ok = guardarTexto(k, v); if (k === 'orc-seq') agendar(); return ok; };
  function guardar(k, v) { return guardarTexto(k, v); }

  function redesenhar() {
    try {
      Object.keys(CAMPOS).forEach(function (id) { el(id).value = perfil[CAMPOS[id]] || ''; });
      mostrarLogo(); tudo();
      el('aviso-perfil').hidden = !!perfil.nome;
    } catch (e) {}
  }
  function limparLocal() {
    ['orc-perfil', 'orc-docs', 'orc-precos', 'orc-clientes', 'orc-seq', CHAVE_SYNC].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    perfil = {}; docs = []; precos = []; clientes = []; atual = docVazio(); redesenhar();
  }

  // ---------- tela ----------
  function traduzir(e) {
    var m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha errados.';
    if (/Email not confirmed/i.test(m)) return 'Falta confirmar o e-mail. Abra o link que mandamos para você.';
    if (/already registered|already been registered|User already/i.test(m)) return 'Esse e-mail já tem conta. Toque em “Entrar”.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas agora. Espere alguns minutos e tente de novo.';
    if (/Password should be|at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/invalid.*email|Unable to validate email/i.test(m)) return 'Confira o e-mail digitado.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'sem conexão com o servidor';
    return m && m !== '{}' && m !== '[object Object]' ? m : 'erro inesperado, tente de novo';
  }
  function mostrarNuvem(t) { var n = el('nuvem'); if (n) n.textContent = t; }
  function msg(t, erro) { var m = el('conta-msg'); m.textContent = t; m.className = erro ? 'aviso' : 'status'; m.hidden = !t; }

  var modo = 'entrar';
  function abrir(m) {
    modo = m; msg('');
    el('t-conta').textContent = m === 'criar' ? 'Criar conta grátis' : m === 'nova-senha' ? 'Escolha uma senha nova' : 'Entrar';
    el('conta-email-l').hidden = m === 'nova-senha';
    el('conta-ok').textContent = m === 'criar' ? 'Criar conta' : m === 'nova-senha' ? 'Salvar senha' : 'Entrar';
    el('conta-senha').autocomplete = m === 'entrar' ? 'current-password' : 'new-password';
    el('conta-esqueci').hidden = m !== 'entrar';
    el('conta-troca').hidden = m === 'nova-senha';
    el('conta-troca').textContent = m === 'criar' ? 'Já tenho conta: entrar' : 'Não tenho conta: criar grátis';
    el('conta-dica').hidden = m !== 'criar';
    el('modal-conta').hidden = false;
    (m === 'nova-senha' ? el('conta-senha') : el('conta-email')).focus();
  }
  function fechar() { el('modal-conta').hidden = true; }
  function urlVolta() { return location.origin + location.pathname; }

  function enviarForm(ev) {
    ev.preventDefault();
    if (!sb) { msg('Não deu para falar com o servidor. Confira a internet e recarregue a página.', true); return; }
    var email = el('conta-email').value.trim(), senha = el('conta-senha').value;
    if (modo !== 'nova-senha' && !email) { msg('Digite seu e-mail.', true); return; }
    if (senha.length < 6) { msg('A senha precisa ter pelo menos 6 caracteres.', true); return; }
    var b = el('conta-ok'); b.disabled = true; msg('Um momento…');
    var p = modo === 'criar' ? sb.auth.signUp({ email: email, password: senha, options: { emailRedirectTo: urlVolta() } })
      : modo === 'nova-senha' ? sb.auth.updateUser({ password: senha })
      : sb.auth.signInWithPassword({ email: email, password: senha });
    p.then(function (r) {
      if (r.error) throw r.error;
      if (modo === 'criar' && !r.data.session) {
        msg('Pronto! Mandamos um link para ' + email + '. Toque no link do e-mail para ativar a conta e depois entre aqui com seu e-mail e senha.');
        return;
      }
      if (modo === 'nova-senha') { msg('Senha trocada.'); setTimeout(fechar, 900); return; }
      fechar();
    }).catch(function (e) { msg(traduzir(e), true); }).then(function () { b.disabled = false; });
  }
  function esqueci() {
    var email = el('conta-email').value.trim();
    if (!email) { msg('Digite seu e-mail acima e toque de novo em “Esqueci a senha”.', true); return; }
    sb.auth.resetPasswordForEmail(email, { redirectTo: urlVolta() }).then(function (r) {
      if (r.error) throw r.error;
      msg('Se esse e-mail tiver conta, chega um link para trocar a senha.');
    }).catch(function (e) { msg(traduzir(e), true); });
  }

  function mostrarConta() {
    var logado = !!usuario;
    el('conta-fora').hidden = logado; el('conta-dentro').hidden = !logado;
    if (logado) el('conta-quem').textContent = usuario.email || '';
    var d = el('onde-fica'); if (d) d.textContent = logado ? 'Fica salvo no celular e na sua conta.' : 'Fica salvo só neste celular. Crie uma conta para guardar na nuvem.';
  }
  function entrou(u) {
    var st = estado();
    if (st.user && st.user !== u.id) { limparLocal(); st = estado(); }
    if (st.user !== u.id) { st.user = u.id; salvarEstado(st); } // primeira vez: o que já está no celular sobe para a conta
    usuario = u; mostrarConta(); sincronizar();
  }
  function saiu() { usuario = null; mostrarConta(); if (!/apagad/.test(el('nuvem').textContent)) mostrarNuvem('Você saiu da conta.'); }

  var apagarArmado = false;
  function ligarTela() {
    el('conta-form').addEventListener('submit', enviarForm);
    el('conta-fechar').addEventListener('click', fechar);
    el('conta-esqueci').addEventListener('click', esqueci);
    el('conta-troca').addEventListener('click', function () { abrir(modo === 'criar' ? 'entrar' : 'criar'); });
    el('conta-criar').addEventListener('click', function () { abrir('criar'); });
    el('conta-entrar').addEventListener('click', function () { abrir('entrar'); });
    el('conta-sync').addEventListener('click', function () { sincronizar(); });
    el('conta-sair').addEventListener('click', function () {
      var b = el('conta-sair'); b.disabled = true;
      sincronizar().then(function () {
        var tudoEnviado = /✓/.test(el('nuvem').textContent);
        if (!tudoEnviado) { b.disabled = false; mostrarNuvem('Ainda tem coisa que não subiu para a nuvem. Conecte à internet antes de sair, senão ela se perde.'); return; }
        return sb.auth.signOut().then(function () { limparLocal(); b.disabled = false; });
      });
    });
    el('conta-apagar').addEventListener('click', function () {
      var b = el('conta-apagar');
      if (!apagarArmado) { apagarArmado = true; b.textContent = 'Toque de novo para apagar a conta e todos os dados'; setTimeout(function () { apagarArmado = false; b.textContent = 'Apagar minha conta'; }, 6000); return; }
      b.disabled = true;
      sb.rpc('apagar_conta').then(function (r) {
        if (r.error) throw r.error;
        return sb.auth.signOut({ scope: 'local' });
      }).then(function () { limparLocal(); mostrarNuvem('Conta e dados apagados.'); })
        .catch(function (e) { mostrarNuvem('Não deu para apagar: ' + traduzir(e)); })
        .then(function () { b.disabled = false; apagarArmado = false; b.textContent = 'Apagar minha conta'; });
    });
    window.addEventListener('online', agendar);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') agendar(); });
    window.addEventListener('hashchange', pelaUrl); pelaUrl();
  }
  function pelaUrl() {
    var h = location.hash.replace('#', '');
    if (h === 'criar' || h === 'entrar') { abrir(h); history.replaceState(null, '', location.pathname); }
  }

  ligarTela(); mostrarConta();
  if (!window.supabase || !window.supabase.createClient) { mostrarNuvem('Sem conexão com o servidor de contas agora.'); return; }
  sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });
  sb.auth.onAuthStateChange(function (ev, sessao) {
    if (ev === 'PASSWORD_RECOVERY') { setTimeout(function () { abrir('nova-senha'); }, 0); }
    var u = sessao && sessao.user;
    if (u && (!usuario || usuario.id !== u.id)) setTimeout(function () { entrou(u); }, 0);
    if (!u && usuario) setTimeout(saiu, 0);
  });
  window.contaDebug = { sincronizar: sincronizar, estado: estado, plano: function () { return acesso; } };

  // ---------- assinatura ----------
  // O banco decide quem tem acesso (meu_acesso); a tela só mostra e bloqueia a aba Novo.
  // Sem a cobrança ligada pelo dono, ninguém é bloqueado e a seção do plano fica escondida.
  var acesso = null, config = null;
  var real = function (v) { return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); };
  var dataBR = function (s) { return s ? new Date(s).toLocaleDateString('pt-BR') : ''; };
  var STATUS = { PENDING: 'Em aberto', OVERDUE: 'Vencida', CONFIRMED: 'Paga', RECEIVED: 'Paga', RECEIVED_IN_CASH: 'Paga', REFUNDED: 'Estornada', DELETED: 'Cancelada' };

  function lerConfig() {
    return sb.from('cobranca_config').select('*').eq('id', 1).maybeSingle().then(function (r) { if (!r.error) config = r.data; });
  }
  function lerAcesso() {
    if (!usuario) { acesso = null; return lerConfig().then(aplicarAcesso); }
    return Promise.all([sb.rpc('meu_acesso'), sb.from('cobrancas').select('*').order('vencimento', { ascending: false }).limit(12), lerConfig()])
      .then(function (rs) {
        if (rs[0].error) throw rs[0].error;
        acesso = rs[0].data; desenharPlano(acesso, rs[1].data || []); aplicarAcesso();
      }).catch(function () { aplicarAcesso(); });
  }
  function bloquear(sim, tit, txt, botao) {
    el('tela-novo').classList.toggle('bloqueado', !!sim); el('bloqueio').hidden = !sim;
    if (sim) { el('bloqueio-tit').textContent = tit; el('bloqueio-txt').textContent = txt; el('bloqueio-btn').textContent = botao; }
  }
  function aplicarAcesso() {
    var ligada = config && config.ligada_em;
    if (!usuario) {
      var lim = (config && config.limite_sem_conta) || 3;
      var passou = ligada && docs.length >= lim;
      bloquear(passou, 'Crie sua conta para continuar', 'Sem conta dá para fazer ' + lim + ' orçamentos. Com a conta você ganha ' + ((config && config.dias_teste) || 14) + ' dias grátis com tudo liberado e seus dados ficam guardados na nuvem.', 'Criar conta grátis');
      el('bloqueio-btn').onclick = function () { abrir('criar'); };
      return;
    }
    if (!acesso || !acesso.cobranca_ligada) { bloquear(false); return; }
    var vencido = acesso.motivo === 'vencido';
    bloquear(!acesso.liberado, vencido ? 'Sua assinatura venceu' : 'Seu teste grátis acabou',
      'Para continuar fazendo orçamentos, assine por ' + real(acesso.preco_mensal) + ' por mês ou ' + real(acesso.preco_anual) + ' por ano.', vencido ? 'Pagar agora' : 'Assinar');
    el('bloqueio-btn').onclick = function () { irPara('perfil'); el('plano-sec').scrollIntoView({ behavior: 'smooth' }); };
  }
  function desenharPlano(a, faturas) {
    var mostrar = a && (a.cobranca_ligada || a.motivo === 'admin');
    el('plano-sec').hidden = !mostrar;
    if (!mostrar) return;
    var s = '', d = '';
    if (a.motivo === 'admin') { s = 'Conta do dono'; d = 'Sempre liberada. Os botões abaixo servem para você testar a assinatura.'; }
    else if (a.motivo === 'teste') { s = 'Teste grátis até ' + dataBR(a.teste_ate); d = 'Tudo liberado. Se assinar agora, o período pago começa depois do teste: você não perde nenhum dia.'; }
    else if (a.motivo === 'pago') { s = 'Plano ' + (a.plano || '') + ' ativo até ' + dataBR(a.pago_ate); d = a.status === 'cancelada' ? 'A renovação está cancelada. Você usa até essa data.' : 'Renova sozinho. A fatura chega no seu e-mail antes do vencimento.'; }
    else if (a.motivo === 'tolerancia') { s = 'Pagamento atrasado'; d = 'Ainda está liberado por alguns dias. Pague a fatura em aberto abaixo para não ser bloqueado.'; }
    else if (a.motivo === 'vencido') { s = 'Assinatura vencida'; d = 'Pague a fatura em aberto ou assine de novo para voltar a fazer orçamentos.'; }
    else { s = 'Teste grátis acabou'; d = 'Assine para continuar fazendo orçamentos.'; }
    el('plano-situacao').textContent = s; el('plano-detalhe').textContent = d;
    el('plano-mensal').textContent = 'Mensal · ' + real(a.preco_mensal);
    el('plano-anual').textContent = 'Anual · ' + real(a.preco_anual) + ' (2 meses grátis)';
    var renovando = a.motivo === 'pago' && a.status !== 'cancelada';
    el('plano-botoes').hidden = renovando && a.plano === 'anual';
    el('plano-mensal').hidden = renovando && a.plano === 'mensal';
    el('plano-cancelar').hidden = !(a.status === 'ativa' || a.status === 'pendente' || a.status === 'atrasada');
    var box = el('plano-faturas'); box.textContent = '';
    faturas.forEach(function (f) {
      var it = document.createElement('div'); it.className = 'hist-item';
      it.innerHTML = '<div class="hist-topo"><b></b><span></span></div><div class="hist-acoes"></div>';
      it.querySelector('b').textContent = 'Fatura de ' + dataBR(f.vencimento + 'T12:00:00');
      it.querySelector('span').textContent = real(f.valor) + ' · ' + (STATUS[f.status] || f.status);
      if ((f.status === 'PENDING' || f.status === 'OVERDUE') && f.link) {
        var b = document.createElement('a'); b.className = 'botao primario'; b.href = f.link; b.target = '_blank'; b.rel = 'noopener'; b.textContent = 'Pagar com Pix, boleto ou cartão';
        it.querySelector('.hist-acoes').appendChild(b);
      }
      box.appendChild(it);
    });
  }
  function chamarFuncao(nome, corpo) {
    return sb.auth.getSession().then(function (r) {
      var t = r.data.session && r.data.session.access_token;
      return fetch(SB_URL + '/functions/v1/' + nome, { method: 'POST', headers: { 'content-type': 'application/json', apikey: SB_KEY, authorization: 'Bearer ' + t }, body: JSON.stringify(corpo || {}) });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.erro || 'Erro ' + r.status); return j; }); });
  }
  var planoEscolhido = 'mensal';
  function abrirAssinar(plano) {
    planoEscolhido = plano;
    var preco = acesso ? (plano === 'anual' ? acesso.preco_anual : acesso.preco_mensal) : 0;
    el('t-assinar').textContent = 'Assinar plano ' + plano;
    el('assinar-resumo').textContent = real(preco) + (plano === 'anual' ? ' por ano' : ' por mês') + '. Cancele quando quiser.';
    if (!el('assinar-nome').value) el('assinar-nome').value = perfil.nome || '';
    if (!el('assinar-doc').value) el('assinar-doc').value = perfil.doc || '';
    el('assinar-msg').hidden = true; el('modal-assinar').hidden = false; el('assinar-nome').focus();
  }
  el('plano-mensal').addEventListener('click', function () { abrirAssinar('mensal'); });
  el('plano-anual').addEventListener('click', function () { abrirAssinar('anual'); });
  el('assinar-fechar').addEventListener('click', function () { el('modal-assinar').hidden = true; });
  el('assinar-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var m = el('assinar-msg'), b = el('assinar-ok');
    m.hidden = false; m.className = 'status'; m.textContent = 'Criando sua cobrança…'; b.disabled = true;
    chamarFuncao('assinar', { plano: planoEscolhido, nome: el('assinar-nome').value, cpfCnpj: el('assinar-doc').value }).then(function (j) {
      if (j.jaAssinante) { m.textContent = 'Você já está com esse plano ativo.'; return; }
      if (!j.link) { m.textContent = 'Assinatura criada. A fatura aparece em “Seu plano” em instantes.'; lerAcesso(); return; }
      m.innerHTML = 'Pronto! <a href="" target="_blank" rel="noopener">Abrir o pagamento</a>. Depois de pagar, volte aqui: libera sozinho.';
      m.querySelector('a').href = j.link;
      window.open(j.link, '_blank', 'noopener');
      lerAcesso();
    }).catch(function (e) { m.className = 'aviso'; m.textContent = e.message; }).then(function () { b.disabled = false; });
  });
  var cancelarArmado = false;
  el('plano-cancelar').addEventListener('click', function () {
    var b = el('plano-cancelar');
    if (!cancelarArmado) { cancelarArmado = true; b.textContent = 'Toque de novo para cancelar a renovação'; setTimeout(function () { cancelarArmado = false; b.textContent = 'Cancelar a renovação'; }, 6000); return; }
    b.disabled = true;
    chamarFuncao('cancelar').then(function (j) {
      el('plano-msg').textContent = j.ate ? 'Renovação cancelada. Você usa até ' + dataBR(j.ate) + '.' : 'Renovação cancelada.';
      lerAcesso();
    }).catch(function (e) { el('plano-msg').textContent = e.message; })
      .then(function () { b.disabled = false; cancelarArmado = false; b.textContent = 'Cancelar a renovação'; });
  });
  // pagou em outra aba: ao voltar para o app, confere de novo
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') lerAcesso(); });
  var entrouOriginal = entrou, saiuOriginal = saiu;
  entrou = function (u) { entrouOriginal(u); lerAcesso(); };
  saiu = function () { saiuOriginal(); el('plano-sec').hidden = true; lerAcesso(); };
  var guardarAnterior = window.guardarJSON;
  window.guardarJSON = function (k, v) { guardarAnterior(k, v); if (k === 'orc-docs' && !usuario) aplicarAcesso(); };
  lerAcesso();
  if (location.hash === '#assinar') { history.replaceState(null, '', location.pathname); setTimeout(function () { irPara('perfil'); }, 0); }
})();
