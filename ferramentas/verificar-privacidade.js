#!/usr/bin/env node
/* Procura dados pessoais e documentos reais nos arquivos versionados (git ls-files).
   Roda no CI em todo PR e em `npm test`. Falha (código 1) se achar:
   - arquivo de fatura/nota/exportação pela extensão (PDF, imagens, CSV, ZIP, backup .json…) ou pelo conteúdo
     (PDF/JPEG/PNG/ZIP/GIF/HEIC renomeados);
   - XML ou TXT fora de testes/casos/notas/;
   - CPF ou CNPJ com dígito verificador válido, cartão que passa no Luhn, chave de NF-e (44 dígitos),
     ID de transação Pix, e-mail — fora da lista de exemplos fictícios conhecidos.
   Uso: npm run privacidade */
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const so = (s) => String(s).replace(/\D/g, '');
const repetido = (d) => /^(\d)\1+$/.test(d);

function cpfValido(txt) {
  const d = so(txt);
  if (d.length !== 11 || repetido(d)) return false;
  const dv = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dv(9) === +d[9] && dv(10) === +d[10];
}
function cnpjValido(txt) {
  const d = so(txt);
  if (d.length !== 14 || repetido(d)) return false;
  const dv = (n) => { const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = pesos.reduce((t, p, i) => t + p * +d[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13];
}
function luhn(txt) {
  const d = so(txt);
  if (d.length < 13 || d.length > 19 || repetido(d)) return false;
  let s = 0;
  for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; }
  return s % 10 === 0;
}

// Exemplos fictícios conhecidos (documentação, testes)
const PERMITIDOS = new Set(['11222333000181', '00000000000191', '12345678909', '4111111111111111']);
const EMAIL_OK = /(@example\.(com|org)|@exemplo\.|noreply@|@users\.noreply\.github\.com|@anthropic\.com$)/i;

const EXT_PROIBIDA = /\.(pdf|jpe?g|png|webp|gif|bmp|tiff?|heic|heif|csv|ofx|ofc|qif|xlsx?|ods|zip|7z|rar|gz|docx?|eml|msg)$/i;
const SO_EM_CASOS = /\.(xml|txt)$/i;
const JSON_OK = /^(package|package-lock|tsconfig)\.json$/;
const PULAR_CONTEUDO = /^(vendor\/|package-lock\.json$)|\.min\.js$/;
const ASSINATURAS = [['%PDF', 'PDF'], ['\xFF\xD8\xFF', 'JPEG'], ['\x89PNG', 'PNG'], ['PK\x03\x04', 'ZIP/Office'], ['GIF8', 'GIF']];

/** Analisa um arquivo (caminho relativo + conteúdo). Devolve a lista de problemas. */
function analisar(rel, buf) {
  const p = [];
  if (EXT_PROIBIDA.test(rel)) p.push('extensão de documento/exportação');
  if (SO_EM_CASOS.test(rel) && !rel.startsWith('testes/casos/notas/') && !/^vendor\/.*LICENSE[^/]*\.txt$/i.test(rel)) p.push('XML/TXT fora de testes/casos/notas/');
  if (/\.json$/i.test(rel) && !JSON_OK.test(rel)) p.push('JSON fora da lista (backup do app?)');
  const inicio = buf.subarray(0, 12).toString('latin1');
  for (const [mag, nome] of ASSINATURAS) if (inicio.startsWith(mag)) p.push(`conteúdo é ${nome}`);
  if (inicio.slice(4, 8) === 'ftyp') p.push('conteúdo é HEIC/MP4');
  if (PULAR_CONTEUDO.test(rel)) return p;
  const t = buf.toString('utf8');
  for (const m of t.matchAll(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g)) if (cpfValido(m[0]) && !PERMITIDOS.has(so(m[0]))) p.push(`CPF válido: ${m[0].slice(0, 4)}…`);
  for (const m of t.matchAll(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g)) if (cnpjValido(m[0]) && !PERMITIDOS.has(so(m[0]))) p.push(`CNPJ válido: ${m[0].slice(0, 6)}…`);
  // cartão: 16 dígitos seguidos ou em 4 grupos de 4 ("1234 5678 9012 3456"), que passe no Luhn
  for (const m of t.matchAll(/\b(?:\d{16}|\d{4}([ .-])\d{4}\1\d{4}\1\d{4})\b/g)) if (luhn(m[0]) && !PERMITIDOS.has(so(m[0]))) p.push(`possível cartão: ${so(m[0]).slice(0, 4)}…`);
  for (const m of t.matchAll(/\b\d{4}(?: ?\d{4}){10}\b/g)) if (!/^1234 ?5678/.test(m[0])) p.push('chave de NF-e (44 dígitos)');
  for (const m of t.matchAll(/\bE\d{8}\d{12}[A-Za-z0-9]{11}\b/g)) if (!m[0].startsWith('E00000000')) p.push('ID de transação Pix');
  for (const m of t.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) if (!EMAIL_OK.test(m[0])) p.push(`e-mail: ${m[0].replace(/^(.).*@/, '$1…@')}`);
  return [...new Set(p)];
}

module.exports = { analisar, cpfValido, cnpjValido, luhn };

if (require.main === module) {
  const raiz = path.resolve(__dirname, '..');
  const arquivos = execSync('git ls-files -z', { cwd: raiz }).toString().split('\0').filter(Boolean);
  let ruins = 0;
  for (const rel of arquivos) {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) continue;
    const problemas = analisar(rel, fs.readFileSync(abs));
    if (problemas.length) { ruins++; console.log(`✗ ${rel}: ${problemas.join('; ')}`); }
  }
  if (ruins) { console.log(`\n${ruins} arquivo(s) com possível dado pessoal ou documento real. Troque por dados inventados (veja CONTRIBUINDO-COM-IA.md).`); process.exit(1); }
  console.log(`✓ ${arquivos.length} arquivos versionados verificados: nenhum documento ou dado pessoal encontrado.`);
}
