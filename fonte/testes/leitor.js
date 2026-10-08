// Testa o leitor de fala do app (lerFala em app/index.html) com frases reais de obra.
// Rodar: node fonte/testes/leitor.js
var fs = require('fs'), path = require('path');
var html = fs.readFileSync(path.join(__dirname, '../../app/index.html'), 'utf8');
var src = html.slice(html.indexOf('// ===== núcleo'), html.indexOf('// ----- Pix copia-e-cola'));
var ctx = {}; new Function('ctx', src + ';ctx.lerFala = lerFala;')(ctx);
var casos = JSON.parse(fs.readFileSync(path.join(__dirname, 'frases-leitor.json'), 'utf8'));

function fmt(r) { return r.itens.map(function (i) { return i.descricao + ' ' + i.qtd + i.un + ' x' + i.valorUnit; }).join(' | ') + (r.cliente ? ' #' + r.cliente : ''); }
var ok = 0, falhas = 0;
function confere(frase, quer, cond) {
  var r = ctx.lerFala(frase), veio = fmt(r), erro = veio !== quer ? 'veio: ' + veio + '\n   quer: ' + quer : '';
  Object.keys(cond || {}).forEach(function (k) {
    if (JSON.stringify(r[k]) !== JSON.stringify(cond[k])) erro += '\n   ' + k + ' veio ' + JSON.stringify(r[k]) + ', quer ' + JSON.stringify(cond[k]);
  });
  if (erro) { falhas++; console.log('FALHA: ' + frase + '\n   ' + erro); } else ok++;
}
casos.itens.forEach(function (c) { confere(c[0], c[1]); });
casos.condicoes.forEach(function (c) { confere(c[0], c[1], c[2]); });
console.log(ok + '/' + (ok + falhas) + ' frases certas');
process.exit(falhas ? 1 : 0);
