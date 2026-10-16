/* Raio-X da Fatura — contrato dos dados e dos plugins (leitores de fatura).
   Este arquivo só descreve tipos: o navegador não o carrega. Ele serve para o editor (autocompletar)
   e para `npm run tipos`, que confere os arquivos marcados com // @ts-check. */

/** Um pedaço de texto do PDF e sua posição horizontal (em pontos, da esquerda). */
interface Celula { s: string; x: number }

/** Uma linha do PDF: células na mesma altura, da esquerda para a direita.
    `texto` junta as células; células distantes (mais de 12 pt) ficam separadas por 3 espaços. */
interface Linha { texto: string; celulas: Celula[]; y: number }

/** Uma página: linhas de cima para baixo. */
type Pagina = Linha[];

/** Dados da fatura que o leitor devolve. Valores em reais (número), datas 'AAAA-MM-DD'. Campo que não existe: null. */
interface FaturaLida {
  cartao: string;
  titular: string;
  total: number | null;
  vencimento: string;
  fechamento: string;
  limite_total?: number | null;
  limite_utilizado?: number | null;
  a_vencer?: number | null;
  pagamento_minimo?: number | null;
  juros_rotativo_am?: number | null;
}

type TipoLancamento = 'compra' | 'estorno' | 'iof' | 'anuidade' | 'encargo';

/** Um lançamento como o leitor devolve (antes de RaioX.lerFatura completar banco, mês, id, categoria…). */
interface LancamentoLido {
  /** 'AAAA-MM-DD' (use RaioX.util.comAno para datas sem ano) */
  data: string;
  descricao: string;
  /** últimos 4 dígitos do cartão, ou '' */
  cartao: string;
  /** nome de quem fez a compra (titular ou adicional); lerFatura guarda só o primeiro nome */
  portador: string;
  /** 'n/N' (ex.: '3/12') ou '' à vista */
  parcela: string;
  /** positivo = gasto, negativo = crédito/estorno */
  valor: number;
  /** 'compra' | 'estorno' | 'iof' | 'anuidade' | 'encargo' (em branco: compra, ou estorno se negativo) */
  tipo?: TipoLancamento | string;
}

/** Lançamento completo, como fica guardado. */
interface Lancamento extends LancamentoLido {
  id: string;
  banco: string;
  /** mês da fatura 'AAAA-MM' (o do vencimento) */
  mes: string;
  adicional: 'sim' | 'nao';
  estabelecimento: string;
  categoria: string;
  tipo: TipoLancamento;
}

interface Fatura extends FaturaLida {
  banco: string;
  arquivo: string;
  mes: string;
  paga?: 'sim' | '';
}

/** O plugin: um leitor de fatura de um banco. Veja PLUGINS.md. */
interface Leitor {
  /** identificador curto, sem espaços (ex.: 'nubank'); vira prefixo dos ids dos lançamentos */
  id: string;
  /** nome do banco como aparece na tela (ex.: 'Nubank') */
  banco: string;
  /** true se o texto completo do PDF é uma fatura deste banco. Tem que ser específico: não pode reconhecer fatura de outro banco. */
  reconhece(texto: string): boolean;
  /** Lê a fatura. Função pura: sem rede, sem armazenamento, sem tela. */
  ler(paginas: Pagina[], texto: string): { fatura: FaturaLida; lancamentos: LancamentoLido[] };
}

interface ResultadoLeitura {
  ok: boolean;
  arquivo: string;
  banco?: string;
  motivo?: string;
  fatura?: Fatura;
  lancamentos?: Lancamento[];
  /** soma dos lançamentos × total da fatura: é como sabemos que a leitura está certa */
  conferencia?: { soma: number; total: number | null; diferenca: number; confere: boolean };
  /** problemas no formato do que o leitor devolveu (data inválida, valor que não é número…) */
  problemas?: string[];
}

interface UtilLeitores {
  MESES: Record<string, number>;
  valor(txt: string | null | undefined): number | null;
  ehValor(s: string): boolean;
  dataBR(txt: string): string;
  dataExtenso(txt: string): string;
  comAno(dia: number, mes: number, referenciaISO?: string): string;
  primeiroNome(nome: string): string;
  achar(texto: string, re: RegExp, grupo?: number): string;
  linhasPorColuna(paginas: Pagina[], reData?: RegExp): (Linha & { pagina: number; coluna: number })[];
  textoCompleto(paginas: Pagina[]): string;
}

interface RaioX {
  leitores: Leitor[];
  registrarLeitor(l: Leitor): void;
  validarLeitura(r: { fatura: FaturaLida; lancamentos: LancamentoLido[] }): string[];
  lerFatura(paginas: Pagina[], nomeArquivo: string): ResultadoLeitura;
  util: UtilLeitores;
  estabelecimento?(descricao: string): string;
  categorizar?(l: { descricao?: string; valor: number; tipo?: string }): string;
  [outro: string]: any;
}

interface Window { RaioX: RaioX }
// eslint-disable-next-line no-var
declare var RaioX: RaioX;
