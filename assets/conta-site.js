// Entrar, criar conta e nova senha nas páginas do site.
// A sessão fica no localStorage deste domínio, a mesma que o app usa: depois de entrar aqui,
// o app em app/ já abre conectado. Os links dos e-mails voltam para o app (endereço liberado
// no Supabase); no app, o link de troca de senha manda para nova-senha.html já com a sessão.
(function () {
  var SB_URL = 'https://xzumkgmzmjmlxeigicbt.supabase.co';
  var SB_KEY = 'sb_publishable_5-o29KR-a2F3ZMU7SpWKlw_eTc6X7TM'; // chave pública, feita para ficar no site
  var APP = new URL('app/', location.href).href;

  function el(id) { return document.getElementById(id); }
  function msg(id, t, tipo) { var m = el(id); if (!m) return; m.textContent = t || ''; m.className = 'msg-conta' + (tipo ? ' ' + tipo : ''); m.hidden = !t; }
  function traduzir(e) {
    var m = String((e && (e.message || e.error_description || e.msg)) || e || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha errados.';
    if (/Email not confirmed/i.test(m)) return 'Falta ativar a conta. Abra o link que mandamos para o seu e-mail.';
    if (/already registered|already been registered|User already/i.test(m)) return 'Esse e-mail já tem conta. Entre com ele.';
    if (/rate limit|too many|security purposes/i.test(m)) return 'Muitas tentativas agora. Espere alguns minutos e tente de novo.';
    if (/should be different|same.*password/i.test(m)) return 'A senha nova precisa ser diferente da antiga.';
    if (/Password should be|at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/invalid.*email|Unable to validate email/i.test(m)) return 'Confira o e-mail digitado.';
    if (/Failed to fetch|NetworkError|network|Load failed/i.test(m)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
    return m && m !== '{}' && m !== '[object Object]' ? m : 'Erro inesperado. Tente de novo.';
  }
  function emailOk(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }
  function irProApp() {
    var volta = new URLSearchParams(location.search).get('volta');
    location.replace(APP + (volta === 'assinar' ? '#assinar' : ''));
  }
  function ocupado(form, sim) { var b = form.querySelector('button[type=submit]'); if (b) b.disabled = sim; }

  var ver = el('ver');
  if (ver) ver.addEventListener('change', function () { el('senha').type = ver.checked ? 'text' : 'password'; });

  if (!window.supabase || !window.supabase.createClient) {
    ['msg', 'msg2'].forEach(function (id) { msg(id, 'Não deu para falar com o servidor de contas. Confira a internet e recarregue a página.', 'erro'); });
    var c = el('carregando'); if (c) c.textContent = 'Não deu para falar com o servidor de contas. Confira a internet e recarregue a página.';
    return;
  }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' } });

  function mostrarJaDentro(u) {
    var box = el('ja-dentro'); if (!box) return;
    el('ja-email').textContent = u.email || '';
    box.hidden = false;
    ['form-entrar', 'form-esqueci', 'form-criar'].forEach(function (id) { if (el(id)) el(id).hidden = true; });
  }

  // ---------- entrar ----------
  var fe = el('form-entrar');
  if (fe) {
    fe.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = el('email').value.trim(), senha = el('senha').value;
      if (!emailOk(email)) { msg('msg', 'Digite um e-mail válido.', 'erro'); el('email').focus(); return; }
      if (!senha) { msg('msg', 'Digite sua senha.', 'erro'); el('senha').focus(); return; }
      ocupado(fe, true); msg('msg', 'Entrando…');
      sb.auth.signInWithPassword({ email: email, password: senha }).then(function (r) {
        if (r.error) throw r.error;
        msg('msg', 'Pronto! Abrindo o app…', 'ok'); irProApp();
      }).catch(function (e) { msg('msg', traduzir(e), 'erro'); ocupado(fe, false); });
    });
    var fx = el('form-esqueci');
    function modoEsqueci(sim) {
      fe.hidden = sim; fx.hidden = !sim;
      if (sim) { el('email2').value = el('email').value; el('email2').focus(); } else el('email').focus();
    }
    el('esqueci').addEventListener('click', function () { modoEsqueci(true); });
    el('voltar-entrar').addEventListener('click', function () { modoEsqueci(false); });
    fx.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = el('email2').value.trim();
      if (!emailOk(email)) { msg('msg2', 'Digite um e-mail válido.', 'erro'); return; }
      ocupado(fx, true); msg('msg2', 'Mandando…');
      sb.auth.resetPasswordForEmail(email, { redirectTo: APP }).then(function (r) {
        if (r.error) throw r.error;
        msg('msg2', 'Se esse e-mail tiver conta, chega um link para trocar a senha. Olhe também o spam.', 'ok');
      }).catch(function (e) { msg('msg2', traduzir(e), 'erro'); }).then(function () { ocupado(fx, false); });
    });
    if (location.hash === '#esqueci') modoEsqueci(true);
  }

  // ---------- criar conta ----------
  var fc = el('form-criar');
  var emailCriado = '';
  if (fc) {
    fc.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = el('email').value.trim(), senha = el('senha').value;
      if (!emailOk(email)) { msg('msg', 'Digite um e-mail válido.', 'erro'); el('email').focus(); return; }
      if (senha.length < 6) { msg('msg', 'A senha precisa ter pelo menos 6 caracteres.', 'erro'); el('senha').focus(); return; }
      if (!el('aceito').checked) { msg('msg', 'Para criar a conta, marque que leu e aceita os termos.', 'erro'); el('aceito').focus(); return; }
      ocupado(fc, true); msg('msg', 'Criando sua conta…');
      sb.auth.signUp({ email: email, password: senha, options: { emailRedirectTo: APP } }).then(function (r) {
        if (r.error) throw r.error;
        // Com confirmação de e-mail ligada, um e-mail que já tem conta volta sem erro e sem identidades.
        var u = r.data.user;
        if (u && Array.isArray(u.identities) && u.identities.length === 0) throw new Error('already registered');
        if (r.data.session) { msg('msg', 'Conta criada! Abrindo o app…', 'ok'); irProApp(); return; }
        emailCriado = email;
        el('confira-email').textContent = email;
        fc.hidden = true; el('confira').hidden = false;
      }).catch(function (e) { msg('msg', traduzir(e), 'erro'); ocupado(fc, false); });
    });
    el('reenviar').addEventListener('click', function () {
      var b = el('reenviar'); b.disabled = true; msg('msg3', 'Mandando…');
      sb.auth.resend({ type: 'signup', email: emailCriado, options: { emailRedirectTo: APP } }).then(function (r) {
        if (r.error) throw r.error;
        msg('msg3', 'Mandamos de novo. Pode levar alguns minutos.', 'ok');
      }).catch(function (e) { msg('msg3', traduzir(e), 'erro'); })
        .then(function () { setTimeout(function () { b.disabled = false; }, 30000); });
    });
  }

  // ---------- nova senha ----------
  var fn = el('form-nova');
  if (fn) {
    var pronto = false;
    function comSessao(s) {
      if (pronto) return; pronto = true;
      el('carregando').hidden = true;
      if (!s) { el('expirou').hidden = false; return; }
      el('ja-email').textContent = s.user.email || ''; fn.hidden = false; el('senha').focus();
    }
    sb.auth.onAuthStateChange(function (ev, s) { if (s && (ev === 'PASSWORD_RECOVERY' || ev === 'SIGNED_IN')) setTimeout(function () { comSessao(s); }, 0); });
    sb.auth.getSession().then(function (r) {
      var s = r.data.session;
      // link ainda sendo lido da barra de endereço: espera o evento acima
      if (!s && /access_token|error/.test(location.hash)) { setTimeout(function () { comSessao(null); }, 4000); return; }
      comSessao(s);
    });
    fn.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var senha = el('senha').value;
      if (senha.length < 6) { msg('msg', 'A senha precisa ter pelo menos 6 caracteres.', 'erro'); return; }
      ocupado(fn, true); msg('msg', 'Salvando…');
      sb.auth.updateUser({ password: senha }).then(function (r) {
        if (r.error) throw r.error;
        msg('msg', 'Senha trocada! Abrindo o app…', 'ok');
        setTimeout(irProApp, 900);
      }).catch(function (e) { msg('msg', traduzir(e), 'erro'); ocupado(fn, false); });
    });
    return;
  }

  // Já conectado em entrar/criar: não pede login de novo.
  sb.auth.getSession().then(function (r) { if (r.data.session) mostrarJaDentro(r.data.session.user); });
})();
