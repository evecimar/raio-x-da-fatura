/* Fatura fictícia no layout dos Cartões Caixa: demonstrativo em duas colunas, valores com D/C,
   anuidade sem data, parcelas como "06 DE 10" e a cidade como última célula. Nenhum dado real. */
const { L, pagina } = require('../paginas');

const cabecalho = () => [
  L(832, [448, 'Central de Atendimento Cartões Caixa']),
  L(816, [171, 'Informações Complementares'])
];

const paginas = [
  pagina(
    L(814, [17, '4111.XXXX.XXXX.1111']),
    L(794, [477, 'VENCIMENTO']),
    L(776, [80, 'ANA EXEMPLO SOUZA'], [487, '11/10/2026']),
    L(760, [80, 'RUA DAS FLORES 100']),
    L(750, [80, 'CENTRO'], [340, 'VALOR TOTAL DESTA FATURA']),
    L(736, [80, '00000000 CIDADE EXEMPLO UF']),
    L(727, [402, 'R$ 749,88']),
    L(706, [320, 'Limite Total -----------------------------'], [505, 'R$ 10.000,00']),
    L(658, [56, 'TOTAL'], [328, 'MÍNIMO**']),
    L(645, [47, 'R$ 749,88'], [125, 'não paga juros!'], [329, 'R$ 112,48']),
    L(584, [66, 'ROTATIVO']),
    L(579, [144, '10,59% a.m 234,65% a.a']),
    L(407, [18, 'Pagador:'], [44, 'ANA EXEMPLO SOUZA'], [477, 'CPF/CNPJ do Pagador:']),
    L(373, [26, 'CARTÕES CAIXA - 00.000.000/0001-00']),
    L(324, [18, 'caixa.gov.br'])
  ),
  pagina(
    ...cabecalho(),
    L(772, [28, 'Limites'], [305, 'Melhor data para compra:'], [405, '31/10/2026']),
    L(757, [28, 'TOTAL'], [248, 'R$ 10.000,00']),
    L(753, [305, 'que vencem no próximo mês aprovadas até dia 01/10/2026.)']),
    L(746, [28, 'UTILIZADO'], [248, 'R$ 2.000,00']),
    L(735, [28, 'SAQUE'], [252, 'R$ 1.000,00'], [305, 'DESPESAS A VENCER: R$1.250,12']),
    L(704, [305, 'Demonstrativo']),
    L(691, [307, 'Data'], [331, 'Descrição'], [428, 'Cidade/País'], [488, 'Valor U$$'], [533, 'Crédito/Débito']),
    L(675, [307, '01/09'], [331, 'TOTAL DA FATURA ANTERIOR'], [546, '900,00D']),
    L(668, [307, '11/09'], [331, 'OBRIGADO PELO PAGAMENTO'], [546, '900,00C']),
    L(661, [307, '01/10'], [331, 'CASHBACK ANUIDADE GASTOS TIT'], [552, '10,00C']),
    L(654, [307, '18/08'], [331, 'LOJA ONLINE EXEMPLO'], [428, 'Sao Paulo'], [552, '30,00C']),
    L(626, [307, '08/09'], [331, 'AJUSTE CRED PARC S/ JUROS'], [555, '0,02C']),
    L(581, [307, 'Total'], [547, '40,02 C']),
    L(564, [305, 'ANA EXEMPLO SOUZA (Cartão 1111)']),
    L(553, [305, 'ANUIDADE']),
    L(536, [305, 'ANUIDADE DIFERENCIADA TIT 10/'], [391, '12'], [551, '30,00D']),
    L(522, [307, 'Total final (cartão 1111)'], [551, '30,00D']),
    L(500, [305, 'PEDRO EXEMPLO SOUZA (Cartão 2222)']),
    L(489, [93, 'Programa de Pontos']),
    L(455, [305, 'COMPRAS (Cartão 2222)']),
    L(448, [28, 'Bonificação'], [285, '0'], [311, 'Data'], [331, 'Descrição'], [428, 'Cidade/País'], [488, 'Valor U$$'], [533, 'Crédito/Débito']),
    L(438, [315, '05/09'], [331, 'MERCADO EXEMPLO'], [428, 'CIDADE A'], [550, '200,00D']),
    L(424, [28, 'Fator Conversão'], [272, '2,30'], [315, '12/09'], [331, 'LOJA ONLINE EXEMPLO'], [428, 'Sao Paulo'], [552, '89,90D'])
  ),
  pagina(
    ...cabecalho(),
    L(780, [28, 'Demonstrativo'], [305, 'Demonstrativo']),
    L(767, [34, 'Data'], [54, 'Descrição'], [151, 'Cidade/País'], [256, 'Crédito/Débito'], [311, 'Data'], [331, 'Descrição'], [428, 'Cidade/País'], [533, 'Crédito/Débito']),
    L(759, [38, '20/09'], [54, 'POSTO EXEMPLO'], [151, 'CIDADE A'], [273, '100,00D'], [305, 'ANA EXEMPLO SOUZA (Cartão 3333)']),
    L(751, [38, 'Total COMPRAS'], [267, '389,90D'], [307, 'COMPRAS PARCELADAS (Cartão 3333)']),
    L(743, [28, 'COMPRAS PARCELADAS (Cartão 2222)'], [315, '14/01'], [331, 'CURSO EXEMPLO'], [384, '09 DE 12'], [428, 'CIDADE B'], [550, '250,00D']),
    L(735, [38, '28/04'], [54, 'LOJA DE TINTAS'], [106, '06 DE 10'], [151, 'CIDADE A'], [273, '120,00D'], [307, 'Total COMPRAS PARCELADAS'], [548, '250,00D']),
    L(719, [360, 'Valor total desta fatura'], [454, 'R$ 749,88 D'])
  )
];

const esperado = {
  banco: 'Caixa',
  fatura: { mes: '2026-10', total: 749.88, vencimento: '2026-10-11', fechamento: '2026-10-01', titular: 'Ana', cartao: 'Visa', limite_total: 10000, limite_utilizado: 2000, a_vencer: 1250.12, pagamento_minimo: 112.48 },
  quantidade: 9,
  lancamentos: [
    { data: '2026-10-01', descricao: 'CASHBACK ANUIDADE GASTOS TIT', valor: -10, tipo: 'estorno' },
    { data: '2026-08-18', descricao: 'LOJA ONLINE EXEMPLO', valor: -30, tipo: 'estorno' },
    { data: '2026-10-01', descricao: 'ANUIDADE DIFERENCIADA TIT', cartao: '1111', parcela: '10/12', valor: 30, tipo: 'anuidade' },
    { data: '2026-09-05', descricao: 'MERCADO EXEMPLO', cartao: '2222', portador: 'Pedro', adicional: 'sim', valor: 200 },
    { data: '2026-04-28', descricao: 'LOJA DE TINTAS', cartao: '2222', parcela: '6/10', valor: 120 },
    { data: '2026-01-14', descricao: 'CURSO EXEMPLO', cartao: '3333', portador: 'Ana', parcela: '9/12', valor: 250 }
  ]
};

module.exports = { arquivo: 'caixa-ficticia.pdf', paginas, esperado };
