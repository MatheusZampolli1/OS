#!/usr/bin/env python3
"""Gera as páginas estáticas do site do Orçamento Falado.

Rode na raiz do repositório:  python3 fonte/gerar_site.py
O app fica em app/ e não é gerado aqui.
"""
import html
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'https://matheuszampolli1.github.io/OS/'
NOME = 'Orçamento Falado'

# Canal de atendimento. Vazio esconde o item no site.
WHATSAPP = '5511989167926'  # só dígitos, com DDI
EMAIL = ''
RESPONSAVEL = 'Matheus Zampolli'

PRECO_MES = 'R$ 29,90'
PRECO_TRI = 'R$ 79,90'
PRECO_TRI_MES = 'R$ 26,63'
PRECO_ANO = 'R$ 299'
PRECO_ANO_MES = 'R$ 24,92'
ECON_TRI = 'R$ 9,80 a cada 3 meses (11%)'
ECON_ANO = 'R$ 59,80 por ano (17%)'

PROFISSOES = {
    'pedreiro': {
        'nome': 'Pedreiro', 'titulo': 'Orçamento de pedreiro pelo celular',
        'chamada': 'Reboco, contrapiso, piso e parede: fale o serviço e o orçamento sai em PDF.',
        'fala': 'Orçamento para o seu Jorge: reboco 32 metros quadrados a 28 reais, contrapiso 18 metros a 35 reais e retirada de entulho 2 unidades a 150.',
        'itens': [('Reboco de parede', 'm²'), ('Contrapiso', 'm²'), ('Assentamento de piso', 'm²'), ('Assentamento de revestimento de parede', 'm²'),
                  ('Levantar parede de bloco', 'm²'), ('Rodapé', 'm'), ('Demolição de parede', 'm²'), ('Retirada de entulho', 'un')],
        'dica': 'Separe material e mão de obra em itens diferentes. O cliente entende melhor o preço e você evita discussão quando o material sobe.',
    },
    'pintor': {
        'nome': 'Pintor', 'titulo': 'Orçamento de pintura pelo celular',
        'chamada': 'Mediu a parede, falou o preço por metro, mandou no WhatsApp. Sem planilha.',
        'fala': 'Orçamento para a dona Márcia: pintura de parede com 2 demãos 85 metros quadrados a 18 reais e massa corrida 40 metros a 14 reais.',
        'itens': [('Pintura de parede com 2 demãos', 'm²'), ('Pintura de teto', 'm²'), ('Massa corrida', 'm²'), ('Textura', 'm²'),
                  ('Lixamento e preparação', 'm²'), ('Pintura de porta', 'un'), ('Pintura de grade ou portão', 'm²')],
        'dica': 'Diga no orçamento quantas demãos estão incluídas e se a tinta é sua ou do cliente. É a dúvida que mais vira briga no fim da obra.',
    },
    'eletricista': {
        'nome': 'Eletricista', 'titulo': 'Orçamento de eletricista pelo celular',
        'chamada': 'Ponto de luz, tomada, chuveiro e quadro: o orçamento sai por ponto, do jeito que você cobra.',
        'fala': 'Orçamento para o Ricardo: instalação de tomada 6 pontos a 60 reais, troca de disjuntor 2 unidades a 80 e instalação de chuveiro 1 a 120.',
        'itens': [('Instalação de tomada', 'pt'), ('Instalação de interruptor', 'pt'), ('Ponto de luz', 'pt'), ('Instalação de chuveiro', 'un'),
                  ('Troca de disjuntor', 'un'), ('Montagem de quadro de distribuição', 'un'), ('Passagem de fiação', 'm'), ('Instalação de luminária', 'un')],
        'dica': 'Cobre a visita técnica como item separado. Se o cliente fechar, você pode dar desconto do mesmo valor no total.',
    },
    'encanador': {
        'nome': 'Encanador', 'titulo': 'Orçamento de encanador pelo celular',
        'chamada': 'Torneira, vaso, desentupimento e vazamento: orçamento na hora, ainda na casa do cliente.',
        'fala': 'Orçamento para a Patrícia: caça vazamento 1 a 250 reais, troca de sifão 2 unidades a 70 e troca de torneira 1 a 90.',
        'itens': [('Troca de torneira', 'un'), ('Instalação de vaso sanitário', 'un'), ('Desentupimento', 'un'), ('Troca de sifão', 'un'),
                  ('Ponto de água', 'pt'), ('Ponto de esgoto', 'pt'), ('Caça vazamento', 'un'), ("Instalação de caixa d'água", 'un')],
        'dica': 'Em serviço de urgência, mande o orçamento antes de começar e peça o "ok" por escrito. A assinatura na tela resolve isso em segundos.',
    },
    'gesseiro': {
        'nome': 'Gesseiro', 'titulo': 'Orçamento de gesso e drywall pelo celular',
        'chamada': 'Forro, parede de drywall, sanca e moldura: metro quadrado e metro linear no mesmo orçamento.',
        'fala': 'Orçamento para o Paulo: forro de drywall 24 metros quadrados a 95 reais e sanca de gesso 14 metros a 60.',
        'itens': [('Forro de drywall', 'm²'), ('Parede de drywall', 'm²'), ('Forro de gesso', 'm²'), ('Sanca de gesso', 'm'),
                  ('Moldura de gesso', 'm'), ('Tratamento de juntas', 'm²')],
        'dica': 'Sanca e moldura se cobram por metro linear; forro e parede, por metro quadrado. Deixar a unidade certa no orçamento evita a pergunta "isso é por quê?".',
    },
}

UNIDADES = {'m²': 'metro quadrado', 'm': 'metro linear', 'pt': 'ponto', 'un': 'unidade'}

e = html.escape


def cabeca(titulo, descricao, base, caminho, extra=''):
    return f'''<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(titulo)}</title>
<meta name="description" content="{e(descricao)}">
<link rel="canonical" href="{URL}{caminho}">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(descricao)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta name="theme-color" content="#1d2428">
<link rel="icon" href="{base}assets/icone.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap">
<link rel="stylesheet" href="{base}assets/site.css">
{extra}</head>
<body>
'''


def topo(base):
    links = [('Funções', f'{base}#funcoes'), ('Profissões', f'{base}profissoes/'), ('Preços', f'{base}precos.html'),
             ('Blog', f'{base}blog/'), ('Novidades', f'{base}novidades.html')]
    nav = ''.join(f'<a href="{h}">{t}</a>' for t, h in links)
    return f'''<header class="topo"><div class="wrap">
<a class="marca" href="{base}"><span class="faixa" aria-hidden="true"></span>{NOME}</a>
<nav class="menu" aria-label="Principal">{nav}<a href="{base}entrar.html">Entrar</a><a class="botao primario peq" href="{base}criar-conta.html">Criar conta grátis</a></nav>
<details class="menu-mob"><summary>Menu</summary><nav aria-label="Principal">{nav}<a href="{base}entrar.html">Entrar</a><a href="{base}criar-conta.html"><b>Criar conta grátis</b></a></nav></details>
</div></header>
<main>
'''


def contato_itens(base):
    itens = []
    if WHATSAPP:
        itens.append(f'<li><a href="https://wa.me/{WHATSAPP}" rel="noopener">WhatsApp</a></li>')
    if EMAIL:
        itens.append(f'<li><a href="mailto:{EMAIL}">{EMAIL}</a></li>')
    itens.append(f'<li><a href="{base}contato.html">Contato</a></li>')
    return ''.join(itens)


def rodape(base):
    profs = ''.join(f'<li><a href="{base}profissoes/{k}.html">{p["nome"]}</a></li>' for k, p in PROFISSOES.items())
    return f'''</main>
<footer class="rodape"><div class="wrap">
<div class="marca-col"><a class="marca" href="{base}"><span class="faixa" aria-hidden="true"></span>{NOME}</a>
<p class="nota">Orçamento, recibo e cobrança por voz para quem trabalha com obra. Feito no Brasil, para WhatsApp e Pix.</p></div>
<div><h3>Produto</h3><ul><li><a href="{base}#funcoes">Funções</a></li><li><a href="{base}precos.html">Preços</a></li><li><a href="{base}novidades.html">Novidades</a></li><li><a href="{base}app/">Abrir o app</a></li></ul></div>
<div><h3>Profissões</h3><ul>{profs}</ul></div>
<div><h3>Ajuda</h3><ul><li><a href="{base}blog/">Blog</a></li>{contato_itens(base)}<li><a href="{base}termos.html">Termos de uso</a></li><li><a href="{base}privacidade.html">Privacidade</a></li></ul></div>
</div></footer>
</body>
</html>
'''


def chamada_final(base):
    return f'''<section class="secao chamada"><div class="wrap">
<h2>Seu próximo orçamento pode sair em um minuto.</h2>
<p class="sub">Crie a conta, fale o primeiro serviço e mande o PDF para você mesmo no WhatsApp para ver como fica.</p>
<div class="botoes"><a class="botao primario" href="{base}criar-conta.html">Criar conta grátis</a><a class="botao" href="{base}app/">Testar sem conta</a></div>
</div></section>
'''


def pagina(caminho, titulo, descricao, corpo, extra=''):
    base = '../' * caminho.count('/')
    conteudo = cabeca(titulo, descricao, base, caminho.replace('index.html', ''), extra) + topo(base) + corpo(base) + rodape(base)
    destino = os.path.join(RAIZ, caminho)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, 'w', encoding='utf-8') as f:
        f.write(conteudo)
    return caminho


# ---------------------------------------------------------------- início
PERGUNTAS = [
    ('Preciso instalar alguma coisa?',
     'Não. O app abre no navegador do celular. Se quiser, use "Adicionar à tela inicial" para ele ficar com cara de aplicativo.'),
    ('Funciona sem internet?',
     'Depois da primeira vez que você abre, sim: dá para montar o orçamento, gerar o PDF e guardar. A voz depende do celular; no Chrome para Android ela usa a internet. Sem sinal, você digita.'),
    ('O cliente precisa baixar algum app?',
     'Não. Ele recebe o PDF no WhatsApp, com o código Pix pronto para copiar e colar.'),
    ('O Pix cai na minha conta?',
     'Sim. O código usa a sua chave Pix. O dinheiro vai direto do cliente para você; nós não passamos o pagamento por nenhum intermediário.'),
    ('Isso substitui a nota fiscal?',
     'Não. O app faz orçamento, recibo e relatório de serviço. Nota fiscal de serviço (NFS-e) ainda não é emitida por ele.'),
    ('Onde ficam os meus dados?',
     'Sem conta, ficam só no seu celular, e você pode fazer uma cópia de segurança. Com a conta, ficam guardados na nuvem e aparecem em qualquer aparelho em que você entrar.'),
    ('Funciona no iPhone?',
     'O app abre em qualquer celular. O reconhecimento de voz foi testado no Chrome para Android; se a voz não funcionar no seu aparelho, dá para digitar os itens.'),
    ('Quanto custa?',
     f'Enquanto o app está em lançamento, é grátis. Depois, o plano será {PRECO_MES} por mês ou {PRECO_ANO} por ano, com 14 dias grátis para testar e sem cartão no cadastro.'),
]


def faq_html(perguntas):
    return '<div class="faq">' + ''.join(f'<details><summary>{e(q)}</summary><p>{e(r)}</p></details>' for q, r in perguntas) + '</div>'


def inicio(base):
    profs = ''.join(f'<a class="prof" href="{base}profissoes/{k}.html"><b>{p["nome"]}</b><span>{e(p["itens"][0][0])}, {e(p["itens"][1][0].lower())}…</span></a>'
                    for k, p in PROFISSOES.items())
    return f'''<section class="hero"><div class="wrap">
<div class="hero-texto">
<span class="selo"><i aria-hidden="true"></i>Grátis durante o lançamento</span>
<h1>Fale o serviço.<br>O orçamento sai pronto.</h1>
<p class="sub">Para pedreiro, pintor, eletricista, encanador e gesseiro. Você fala no celular, o app monta o orçamento em PDF com Pix e você manda no WhatsApp do cliente, ainda na obra.</p>
<div class="botoes"><a class="botao primario" href="{base}criar-conta.html">Criar conta grátis</a><a class="botao" href="#como">Ver como funciona</a></div>
<p class="miudo">Sem cartão. Sem instalar nada. Funciona no navegador do celular.</p>
</div>
<div class="celular" role="img" aria-label="Exemplo de tela do app: a fala vira um orçamento em PDF">
<div class="tela">
<span class="rotulo">Exemplo · você fala</span>
<p class="fala">“Orçamento pra dona Márcia: pintura de parede duas demãos, 85 metros a 18 reais, e massa corrida 40 metros a 14.”</p>
<div class="mic-falso"><i aria-hidden="true"></i>OUVINDO</div>
<span class="rotulo">O app monta</span>
<div class="doc">
<span class="tit">Orçamento nº 12 · Márcia</span>
<div class="lin"><span>Pintura 2 demãos · 85 m²</span><span>1.530,00</span></div>
<div class="lin"><span>Massa corrida · 40 m²</span><span>560,00</span></div>
<div class="tot"><span>Total</span><span>R$ 2.090,00</span></div>
<div class="lin"><span>Sinal 30% via Pix</span><span>627,00</span></div>
</div>
<div class="zap-falso">Enviar no WhatsApp</div>
</div></div>
</div></section>

<section class="secao alt" id="como"><div class="wrap">
<div class="cab"><span class="etiqueta">Como funciona</span><h2>Três passos, na frente do cliente.</h2></div>
<div class="passos">
<div class="passo"><h3>Fale</h3><p>Aperte o microfone e diga o serviço, a quantidade e o preço do jeito que você fala no dia a dia. Se não disser o preço, o app usa o da sua tabela.</p></div>
<div class="passo"><h3>Confira</h3><p>Os itens aparecem separados, com unidade e subtotal. Ajuste o que quiser com o dedo, ponha fotos, desconto e o sinal.</p></div>
<div class="passo"><h3>Envie</h3><p>Sai um PDF com sua marca, o código Pix e o campo de aceite. Um toque e ele vai para o WhatsApp do cliente.</p></div>
</div>
</div></section>

<section class="secao" id="funcoes"><div class="wrap">
<div class="cab"><span class="etiqueta">Funções</span><h2>Do orçamento ao dinheiro na conta.</h2><p class="sub">Tudo que o prestador faz no papel ou na cabeça, num lugar só.</p></div>
<div class="funcoes">
<div class="funcao"><h3>Orçamento em um minuto</h3><ul>
<li>Voz em português, com números, “mil”, metro quadrado, ponto e diária</li>
<li>Tabela de preços que aprende sozinha com cada orçamento</li>
<li>Lista pronta de serviços por profissão</li>
<li>Até 5 fotos e a sua logo no PDF</li></ul></div>
<div class="funcao"><h3>Cliente aprova na hora</h3><ul>
<li>Assinatura com o dedo na tela, com nome, data e hora</li>
<li>Prazo, garantia e condições já no documento</li>
<li>Lembrete pelo WhatsApp para quem não respondeu</li></ul></div>
<div class="funcao"><h3>Receba sem esquecer ninguém</h3><ul>
<li>Pix copia e cola e QR Code com o valor certo</li>
<li>Sinal, parcelas e recibo de cada pagamento</li>
<li>Lista de quem ainda deve e lembrete de cobrança com o Pix do saldo</li></ul></div>
<div class="funcao"><h3>Controle do seu negócio</h3><ul>
<li>Painel com o que está esperando, a receber e recebido no mês</li>
<li>Clientes salvos e relatório de serviço com fotos</li>
<li>Planilha para o contador e pedido de avaliação no Google</li></ul></div>
</div>
</div></section>

<section class="secao alt"><div class="wrap">
<div class="cab"><span class="etiqueta">Profissões</span><h2>Feito para quem trabalha com obra.</h2></div>
<div class="profs">{profs}</div>
</div></section>

<section class="secao"><div class="wrap">
<div class="trio">
<div><b>Feito para WhatsApp e Pix</b><p>É onde o seu cliente está. O orçamento chega como PDF na conversa, com o Pix pronto.</p></div>
<div><b>Funciona na obra</b><p>Sem sinal no canteiro? Monte, salve e mande quando a internet voltar.</p></div>
<div><b>Seus dados são seus</b><p>Exporte tudo quando quiser: cópia de segurança completa e planilha para o contador.</p></div>
</div>
</div></section>

<section class="secao alt" id="perguntas"><div class="wrap">
<div class="cab"><span class="etiqueta">Perguntas</span><h2>Perguntas frequentes</h2></div>
{faq_html(PERGUNTAS)}
</div></section>
''' + chamada_final(base)


# ---------------------------------------------------------------- preços
def precos(base):
    return f'''<section class="secao"><div class="wrap">
<div class="cab"><span class="etiqueta">Preços</span><h1>Um plano, tudo incluído.</h1><p class="sub">Sem limite de orçamentos, sem cobrança por cliente e sem taxa sobre o seu Pix. Mesmo app em todos os planos; muda só o período.</p></div>
<p class="faixa-aviso">Lançamento: enquanto estamos em teste, o app é grátis para todo mundo. Ninguém será cobrado sem aviso antes.</p>
<div class="planos" style="margin-top:20px">
<div class="plano"><span class="etiqueta">Mensal</span><p class="valor">{PRECO_MES}<small> /mês</small></p>
<ul><li>14 dias grátis, sem cartão</li><li>Cancele quando quiser</li><li>Todas as funções</li></ul></div>
<div class="plano"><span class="etiqueta">Trimestral</span><p class="valor">{PRECO_TRI}<small> /3 meses</small></p>
<p class="miudo">Sai {PRECO_TRI_MES} por mês.</p>
<ul><li>14 dias grátis, sem cartão</li><li>Cancele quando quiser</li><li>Todas as funções</li></ul></div>
<div class="plano dest"><span class="etiqueta">Anual · 2 meses de presente</span><p class="valor">{PRECO_ANO}<small> /ano</small></p>
<p class="miudo">Sai {PRECO_ANO_MES} por mês.</p>
<ul><li>14 dias grátis, sem cartão</li><li>Todas as funções</li><li>Preço travado por 12 meses</li></ul></div>
</div>
<div class="botoes" style="margin-top:24px"><a class="botao primario" href="{base}criar-conta.html">Criar conta grátis</a></div>
</div></section>
<section class="secao alt"><div class="wrap">
<div class="cab"><h2>O que muda de um plano para o outro</h2><p class="sub">As funções são as mesmas nos três. Muda o período, o preço e a economia.</p></div>
<div class="tabela comparar"><table>
<tr><th></th><th>Mensal</th><th>Trimestral</th><th>Anual</th></tr>
<tr><td>Quanto paga</td><td class="num">{PRECO_MES}</td><td class="num">{PRECO_TRI}</td><td class="num">{PRECO_ANO}</td></tr>
<tr><td>De quanto em quanto tempo</td><td>Todo mês</td><td>A cada 3 meses</td><td>Uma vez por ano</td></tr>
<tr><td>Sai por mês</td><td class="num">{PRECO_MES}</td><td class="num">{PRECO_TRI_MES}</td><td class="num">{PRECO_ANO_MES}</td></tr>
<tr><td>Economia em relação ao mensal</td><td>—</td><td class="num">{ECON_TRI}</td><td class="num">{ECON_ANO}</td></tr>
<tr><td>Preço travado</td><td>1 mês</td><td>3 meses</td><td>12 meses</td></tr>
<tr><td>Todas as funções</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
<tr><td>Cancelar quando quiser</td><td>Sim</td><td>Sim</td><td>Sim</td></tr>
</table></div>
</div></section>
<section class="secao"><div class="wrap">
<div class="cab"><h2>O que está incluído</h2></div>
<div class="tabela"><table>
<tr><th>Função</th><th>Incluído</th></tr>
<tr><td>Orçamento por voz e por digitação</td><td>Sim, sem limite</td></tr>
<tr><td>Tabela de preços e lista por profissão</td><td>Sim</td></tr>
<tr><td>PDF com logo, fotos, Pix e assinatura</td><td>Sim</td></tr>
<tr><td>Recibo, sinal e parcelas</td><td>Sim</td></tr>
<tr><td>Lembretes de resposta e de cobrança no WhatsApp</td><td>Sim</td></tr>
<tr><td>Painel, clientes e relatório de serviço</td><td>Sim</td></tr>
<tr><td>Planilha para o contador e cópia de segurança</td><td>Sim</td></tr>
<tr><td>Dados na nuvem, em vários aparelhos</td><td>Sim, com a conta</td></tr>
</table></div>
</div></section>
<section class="secao"><div class="wrap">
<div class="cab"><h2>Dúvidas sobre o plano</h2></div>
{faq_html([
    ('Preciso pôr cartão para testar?', 'Não. O teste de 14 dias não pede cartão. No fim, você escolhe se quer continuar.'),
    ('Vocês cobram taxa sobre o que eu recebo?', 'Não. O Pix vai da conta do cliente direto para a sua. Não ficamos com nenhuma parte.'),
    ('E se eu cancelar?', 'Você continua podendo exportar todos os seus dados: cópia de segurança completa e planilha.'),
    ('Como vou pagar?', 'No cartão de crédito, que renova sozinho a cada período, ou por Pix e boleto, com uma fatura no seu e-mail a cada período. Durante o lançamento, não há cobrança.'),
    ('E quando acabam os 14 dias?', 'Você escolhe um plano e paga. Se não assinar, o app para de criar e enviar orçamentos, recibos e relatórios. Seus dados continuam guardados e você pode ver e exportar tudo quando quiser.'),
    ('E se um pagamento atrasar?', 'O app continua funcionando por 3 dias. Depois disso, a criação de documentos fica pausada até o pagamento cair, e volta sozinha assim que ele é confirmado.'),
    ('Posso desistir e pedir o dinheiro de volta?', 'Sim. Em até 7 dias depois do primeiro pagamento, devolvemos o valor inteiro (direito de arrependimento do Código de Defesa do Consumidor). Depois disso, o cancelamento vale no fim do período já pago.'),
])}
</div></section>
''' + chamada_final(base)


# ---------------------------------------------------------------- profissões
def profissao(chave):
    p = PROFISSOES[chave]

    def corpo(base):
        linhas = ''.join(f'<tr><td>{e(d)}</td><td>{e(u)}</td><td>{UNIDADES[u]}</td></tr>' for d, u in p['itens'])
        outras = ''.join(f'<a class="prof" href="{k}.html"><b>{q["nome"]}</b></a>' for k, q in PROFISSOES.items() if k != chave)
        return f'''<section class="hero"><div class="wrap">
<div class="hero-texto">
<span class="etiqueta">Para {p["nome"].lower()}</span>
<h1>{e(p["titulo"])}</h1>
<p class="sub">{e(p["chamada"])}</p>
<div class="botoes"><a class="botao primario" href="{base}criar-conta.html">Criar conta grátis</a><a class="botao" href="{base}app/">Testar agora</a></div>
</div>
<div class="celular" role="img" aria-label="Exemplo de fala de um {p["nome"].lower()}"><div class="tela">
<span class="rotulo">Exemplo · você fala</span>
<p class="fala">“{e(p["fala"])}”</p>
<div class="mic-falso"><i aria-hidden="true"></i>OUVINDO</div>
<div class="zap-falso">Orçamento pronto em PDF</div>
</div></div>
</div></section>
<section class="secao alt"><div class="wrap estreito">
<div class="cab"><span class="etiqueta">Já vem pronto</span><h2>Serviços de {p["nome"].lower()} na sua tabela</h2>
<p class="sub">Escolha “{p["nome"]}” no perfil e estes serviços entram na sua tabela com a unidade certa. O preço é o seu: você põe uma vez e o app lembra.</p></div>
<div class="tabela"><table><tr><th>Serviço</th><th>Unidade</th><th>Cobrado por</th></tr>{linhas}</table></div>
</div></section>
<section class="secao"><div class="wrap estreito">
<div class="caixa"><b>Dica de quem faz orçamento todo dia</b><p>{e(p["dica"])}</p></div>
</div></section>
<section class="secao alt"><div class="wrap">
<div class="cab"><h2>Outras profissões</h2></div>
<div class="profs" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">{outras}</div>
</div></section>
''' + chamada_final(base)
    return corpo


def profissoes_indice(base):
    cards = ''.join(f'<a class="prof" href="{k}.html"><b>{p["nome"]}</b><span>{e(p["chamada"])}</span></a>' for k, p in PROFISSOES.items())
    return f'''<section class="secao"><div class="wrap">
<div class="cab"><span class="etiqueta">Profissões</span><h1>Um app, cinco ofícios.</h1><p class="sub">Cada profissão vem com a lista de serviços e as unidades que você já usa: metro quadrado, metro linear, ponto e unidade.</p></div>
<div class="profs" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">{cards}</div>
</div></section>
''' + chamada_final(base)


# ---------------------------------------------------------------- novidades
VERSOES = [
    ('Em construção', 'breve', [
        'Conta com login: seus orçamentos, clientes e preços guardados na nuvem e em qualquer aparelho',
        'Assinatura do orçamento à distância, por link',
        'Aviso quando o cliente abrir o orçamento',
        'Mais de uma pessoa usando a mesma empresa',
    ]),
    ('Versão 3 · 05/10/2026', '', [
        'Abas: Novo, Orçamentos, Preços, Clientes e Perfil',
        'Tabela de preços que aprende sozinha e lista pronta por profissão',
        'Assinatura do cliente na tela, com nome, data e hora no PDF',
        'Desconto em R$ ou %, sinal, parcelas e recibo de cada pagamento',
        'Lembrete de resposta, lembrete de cobrança com Pix do saldo e pedido de avaliação no Google pelo WhatsApp',
        'Relatório de serviço com fotos, painel do mês, planilha para o contador e cópia de segurança',
        'Funciona sem internet depois da primeira visita',
    ]),
    ('Versão 2 · 05/10/2026', '', [
        'Logo e até 5 fotos no PDF',
        'Sinal de 30%, 50% ou 100% via Pix, garantia e campo de aceite',
        'Recibo em PDF e lista de orçamentos com situação',
    ]),
    ('Versão 1 · 05/10/2026', '', [
        'Orçamento por voz em português, PDF e envio pelo WhatsApp',
        'Pix copia e cola no padrão do Banco Central',
        'Correção: palavras repetidas no microfone do Chrome para Android',
    ]),
]


def novidades(base):
    blocos = ''
    for titulo, tag, itens in VERSOES:
        t = f'<span class="tag breve">Em breve</span>' if tag else ''
        blocos += f'<div class="versao">{t}<h2>{e(titulo)}</h2><ul>' + ''.join(f'<li>{e(i)}</li>' for i in itens) + '</ul></div>'
    return f'''<section class="secao"><div class="wrap estreito">
<div class="cab"><span class="etiqueta">Novidades</span><h1>O que mudou no app</h1><p class="sub">Cada melhoria, na ordem em que entrou.</p></div>
{blocos}
</div></section>
''' + chamada_final(base)


# ---------------------------------------------------------------- contato
def contato(base):
    canais = []
    if WHATSAPP:
        canais.append(f'<a class="botao primario" href="https://wa.me/{WHATSAPP}" rel="noopener">Falar no WhatsApp</a>')
    if EMAIL:
        canais.append(f'<p>E-mail: <b>{e(EMAIL)}</b></p>')
    if not canais:
        canais.append('<p>O canal de atendimento está sendo preparado e aparece aqui em breve.</p>')
    return f'''<section class="secao"><div class="wrap estreito">
<div class="cab"><span class="etiqueta">Contato</span><h1>Fale com a gente</h1><p class="sub">Dúvida, sugestão ou problema no app: responda por aqui que a gente ajuda.</p></div>
<div class="botoes">{''.join(canais)}</div>
</div></section>
<section class="secao alt"><div class="wrap">
<div class="cab"><h2>Antes de chamar</h2></div>
{faq_html(PERGUNTAS[:6])}
</div></section>
'''


# ---------------------------------------------------------------- legal
def termos(base):
    return f'''<article class="wrap estreito artigo">
<span class="etiqueta">Documento</span>
<h1>Termos de uso</h1>
<p class="meta">Atualizado em 05/10/2026</p>
<p>Estes termos valem para quem usa o {NOME} (o “app”), no endereço {URL}. Ao criar uma conta ou usar o app, você concorda com eles.</p>
<h2>1. O que o app faz</h2>
<p>O app ajuda prestadores de serviço a montar orçamentos, recibos e relatórios de serviço, gerar código Pix com a chave do próprio prestador e enviar documentos pelo WhatsApp. O app não intermedeia pagamentos: o dinheiro vai do cliente direto para a conta do prestador.</p>
<h2>2. Sua responsabilidade</h2>
<ul>
<li>Conferir valores, quantidades e condições antes de enviar qualquer documento. O reconhecimento de voz pode errar.</li>
<li>Informar uma chave Pix que seja sua.</li>
<li>Ter autorização para guardar os dados dos seus clientes que você colocar no app.</li>
<li>Cumprir as obrigações fiscais do seu negócio. O app não emite nota fiscal.</li>
</ul>
<h2>3. Conta</h2>
<p>Você é responsável por manter sua senha em segredo. Se perceber uso indevido, fale com a gente pelo <a href="{base}contato.html">contato</a>.</p>
<h2>4. Preço e cancelamento</h2>
<p>Durante o lançamento, o app é gratuito. Quando a cobrança começar, os preços estarão na página <a href="{base}precos.html">Preços</a>, com aviso prévio a quem já usa.</p>
<ul>
<li><b>Teste:</b> 14 dias grátis com todas as funções, sem cartão, uma vez por pessoa. O teste começa quando a conta é criada (ou quando a cobrança começar, para quem já usava).</li>
<li><b>Planos:</b> mensal, trimestral ou anual, renovados automaticamente ao fim de cada período até você cancelar. No cartão, a renovação é cobrada sozinha; no Pix ou boleto, enviamos uma fatura por e-mail.</li>
<li><b>Fim do teste ou atraso:</b> sem plano pago, o app deixa de criar e enviar orçamentos, recibos e relatórios. Em caso de atraso, isso só acontece 3 dias depois do vencimento. Seus dados continuam disponíveis para ver e exportar.</li>
<li><b>Cancelamento:</b> a qualquer momento, pelo próprio app, sem multa. Vale no fim do período já pago, sem devolução proporcional.</li>
<li><b>Arrependimento:</b> em até 7 dias do primeiro pagamento, você pode desistir e receber o valor inteiro de volta (art. 49 do Código de Defesa do Consumidor). Peça pelo <a href="{base}contato.html">contato</a>.</li>
<li><b>Mudança de preço:</b> avisamos por e-mail antes. O preço novo só vale a partir da próxima renovação; o período já pago não muda.</li>
<li><b>Pagamentos:</b> processados pelo Asaas. Não guardamos dados de cartão.</li>
</ul>
<h2>5. Disponibilidade</h2>
<p>Trabalhamos para o app ficar sempre no ar, mas ele pode ter interrupções. Recomendamos guardar uma cópia de segurança dos seus dados de vez em quando, pela aba Perfil.</p>
<h2>6. Seus dados</h2>
<p>Os orçamentos, clientes e preços que você cria são seus. Você pode exportar ou apagar tudo a qualquer momento. Como tratamos dados pessoais está na <a href="{base}privacidade.html">Política de privacidade</a>.</p>
<h2>7. Mudanças</h2>
<p>Se estes termos mudarem, a data acima é atualizada e quem tem conta é avisado antes de a mudança valer.</p>
<h2>8. Lei e foro</h2>
<p>Estes termos seguem as leis do Brasil, incluindo o Código de Defesa do Consumidor quando aplicável.</p>
</article>
'''


def privacidade(base):
    return f'''<article class="wrap estreito artigo">
<span class="etiqueta">Documento</span>
<h1>Política de privacidade</h1>
<p class="meta">Atualizado em 05/10/2026</p>
<p>Esta política explica quais dados o {NOME} trata, para quê e quais são os seus direitos pela Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>
<h2>Quem é o responsável</h2>
<p>O controlador dos dados é {RESPONSAVEL}, responsável pelo {NOME}. Pedidos sobre seus dados podem ser feitos pelo <a href="{base}contato.html">contato</a>.</p>
<h2>Quais dados</h2>
<ul>
<li><b>Conta:</b> e-mail e senha (a senha é guardada de forma cifrada; nós não conseguimos lê-la).</li>
<li><b>Seu perfil:</b> nome da empresa, telefone, chave Pix, logo e profissão, que você mesmo informa.</li>
<li><b>Seu trabalho:</b> orçamentos, preços, clientes (nome, telefone, endereço), fotos e assinaturas que você coloca no app.</li>
</ul>
<h2>Voz</h2>
<p>O reconhecimento de voz é feito pelo próprio navegador do seu celular. No Google Chrome, o navegador envia o áudio ao serviço de voz do Google para transformar em texto. O {NOME} recebe só o texto, não grava nem guarda o áudio.</p>
<h2>Para que usamos</h2>
<ul>
<li>Fazer o app funcionar: guardar e mostrar seus orçamentos em qualquer aparelho (execução de contrato).</li>
<li>Responder seus pedidos de suporte.</li>
<li>Avisar sobre mudanças importantes no app ou nos preços.</li>
</ul>
<p>Não vendemos seus dados nem os dos seus clientes, e não usamos esses dados para publicidade.</p>
<h2>Onde ficam</h2>
<p>Sem conta, os dados ficam só no seu aparelho. Com conta, ficam no Supabase, serviço de banco de dados e login que usamos. Cada conta só consegue ler os próprios dados: essa regra é aplicada no banco de dados, não apenas na tela.</p>
<h2>Por quanto tempo</h2>
<p>Enquanto a sua conta existir. Se você apagar a conta, os dados são apagados.</p>
<h2>Seus direitos</h2>
<p>Você pode pedir a qualquer momento: confirmação de que tratamos seus dados, acesso, correção, exportação, exclusão e informações sobre com quem compartilhamos. Boa parte disso você faz sozinho no app: exportar (cópia de segurança) e apagar.</p>
<h2>Dados dos seus clientes</h2>
<p>Quando você guarda dados de um cliente no app, você é quem decide sobre esses dados, e nós os tratamos só para o app funcionar para você.</p>
<h2>Cookies</h2>
<p>O site não usa cookies de publicidade nem de rastreamento. O app guarda informações no próprio navegador para funcionar sem internet e manter você conectado.</p>
</article>
'''


# ---------------------------------------------------------------- blog
POSTS = [
    {
        'slug': 'o-que-colocar-no-orcamento-de-obra',
        'titulo': 'O que colocar num orçamento de obra para o cliente fechar',
        'resumo': 'Os itens que evitam a pergunta “mas isso não estava incluído?” e deixam o cliente confortável para dizer sim.',
        'data': '05/10/2026',
        'corpo': '''
<p>O orçamento é a primeira coisa “oficial” que o cliente recebe de você. Um papel bem feito passa confiança antes mesmo de você começar o serviço. E a maior parte das brigas no fim da obra nasce de algo que não estava escrito no começo.</p>
<h2>1. Seus dados e os do cliente</h2>
<p>Nome ou nome da empresa, telefone, e, se tiver, CNPJ ou MEI. Do cliente: nome, telefone e endereço da obra. Parece óbvio, mas um orçamento sem nome some no meio das conversas do WhatsApp.</p>
<h2>2. Um item por serviço, com unidade</h2>
<p>Em vez de “reforma do banheiro: R$ 4.000”, separe: demolição, contrapiso, assentamento de piso, revestimento de parede. Cada um com quantidade, unidade (m², metro, ponto, unidade) e preço. O cliente entende onde está o dinheiro e, se quiser cortar algo, corta um item em vez de pedir desconto no total.</p>
<h2>3. Material: de quem é</h2>
<p>Deixe claro se o material está incluído ou se é por conta do cliente. Se estiver incluído, coloque como item separado. Se o preço do material mudar, você ajusta só aquela linha.</p>
<h2>4. Prazo e validade</h2>
<p>Dois prazos diferentes: quanto tempo leva o serviço e até quando o orçamento vale. Uma validade curta (por exemplo, 15 dias) protege você quando o material sobe.</p>
<h2>5. Forma de pagamento e sinal</h2>
<p>Quanto de entrada, quanto na metade, quanto no fim. Com o Pix já no orçamento, o cliente paga o sinal na hora em que aceita, sem ter que pedir a chave depois.</p>
<h2>6. Garantia</h2>
<p>Quanto tempo de garantia você dá sobre o serviço. Isso pesa na decisão do cliente quando ele está comparando três orçamentos.</p>
<h2>7. O aceite</h2>
<p>Um campo para o cliente assinar, com data. Pode ser no papel ou com o dedo na tela do celular. Ele transforma uma conversa em um combinado.</p>
<div class="caixa"><b>No app</b><p>Todos esses campos já vêm no PDF do Orçamento Falado: seus dados, itens com unidade, prazo, validade, sinal com Pix, garantia e assinatura na tela.</p></div>
''',
    },
    {
        'slug': 'como-cobrar-sinal-sem-perder-o-cliente',
        'titulo': 'Como pedir sinal sem perder o cliente',
        'resumo': 'Sinal protege seu tempo e seu material. O segredo está em como e quando você pede.',
        'data': '05/10/2026',
        'corpo': '''
<p>Muito prestador tem receio de pedir sinal e parecer desconfiado. Mas quem já comprou material para um cliente que sumiu sabe o preço de não pedir. O sinal não é desconfiança: é o que garante a sua agenda para aquele cliente.</p>
<h2>Peça junto com o orçamento, não depois</h2>
<p>Se o sinal aparece só quando o cliente já aceitou, parece uma condição nova. Se já está escrito no orçamento, é parte do combinado desde o começo. Escreva: “Sinal de 30% para reservar a data e comprar o material”.</p>
<h2>Explique para que serve</h2>
<p>“Para reservar a data” e “para comprar o material” são motivos que o cliente entende. Uma frase basta.</p>
<h2>Facilite o pagamento</h2>
<p>Cada passo a mais é uma chance de o cliente deixar para depois. Mande o código Pix com o valor do sinal já preenchido. Ele copia, cola e pronto.</p>
<h2>Dê recibo na hora</h2>
<p>Recebeu o sinal, mande o recibo. O cliente fica tranquilo e você tem o registro de quanto falta receber.</p>
<h2>Quanto pedir</h2>
<p>Não existe regra única. Muitos prestadores usam entre 30% e 50%, ou o valor do material. O importante é ser o mesmo critério para todos os clientes e estar escrito.</p>
<div class="caixa"><b>No app</b><p>Escolha sinal de 30%, 50% ou 100% e o Pix já sai com o valor certo no PDF. Quando o cliente pagar, registre e o recibo sai com um toque.</p></div>
''',
    },
    {
        'slug': 'como-calcular-metro-quadrado-de-parede',
        'titulo': 'Como calcular o metro quadrado de parede para orçamento de pintura',
        'resumo': 'A conta simples que evita cobrar a menos, e o que fazer com portas e janelas.',
        'data': '05/10/2026',
        'corpo': '''
<p>Errar a metragem é o jeito mais rápido de trabalhar de graça. A conta é simples, mas tem detalhes que fazem diferença no total.</p>
<h2>A conta básica</h2>
<p>Área de uma parede = largura × altura. Uma parede de 4 metros de largura e 2,70 m de altura tem 4 × 2,70 = 10,8 m². Some todas as paredes do cômodo.</p>
<h2>Jeito rápido para um cômodo inteiro</h2>
<p>Some os quatro lados do cômodo (o perímetro) e multiplique pela altura. Um quarto de 3 m × 4 m tem perímetro de 3 + 4 + 3 + 4 = 14 m. Com pé-direito de 2,70 m: 14 × 2,70 = 37,8 m² de parede.</p>
<h2>Teto</h2>
<p>O teto é largura × comprimento do cômodo. No mesmo quarto: 3 × 4 = 12 m². Coloque como item separado, porque dá mais trabalho por metro do que a parede.</p>
<h2>Portas e janelas: descontar ou não?</h2>
<p>Muitos pintores não descontam vãos pequenos, porque o recorte em volta deles dá trabalho. Vãos grandes, como uma porta de vidro ou um janelão, costumam ser descontados. O que importa é você decidir um critério e manter.</p>
<h2>Demãos</h2>
<p>O preço por m² normalmente já inclui as demãos que você combinou. Escreva no orçamento quantas são: “pintura com 2 demãos”. Se o cliente pedir uma terceira, é um item a mais.</p>
<h2>Quantidade de tinta</h2>
<p>O rendimento muda de tinta para tinta e de superfície para superfície. Use o que está escrito na lata do produto que você vai usar, considerando o número de demãos.</p>
<div class="caixa"><b>No app</b><p>Fale “pintura de parede com 2 demãos, 37,8 metros quadrados a 18 reais” e o item já sai com a unidade e o subtotal.</p></div>
''',
    },
]


def blog_indice(base):
    itens = ''.join(f'<a class="post" href="{p["slug"]}.html"><h2 style="font-size:1.5rem">{e(p["titulo"])}</h2><p>{e(p["resumo"])}</p><span>{p["data"]}</span></a>' for p in POSTS)
    return f'''<section class="secao"><div class="wrap estreito">
<div class="cab"><span class="etiqueta">Blog</span><h1>Dicas para quem vive de obra</h1><p class="sub">Orçamento, cobrança e organização, sem enrolação.</p></div>
<div class="lista-blog">{itens}</div>
</div></section>
''' + chamada_final(base)


def post(p):
    def corpo(base):
        return f'''<article class="wrap estreito artigo">
<a class="etiqueta" href="./">← Blog</a>
<h1>{e(p["titulo"])}</h1>
<p class="meta">{p["data"]}</p>
{p["corpo"]}
</article>
''' + chamada_final(base)
    return corpo


# ---------------------------------------------------------------- conta
# Páginas próprias de login. Usam a mesma sessão do app (supabase-js guarda no localStorage
# deste domínio), então quem entra aqui já abre o app conectado.
SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/dist/umd/supabase.js'


def conta_scripts(base):
    return f'<script src="{SUPABASE_JS}"></script>\n<script src="{base}assets/conta-site.js"></script>\n'


def ja_dentro(base, acao):
    return f'''<div id="ja-dentro" class="form-conta" hidden><p style="margin:0">Você já está conectado como <b id="ja-email"></b>.</p>
<a class="botao primario" href="{base}app/">Abrir o app</a>
<p class="miudo" style="margin:0">Para {acao}, abra o app e toque em Perfil → Sair.</p></div>
'''


def pag_entrar(base):
    return f'''<section class="conta-pag"><div class="wrap">
<div class="cab"><h1>Entrar</h1><p class="sub">Use o e-mail e a senha da sua conta.</p></div>
{ja_dentro(base, 'trocar de conta')}<form id="form-entrar" class="form-conta" novalidate>
<label for="email">E-mail<input id="email" type="email" autocomplete="email" inputmode="email" required></label>
<label for="senha">Senha<input id="senha" type="password" autocomplete="current-password" minlength="6" required></label>
<label class="ver-senha"><input id="ver" type="checkbox"> Mostrar senha</label>
<button class="botao primario" type="submit">Entrar</button>
<p id="msg" class="msg-conta" role="status" hidden></p>
<button id="esqueci" class="link" type="button">Esqueci a senha</button>
</form>
<form id="form-esqueci" class="form-conta" novalidate hidden>
<p style="margin:0">Digite o e-mail da conta. Mandamos um link para você escolher uma senha nova.</p>
<label for="email2">E-mail<input id="email2" type="email" autocomplete="email" inputmode="email" required></label>
<button class="botao primario" type="submit">Mandar o link</button>
<p id="msg2" class="msg-conta" role="status" hidden></p>
<button id="voltar-entrar" class="link" type="button">Voltar para entrar</button>
</form>
<p class="troca-conta">Ainda não tem conta? <a href="{base}criar-conta.html"><b>Criar conta grátis</b></a></p>
</div></section>
''' + conta_scripts(base)


def pag_criar(base):
    return f'''<section class="conta-pag"><div class="wrap">
<div class="cab"><h1>Criar conta grátis</h1><p class="sub">Seus orçamentos ficam guardados na nuvem e aparecem em qualquer celular em que você entrar.</p></div>
{ja_dentro(base, 'criar outra conta')}<form id="form-criar" class="form-conta" novalidate>
<label for="email">E-mail<input id="email" type="email" autocomplete="email" inputmode="email" required></label>
<label for="senha">Senha<input id="senha" type="password" autocomplete="new-password" minlength="6" required></label>
<label class="ver-senha"><input id="ver" type="checkbox"> Mostrar senha</label>
<p class="miudo" style="margin:0">Pelo menos 6 caracteres.</p>
<label class="ver-senha"><input id="aceito" type="checkbox" required> <span>Li e aceito os <a href="{base}termos.html" target="_blank" rel="noopener">termos de uso</a> e a <a href="{base}privacidade.html" target="_blank" rel="noopener">política de privacidade</a>.</span></label>
<button class="botao primario" type="submit">Criar conta</button>
<p id="msg" class="msg-conta" role="status" hidden></p>
</form>
<div id="confira" class="form-conta" hidden>
<h2 style="font-size:1.6rem">Confira seu e-mail</h2>
<p style="margin:0">Mandamos um link para <b id="confira-email"></b>. Toque nele para ativar a conta: o app abre já conectado.</p>
<p class="miudo" style="margin:0">Não chegou? Olhe a caixa de spam e a de promoções.</p>
<button id="reenviar" class="botao" type="button">Mandar o link de novo</button>
<p id="msg3" class="msg-conta" role="status" hidden></p>
</div>
<p class="troca-conta">Já tem conta? <a href="{base}entrar.html"><b>Entrar</b></a></p>
</div></section>
''' + conta_scripts(base)


def pag_nova_senha(base):
    return f'''<section class="conta-pag"><div class="wrap">
<div class="cab"><h1>Escolha uma senha nova</h1></div>
<p id="carregando" class="msg-conta">Conferindo o link…</p>
<div id="expirou" class="form-conta" hidden><p style="margin:0">Esse link expirou ou já foi usado. Peça outro na tela de entrar, em “Esqueci a senha”.</p>
<a class="botao primario" href="{base}entrar.html#esqueci">Pedir outro link</a></div>
<form id="form-nova" class="form-conta" novalidate hidden>
<p style="margin:0">Conta: <b id="ja-email"></b></p>
<label for="senha">Senha nova<input id="senha" type="password" autocomplete="new-password" minlength="6" required></label>
<label class="ver-senha"><input id="ver" type="checkbox"> Mostrar senha</label>
<button class="botao primario" type="submit">Salvar a senha</button>
<p id="msg" class="msg-conta" role="status" hidden></p>
</form>
</div></section>
''' + conta_scripts(base)


# ---------------------------------------------------------------- geração
def gerar():
    feitas = []
    feitas.append(pagina('index.html', f'{NOME}: orçamento por voz para quem trabalha com obra',
                         'Fale o serviço e receba o orçamento pronto em PDF, com Pix e assinatura, para mandar no WhatsApp. Para pedreiro, pintor, eletricista, encanador e gesseiro.', inicio))
    feitas.append(pagina('precos.html', f'Preços · {NOME}', f'Um plano com tudo incluído: {PRECO_MES} por mês ou {PRECO_ANO} por ano, com 14 dias grátis. Grátis durante o lançamento.', precos))
    feitas.append(pagina('profissoes/index.html', f'Profissões · {NOME}', 'Orçamento por voz para pedreiro, pintor, eletricista, encanador e gesseiro.', profissoes_indice))
    for k, p in PROFISSOES.items():
        feitas.append(pagina(f'profissoes/{k}.html', f'{p["titulo"]} · {NOME}', p['chamada'], profissao(k)))
    feitas.append(pagina('novidades.html', f'Novidades · {NOME}', 'Tudo o que mudou no app, versão por versão.', novidades))
    feitas.append(pagina('contato.html', f'Contato · {NOME}', 'Fale com o suporte do Orçamento Falado.', contato))
    feitas.append(pagina('termos.html', f'Termos de uso · {NOME}', 'Termos de uso do Orçamento Falado.', termos))
    feitas.append(pagina('privacidade.html', f'Privacidade · {NOME}', 'Política de privacidade do Orçamento Falado (LGPD).', privacidade))
    feitas.append(pagina('blog/index.html', f'Blog · {NOME}', 'Dicas de orçamento, cobrança e organização para quem trabalha com obra.', blog_indice))
    for p in POSTS:
        feitas.append(pagina(f'blog/{p["slug"]}.html', f'{p["titulo"]} · {NOME}', p['resumo'], post(p)))

    feitas.append(pagina('entrar.html', f'Entrar · {NOME}', 'Entre na sua conta do Orçamento Falado.', pag_entrar))
    feitas.append(pagina('criar-conta.html', f'Criar conta grátis · {NOME}', 'Crie sua conta grátis no Orçamento Falado e guarde seus orçamentos na nuvem.', pag_criar))
    pagina('nova-senha.html', f'Nova senha · {NOME}', 'Troca de senha da conta.', pag_nova_senha, '<meta name="robots" content="noindex">\n')

    urls = [URL + c.replace('index.html', '') for c in feitas] + [URL + 'app/']
    with open(os.path.join(RAIZ, 'sitemap.xml'), 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        f.writelines(f'  <url><loc>{u}</loc></url>\n' for u in urls)
        f.write('</urlset>\n')
    with open(os.path.join(RAIZ, 'robots.txt'), 'w', encoding='utf-8') as f:
        f.write(f'User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {URL}sitemap.xml\n')
    print('\n'.join(feitas))


if __name__ == '__main__':
    gerar()
