/* Fatura fictícia no layout do Nubank (PDF do app/e-mail). Nenhum dado real. */
const { L, pagina } = require('../paginas');

const paginas = [
  pagina(
    L(648, [138, 'Olá, Ana.']),
    L(606, [138, 'Esta é a sua fatura de']),
    L(565, [138, 'outubro, no valor de']),
    L(523, [138, 'R$ 559,85']),
    L(438, [138, 'Data de vencimento: 15 OUT 2026']),
    L(415, [138, 'Período vigente: 08 SET a 08 OUT']),
    L(373, [138, 'Limite total do cartão de crédito: R$ 5.000,00']),
    L(44, [493, '1 de 3'])
  ),
  pagina(
    L(795, [327, 'ANA EXEMPLO SOUZA']),
    L(782, [327, 'FATURA 15 OUT 2026'], [439, 'EMISSÃO E ENVIO 08 OUT 2026']),
    L(732, [50, 'RESUMO DA FATURA ATUAL']),
    L(703, [140, 'Fatura anterior'], [496, 'R$ 400,00']),
    L(687, [140, 'Pagamento recebido'], [491, '−R$ 400,00']),
    L(661, [140, 'Total de compras de todos os cartões, 08 SET a 08 OUT'], [488, 'R$ 556,35']),
    L(645, [140, 'IOF de compras internacionais'], [502, 'R$ 3,50']),
    L(614, [140, 'Total a pagar'], [457, 'R$ 559,85']),
    L(583, [148, 'O Nubank declara, nos termos da Lei 12.007 2009, que os débitos referentes ao cartão foram quitados.']),
    L(422, [50, 'PRÓXIMAS FATURAS']),
    L(384, [140, 'Saldo em aberto da próxima fatura'], [495, 'R$ 150,00']),
    L(368, [140, 'Saldo em aberto total'], [487, 'R$ 900,00']),
    L(284, [140, 'Limite total'], [395, 'R$ 1.459,85'], [484, 'R$ 5.000,00']),
    L(21, [528, '2 de 3'])
  ),
  pagina(
    L(795, [327, 'ANA EXEMPLO SOUZA']),
    L(782, [327, 'FATURA 15 OUT 2026'], [439, 'EMISSÃO E ENVIO 08 OUT 2026']),
    L(734, [50, 'TRANSAÇÕES'], [130, 'DE 08 SET A 08 OUT']),
    L(666, [119, 'Ana Exemplo'], [491, 'R$ 363,95']),
    L(640, [123, '08 SET'], [172, '•••• 1111'], [214, 'Escola Exemplo - Parcela 3/12'], [501, 'R$ 50,00']),
    L(618, [123, '12 SET'], [172, '•••• 1111'], [214, 'Mercado Bom Preço'], [497, 'R$ 230,45']),
    L(596, [123, '20 SET'], [172, '•••• 1111'], [214, 'Streaming Exemplo'], [491, 'R$ 100,00']),
    L(581, [214, 'BRL 100.00 = USD 18.66']),
    L(572, [214, 'Conversão: BRL 5.36 = USD 1 = R$ 5,36']),
    L(554, [123, '20 SET'], [185, 'IOF de "Streaming Exemplo"'], [506, 'R$ 3,50']),
    L(532, [123, '25 SET'], [172, '•••• 1111'], [214, 'Loja Exemplo'], [497, '−R$ 20,00']),
    L(500, [119, 'Pedro Exemplo'], [491, 'R$ 195,90']),
    L(476, [123, '15 SET'], [172, '•••• 2222'], [214, 'Posto Exemplo'], [497, 'R$ 150,00']),
    L(454, [123, '03 OUT'], [172, '•••• 2222'], [214, 'Farmácia Exemplo'], [501, 'R$ 45,90']),
    L(349, [119, 'Pagamentos'], [495, '-R$ 400,00']),
    L(323, [123, '08 SET'], [185, 'Pagamento em 08 SET'], [494, '−R$ 400,00']),
    L(108, [58, 'Em cumprimento à regulação do Banco Central, as suas operações de crédito']),
    L(21, [528, '3 de 3'])
  )
];

const esperado = {
  banco: 'Nubank',
  fatura: { mes: '2026-10', total: 559.85, vencimento: '2026-10-15', fechamento: '2026-10-08', titular: 'Ana', limite_total: 5000, a_vencer: 900 },
  quantidade: 7,
  lancamentos: [
    { data: '2026-09-08', descricao: 'Escola Exemplo', cartao: '1111', portador: 'Ana', adicional: 'nao', parcela: '3/12', valor: 50, tipo: 'compra' },
    { data: '2026-09-20', descricao: 'IOF de "Streaming Exemplo"', valor: 3.5, tipo: 'iof' },
    { data: '2026-09-25', descricao: 'Loja Exemplo', valor: -20, tipo: 'estorno' },
    { data: '2026-10-03', descricao: 'Farmácia Exemplo', cartao: '2222', portador: 'Pedro', adicional: 'sim', valor: 45.9 }
  ]
};

module.exports = { arquivo: 'nubank-ficticia.pdf', paginas, esperado };
