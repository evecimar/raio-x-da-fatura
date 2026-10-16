/* Monta "páginas" no mesmo formato que app/pdf-texto.js devolve, para casos de teste escritos à mão.
   Uma linha é L(y, [x, 'texto'], [x, 'texto'], ...). Células com mais de 12 pt de distância
   viram "   " no texto, igual ao extrator real. */
function L(y, ...celulas) {
  const cel = celulas.map(([x, s]) => ({ s: String(s).trim(), x })).sort((a, b) => a.x - b.x);
  return { y, texto: cel.map(c => c.s).join('   '), celulas: cel };
}
/** Uma página: as linhas são ordenadas de cima para baixo (y maior primeiro), como no PDF. */
const pagina = (...linhas) => linhas.sort((a, b) => b.y - a.y);
module.exports = { L, pagina };
