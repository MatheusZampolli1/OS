import { criarWebhook } from '../_shared/cobranca.js';

Deno.serve(criarWebhook(Deno.env.toObject()));
