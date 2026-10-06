# Ligar a cobrança dos assinantes

Tudo começa no **sandbox** (ambiente de teste do Asaas, dinheiro de mentira). A cobrança real só entra no fim, no passo E.
As chaves ficam só no Supabase e no Asaas. Não mande nenhuma delas no chat.

## A. Asaas (sandbox)
1. Crie uma conta grátis em https://sandbox.asaas.com.
2. Vá em **Integrações → Chaves de API** e gere uma chave. Ela começa com `$aact_hmlg_`. Copie e guarde.

## B. Supabase
3. Abra **SQL Editor → New query**, cole todo o `supabase-cobranca.sql` e clique em **Run**.
4. Abra **Edge Functions → Secrets** e crie dois segredos:
   - `ASAAS_API_KEY`: a chave do passo 2.
   - `ASAAS_WEBHOOK_TOKEN`: uma senha que você inventa, com pelo menos 40 letras e números e sem espaço. Guarde, porque ela vai de novo no passo 7.
5. Abra **Edge Functions → Deploy a new function → Via Editor** e crie três funções. Em cada uma, apague o exemplo, cole o arquivo inteiro e clique em Deploy:
   - nome `assinar`, arquivo `assinar.ts`
   - nome `cancelar`, arquivo `cancelar.ts`
   - nome `asaas-webhook`, arquivo `asaas-webhook.ts`
6. Em cada uma das três funções, abra **Details** (ou Settings) e **desligue "Verify JWT"** (ou "Enforce JWT verification"). Sem isso, o aviso do Asaas é recusado. O login continua conferido dentro das funções.

## C. Aviso de pagamento (Asaas)
7. No sandbox, abra **Integrações → Webhooks → Adicionar**:
   - URL: `https://xzumkgmzmjmlxeigicbt.supabase.co/functions/v1/assas-webhook` (o endereço que o Supabase deu à função)
   - Token de autenticação: o mesmo `ASAAS_WEBHOOK_TOKEN` do passo 4
   - Versão da API: v3. Tipo de envio: sequencial. Ativo: sim.
   - Eventos de cobrança: criada, atualizada, confirmada, recebida, vencida, removida, estornada, chargeback recebido e recebimento em dinheiro desfeito.

## D. Teste
8. No app, entre na sua conta e vá em **Perfil → Seu plano → Mensal**. Coloque seu nome e CPF. A fatura do sandbox abre.
9. No sandbox, abra **Cobranças**, entre nessa cobrança e confirme o pagamento (no sandbox existe a opção de simular ou confirmar o pagamento).
10. Volte ao app: "Seu plano" deve mostrar **Plano mensal ativo até ...**. O painel do dono mostra o pagamento em "Assinaturas".

## E. Cobrança real (só depois do teste e do seu OK)
11. Abra a conta de produção do Asaas em https://www.asaas.com. Atenção: MEI não pode vender software por assinatura (CNAE 6311-9/00 ou 6203-1/00 são vedados ao MEI); o caminho é uma ME no Simples Nacional. Confirme com um contador.
12. Gere a chave de produção (começa com `$aact_prod_`) e troque o valor de `ASAAS_API_KEY` no Supabase. O código percebe sozinho que é produção.
13. Crie o mesmo webhook do passo 7 na conta de produção.
14. No painel do dono, clique em **Ligar cobrança** (dois toques). A partir daí, cada conta ganha 14 dias de teste e depois precisa assinar. A sua conta de dono nunca é bloqueada.
