#!/usr/bin/env python3
"""Gera dados/exemplo.js com faturas 100% FICTÍCIAS (pessoas, lojas e valores inventados).
Determinístico (semente fixa). Uso: python3 ferramentas/gerar-exemplo.py
Os cenários foram escolhidos para exercitar todos os destaques do painel:
cartão adicional com muitas compras online, assinatura cobrada em dólar com IOF,
cobrança duplicada, parcelas antigas, estornos, anuidade e rotativo caro."""
import json, pathlib, random
from datetime import date, timedelta

random.seed(2026)
raiz = pathlib.Path(__file__).resolve().parent.parent
MESES = ['2026-08', '2026-09', '2026-10']
TITULAR, ADICIONAL = 'Ana', 'Pedro'

# banco, produto, dia de vencimento, limite, rotativo % a.m. (None = não informado), cartões {final: portador}
BANCOS = [
    ('Nubank', 'Mastercard', 15, 8000.00, None, {'4821': TITULAR, '7310': TITULAR}),
    ('Inter', 'Mastercard Gold', 10, 12000.00, 14.90, {'1904': TITULAR}),
    ('Itaú', 'Visa Platinum', 20, 18000.00, 11.80, {'5566': TITULAR, '9087': ADICIONAL}),
]

# estabelecimento, categoria, faixa de valor
LOJAS = {
    'mercado':  [('Supermercado Bom Preço', 'Mercado', (90, 420)), ('Hortifruti Verde Vale', 'Mercado', (25, 90)), ('Açougue Boi Gordo', 'Mercado', (60, 180))],
    'comida':   [('iFood', 'Alimentação fora', (35, 110)), ('Padaria Pão Quente', 'Alimentação fora', (12, 45)), ('Cantina da Praça', 'Alimentação fora', (45, 160))],
    'posto':    [('Posto Estrela', 'Combustível', (120, 280)), ('Auto Posto Rota 10', 'Combustível', (80, 250))],
    'farmacia': [('Farmácia Saúde Mais', 'Farmácia e saúde', (18, 140)), ('Drogaria Bem Estar', 'Farmácia e saúde', (25, 95))],
    'online':   [('Shopee', 'Compras online', (19, 89)), ('Mercado Livre', 'Compras online', (35, 260)), ('Amazon', 'Compras online', (29, 199))],
    'transp':   [('Uber', 'Transporte', (14, 48))],
    'lazer':    [('Cine Estação', 'Lazer', (38, 90)), ('Livraria Página 9', 'Lazer', (35, 120))],
    'pet':      [('Pet Feliz', 'Pet', (60, 190))],
    'casa':     [('Casa & Cia Utilidades', 'Casa', (40, 230)), ('Gás e Água Fonte Boa', 'Casa', (95, 130))],
}
ASSINATURAS = [('Netflix', 55.90), ('Spotify', 21.90), ('Google One', 9.99), ('Academia Forma', 99.90)]
PARCELADOS = [  # loja, categoria, valor da parcela, total de parcelas, mês da compra (AAAA-MM-DD), banco, cartão
    ('Magazine Eletro', 'Casa', 189.90, 10, '2026-04-12', 'Itaú', '5566'),
    ('Móveis Aconchego', 'Casa', 312.40, 8, '2026-06-03', 'Inter', '1904'),
    ('Ótica Visão Clara', 'Farmácia e saúde', 96.50, 6, '2026-07-18', 'Nubank', '4821'),
    ('Curso Online Pro', 'Educação', 74.90, 12, '2026-02-01', 'Nubank', '7310'),
    ('Pneus & Cia', 'Veículo', 142.75, 5, '2026-08-09', 'Itaú', '9087'),
]

def dia(mes, d):
    a, m = map(int, mes.split('-'))
    return date(a, m, 1) + timedelta(days=d - 1)

def mes_anterior(mes):
    a, m = map(int, mes.split('-'))
    return f'{a - 1}-12' if m == 1 else f'{a}-{m - 1:02d}'

def valor(faixa): return round(random.uniform(*faixa), 2)

faturas, lancamentos = [], []
for mi, mes in enumerate(MESES):
    compras_de = mes_anterior(mes)  # compras do mês anterior entram na fatura deste mês
    for banco, produto, venc, limite, rot, cartoes in BANCOS:
        itens = []
        finais = list(cartoes)
        def add(data, desc, est, cat, v, cartao=None, parcela='', tipo='compra'):
            c = cartao if cartao is not None else random.choice(finais)
            itens.append(dict(data=data.isoformat() if isinstance(data, date) else data, descricao=desc, estabelecimento=est,
                              categoria=cat, valor=round(v, 2), cartao=c, portador=cartoes.get(c, TITULAR), parcela=parcela, tipo=tipo))
        # gastos do dia a dia, mais intensos no Itaú; cresce um pouco a cada mês
        n = {'Nubank': 14, 'Inter': 18, 'Itaú': 16}[banco] + mi * 2
        for _ in range(n):
            grupo = random.choice(['mercado', 'mercado', 'comida', 'comida', 'posto', 'farmacia', 'transp', 'lazer', 'pet', 'casa'])
            est, cat, faixa = random.choice(LOJAS[grupo])
            add(dia(compras_de, random.randint(1, 28)), est.upper(), est, cat, valor(faixa), cartao=[c for c in finais if cartoes[c] == TITULAR][0])
        # cartão adicional no Itaú: muitas compras online pequenas (vira o "maior gasto")
        if banco == 'Itaú':
            for _ in range(22 + mi * 6):
                est, cat, faixa = random.choice(LOJAS['online'][:1] * 3 + LOJAS['online'])
                add(dia(compras_de, random.randint(1, 28)), est.upper() + ' *PEDIDO', est, cat, valor(faixa), cartao='9087')
            for _ in range(2 + mi):  # devoluções
                est = 'Shopee'
                add(dia(compras_de, random.randint(5, 28)), 'ESTORNO SHOPEE', est, 'Créditos e estornos', -valor((19, 70)), cartao='9087', tipo='estorno')
        # assinaturas no Nubank, uma em dólar com IOF; duplicidade no último mês
        if banco == 'Nubank':
            for est, v in ASSINATURAS:
                add(dia(compras_de, 8 if est == 'Spotify' else random.randint(3, 12)), est, est, 'Assinaturas digitais', v, cartao='7310')
            usd = round(random.uniform(19.5, 21.0), 2)
            v = round(usd * 5.42, 2)
            add(dia(compras_de, 18), f'Ferramenta IA Pro (USD {usd:.2f})', 'Ferramenta IA Pro', 'Assinaturas digitais', v, cartao='7310')
            add(dia(compras_de, 18), 'IOF de "Ferramenta IA Pro"', 'Ferramenta IA Pro', 'Taxas, IOF e juros', round(v * 0.0438, 2), cartao='', tipo='iof')
            if mes == MESES[-1]:
                add(dia(compras_de, 8), 'Spotify', 'Spotify', 'Assinaturas digitais', 21.90, cartao='7310')
        if banco == 'Inter':
            add(dia(compras_de, 27), 'ANUIDADE', 'Anuidade', 'Taxas, IOF e juros', 22.90, cartao='1904', parcela=f'{mi + 4}/12', tipo='anuidade')
        # parcelas antigas que caem neste mês
        for loja, cat, vp, total_p, compra, b, c in PARCELADOS:
            if b != banco: continue
            a, m, d = map(int, compra.split('-'))
            k = (int(mes[:4]) - a) * 12 + int(mes[5:]) - m
            if 1 <= k <= total_p:
                add(compra, f'{loja.upper()} PARC {k:02d}/{total_p:02d}', loja, cat, vp, cartao=c, parcela=f'{k}/{total_p}')
        itens.sort(key=lambda x: x['data'])
        total = round(sum(i['valor'] for i in itens), 2)
        a_vencer = round(sum(vp * max(0, total_p - ((int(mes[:4]) - int(compra[:4])) * 12 + int(mes[5:]) - int(compra[5:7])))
                             for _, _, vp, total_p, compra, b, _ in PARCELADOS if b == banco), 2)
        usado = round(min(limite * 0.95, total + a_vencer + random.uniform(0, limite * 0.08)), 2)
        f = dict(mes=mes, banco=banco, cartao=produto, titular=TITULAR, total=f'{total:.2f}',
                 vencimento=f'{mes}-{venc:02d}', fechamento=(dia(mes, venc) - timedelta(days=7)).isoformat(),
                 limite_total=f'{limite:.2f}', limite_utilizado=f'{usado:.2f}', a_vencer=f'{a_vencer:.2f}',
                 pagamento_minimo=f'{max(total * 0.15, 50):.2f}' if rot else '', juros_rotativo_am=f'{rot:.2f}' if rot else '',
                 arquivo=f'exemplo-{banco.lower().replace("ú", "u")}-{mes}.pdf')
        faturas.append(f)
        for i, it in enumerate(itens, 1):
            lancamentos.append(dict(id=f'ex-{banco.lower().replace("ú", "u")}-{mes}-{i:03d}', mes=mes, banco=banco, cartao=it['cartao'],
                                    portador=it['portador'], adicional='sim' if it['portador'] != TITULAR else 'nao', data=it['data'],
                                    descricao=it['descricao'], estabelecimento=it['estabelecimento'], categoria=it['categoria'],
                                    parcela=it['parcela'], valor=f"{it['valor']:.2f}", tipo=it['tipo']))

# ---- notas fiscais / cupons fictícios ----
# Parte delas corresponde a compras no cartão (para mostrar o vínculo), parte foi paga em dinheiro ou Pix.
FORA_DO_CARTAO = [  # loja, cnpj, categoria, forma, itens [(descrição, qtd, unitário)]
    ('Feira do Produtor', '', 'Mercado', 'dinheiro', [('Banana prata kg', 2, 6.50), ('Tomate kg', 1.5, 8.90), ('Alface un', 2, 3.00)]),
    ('Gás e Água Fonte Boa', '11.222.333/0001-81', 'Casa', 'pix', [('Água mineral 20 L', 2, 15.00)]),
    ('Gás e Água Fonte Boa', '11.222.333/0001-81', 'Casa', 'dinheiro', [('Gás de cozinha P13', 1, 118.00)]),
    ('Padaria Pão Quente', '22.333.444/0001-90', 'Alimentação fora', 'pix', [('Pão francês kg', 0.6, 16.90), ('Café coado', 2, 4.50)]),
    ('Banca do Seu Zé', '', 'Lazer', 'dinheiro', [('Revista', 1, 18.90)]),
    ('Lava-Rápido Brilho', '33.444.555/0001-02', 'Veículo', 'debito', [('Lavagem completa', 1, 60.00)]),
]
notas = []
por_id = {l['id']: l for l in lancamentos}
for mi, mes in enumerate(MESES):
    compras_de = mes_anterior(mes)
    # 1) notas de compras que também estão na fatura (cartão): mercado, farmácia e posto do titular
    cands = [l for l in lancamentos if l['mes'] == mes and l['tipo'] == 'compra' and not l['parcela']
             and l['categoria'] in ('Mercado', 'Farmácia e saúde', 'Combustível') and l['adicional'] == 'nao']
    for k, l in enumerate(cands[:5]):
        v = float(l['valor'])
        if l['categoria'] == 'Combustível':
            litros = round(v / 6.29, 3); itens = [('Gasolina comum', litros, 6.29)]
        else:
            a = round(v * 0.6, 2); itens = [('Itens diversos', 1, a), ('Outros itens', 1, round(v - a, 2))]
        notas.append(dict(arquivo=f'cupom-exemplo-{mes}-{k + 1}.jpg', origem='foto' if k % 2 == 0 else 'xml', loja=l['estabelecimento'],
                          cnpj=f'{40 + k:02d}.555.666/0001-{10 + k:02d}', data=l['data'], hora=f'{9 + k}:{(k * 13) % 60:02d}', total=v,
                          forma='credito', cartao_final=l['cartao'] if k % 2 else '', categoria=l['categoria'],
                          itens=[dict(descricao=d, qtd=q, unitario=u, total=round(q * u, 2)) for d, q, u in itens],
                          vinculo=l['id'], vinculo_tipo='auto' if k % 3 else 'manual', revisar=False, avisos=[]))
    # 2) despesas fora do cartão
    for k, (loja, cnpj, cat, forma, itens) in enumerate(FORA_DO_CARTAO):
        d = dia(compras_de, 3 + k * 4 + mi)
        its = [dict(descricao=a, qtd=q, unitario=u, total=round(q * u, 2)) for a, q, u in itens]
        notas.append(dict(arquivo=f'nota-exemplo-{mes}-{k + 1}.jpg' if k != 4 else '', origem='foto' if k != 4 else 'manual', loja=loja, cnpj=cnpj,
                          data=d.isoformat(), hora=f'{8 + k}:{(k * 7) % 60:02d}', total=round(sum(i['total'] for i in its), 2), forma=forma,
                          cartao_final='', categoria=cat, itens=its, vinculo='', vinculo_tipo='', revisar=False, avisos=[]))
    # 3) uma nota que a leitura não conseguiu entender direito
    notas.append(dict(arquivo=f'foto-borrada-{mes}.jpg', origem='foto', loja='Mercadinho S...', cnpj='', data=dia(compras_de, 26).isoformat(), hora='',
                      total=None, forma='', cartao_final='', categoria='Mercado', itens=[], vinculo='', vinculo_tipo='', revisar=True,
                      avisos=['Não consegui ler o total.']))
for i, n in enumerate(notas, 1):
    n['id'] = f'ex-nota-{i:03d}'; n['mes'] = n['data'][:7]; n['criada_em'] = '2026-10-14T12:00:00Z'

saida = raiz / 'dados/exemplo.js'
saida.write_text('// Dados 100% FICTÍCIOS gerados por ferramentas/gerar-exemplo.py — pessoas, lojas e valores inventados.\n'
                 'window.RAIO_X_EXEMPLO = ' + json.dumps({'faturas': faturas, 'lancamentos': lancamentos, 'notas': notas}, ensure_ascii=False) + ';\n', encoding='utf-8')
print(f'{len(faturas)} faturas, {len(lancamentos)} lançamentos, {len(notas)} notas → {saida.relative_to(raiz)}')
for f in faturas: print(f"  {f['mes']} {f['banco']:7} R$ {f['total']:>9}")
