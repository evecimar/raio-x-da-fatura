/* Fatura fictícia do Nubank no layout de novembro/2026: a 1ª página traz uma tabela que simula o parcelamento da
   fatura, com outra linha "Total a pagar" (o total se a pessoa parcelar). O total certo é o do resumo. Nenhum dado real. */
const { L, pagina } = require('../paginas');
const base = require('./nubank');

const simulacao = pagina(
  L(782, [325, 'FATURA 15 OUT 2026'], [436, 'EMISSÃO E ENVIO 08 OUT 2026']),
  L(731, [57, 'Alternativas de pagamento para a sua'], [448, 'Para valores atualizados,']),
  L(707, [57, 'fatura no valor de R$ 559,85']),
  L(649, [68, '1. Pagar o valor total da fatura']),
  L(614, [68, 'Você quita o seu saldo, libera seu limite e não paga juros'], [406, 'Pagamento total da fatura']),
  L(600, [68, 'nem multa.'], [406, 'R$ 559,85']),
  L(470, [56, '2. Parcelar a fatura']),
  L(430, [395, '3 vezes'], [478, '6 vezes']),
  L(415, [318, 'Total a pagar'], [395, 'R$ 777,77'], [478, 'R$ 888,88']),
  L(394, [312, 'Valor de entrada'], [395, 'R$ 99,99'], [478, 'R$ 99,99']),
  L(377, [313, 'Valor da parcela'], [395, 'R$ 225,93'], [478, 'R$ 131,48']),
  L(342, [335, 'IOF'], [395, 'R$ 4,44'], [478, 'R$ 6,66']),
  L(279, [56, '3. Faça o pagamento mínimo e entre no rotativo']),
  L(44, [493, '2 de 4'])
);

const paginas = [base.paginas[0], simulacao, ...base.paginas.slice(1)];

module.exports = { arquivo: 'nubank-ficticia-simulacao.pdf', paginas, esperado: base.esperado };
