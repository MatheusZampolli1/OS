#!/usr/bin/env python3
"""Gera supabase/colar/*.ts a partir de supabase/functions/_shared/cobranca.js.

Cada arquivo é a função inteira em um só arquivo, para colar no editor do Supabase.
Rodar depois de qualquer mudança em cobranca.js:  python fonte/gerar_colar.py
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / 'supabase' / 'functions' / '_shared' / 'cobranca.js'
FUNCOES = {'asaas-webhook': 'criarWebhook', 'assinar': 'criarAssinar', 'cancelar': 'criarCancelar'}

codigo = FONTE.read_bytes().decode('utf-8')
crlf = '\r\n' in codigo
codigo = codigo.replace('\r\n', '\n')
codigo = re.sub(r'^export function ', 'function ', codigo, flags=re.M)

for nome, fabrica in FUNCOES.items():
    topo = (f'// Função {nome} do Orçamento Falado. Cole este arquivo inteiro no editor da função no Supabase.\n'
            '// Gerado de supabase/functions/_shared/cobranca.js.\n')
    texto = topo + codigo.rstrip('\n') + f'\n\nDeno.serve({fabrica}(Deno.env.toObject()));\n'
    if crlf:
        texto = texto.replace('\n', '\r\n')
    destino = RAIZ / 'supabase' / 'colar' / f'{nome}.ts'
    destino.write_bytes(texto.encode('utf-8'))
    print('gerado', destino.relative_to(RAIZ))
