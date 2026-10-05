import { criarAssinar } from '../_shared/cobranca.js';

Deno.serve(criarAssinar(Deno.env.toObject()));
