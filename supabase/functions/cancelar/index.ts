import { criarCancelar } from '../_shared/cobranca.js';

Deno.serve(criarCancelar(Deno.env.toObject()));
