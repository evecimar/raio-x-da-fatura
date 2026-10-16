/* Raio-X da Fatura — nomes de estabelecimento e categorias.
   As regras são uma lista simples: a primeira que bater vence. Contribuições são bem-vindas! */
(function (g) {
  const RX = g.RaioX = g.RaioX || {};

  // [padrão na descrição, nome limpo do estabelecimento, categoria]
  const MARCAS = [
    [/tik ?tok/i, 'TikTok Shop', 'Compras online'],
    [/shopee/i, 'Shopee', 'Compras online'],
    [/mercado ?livre|mercadolivre/i, 'Mercado Livre', 'Compras online'],
    [/amazon|amzn/i, 'Amazon', 'Compras online'],
    [/magalu|magazine ?luiza/i, 'Magalu', 'Compras online'],
    [/aliexpress/i, 'AliExpress', 'Compras online'],
    [/shein/i, 'Shein', 'Compras online'],
    [/temu/i, 'Temu', 'Compras online'],
    [/anthropic|claude\.ai/i, 'Claude (Anthropic)', 'Assinaturas digitais'],
    [/openai|chatgpt/i, 'ChatGPT (OpenAI)', 'Assinaturas digitais'],
    [/apple\.com|itunes/i, 'Apple', 'Assinaturas digitais'],
    [/google|youtube/i, 'Google', 'Assinaturas digitais'],
    [/netflix/i, 'Netflix', 'Assinaturas digitais'],
    [/spotify/i, 'Spotify', 'Assinaturas digitais'],
    [/microsoft|xbox/i, 'Microsoft', 'Assinaturas digitais'],
    [/disney/i, 'Disney+', 'Assinaturas digitais'],
    [/hbo ?max|\bmax\.com/i, 'Max', 'Assinaturas digitais'],
    [/prime ?video|amazon ?prime/i, 'Prime Video', 'Assinaturas digitais'],
    [/globoplay/i, 'Globoplay', 'Assinaturas digitais'],
    [/starlink/i, 'Starlink', 'Assinaturas digitais'],
    [/vivo|claro\b|\btim\b|oi ?fibra/i, null, 'Assinaturas digitais'],
    [/ifood|ifd\*/i, null, 'Alimentação fora'],
    [/uber ?eats|rappi|aiqfome/i, null, 'Alimentação fora'],
    [/\buber\b|99 ?app|99pop|cabify/i, null, 'Transporte'],
    [/posto|auto ?posto|combust|shell|ipiranga|petrobras|\bbr mania/i, null, 'Combustível'],
    [/farm[aá]cia|drogaria|droga ?raia|drogasil|pague ?menos|panvel/i, null, 'Farmácia e saúde'],
    [/m[eé]d(ic|ico)|cl[ií]nica|laborat|hospital|odonto|imagem/i, null, 'Farmácia e saúde'],
    [/mercad(o|inho)|supermerc|atacad|assa[ií]|carrefour|p[aã]o de a[cç]|minimercado|hortifruti|a[cç]ougue/i, null, 'Mercado'],
    [/padaria|restaur|lanchon|pizz|burger|bar\b|caf[eé]|churrasc|sorvet|a[cç]a[ií]|frango|espetinho/i, null, 'Alimentação fora'],
    [/pneu|auto ?center|garage|oficina|mec[aâ]nic|estaciona|sem ?parar|veloe|conectcar/i, null, 'Veículo'],
    [/tinta|m[oó]veis|constru|leroy|madeir|eletro|lojas|casa |g[aá]s\b|[aá]gua e g[aá]s|revestiment|piso|porcelanato|cer[aâ]mica|argamassa|rejunt|cimento|areia|telha|tijolo|hidr[aá]ulic|el[eé]tric[ao]s?\b|ferragens|vidra[cç]aria/i, null, 'Casa'],
    [/infantil|roupa|moda|cal[cç]ad|renner|riachuelo|c&a|praia/i, null, 'Roupas e infantil'],
    [/faculdade|escola|curso|udemy|alura|col[eé]gio/i, null, 'Educação'],
    [/pet ?(shop|show)|petz|cobasi|veterin/i, null, 'Pet'],
    [/fotograf|sal[aã]o|barbearia|est[eé]tica/i, null, 'Serviços'],
    [/cinema|ingresso|show|teatro|steam|playstation|nintendo/i, null, 'Lazer']
  ];
  const PREFIXOS = /^(DL|EBN|MP|IFD|EC|PPRO|LITE|PAG|PG|SUMUP|SQ|STONE|CIELO|GETNET|PICPAY|MLP|PAYPAL|HTM|ZP|PAGSEG|PAGSEGURO)\s?\*\s?/i;

  const titulo = (s) => s.toLowerCase().replace(/(^|[\s\-/(])([a-zà-ú])/g, (a, b, c) => b + c.toUpperCase());

  RX.estabelecimento = function (desc) {
    const d = String(desc || '');
    for (const [re, nome] of MARCAS) if (nome && re.test(d)) return nome;
    let s = d.replace(/^IOF de "?(.*?)"?$/i, '$1');
    for (let i = 0; i < 2; i++) s = s.replace(PREFIXOS, '');
    s = s.replace(/^(.{4,}?)\s+\w\*.*$/, '$1').replace(/\s*\*.*$/, '').replace(/\s+\d{2,}(\s+[A-Z])?$/, '').replace(/^\d{5,}\s*/, '').replace(/\s{2,}/g, ' ').trim();
    if (s === s.toUpperCase()) s = titulo(s);
    return s || d;
  };

  RX.categorizar = function (l) {
    if (l.tipo === 'estorno' || l.valor < 0) return 'Créditos e estornos';
    if (l.tipo === 'iof' || l.tipo === 'anuidade' || l.tipo === 'encargo') return 'Taxas, IOF e juros';
    const d = String(l.descricao || '');
    for (const [re, , cat] of MARCAS) if (re.test(d)) return cat;
    return 'Outros';
  };
  RX.regrasDeCategoria = MARCAS;
})(typeof window !== 'undefined' ? window : globalThis);
