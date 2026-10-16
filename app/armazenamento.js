/* Raio-X da Fatura — armazenamento no navegador.
   Usa IndexedDB (banco "raio-x-da-fatura"); se não abrir, cai para localStorage (sem arquivos originais).
   Lojas: faturas (chave banco|mes), lancamentos (id), notas (id), originais (id → PDF/foto em Blob), meta.
   Na primeira abertura migra o que existia no localStorage (versões anteriores do app).
   Todas as gravações passam por uma fila, então nunca se atropelam. */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};
  const NOME = 'raio-x-da-fatura', VERSAO = 1;
  const CHAVE_LS = 'raio-x-da-fatura:v1';
  const LOJAS = ['faturas', 'lancamentos', 'notas', 'originais', 'meta'];
  let db = null, modo = 'nenhum', fila = Promise.resolve();
  const req = (r) => new Promise((ok, erro) => { r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error); });
  const fim = (tx) => new Promise((ok, erro) => { tx.oncomplete = () => ok(); tx.onerror = () => erro(tx.error); tx.onabort = () => erro(tx.error || new Error('transação abortada')); });
  const enfileirar = (fn) => (fila = fila.then(fn, fn));
  const lsLer = () => { try { return JSON.parse(localStorage.getItem(CHAVE_LS) || 'null'); } catch (e) { return null; } };
  const temAlgo = (s) => s && ((s.faturas && s.faturas.length) || (s.notas && s.notas.length));

  function abrirIDB() {
    return new Promise((ok, erro) => {
      if (!g.indexedDB) return erro(new Error('IndexedDB indisponível'));
      let r;
      try { r = g.indexedDB.open(NOME, VERSAO); } catch (e) { return erro(e); }
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('faturas')) d.createObjectStore('faturas', { keyPath: 'chave' });
        if (!d.objectStoreNames.contains('lancamentos')) d.createObjectStore('lancamentos', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('notas')) d.createObjectStore('notas', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('originais')) d.createObjectStore('originais', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta');
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => erro(r.error);
      r.onblocked = () => erro(new Error('banco bloqueado por outra aba'));
    });
  }

  let abrindo = null;
  async function abrir() {
    if (!abrindo) abrindo = (async () => {
      try { db = await abrirIDB(); modo = 'indexeddb'; }
      catch (e) {
        console.warn('Raio-X da Fatura: IndexedDB indisponível, usando localStorage.', e);
        try { localStorage.setItem('raio-x-teste', '1'); localStorage.removeItem('raio-x-teste'); modo = 'localstorage'; } catch (e2) { modo = 'nenhum'; }
      }
      return modo;
    })();
    return abrindo;
  }

  async function lerTudoIDB() {
    const tx = db.transaction(['faturas', 'lancamentos', 'notas', 'meta'], 'readonly');
    const [faturas, lancamentos, notas, config] = await Promise.all([
      req(tx.objectStore('faturas').getAll()), req(tx.objectStore('lancamentos').getAll()),
      req(tx.objectStore('notas').getAll()), req(tx.objectStore('meta').get('config'))
    ]);
    faturas.forEach(f => delete f.chave);
    return { faturas, lancamentos, notas, config: config || {} };
  }

  async function gravarTudoIDB(estado) {
    const tx = db.transaction(['faturas', 'lancamentos', 'notas', 'meta', 'originais'], 'readwrite');
    const sF = tx.objectStore('faturas'), sL = tx.objectStore('lancamentos'), sN = tx.objectStore('notas');
    sF.clear(); sL.clear(); sN.clear();
    estado.faturas.forEach(f => sF.put({ ...f, chave: `${f.banco}|${f.mes}` }));
    estado.lancamentos.forEach(l => sL.put({ ...l }));
    estado.notas.forEach(n => sN.put(JSON.parse(JSON.stringify(n))));
    tx.objectStore('meta').put(new Date().toISOString(), 'salvoEm');
    // Arquivos originais que ninguém mais usa são apagados junto.
    const usados = new Set([...estado.faturas.map(f => f.arquivo_id), ...estado.notas.map(n => n.arquivo_id)].filter(Boolean));
    const so = tx.objectStore('originais');
    const ids = await req(so.getAllKeys());
    ids.forEach(id => { if (!usados.has(id)) so.delete(id); });
    await fim(tx);
  }

  const A = RX.armazem = {
    modo: () => modo,
    abrir,

    /** Lê o estado guardado. Migra do localStorage na primeira vez. */
    async lerEstado() {
      await abrir();
      if (modo === 'indexeddb') {
        let s = await lerTudoIDB();
        const antigo = lsLer();
        if (!temAlgo(s) && temAlgo(antigo)) {
          const migrar = { faturas: antigo.faturas || [], lancamentos: antigo.lancamentos || [], notas: antigo.notas || [] };
          await enfileirar(() => gravarTudoIDB(migrar));
          const conferido = await lerTudoIDB();
          if (conferido.faturas.length === migrar.faturas.length && conferido.lancamentos.length === migrar.lancamentos.length && conferido.notas.length === migrar.notas.length) {
            try { localStorage.removeItem(CHAVE_LS); } catch (e) { /* ok */ }
            const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(new Date().toISOString(), 'migradoDoLocalStorage'); await fim(tx);
            console.info('Raio-X da Fatura: dados migrados do localStorage para o IndexedDB.');
          }
          s = conferido;
        }
        A.config = { guardarOriginais: true, ...(s.config || {}) };
        return temAlgo(s) ? s : null;
      }
      if (modo === 'localstorage') { const s = lsLer(); A.config = { guardarOriginais: false }; return temAlgo(s) ? s : null; }
      return null;
    },

    gravarEstado(estado) {
      return enfileirar(async () => {
        await abrir();
        if (modo === 'indexeddb') return gravarTudoIDB(estado);
        if (modo === 'localstorage') localStorage.setItem(CHAVE_LS, JSON.stringify({ versao: 2, salvoEm: new Date().toISOString(), ...estado }));
      }).catch(e => { console.error('Raio-X da Fatura: não foi possível guardar.', e); document.dispatchEvent(new CustomEvent('raio-x:erro-armazenamento', { detail: String(e && e.message || e) })); });
    },

    limpar() {
      return enfileirar(async () => {
        await abrir();
        if (modo === 'indexeddb') { const tx = db.transaction(LOJAS, 'readwrite'); LOJAS.forEach(l => tx.objectStore(l).clear()); await fim(tx); }
        try { localStorage.removeItem(CHAVE_LS); } catch (e) { /* ok */ }
      });
    },

    config: { guardarOriginais: true },
    async definirConfig(c) {
      A.config = { ...A.config, ...c };
      await abrir();
      if (modo !== 'indexeddb') return;
      await enfileirar(async () => { const tx = db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(A.config, 'config'); await fim(tx); });
    },

    /* ---------- arquivos originais (PDF, fotos, XML) ---------- */
    podeGuardarOriginais: () => modo === 'indexeddb',
    async guardarOriginal(arquivo) {
      await abrir();
      if (modo !== 'indexeddb' || !A.config.guardarOriginais) return '';
      const id = 'orig-' + [arquivo.name, arquivo.size, arquivo.lastModified || 0].join('|');
      await enfileirar(async () => {
        const tx = db.transaction('originais', 'readwrite');
        const tipo = tipoSeguro(arquivo.type, arquivo.name);
        tx.objectStore('originais').put({ id, nome: arquivo.name, tipo, tamanho: arquivo.size, blob: arquivo.slice(0, arquivo.size, tipo), guardadoEm: new Date().toISOString() });
        await fim(tx);
      });
      return id;
    },
    async lerOriginal(id) {
      await abrir();
      if (modo !== 'indexeddb' || !id) return null;
      return req(db.transaction('originais').objectStore('originais').get(id));
    },
    async listarOriginais() {
      await abrir();
      if (modo !== 'indexeddb') return [];
      const todos = await req(db.transaction('originais').objectStore('originais').getAll());
      return todos.map(o => ({ id: o.id, nome: o.nome, tipo: o.tipo, tamanho: o.tamanho, blob: o.blob }));
    },
    async apagarOriginais() {
      await abrir();
      if (modo !== 'indexeddb') return;
      await enfileirar(async () => { const tx = db.transaction('originais', 'readwrite'); tx.objectStore('originais').clear(); await fim(tx); });
    },

    /** Espaço usado: originais (exato) e total estimado pelo navegador. */
    async uso() {
      const orig = (await A.listarOriginais()).reduce((t, o) => t + (o.tamanho || 0), 0);
      let usado = null, cota = null;
      try { if (navigator.storage && navigator.storage.estimate) { const e = await navigator.storage.estimate(); usado = e.usage; cota = e.quota; } } catch (e) { /* ok */ }
      return { modo, originais: orig, nOriginais: (await A.listarOriginais()).length, usado, cota };
    },

    /** Espera as gravações pendentes (útil antes de exportar ou em testes). */
    esperar: () => fila
  };

  /** Abre o arquivo original (PDF/foto/XML) numa nova aba.
      O tipo é sempre recalculado por tipoSeguro: um backup adulterado não consegue abrir HTML/SVG/JS
      (isso rodaria script na origem do app e leria os dados). Tipo desconhecido → só baixa. */
  RX.abrirOriginal = async function (id) {
    const o = await A.lerOriginal(id);
    if (!o) return false;
    const tipo = tipoSeguro(o.tipo, o.nome);
    const url = URL.createObjectURL(new Blob([o.blob], { type: tipo }));
    const baixar = () => { const a = document.createElement('a'); a.href = url; a.download = String(o.nome || 'arquivo'); a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); };
    if (tipo === 'application/octet-stream') baixar();
    else {
      const w = g.open('', '_blank');
      if (w) { w.opener = null; w.location.href = url; } else baixar();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return true;
  };

  /* ---------- tipos de arquivo permitidos ---------- */
  const TIPOS_OK = /^(application\/pdf|image\/(jpeg|png|webp|bmp|gif)|(application|text)\/xml)$/;
  /** Só tipos que o navegador mostra sem rodar código (PDF, imagem, XML). Qualquer outro vira download. */
  function tipoSeguro(tipo, nome) {
    const t = String(tipo || '').toLowerCase().split(';')[0].trim();
    if (TIPOS_OK.test(t)) return t;
    const n = String(nome || '').toLowerCase();
    if (/\.pdf$/.test(n)) return 'application/pdf';
    if (/\.xml$/.test(n)) return 'application/xml';
    if (/\.jpe?g$/.test(n)) return 'image/jpeg';
    if (/\.png$/.test(n)) return 'image/png';
    if (/\.webp$/.test(n)) return 'image/webp';
    return 'application/octet-stream';
  }
  RX.tipoSeguro = tipoSeguro;

  /* ---------- backup ---------- */
  const paraBase64 = (blob) => new Promise((ok, erro) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.onerror = () => erro(r.error); r.readAsDataURL(blob); });
  const deBase64 = (b64, tipo) => { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: tipo || '' }); };

  /** Gera o backup completo (.json). comOriginais inclui PDFs/fotos em base64 (arquivo maior). */
  RX.gerarBackup = async function ({ comOriginais = true } = {}) {
    await A.esperar();
    const e = RX.estado();
    const backup = { app: 'raio-x-da-fatura', formato: 1, criadoEm: new Date().toISOString(), faturas: e.faturas, lancamentos: e.lancamentos, notas: e.notas, originais: [] };
    if (comOriginais) for (const o of await A.listarOriginais()) backup.originais.push({ id: o.id, nome: o.nome, tipo: o.tipo, tamanho: o.tamanho, base64: await paraBase64(o.blob) });
    return new Blob([JSON.stringify(backup)], { type: 'application/json' });
  };

  /** Lê um backup .json e devolve os dados (sem aplicar). Lança erro com mensagem amigável se não for válido. */
  RX.lerBackup = async function (arquivo) {
    let d;
    try { d = JSON.parse(await arquivo.text()); } catch (e) { throw new Error('Este arquivo não é um backup válido (JSON ilegível).'); }
    if (!d || d.app !== 'raio-x-da-fatura' || !Array.isArray(d.faturas) || !Array.isArray(d.lancamentos)) throw new Error('Este arquivo não é um backup do Raio-X da Fatura.');
    // Backup é arquivo de fora: só objetos, com os campos no formato que o app espera.
    const objetos = (a) => (Array.isArray(a) ? a : []).filter(x => x && typeof x === 'object' && !Array.isArray(x));
    d.faturas = objetos(d.faturas);
    d.lancamentos = objetos(d.lancamentos);
    d.notas = objetos(d.notas).map(n => ({ ...n, itens: objetos(n.itens), avisos: (Array.isArray(n.avisos) ? n.avisos : []).map(String) }));
    d.originais = objetos(d.originais).filter(o => typeof o.id === 'string' && typeof o.base64 === 'string')
      .map(o => ({ id: o.id, nome: String(o.nome || ''), tipo: tipoSeguro(o.tipo, o.nome), tamanho: Number(o.tamanho) || 0, base64: o.base64 }));
    return d;
  };

  /** Grava os originais de um backup no IndexedDB. */
  RX.restaurarOriginais = async function (originais) {
    await abrir();
    if (modo !== 'indexeddb' || !originais.length) return 0;
    await enfileirar(async () => {
      const tx = db.transaction('originais', 'readwrite');
      originais.forEach(o => { if (o && typeof o.id === 'string' && typeof o.base64 === 'string') { const tipo = tipoSeguro(o.tipo, o.nome); tx.objectStore('originais').put({ id: o.id, nome: String(o.nome || ''), tipo, tamanho: Number(o.tamanho) || 0, blob: deBase64(o.base64, tipo), guardadoEm: new Date().toISOString() }); } });
      await fim(tx);
    });
    return originais.length;
  };
})(window);
