/* Raio-X da Fatura — tela inicial: escolher a pasta, ler os PDFs e controlar o mês. */
(function () {
  const RX = window.RaioX;
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const nomeMes = (m) => { const [a, n] = m.split('-').map(Number); const s = MESES[n - 1]; return s[0].toUpperCase() + s.slice(1) + ' de ' + a; };
  RX.nomeMes = nomeMes;

  const pdfjs = window.pdfjsLib;
  if (pdfjs) pdfjs.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

  const inicio = $('#rx-inicio'), painel = $('#dash-root'), lista = $('#rx-arquivos'), resumo = $('#rx-resumo');
  const modoExemplo = !!window.RAIO_X_EXEMPLO;

  function mostrar(qual) {
    if (inicio) inicio.hidden = qual !== 'inicio';
    painel.hidden = qual !== 'painel';
    if (qual === 'painel') { montarControles(); RX.atualizar(); window.scrollTo(0, 0); }
  }

  if (modoExemplo) {
    RX.usarDados(window.RAIO_X_EXEMPLO);
    document.addEventListener('raio-x:atualizado', () => { const sel = document.querySelector('#rx-controles select'); if (sel) sel.value = RX.mesSelecionado; });
    mostrar('painel');
    return;
  }
  const chips = $('#rx-bancos');
  if (chips) RX.leitores.forEach(l => chips.appendChild(el('span', null, l.banco)));

  // ---------- senha de PDF ----------
  const dlg = $('#rx-senha');
  function pedirSenha(nome, errou) {
    return new Promise((resolve) => {
      $('#rx-senha-arquivo').textContent = nome;
      $('#rx-senha-erro').hidden = !errou;
      const inp = $('#rx-senha-campo'); inp.value = '';
      const fechar = (v) => { dlg.close(); $('#rx-senha-form').onsubmit = null; $('#rx-senha-pular').onclick = null; resolve(v); };
      $('#rx-senha-form').onsubmit = (e) => { e.preventDefault(); fechar(inp.value); };
      $('#rx-senha-pular').onclick = () => fechar(null);
      dlg.showModal(); inp.focus();
    });
  }

  async function extrair(arquivo) {
    const dados = new Uint8Array(await arquivo.arrayBuffer());
    let tentativa = 0;
    const task = pdfjs.getDocument({ data: dados, isEvalSupported: false, disableFontFace: true });
    task.onPassword = async (atualizarSenha, motivo) => {
      const senha = await pedirSenha(arquivo.name, tentativa++ > 0 || motivo === pdfjs.PasswordResponses.INCORRECT_PASSWORD);
      if (senha == null) { task.destroy(); return; }
      atualizarSenha(senha);
    };
    const doc = await task.promise;
    return RX.extrairLinhasDoc(doc);
  }

  // Versão de extrairLinhas que recebe o documento já aberto (para suportar senha).
  RX.extrairLinhasDoc = async function (doc) {
    const falso = { getDocument: () => ({ promise: Promise.resolve(doc) }) };
    return RX.extrairLinhas(falso, null);
  };

  // ---------- leitura de vários arquivos ----------
  async function processar(arquivos, { substituir }) {
    const aceitos = arquivos.filter(f => /\.pdf$/i.test(f.name) || (RX.ehArquivoDeNota && RX.ehArquivoDeNota(f.name)))
      .sort((a, b) => a.name.localeCompare(b.name));
    lista.replaceChildren(); resumo.hidden = true;
    $('#rx-progresso').hidden = false;
    if (!aceitos.length) { linhaStatus({ nome: 'Nenhum arquivo de fatura ou nota encontrado', cls: 'erro', det: 'Escolha a pasta com os PDFs das faturas e, se quiser, fotos, PDFs ou XMLs das notas fiscais.' }); return; }
    const faturas = [], notas = [], itensNota = new Map();
    const dataBR = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : 'sem data';
    const descNota = (n) => [n.loja || 'Loja não lida', dataBR(n.data), n.total > 0 ? brl.format(n.total) : 'total não lido', RX.FORMAS_PAGAMENTO ? RX.FORMAS_PAGAMENTO[n.forma || ''] : n.forma].join(' · ');
    let falhas = 0;
    for (const f of aceitos) {
      const item = linhaStatus({ nome: f.webkitRelativePath || f.name, cls: 'lendo', det: 'Lendo…' });
      try {
        let r;
        if (/\.xml$/i.test(f.name)) r = RX.lerNotaXML(await f.text(), f.name);
        else if (!/\.pdf$/i.test(f.name)) r = await RX.lerNotaFoto(f, (msg) => atualizarStatus(item, 'lendo', msg));
        else {
          const paginas = await extrair(f);
          r = RX.lerFatura(paginas, f.name);
          const texto = RX.util.textoCompleto(paginas);
          const pareceFatura = /fatura/i.test(texto) && /(vencimento|limite)/i.test(texto) && /(cart[aã]o|cr[eé]dito)/i.test(texto);
          if (!r.ok && RX.lerNotaTexto && !pareceFatura) {
            const nota = RX.lerNotaTexto(texto, { arquivo: f.name, origem: 'pdf' });
            if (nota.ok && (nota.nota.total > 0 || nota.nota.loja)) r = nota;
          }
        }
        if (!r.ok) { falhas++; atualizarStatus(item, 'aviso', r.motivo); continue; }
        try { const id = await RX.armazem.guardarOriginal(f); if (id) (r.tipo === 'nota' ? r.nota : r.fatura).arquivo_id = id; }
        catch (e) { console.warn('Raio-X da Fatura: não guardei o arquivo original.', e); }
        if (r.tipo === 'nota') {
          notas.push(r); itensNota.set(r, item);
          atualizarStatus(item, r.nota.revisar ? 'aviso' : 'ok', 'Nota · ' + descNota(r.nota) + (r.nota.revisar ? ' — confira na tela de Despesas.' : ''));
        } else {
          faturas.push(r);
          const ok = r.conferencia.confere;
          atualizarStatus(item, ok ? 'ok' : 'aviso',
            `${r.banco} · ${nomeMes(r.fatura.mes)} · ${brl.format(r.fatura.total)} · ${r.lancamentos.length} lançamentos` +
            (ok ? '' : ` — atenção: a soma dos lançamentos (${brl.format(r.conferencia.soma)}) difere do total em ${brl.format(Math.abs(r.conferencia.diferenca))}.`));
        }
      } catch (e) {
        falhas++;
        const senha = e && e.name === 'PasswordException';
        atualizarStatus(item, 'erro', senha ? 'PDF protegido por senha (pulado).' : /\.pdf$/i.test(f.name) ? 'Não foi possível abrir este PDF.' : 'Não foi possível ler este arquivo: ' + (e && e.message || e));
      }
    }
    if (faturas.length) RX.adicionar(faturas, { substituir });
    if (notas.length) {
      const novas = RX.adicionarNotas(notas);
      const porId = new Map(RX.estado().lancamentos.map(l => [l.id, l]));
      notas.forEach(r => {
        const li = itensNota.get(r);
        if (r.repetida) { atualizarStatus(li, 'ok', 'Nota já estava guardada (ignorada).'); return; }
        const n = novas.find(x => x.arquivo === r.nota.arquivo);
        const l = n && n.vinculo && porId.get(n.vinculo);
        if (l) li.querySelector('.rx-arq-det').textContent += ` — ligada ao cartão ${l.banco}${l.cartao ? ' final ' + l.cartao : ''}.`;
      });
    }
    const partes = [];
    if (faturas.length) partes.push(`${faturas.length} fatura${faturas.length > 1 ? 's' : ''}`);
    if (notas.length) partes.push(`${notas.length} nota${notas.length > 1 ? 's' : ''}`);
    resumo.hidden = false;
    $('#rx-resumo-texto').textContent = partes.length ? `Lido: ${partes.join(' e ')}${falhas ? ` · ${falhas} arquivo${falhas > 1 ? 's' : ''} com problema` : ''}.` : 'Nada pôde ser lido.';
    $('#rx-abrir-painel').hidden = !RX.temDados();
    if (notas.length && !faturas.length && RX.mostrarVisao) RX.mostrarVisao('despesas');
  }

  function linhaStatus({ nome, cls, det }) {
    const li = el('li', 'rx-arq ' + cls);
    li.append(el('span', 'rx-arq-ico'), el('span', 'rx-arq-nome', nome), el('span', 'rx-arq-det', det));
    lista.appendChild(li); return li;
  }
  function atualizarStatus(li, cls, det) { li.className = 'rx-arq ' + cls; li.querySelector('.rx-arq-det').textContent = det; }

  // ---------- escolher pasta / arrastar ----------
  let substituirProx = true;
  const entrada = $('#rx-pasta'), entradaArq = $('#rx-arquivos-input');
  const aoEscolher = (e) => { const fs = [...e.target.files]; e.target.value = ''; mostrar('inicio'); processar(fs, { substituir: substituirProx }); };
  entrada.addEventListener('change', aoEscolher);
  entradaArq.addEventListener('change', aoEscolher);
  $('#rx-btn-pasta').addEventListener('click', () => { substituirProx = !RX.temDados(); entrada.click(); });
  $('#rx-btn-arquivos').addEventListener('click', () => { substituirProx = !RX.temDados(); entradaArq.click(); });
  $('#rx-abrir-painel').addEventListener('click', () => mostrar('painel'));
  $('#rx-voltar-painel').addEventListener('click', () => mostrar('painel'));

  const zona = $('#rx-zona');
  ['dragenter', 'dragover'].forEach(ev => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add('arrastando'); }));
  ['dragleave', 'drop'].forEach(ev => zona.addEventListener(ev, () => zona.classList.remove('arrastando')));
  zona.addEventListener('drop', async (e) => {
    e.preventDefault();
    const arquivos = [];
    const lerEntrada = (ent) => new Promise((ok) => {
      if (ent.isFile) ent.file(f => { arquivos.push(f); ok(); }, ok);
      else if (ent.isDirectory) {
        const leitor = ent.createReader(), filhos = [];
        const lote = () => leitor.readEntries(async (es) => { if (!es.length) { await Promise.all(filhos.map(lerEntrada)); ok(); } else { filhos.push(...es); lote(); } }, ok);
        lote();
      } else ok();
    });
    const itens = [...(e.dataTransfer.items || [])].map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    if (itens.length) await Promise.all(itens.map(lerEntrada)); else arquivos.push(...e.dataTransfer.files);
    processar(arquivos, { substituir: !RX.temDados() });
  });

  // ---------- controles no topo do painel ----------
  function montarControles() {
    const box = document.getElementById('rx-controles');
    if (!box) return;
    box.replaceChildren();
    const meses = RX.meses();
    const rot = el('label', 'rx-ctl-mes');
    rot.append(el('span', 'rx-sr', 'Mês da fatura'));
    const sel = el('select', 'rx-select'); sel.setAttribute('aria-label', 'Mês da fatura');
    meses.forEach(m => { const o = el('option', null, nomeMes(m)); o.value = m; sel.appendChild(o); });
    if (meses.length > 1 || RX.estado().notas.length) { const o = el('option', null, 'Todos os meses'); o.value = RX.TODOS; sel.appendChild(o); }
    sel.value = RX.mesSelecionado;
    sel.addEventListener('change', () => RX.selecionarMes(sel.value));
    rot.appendChild(sel);
    box.appendChild(rot);
    const menu = el('div', 'rx-ctl-acoes');
    if (!modoExemplo) {
      const add = el('button', 'rx-btn-ghost', '+ Faturas'); add.type = 'button'; add.title = 'Adicionar mais faturas';
      add.addEventListener('click', () => { substituirProx = false; entrada.click(); });
      const dados = el('button', 'rx-btn-ghost', 'Dados e backup'); dados.type = 'button'; dados.title = 'Backup, armazenamento, CSV e limpeza';
      dados.addEventListener('click', abrirDados);
      menu.append(add, dados);
    } else {
      const a = el('a', 'rx-btn-ghost', 'Usar minhas faturas'); a.href = 'index.html'; menu.append(a);
    }
    box.appendChild(menu);
  }
  document.addEventListener('raio-x:atualizado', () => {
    const sel = document.querySelector('#rx-controles select');
    if (sel && sel.options.length !== RX.meses().length + (RX.meses().length > 1 || RX.estado().notas.length ? 1 : 0)) montarControles();
    else if (sel) sel.value = RX.mesSelecionado;
  });

  // ---------- dados, backup e armazenamento ----------
  const dlgDados = $('#rx-dados');
  const MB = (b) => b == null ? '—' : (b / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: b < 1048576 ? 2 : 1 }) + ' MB';
  const baixar = (blob, nome) => { const a = el('a'); a.href = URL.createObjectURL(blob); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const hojeArq = () => new Date().toISOString().slice(0, 10);
  async function abrirDados() {
    const u = await RX.armazem.uso();
    const e = RX.estado();
    $('#rx-dados-onde').textContent = u.modo === 'indexeddb' ? 'Banco de dados do navegador (IndexedDB), só neste computador.'
      : u.modo === 'localstorage' ? 'Armazenamento simples do navegador (localStorage). Arquivos originais não são guardados neste modo.' : 'Este navegador não permite guardar dados: ao fechar, tudo se perde. Use o backup.';
    $('#rx-dados-conteudo').textContent = `${e.faturas.length} fatura${e.faturas.length === 1 ? '' : 's'}, ${e.lancamentos.length} lançamentos, ${e.notas.length} nota${e.notas.length === 1 ? '' : 's'}` +
      (u.modo === 'indexeddb' ? ` · ${u.nOriginais} arquivo${u.nOriginais === 1 ? '' : 's'} original${u.nOriginais === 1 ? '' : 'is'} (${MB(u.originais)})` : '');
    $('#rx-dados-espaco').textContent = u.usado != null ? `${MB(u.usado)} usados de ${MB(u.cota)} disponíveis para este app.` : '';
    const chk = $('#rx-dados-originais');
    chk.checked = !!RX.armazem.config.guardarOriginais && RX.armazem.podeGuardarOriginais();
    chk.disabled = !RX.armazem.podeGuardarOriginais();
    $('#rx-dados-msg').textContent = '';
    dlgDados.showModal();
  }
  if (dlgDados) {
    $('#rx-dados-fechar').addEventListener('click', () => dlgDados.close());
    $('#rx-dados-originais').addEventListener('change', async (ev) => {
      await RX.armazem.definirConfig({ guardarOriginais: ev.target.checked });
      if (!ev.target.checked) { await RX.armazem.apagarOriginais(); RX.estado().faturas.forEach(f => { f.arquivo_id = ''; }); RX.estado().notas.forEach(n => { n.arquivo_id = ''; }); RX._salvar(); RX.atualizar(); }
      abrirDados();
    });
    $('#rx-dados-backup').addEventListener('click', async () => {
      $('#rx-dados-msg').textContent = 'Gerando backup…';
      const comOrig = $('#rx-dados-backup-orig').checked;
      const blob = await RX.gerarBackup({ comOriginais: comOrig });
      baixar(blob, `raio-x-da-fatura-backup-${hojeArq()}.json`);
      $('#rx-dados-msg').textContent = `Backup baixado (${MB(blob.size)}). Guarde em lugar seguro: ele tem todos os seus dados financeiros.`;
    });
    $('#rx-dados-csv').addEventListener('click', baixarCSV);
    $('#rx-dados-csv-notas').addEventListener('click', () => baixar(new Blob(['\ufeff' + RX.csvNotas()], { type: 'text/csv;charset=utf-8' }), 'raio-x-da-fatura-notas.csv'));
    $('#rx-dados-restaurar').addEventListener('click', () => $('#rx-backup-input').click());
    const limpar = $('#rx-dados-limpar');
    limpar.addEventListener('click', async () => {
      if (!limpar.dataset.confirmar) { limpar.dataset.confirmar = '1'; limpar.textContent = 'Clique de novo para apagar tudo'; setTimeout(() => { delete limpar.dataset.confirmar; limpar.textContent = 'Apagar tudo deste navegador'; }, 4000); return; }
      await RX.limpar(); dlgDados.close(); lista.replaceChildren(); $('#rx-progresso').hidden = true; mostrar('inicio');
    });
  }
  const inpBackup = $('#rx-backup-input');
  if (inpBackup) inpBackup.addEventListener('change', async (ev) => {
    const arq = ev.target.files[0]; ev.target.value = '';
    if (!arq) return;
    const msg = (t) => { const m = $('#rx-dados-msg'); if (m && dlgDados.open) m.textContent = t; else { $('#rx-progresso').hidden = false; lista.replaceChildren(); linhaStatus({ nome: arq.name, cls: /^Backup restaurado/.test(t) ? 'ok' : 'erro', det: t }); } };
    try {
      const d = await RX.lerBackup(arq);
      await RX.restaurarOriginais(d.originais);
      await RX.substituirEstado(d);
      msg(`Backup restaurado: ${d.faturas.length} faturas, ${d.lancamentos.length} lançamentos, ${d.notas.length} notas.`);
      if (dlgDados && dlgDados.open) dlgDados.close();
      mostrar('painel');
    } catch (e) { msg(e.message || String(e)); }
  });
  const btnRestaurarInicio = $('#rx-restaurar-inicio');
  if (btnRestaurarInicio) btnRestaurarInicio.addEventListener('click', () => inpBackup.click());

  function baixarCSV() {
    const blob = new Blob(['﻿' + RX.csv()], { type: 'text/csv;charset=utf-8' });
    const a = el('a'); a.href = URL.createObjectURL(blob); a.download = 'raio-x-da-fatura-lancamentos.csv';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- início ----------
  RX.carregarSalvo().then(tem => {
    mostrar(tem ? 'painel' : 'inicio');
    $('#rx-voltar-painel').hidden = !RX.temDados();
  });
  document.addEventListener('raio-x:atualizado', () => { $('#rx-voltar-painel').hidden = !RX.temDados(); });
  if (!pdfjs) linhaStatus({ nome: 'Leitor de PDF não carregou', cls: 'erro', det: 'Verifique se a pasta vendor/ está junto do index.html.' });
})();
