/* Raio-X da Fatura — leitura de notas fiscais e cupons.
   - XML de NF-e / NFC-e (exato: vem do próprio documento fiscal)
   - PDF de nota/cupom com texto (DANFE, NFC-e enviada por e-mail…)
   - Foto (JPG, PNG, WEBP): OCR com Tesseract, embutido em vendor/ocr e carregado só quando necessário.
   Tudo roda no navegador; nada é enviado. Só guardamos loja, CNPJ da loja, data, total, forma de pagamento
   e itens — nunca endereço, CPF ou telefone do cliente que aparecem no cupom. */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};
  const DINHEIRO = /\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2}(?!\d)/g;
  const num = (s) => { if (s == null) return null; s = String(s).trim(); if (/,\d{1,4}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); const n = Number(s); return isFinite(n) ? n : null; };
  const r2 = (n) => Math.round(n * 100) / 100;
  const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const titulo = (s) => s.toLowerCase().replace(/(^|[\s\-/(&])([a-zà-ú])/g, (a, b, c) => b + c.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, m => m.toLowerCase());
  const ehImagem = (nome) => /\.(jpe?g|png|webp|bmp|gif)$/i.test(nome);
  const ehHeic = (nome) => /\.(heic|heif)$/i.test(nome);
  RX.ehArquivoDeNota = (nome) => ehImagem(nome) || ehHeic(nome) || /\.xml$/i.test(nome);

  /* ---------------- formas de pagamento ---------------- */
  function forma(texto) {
    const t = semAcento(texto).toLowerCase();
    const linhaPag = t.split('\n').filter(l => /(tipo|forma|meio)\s*(de\s*)?pag|pagto|pagamento/.test(l) && !/chave/.test(l)).join(' ');
    const alvo = linhaPag || t;
    if (/debito/.test(alvo)) return 'debito';
    if (/credito|cartao/.test(alvo)) return 'credito';
    if (/dinheiro|especie/.test(alvo)) return 'dinheiro';
    if (/\bpix\b/.test(alvo.replace(/chave\s*pix[^\n]*/g, ''))) return 'pix';
    return '';
  }
  const finalCartao = (t) => (t.match(/(?:final|cart[aã]o[^\n\d]{0,20}|[*x•]{3,}\s*)(\d{4})\b/i) || [])[1] || '';
  const TPAG = { '01': 'dinheiro', '02': 'outro', '03': 'credito', '04': 'debito', '05': 'credito', '10': 'outro', '11': 'outro', '12': 'outro', '13': 'outro', '15': 'outro', '16': 'outro', '17': 'pix', '18': 'outro', '19': 'outro', '90': 'outro', '99': 'outro' };

  /* ---------------- XML NF-e / NFC-e ---------------- */
  RX.lerNotaXML = function (xml, arquivo) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) return { ok: false, arquivo, motivo: 'XML inválido.' };
    const q = (el, tag) => { const n = el && el.getElementsByTagName(tag)[0]; return n ? n.textContent.trim() : ''; };
    const inf = doc.getElementsByTagName('infNFe')[0];
    if (!inf) return { ok: false, arquivo, motivo: 'Este XML não é uma NF-e/NFC-e.' };
    const emit = inf.getElementsByTagName('emit')[0], ide = inf.getElementsByTagName('ide')[0];
    const dh = q(ide, 'dhEmi') || q(ide, 'dEmi');
    const itens = [...inf.getElementsByTagName('det')].map(d => {
      const p = d.getElementsByTagName('prod')[0];
      return { descricao: titulo(q(p, 'xProd')), qtd: num(q(p, 'qCom')), unitario: r2(num(q(p, 'vUnCom')) || 0), total: r2(num(q(p, 'vProd')) || 0) };
    });
    const pags = [...inf.getElementsByTagName('detPag')].map(p => ({ t: q(p, 'tPag'), v: num(q(p, 'vPag')) || 0 })).sort((a, b) => b.v - a.v);
    const cnpj = q(emit, 'CNPJ');
    const modelo = q(ide, 'mod');
    return {
      ok: true, arquivo, tipo: 'nota',
      nota: {
        arquivo, origem: 'xml', loja: titulo(q(emit, 'xFant') || q(emit, 'xNome')),
        cnpj: cnpj.length === 14 ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj,
        data: dh.slice(0, 10), hora: dh.slice(11, 16), total: num(q(inf.getElementsByTagName('ICMSTot')[0], 'vNF')),
        forma: pags.length ? (TPAG[pags[0].t] || 'outro') : '', cartao_final: '', itens,
        revisar: false, avisos: [], documento: modelo === '65' ? 'NFC-e' : 'NF-e'
      }
    };
  };

  /* ---------------- texto (PDF ou OCR) ---------------- */
  const PALAVRAS_NOTA = /cupom|nfc-?e|nota fiscal|danfe|documento auxiliar|total geral|valor a pagar|valor total|cnpj|pedido|ticket|recibo|venda/i;
  const NAO_LOJA = /cnpj|cpf|fone|tel\b|telefone|rua\b|^r\.?\s|^av\.?\s|avenida|cep|bairro|end\.|endere|pedido|venda|data|hora|^cod|inscri|\bie\b|^\d|www\.|http|@/i;

  const pareceEndereco = (l) => /,\s*\d{1,5}\b|\b\d{5}-?\d{3}\b|\b(rua|av|avenida|rod|rodovia|travessa|pra[cç]a)\b/i.test(l);
  function limparLinha(l) {
    return l.replace(/[|_~^"“”'*]/g, ' ').split(/\s+/).filter(Boolean)
      .filter((t, i, a) => !((i === 0 || i === a.length - 1) && t.length <= 2 && !/^&$/.test(t)))
      .join(' ').trim();
  }
  function qualidade(s) { // 0..1: quanto a linha parece texto de verdade (e não ruído do OCR)
    const toks = s.split(/\s+/).filter(t => /[A-Za-zÀ-ú]/.test(t));
    if (!toks.length) return 0;
    const bons = toks.filter(t => t.length <= 14 && /[aeiouáéíóúãõâêôAEIOUÁÉÍÓÚÃÕÂÊÔ]/.test(t) && !/(.)\1\1/i.test(t) && !/[sS]{2}[eEsS]/.test(t)).length;
    return bons / toks.length;
  }
  function acharLoja(linhas) {
    const topo = linhas.slice(0, 18);
    const iEnd = topo.findIndex(pareceEndereco);
    const candidata = (l) => {
      const s = limparLinha(l);
      const letras = s.replace(/[^A-Za-zÀ-ú]/g, '');
      if (s.length < 4 || letras.length < 4 || NAO_LOJA.test(s) || pareceEndereco(s)) return null;
      const q = qualidade(s), maiusc = letras.replace(/[^A-ZÀ-Ú]/g, '').length / letras.length;
      return q >= 0.75 ? { s, p: q * (0.5 + maiusc / 2) * Math.min(letras.length, 24) } : null;
    };
    if (iEnd > 0) for (let i = iEnd - 1; i >= Math.max(0, iEnd - 3); i--) { const c = candidata(topo[i]); if (c) return titulo(c.s); }
    let melhor = null;
    topo.slice(0, 10).forEach((l, i) => { const c = candidata(l); if (c && (!melhor || c.p * (1 - i * 0.05) > melhor.p)) melhor = { s: c.s, p: c.p * (1 - i * 0.05) }; });
    return melhor ? titulo(melhor.s) : '';
  }

  function acharData(texto) {
    const linhas = texto.split('\n');
    const re = /(\d{2})[\/.\-](\d{2})[\/.\-](\d{4}|\d{2})\b/;
    const cand = [];
    linhas.forEach((l, i) => {
      const m = l.match(re); if (!m) return;
      if (/ultima|última|venc|validade|nasc|garantia|pr[oó]xim/i.test(l)) return;
      const ano = m[3].length === 2 ? '20' + m[3] : m[3];
      const iso = `${ano}-${m[2]}-${m[1]}`;
      if (isNaN(new Date(iso + 'T12:00:00Z'))) return;
      const hora = (l.match(/\b(\d{2}):(\d{2})(?::\d{2})?\b/) || [])[0] || '';
      cand.push({ iso, hora: hora.slice(0, 5), peso: (hora ? 2 : 0) + (/emiss|data/i.test(l) ? 1 : 0) - i * 0.01 });
    });
    cand.sort((a, b) => b.peso - a.peso);
    return cand[0] || { iso: '', hora: '' };
  }

  function acharTotal(linhas) {
    const regras = [/valor\s*a\s*pagar/i, /(?:[tl1]?o?ta[l1]|ta[l1])\s*gera[l1]|\bgera[l1]\s*\.{2,}/i, /valor\s*total/i, /total\s*a\s*pagar/i, /[tl1]ota[l1]\s*(r\$|:)/i, /^\s*[tl1]ota[l1]\b/i];
    for (const re of regras) {
      for (let i = 0; i < linhas.length; i++) {
        if (!re.test(linhas[i]) || /itens|qtd|quantidade|tribut|desconto|troco|aprox/i.test(linhas[i])) continue;
        const nums = (linhas[i].match(DINHEIRO) || []).concat(i + 1 < linhas.length && !(linhas[i].match(DINHEIRO)) ? (linhas[i + 1].match(DINHEIRO) || []) : []);
        const v = nums.map(num).filter(n => n > 0).pop();
        if (v) return v;
      }
    }
    return null;
  }

  function acharItens(linhas) {
    const itens = [];
    const corrige = (s) => /[.,]\d{2}$/.test(s) ? num(s) : (/^\d{3,}$/.test(s) ? Number(s.slice(0, -2) + '.' + s.slice(-2)) : null);
    for (const l of linhas) {
      if (/total|subtotal|troco|desconto|pagto|pagamento|cnpj|cpf|qtde|produto|descri|valor/i.test(l)) continue;
      // "3,00  GALAO DE AGUA 20 L  9,50  28,50"  ou (OCR) "GALAO DE AGUA 20 L 950 2850"
      const m = l.match(/^\s*(?:(\d+(?:[.,]\d{1,3})?)\s*(?:un|x|kg|lt)?\s+)?([A-Za-zÀ-ú][^\n]*?[A-Za-zÀ-ú)]\s*(?:\d+\s*(?:l|ml|kg|g|un)\b)?[^\d\n]*?)\s+(\d+[.,]?\d*)\s+(\d+[.,]?\d*)\b/i);
      if (!m) continue;
      const unit = corrige(m[3]), tot = corrige(m[4]);
      if (!unit || !tot || tot < unit - 0.01) continue;
      let qtd = m[1] ? num(m[1].replace(',', '.')) : null;
      if (!qtd || Math.abs(qtd * unit - tot) > 0.05) qtd = r2(tot / unit);
      if (Math.abs(qtd - Math.round(qtd)) > 0.001 && qtd > 50) continue;
      const desc = titulo(m[2].replace(/\s{2,}/g, ' ').replace(/[^A-Za-zÀ-ú0-9 .,\-/]+$/, '').trim());
      if (desc.length < 3) continue;
      itens.push({ descricao: desc, qtd, unitario: r2(unit), total: r2(tot) });
    }
    return itens.slice(0, 80);
  }

  /** Lê uma nota a partir de texto (PDF ou OCR). */
  /* ---------- DANFE (NF-e em PDF) ----------
     Layout padronizado pela SEFAZ: emitente ao lado da chave de acesso (44 dígitos), "VALOR TOTAL DA NOTA",
     tabela "DADOS DOS PRODUTOS / SERVIÇOS" com código, descrição, NCM, CST/CSOSN, CFOP, unidade, qtde, unitário, total…
     O bloco DESTINATÁRIO (nome, CPF, endereço do cliente) é ignorado de propósito. */
  const ehDanfe = (t) => /DANFE|Documento Auxiliar da\s+Nota Fiscal Eletr/i.test(t);
  function lerDanfe(texto, linhas) {
    let loja = '';
    const chave = linhas.find(l => /\d{4}(?:\s\d{4}){10}/.test(l));
    if (chave) loja = chave.replace(/\s*\d{4}(?:\s\d{4}){10}.*$/, '').trim();
    if (!loja || /chave|acesso/i.test(loja)) loja = (texto.match(/Recebemos de\s+(.+?)\s+os produtos/i) || [])[1] || '';
    // CNPJ do emitente: o primeiro CNPJ formatado antes do bloco do destinatário
    const antesDest = texto.split(/DESTINAT[ÁA]RIO/i)[0];
    const cnpj = (antesDest.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/) || [])[0] || '';
    let total = null;
    const iTot = linhas.findIndex(l => /VALOR TOTAL DA NOTA/i.test(l));
    if (iTot >= 0 && linhas[iTot + 1]) total = (linhas[iTot + 1].match(DINHEIRO) || []).map(num).pop() ?? null;
    if (total == null) total = num((texto.match(/Valor Total:\s*([\d.,]+)/i) || [])[1]);
    const ini = linhas.findIndex(l => /DADOS DOS PRODUTOS/i.test(l));
    const fimI = linhas.findIndex((l, i) => i > ini && /DADOS ADICIONAIS|C[ÁA]LCULO DO ISSQN/i.test(l));
    const itens = [];
    for (const l of linhas.slice(ini + 1, fimI > 0 ? fimI : undefined)) {
      // 1846   PISO ...   69072200 0500 5405 M2   70,000   28,000   1.960,00 ...
      const m = l.match(/^\s*\S+\s{2,}(.+?)\s{2,}\d{8}\s+\d{2,4}\s+\d{4}\s+(\S+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.]+,\d{2})/);
      if (!m) continue;
      const qtd = num(m[3]), unit = num(m[4]), tot = num(m[5]);
      if (tot == null) continue;
      itens.push({ descricao: titulo(m[1].trim()), qtd: qtd != null ? r2(qtd) : null, unitario: unit != null ? r2(unit) : null, total: r2(tot), unidade: m[2] });
    }
    return { loja: titulo(loja), cnpj, total, itens };
  }

  /* ---------- Comprovante de Pix / transferência ----------
     Não é nota fiscal, mas é uma despesa fora do cartão: guardamos quem recebeu, valor, data e "Pix".
     CPF/CNPJ mascarados, dados bancários, ID da transação e o pagador (você) não são guardados. */
  const MESES_ABR = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
  const ehComprovanteTransferencia = (t) => /comprovante\s+de\s+(pix|transfer[eê]ncia|pagamento\s+pix)|pix\s+(enviado|realizado)|transfer[eê]ncia\s+(realizada|enviada)/i.test(t);
  function lerComprovanteTransferencia(texto, linhas) {
    let data = '', hora = '';
    const m1 = texto.match(/(\d{1,2})\s*(?:\/|de)\s*(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\w*\.?\s*(?:\/|de)\s*(\d{4})(?:\D{1,5}(\d{2}):(\d{2}))?/i);
    if (m1) { data = `${m1[3]}-${String(MESES_ABR[m1[2].toLowerCase()]).padStart(2, '0')}-${m1[1].padStart(2, '0')}`; if (m1[4]) hora = `${m1[4]}:${m1[5]}`; }
    else { const d = acharData(texto); data = d.iso; hora = d.hora; }
    let total = null;
    const iV = linhas.findIndex(l => /^\s*valor(\s+(da\s+)?(transfer[eê]ncia|pix|pago|enviado))?\s*:?\s*(R\$.*)?$/i.test(l));
    if (iV >= 0) total = ((linhas[iV].match(DINHEIRO) || []).concat(linhas[iV + 1] ? (linhas[iV + 1].match(DINHEIRO) || []) : [])).map(num).find(v => v > 0) ?? null;
    if (total == null) total = (texto.match(/R\$\s*([\d.]+,\d{2})/) || []).slice(1).map(num)[0] ?? null;
    // Quem recebeu: linhas depois de "Para" / "Destino" / "Recebedor" / "Favorecido", até CPF/CNPJ, instituição ou "De".
    let nome = '';
    const iP = linhas.findIndex(l => /^\s*(para|destino|destinat[aá]rio|recebedor|favorecido|quem recebeu)\s*:?\s*$/i.test(l));
    if (iP >= 0) {
      const partes = [];
      for (const l of linhas.slice(iP + 1, iP + 5)) {
        if (/\*{2,}|\d{3}\.\d{3}|cpf|cnpj|banco|institui|caixa econ|ag[eê]ncia|conta|^\s*de\s*$|chave/i.test(l)) break;
        partes.push(l.trim());
      }
      nome = partes.join(' ');
    }
    // "Favorecido: X" / "Para: X" na mesma linha. Só depois "Nome: X", e só no trecho do recebedor:
    // muitos comprovantes trazem antes o bloco do PAGADOR (a própria pessoa), que nunca deve virar a "loja".
    if (!nome) nome = ((texto.match(/(?:favorecido|recebedor|destinat[aá]rio|para|quem recebeu)\s*:\s*([^\n]+)/i) || [])[1] || '').trim();
    if (!nome) {
      const pagador = texto.search(/pagador|origem|quem pagou|^\s*de\s*:?\s*$/im);
      const recebedor = texto.search(/favorecido|recebedor|destinat[aá]rio|destino|quem recebeu|^\s*para\s*:?\s*$/im);
      const trecho = recebedor >= 0 ? texto.slice(recebedor) : (pagador >= 0 ? '' : texto);
      nome = ((trecho.match(/nome\s*:\s*([^\n]+)/i) || [])[1] || '').trim();
    }
    return { loja: nome ? titulo(nome) : 'Transferência', total, data, hora };
  }

  RX.lerNotaTexto = function (texto, { arquivo = '', origem = 'pdf', confianca = null } = {}) {
    if (ehComprovanteTransferencia(texto)) {
      const linhasT = texto.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
      const c = lerComprovanteTransferencia(texto, linhasT);
      const pix = /\bpix\b/i.test(texto);
      return { ok: true, arquivo, tipo: 'nota', nota: {
        arquivo, origem, loja: c.loja, cnpj: '', data: c.data, hora: c.hora, total: c.total,
        forma: pix ? 'pix' : 'outro', cartao_final: '', categoria: 'Transferências e Pix',
        itens: [], documento: pix ? 'Comprovante de Pix' : 'Comprovante de transferência',
        // Pix para pagar fatura de cartão já está contado nas compras da fatura: pedir confirmação para não somar duas vezes.
        revisar: /fatura|cart[aã]o de cr[eé]dito|boleto/i.test(texto),
        avisos: /fatura|cart[aã]o de cr[eé]dito|boleto/i.test(texto) ? ['Parece pagamento de fatura ou boleto. Se for a fatura do cartão, remova esta nota para não contar duas vezes.'] : []
      } };
    }
    const linhas = texto.split('\n').map(l => l.replace(/\s+$/, '')).filter(l => l.trim());
    if (!PALAVRAS_NOTA.test(texto) && !acharTotal(linhas)) return { ok: false, arquivo, motivo: 'Não parece uma nota fiscal ou cupom.' };
    const d = acharData(texto);
    const total = acharTotal(linhas);
    const itens = acharItens(linhas);
    const cnpjM = texto.match(/CNPJ[^\d\n]{0,12}(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/i);
    const nota = {
      arquivo, origem, loja: acharLoja(linhas), cnpj: cnpjM ? cnpjM[1] : '', data: d.iso, hora: d.hora, total,
      forma: forma(texto), cartao_final: finalCartao(texto), itens, revisar: false, avisos: []
    };
    if (ehDanfe(texto)) {
      const dn = lerDanfe(texto, linhas);
      if (dn.loja) nota.loja = dn.loja;
      nota.cnpj = dn.cnpj || nota.cnpj;
      if (dn.total != null) nota.total = dn.total;
      if (dn.itens.length) nota.itens = dn.itens;
      nota.documento = 'NF-e';
      // Na DANFE, "forma" só vale se houver bloco de pagamento/fatura; senão fica em branco para a pessoa dizer.
      if (!/FATURA\s*\/\s*DUPLICATA|FORMA DE PAGAMENTO|PAGAMENTO/i.test(texto)) nota.forma = '';
    }
    if (origem === 'foto') {
      nota.revisar = true;
      nota.avisos.push(confianca != null && confianca < 70 ? 'Foto difícil de ler: confira loja, data e total.' : 'Lido de foto: confira se está certo.');
    }
    // O OCR às vezes perde a vírgula ("32000" em vez de "320,00" ou "32,00"): use o total para consertar um item.
    // (Na DANFE os itens e o total vêm da tabela da nota, não da leitura genérica.)
    const itensFinais = nota.itens, totalFinal = nota.total;
    if (totalFinal && itensFinais.length) {
      const soma = () => r2(itensFinais.reduce((t, i) => t + i.total, 0));
      for (const it of itensFinais) {
        if (Math.abs(soma() - totalFinal) <= 0.05) break;
        for (const div of [10, 100]) {
          const novo = r2(it.total / div), resto = r2(soma() - it.total);
          if (Math.abs(resto + novo - totalFinal) <= 0.05) { it.total = novo; it.qtd = it.unitario ? r2(novo / it.unitario) : it.qtd; break; }
        }
      }
    }
    const somaItens = r2(itensFinais.reduce((t, i) => t + i.total, 0));
    if (totalFinal && itensFinais.length && Math.abs(somaItens - totalFinal) > 0.05) nota.avisos.push(`Os itens somam ${somaItens.toFixed(2).replace('.', ',')} e o total lido é ${totalFinal.toFixed(2).replace('.', ',')}.`);
    return { ok: true, arquivo, tipo: 'nota', nota };
  };

  /* ---------------- OCR de foto ---------------- */
  let carregando = null;
  const carregarScript = (src) => new Promise((ok, erro) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => erro(new Error('Não encontrei ' + src)); document.head.appendChild(s); });
  function carregarOCR() {
    if (!carregando) carregando = (async () => {
      if (!g.Tesseract) await carregarScript('vendor/ocr/tesseract.min.js');
      if (!g.RX_OCR_WORKER_SRC) await carregarScript('vendor/ocr/ocr-worker.js');
      if (!g.RX_OCR_POR_GZ_B64) await carregarScript('vendor/ocr/por.js');
      const workerPath = URL.createObjectURL(new Blob([g.RX_OCR_WORKER_SRC], { type: 'application/javascript' }));
      const por = Uint8Array.from(atob(g.RX_OCR_POR_GZ_B64), c => c.charCodeAt(0));
      return g.Tesseract.createWorker([{ code: 'por', data: por }], 1, { workerPath, corePath: 'embutido', workerBlobURL: false, cacheMethod: 'none', gzip: true, logger: () => {} });
    })().catch(e => { carregando = null; throw e; });
    return carregando;
  }

  /** Melhora a foto para o OCR: corrige rotação (EXIF), tons de cinza, contraste e tamanho. */
  /** Acha o retângulo do papel (claro e sem cor) para ignorar mesa, toalha etc. */
  function recortePapel(bmp) {
    const W = 240, H = Math.max(1, Math.round(bmp.height * W / bmp.width));
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0, W, H);
    const px = ctx.getImageData(0, 0, W, H).data;
    const papel = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const r = px[i], gg = px[i + 1], b = px[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
      papel[j] = mx > 95 && (mx - mn) / mx < 0.18 ? 1 : 0;
    }
    const faixa = (perfil, lim) => { // maior trecho acima do limite, tolerando pequenas falhas (sombra, carimbo)
      const folga = Math.max(2, Math.round(perfil.length * 0.06));
      let melhor = [0, perfil.length - 1], tam = 0, ini = -1, fim = -1, falha = 0;
      perfil.forEach((v, i) => {
        if (v >= lim) { if (ini < 0) ini = i; fim = i; falha = 0; if (fim - ini + 1 > tam) { tam = fim - ini + 1; melhor = [ini, fim]; } }
        else if (ini >= 0 && ++falha > folga) { ini = -1; falha = 0; }
      });
      return tam >= perfil.length * 0.25 ? melhor : [0, perfil.length - 1];
    };
    const col = Array.from({ length: W }, (_, x) => { let s = 0; for (let y = 0; y < H; y++) s += papel[y * W + x]; return s / H; });
    const [x0, x1] = faixa(col, 0.4);
    const lin = Array.from({ length: H }, (_, y) => { let s = 0; for (let x = x0; x <= x1; x++) s += papel[y * W + x]; return s / (x1 - x0 + 1); });
    const [y0, y1] = faixa(lin, 0.4);
    const k = bmp.width / W, m = 4;
    return { x: Math.max(0, (x0 - m) * k), y: Math.max(0, (y0 - m) * k), w: Math.min(bmp.width, (x1 - x0 + 2 * m) * k), h: Math.min(bmp.height, (y1 - y0 + 2 * m) * k) };
  }

  async function prepararImagem(arquivo) {
    const bmp = await createImageBitmap(arquivo, { imageOrientation: 'from-image' });
    const rc = recortePapel(bmp);
    const alvo = 1800, esc = Math.min(2.5, alvo / Math.max(rc.w, rc.h)) || 1;
    const w = Math.round(rc.w * esc), h = Math.round(rc.h * esc);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bmp, rc.x, rc.y, rc.w, rc.h, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h), px = img.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) { const y = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0; px[i] = y; hist[y]++; }
    let acc = 0, lo = 0, hi = 255; const n = w * h;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc < n * 0.02) lo = v; if (acc < n * 0.98) hi = v; }
    const k = 255 / Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) { const y = Math.max(0, Math.min(255, (px[i] - lo) * k)); px[i] = px[i + 1] = px[i + 2] = y; }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  RX.lerNotaFoto = async function (arquivo, aoProgresso) {
    if (ehHeic(arquivo.name)) return { ok: false, arquivo: arquivo.name, motivo: 'Fotos HEIC (iPhone) não abrem no navegador. Exporte como JPG e coloque na pasta.' };
    aoProgresso && aoProgresso('Preparando o leitor de fotos (só na primeira vez)…');
    const worker = await carregarOCR();
    aoProgresso && aoProgresso('Lendo a foto…');
    const canvas = await prepararImagem(arquivo);
    const r = await worker.recognize(canvas);
    // Texto bruto da foto (pode ter CPF/endereço impressos no cupom): só fica em memória se a depuração estiver ligada.
    if (RX.depurar) RX._ultimoOCR = r.data.text;
    const res = RX.lerNotaTexto(r.data.text || '', { arquivo: arquivo.name, origem: 'foto', confianca: r.data.confidence });
    if (!res.ok) res.motivo = 'Não consegui reconhecer uma nota nesta foto. Tente uma foto mais reta e iluminada, ou digite a despesa à mão.';
    return res;
  };
})(window);
