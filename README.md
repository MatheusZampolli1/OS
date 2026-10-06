# Tá Orçado

Site e app de orçamento por voz para prestadores de serviço de obra (pedreiro, pintor, eletricista, encanador, gesseiro).

- `index.html`, `precos.html`, `profissoes/`, `blog/`, `novidades.html`, `contato.html`, `termos.html`, `privacidade.html`: site, gerado por `python3 fonte/gerar_site.py` (edite o gerador, não o HTML).
- `app/`: o app. Funciona sem conta (dados no aparelho) e com conta (dados sincronizados no Supabase por `app/conta.js`).
- `supabase/banco.sql`: tabela `itens` com RLS por usuário e a função `apagar_conta()`. Rode no SQL Editor do Supabase.
- Publicado pelo GitHub Pages (branch `main`, raiz).
