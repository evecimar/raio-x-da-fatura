/* Fatura fictícia no layout do PicPay: lançamentos em duas colunas, parcelas como "PARC06/10",
   cartão adicional com "Picpay Card final 2222". Nenhum dado real. */
const { L, pagina } = require('../paginas');

const topo = (y) => [
  L(y, [410, 'ANA EXEMPLO SOUZA,']),
  L(y - 10, [315, 'RUA DAS FLORES, 100, CENTRO, 00000000 CIDADE EXEMPLO - UF']),
  L(y - 21, [382, 'Vencimento:'], [434, '10/10/2026'], [478, 'Fechamento:'], [532, '01/10/2026']),
  L(y - 31, [468, 'PicPay Mastercard® GOLD'])
];

const paginas = [
  pagina(
    ...topo(810),
    L(751, [24, 'Olá, ANA!']),
    L(733, [24, 'Esta é a sua fatura de Outubro.']),
    L(686, [81, 'Total da sua fatura'], [270, 'Vencimento'], [448, 'Limite total']),
    L(666, [72, 'R$ 386,15'], [251, '10/10/2026'], [419, 'R$ 4.000,00']),
    L(607, [25, 'Fatura anterior'], [248, '800,00'], [310, 'Limite total'], [528, '4.000,00']),
    L(593, [25, 'Pagamento recebido'], [245, '-800,00'], [310, 'Limite utilizado'], [534, '1.500,00']),
    L(551, [25, 'Total da fatura'], [234, 'R$ 386,15']),
    L(481, [89, 'Pagamento total'], [260, 'Pagamento mínimo']),
    L(459, [64, 'R$ 386,15'], [255, 'R$ 56,42']),
    L(20, [533, 'Página 1/3'])
  ),
  pagina(
    ...topo(816),
    L(736, [301, '08/09'], [341, 'POSTO EXEMPLO'], [547, '150,00']),
    L(731, [24, 'Picpay Card']),
    L(716, [301, '20/09'], [341, 'FARMACIA EXEMPLO'], [552, '35,75']),
    L(706, [24, 'Transações Nacionais']),
    L(696, [301, '21/09'], [341, 'IOF COMPRA INTERNACIONAL'], [552, '0,00']),
    L(682, [24, 'Data'], [64, 'Estabelecimento'], [244, 'Valor (R$)']),
    L(662, [24, '10/09'], [64, 'PAGAMENTO DE FATURA'], [260, '-800,00']),
    L(642, [24, '05/09'], [64, 'RESTAURANTE EXEMPLO'], [274, '60,50']),
    L(622, [24, '25/09'], [64, 'ASSINATURA NUVEM'], [279, '9,90']),
    L(548, [30, 'Subtotal dos lançamentos'], [254, '70,40']),
    L(504, [24, 'PEDRO EXEMPLO']),
    L(489, [24, 'Picpay Card final 2222']),
    L(463, [24, 'Transações Nacionais']),
    L(438, [24, 'Data'], [64, 'Estabelecimento'], [244, 'Valor (R$)'], [301, '28/09'], [341, 'ESTORNO LOJA EXEMPLO'], [550, '-30,00']),
    L(419, [24, '15/04'], [64, 'MOVEIS EXEMPLOPARC06/10'], [273, '120,00']),
    L(399, [24, '30/09'], [64, 'PADARIA EXEMPLO'], [273, '40,00']),
    L(243, [308, 'Subtotal dos lançamentos'], [526, '315,75']),
    L(26, [531, 'Página 2/3'])
  ),
  pagina(
    ...topo(816),
    L(518, [24, 'Total geral dos lançamentos'], [254, '386,15']),
    L(306, [27, 'Valor total da fatura'], [227, 'R$ 386,15']),
    L(286, [27, 'Pagamento mínimo'], [227, 'R$ 56,42']),
    L(266, [27, 'Juros'], [227, '18,70% a.m 682,36% a.a']),
    L(26, [531, 'Página 3/3'])
  )
];

const esperado = {
  banco: 'PicPay',
  fatura: { mes: '2026-10', total: 386.15, vencimento: '2026-10-10', fechamento: '2026-10-01', titular: 'Ana', cartao: 'Mastercard Gold', limite_total: 4000, limite_utilizado: 1500, pagamento_minimo: 56.42 },
  quantidade: 8,
  lancamentos: [
    { data: '2026-09-05', descricao: 'RESTAURANTE EXEMPLO', cartao: '', portador: 'Ana', adicional: 'nao', valor: 60.5 },
    { data: '2026-04-15', descricao: 'MOVEIS EXEMPLO', cartao: '2222', portador: 'Pedro', adicional: 'sim', parcela: '6/10', valor: 120 },
    // a coluna da direita é lida depois da esquerda, então segue no cartão do Pedro
    { data: '2026-09-08', descricao: 'POSTO EXEMPLO', cartao: '2222', portador: 'Pedro', valor: 150 },
    { data: '2026-09-21', descricao: 'IOF COMPRA INTERNACIONAL', valor: 0, tipo: 'iof' },
    { data: '2026-09-28', descricao: 'ESTORNO LOJA EXEMPLO', valor: -30, tipo: 'estorno' }
  ]
};

module.exports = { arquivo: 'picpay-ficticia.pdf', paginas, esperado };
