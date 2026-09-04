/**
 * Motor de Competências e Banco de Horas (CompetenciaEngine)
 * 
 * Regras mandatórias:
 * 1. Todos os cálculos internos e armazenamento contábil utilizam MINUTOS INTEIROS (integer).
 *    Ex: 90 = 1h30m, -135 = -2h15m. Evita erros de arredondamento IEEE-754.
 * 2. Cadeia de competências atemporal (YYYY-MM), sem acoplamento com o mês corrente.
 * 3. Transporte de saldo entre competências (C-1 -> C -> C+1).
 * 4. Tratamento explícito de virada de ano (ex: 2026-12 -> 2027-01).
 * 5. Transporte neutro para colaboradores sem lançamentos no mês.
 * 6. Tratamento de ausência de histórico (saldo inicial do cadastro ou zero explícito).
 * 7. Recálculo em cascata por propagação de Delta (Δ) para múltiplos meses/anos posteriores.
 * 8. Idempotência absoluta do fechamento.
 */

export type StatusCompetencia = 'ABERTO' | 'FECHADO' | 'REABERTO';

export const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export interface ColaboradorBase {
  matricula: string;
  nome: string;
  sede: string;
  saldoInicialMinutos?: number; // Saldo de contrato ou implantação em minutos
}

export interface LancamentoSimples {
  id: string;
  matricula: string;
  dataRegistro: string; // YYYY-MM-DD
  competencia: string;  // YYYY-MM
  tipo: 'CREDITO' | 'DEBITO';
  minutos: number;      // Minutos inteiros positivos (ex: 120 para 2h)
  descricao?: string;
}

export interface ResumoMensalContabil {
  id: string;                      // "${matricula}_${competencia}"
  matricula: string;
  competencia: string;             // YYYY-MM
  saldoAnteriorMinutos: number;    // Saldo que veio da competência anterior
  horasCreditoMinutos: number;     // Total de créditos apurados no mês
  horasDebitoMinutos: number;      // Total de débitos apurados no mês
  saldoMesMinutos: number;         // creditos - debitos
  saldoFinalTransportadoMinutos: number; // saldoAnterior + saldoMes
  
  origemSaldoAnterior: 'COMPETENCIA_ANTERIOR' | 'SALDO_BASE_CADASTRO' | 'INICIAL_PADRAO';
  movimentoNeutro: boolean;        // true se o servidor não teve lançamentos no mês
  
  statusCompetencia: StatusCompetencia;
  statusIntegridade?: 'ORIGINAL' | 'REAJUSTADO_POR_CASCATA';
  deltaAplicadoMinutos?: number;
  origemAlteracaoCascata?: string;
  versao: number;
  hashLancamentosConsolidados: string;
  atualizadoEm: string;

  // -----------------------------------------------------------
  // Fase 5 — Metadados de validade e rastreabilidade (LGPD-safe:
  // apenas minutos inteiros e datas; nenhum dado pessoal adicional)
  // -----------------------------------------------------------
  minutosGerados?: number;        // Créditos gerados na competência (min)
  minutosCompensados?: number;    // Créditos já consumidos por compensação (min)
  minutosDisponiveis?: number;    // Créditos ainda em aberto (min)
  dataGeracao?: string;           // YYYY-MM-01 (primeiro dia da competência)
  prazoMeses?: number;            // Prazo aplicável (6 ou 12 meses, configurável)
  dataVencimento?: string;        // dataGeracao + prazoMeses
  situacaoValidade?: 'REGULAR' | 'ATENCAO' | 'CRITICO' | 'VENCIDO';
}

// -------------------------------------------------------------
// 1. ÁLGEBRA DE MINUTOS E FORMATAÇÃO (SEM ERROS DE DÍZIMA)
// -------------------------------------------------------------

/**
 * Converte qualquer formato de hora para minutos inteiros (arredondado para inteiro mais próximo).
 * Suporta: number (horas decimais como 1.5 -> 90), string ("01:30" -> 90, "-02:15" -> -135, "+1.5" -> 90)
 */
export function horasParaMinutos(valor: number | string | null | undefined): number {
  if (valor === null || valor === undefined || valor === '') return 0;

  if (typeof valor === 'number') {
    if (isNaN(valor)) return 0;
    return Math.round(valor * 60);
  }

  const str = String(valor).trim().replace(',', '.');

  // Formato HH:MM ou -HH:MM ou +HH:MM
  if (str.includes(':')) {
    const isNeg = str.startsWith('-');
    const cleanStr = str.replace(/^[+-]/, '');
    const parts = cleanStr.split(':');
    const horas = parseInt(parts[0], 10) || 0;
    const minutos = parseInt(parts[1], 10) || 0;
    const total = horas * 60 + minutos;
    return isNeg ? -total : total;
  }

  // Formato decimal em string (ex: "1.5", "-2.25")
  const num = parseFloat(str);
  if (isNaN(num)) return 0;
  return Math.round(num * 60);
}

/**
 * Converte minutos inteiros para formato de exibição string ("+01:30", "-02:15", "00:00").
 */
export function minutosParaStringFormatada(minutos: number): string {
  const isNeg = minutos < 0;
  const absMin = Math.abs(Math.round(minutos));
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  const sinal = isNeg ? '-' : (minutos > 0 ? '+' : '');
  return `${sinal}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Converte minutos inteiros para formato decimal com 2 casas para relatórios/exportações (ex: 90 -> 1.5).
 */
export function minutosParaHorasDecimais(minutos: number): number {
  return Number((minutos / 60).toFixed(2));
}

// -------------------------------------------------------------
// 2. ÁLGEBRA DE COMPETÊNCIAS E CALENDÁRIO ATEMPORAL (YYYY-MM)
// -------------------------------------------------------------

export function isCompetenciaValida(competencia: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(competencia);
}

/**
 * Calcula a competência anterior com tratamento exato de virada de ano.
 * Ex: "2027-01" -> "2026-12", "2026-08" -> "2026-07"
 */
export function getCompetenciaAnterior(competencia: string): string {
  if (!isCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`);
  }
  const [anoStr, mesStr] = competencia.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  if (mes === 1) {
    return `${ano - 1}-12`;
  }
  return `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/**
 * Calcula a próxima competência com tratamento exato de virada de ano.
 * Ex: "2026-12" -> "2027-01", "2026-07" -> "2026-08"
 */
export function getProximaCompetencia(competencia: string): string {
  if (!isCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`);
  }
  const [anoStr, mesStr] = competencia.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  if (mes === 12) {
    return `${ano + 1}-01`;
  }
  return `${ano}-${String(mes + 1).padStart(2, '0')}`;
}

/**
 * Compara duas competências cronologicamente. Retorna <0 se c1 < c2, 0 se iguais, >0 se c1 > c2.
 */
export function compararCompetencias(c1: string, c2: string): number {
  return c1.localeCompare(c2);
}

/**
 * Gera todas as competências sequenciais entre duas datas (inclusive).
 * Ex: ("2025-11", "2026-02") -> ["2025-11", "2025-12", "2026-01", "2026-02"]
 */
export function gerarCadeiaCompetencias(inicio: string, fim: string): string[] {
  if (compararCompetencias(inicio, fim) > 0) return [];
  const lista: string[] = [];
  let atual = inicio;
  while (compararCompetencias(atual, fim) <= 0) {
    lista.push(atual);
    atual = getProximaCompetencia(atual);
  }
  return lista;
}

// -------------------------------------------------------------
// 3. CÁLCULO DE COMPETÊNCIA PARA UM COLABORADOR
// -------------------------------------------------------------

export interface ParametrosCalculoCompetencia {
  colaborador: ColaboradorBase;
  competencia: string;
  resumoAnterior: ResumoMensalContabil | null;
  lancamentosDoMes: LancamentoSimples[];
  status?: StatusCompetencia;
}

/**
 * Calcula a consolidação contábil da competência para um colaborador.
 * Aplica as regras de:
 * - Prioridade de saldo anterior (resumo C-1 > saldo inicial do cadastro > 0)
 * - Transporte neutro para colaboradores sem lançamentos no mês
 * - Soma de créditos e débitos em minutos inteiros
 * - Geração de hash para idempotência
 */
export function calcularCompetenciaColaborador(
  params: ParametrosCalculoCompetencia
): ResumoMensalContabil {
  const { colaborador, competencia, resumoAnterior, lancamentosDoMes, status = 'ABERTO' } = params;

  if (!isCompetenciaValida(competencia)) {
    throw new Error(`Competência inválida: ${competencia}`);
  }

  // 1. Determinação rigorosa do saldo anterior
  let saldoAnteriorMinutos = 0;
  let origemSaldoAnterior: ResumoMensalContabil['origemSaldoAnterior'] = 'INICIAL_PADRAO';

  if (resumoAnterior) {
    saldoAnteriorMinutos = Math.round(resumoAnterior.saldoFinalTransportadoMinutos);
    origemSaldoAnterior = 'COMPETENCIA_ANTERIOR';
  } else if (colaborador.saldoInicialMinutos !== undefined && colaborador.saldoInicialMinutos !== null) {
    saldoAnteriorMinutos = Math.round(colaborador.saldoInicialMinutos);
    origemSaldoAnterior = 'SALDO_BASE_CADASTRO';
  } else {
    saldoAnteriorMinutos = 0;
    origemSaldoAnterior = 'INICIAL_PADRAO';
  }

  // 2. Apuração dos lançamentos do mês
  let horasCreditoMinutos = 0;
  let horasDebitoMinutos = 0;

  // Filtra lançamentos do colaborador e que pertencem estritamente a esta competência
  const lancamentosFiltrados = lancamentosDoMes.filter(
    (l) => l.matricula === colaborador.matricula && l.competencia === competencia
  );

  lancamentosFiltrados.forEach((l) => {
    const min = Math.abs(Math.round(l.minutos));
    if (l.tipo === 'CREDITO') {
      horasCreditoMinutos += min;
    } else if (l.tipo === 'DEBITO') {
      horasDebitoMinutos += min;
    }
  });

  const saldoMesMinutos = horasCreditoMinutos - horasDebitoMinutos;
  const saldoFinalTransportadoMinutos = saldoAnteriorMinutos + saldoMesMinutos;
  const movimentoNeutro = lancamentosFiltrados.length === 0;

  // 3. Gera hash determinístico dos lançamentos para idempotência
  const idsOrdenados = lancamentosFiltrados.map((l) => `${l.id}_${l.tipo}_${l.minutos}`).sort().join('|');
  const hashLancamentosConsolidados = idsOrdenados ? `H_${idsOrdenados}` : 'EMPTY';

  return {
    id: `${colaborador.matricula}_${competencia}`,
    matricula: colaborador.matricula,
    competencia,
    saldoAnteriorMinutos,
    horasCreditoMinutos,
    horasDebitoMinutos,
    saldoMesMinutos,
    saldoFinalTransportadoMinutos,
    origemSaldoAnterior,
    movimentoNeutro,
    statusCompetencia: status,
    statusIntegridade: 'ORIGINAL',
    versao: 1,
    hashLancamentosConsolidados,
    atualizadoEm: new Date().toISOString(),
  };
}

// -------------------------------------------------------------
// 4. PROPAGAÇÃO EM CASCATA POR DELTA (ALTERAÇÕES RETROATIVAS)
// -------------------------------------------------------------

export interface ParametrosPropagacaoCascata {
  matricula: string;
  competenciaOrigem: string;
  deltaMinutos: number; // Ex: -120 para redução de 2h
  resumosSubsequentesOrdenados: ResumoMensalContabil[];
}

/**
 * Propaga o impacto de uma alteração retroativa através de todas as competências posteriores existentes.
 * Executa em O(N) onde N é o número de meses posteriores, SEM reler lançamentos diários.
 * Mantém os créditos e débitos de cada mês intactos e ajusta o saldo transportado pelo delta acumulado.
 */
export function propagarDeltaCascata(params: ParametrosPropagacaoCascata): ResumoMensalContabil[] {
  const { matricula, competenciaOrigem, deltaMinutos, resumosSubsequentesOrdenados } = params;

  if (deltaMinutos === 0) {
    return resumosSubsequentesOrdenados;
  }

  // Garante ordenação cronológica estrita
  const ordenados = [...resumosSubsequentesOrdenados].sort((a, b) =>
    compararCompetencias(a.competencia, b.competencia)
  );

  return ordenados.map((resumo) => {
    if (resumo.matricula !== matricula) return resumo;
    if (compararCompetencias(resumo.competencia, competenciaOrigem) <= 0) return resumo;

    const novoSaldoAnterior = resumo.saldoAnteriorMinutos + deltaMinutos;
    const novoSaldoFinal = resumo.saldoFinalTransportadoMinutos + deltaMinutos;

    return {
      ...resumo,
      saldoAnteriorMinutos: novoSaldoAnterior,
      saldoFinalTransportadoMinutos: novoSaldoFinal,
      statusIntegridade: 'REAJUSTADO_POR_CASCATA',
      deltaAplicadoMinutos: (resumo.deltaAplicadoMinutos || 0) + deltaMinutos,
      origemAlteracaoCascata: `RETIFICACAO_COMPETENCIA_${competenciaOrigem}`,
      versao: (resumo.versao || 1) + 1,
      atualizadoEm: new Date().toISOString(),
    };
  });
}

// -------------------------------------------------------------
// 5. VERIFICAÇÃO DE IDEMPOTÊNCIA DE FECHAMENTO
// -------------------------------------------------------------

/**
 * Verifica se um fechamento é idempotente (já foi executado com os mesmos exatos lançamentos e saldos).
 * Retorna true se não houver necessidade de nova gravação.
 */
export function isFechamentoIdempotente(
  resumoExistente: ResumoMensalContabil | null | undefined,
  novoCalculo: ResumoMensalContabil
): boolean {
  if (!resumoExistente) return false;

  return (
    resumoExistente.statusCompetencia === 'FECHADO' &&
    resumoExistente.saldoAnteriorMinutos === novoCalculo.saldoAnteriorMinutos &&
    resumoExistente.horasCreditoMinutos === novoCalculo.horasCreditoMinutos &&
    resumoExistente.horasDebitoMinutos === novoCalculo.horasDebitoMinutos &&
    resumoExistente.saldoFinalTransportadoMinutos === novoCalculo.saldoFinalTransportadoMinutos &&
    resumoExistente.hashLancamentosConsolidados === novoCalculo.hashLancamentosConsolidados
  );
}

// -------------------------------------------------------------
// 6. FASE 4 — BLINDAGEM CONTÁBIL DO CICLO DE FECHAMENTO
// -------------------------------------------------------------

export interface ResultadoValidacaoPreRequisito {
  valido: boolean;
  motivo?: string;
}

/**
 * Valida o pré-requisito de fechamento: a competência anterior (C-1) deve
 * estar com status FECHADO, garantindo que o saldo oficial homologado já
 * foi consolidado antes de fechar o mês seguinte.
 * Se o controle de C-1 não existir no banco (cenário de implantação / primeiro
 * mês do sistema), o fechamento é permitido.
 */
export function validarPreRequisitoFechamento(
  statusControleAnterior: string | null | undefined
): ResultadoValidacaoPreRequisito {
  if (!statusControleAnterior) {
    // Cenário de implantação: não há competência anterior no banco
    return { valido: true };
  }
  if (statusControleAnterior === 'FECHADO') {
    return { valido: true };
  }
  return {
    valido: false,
    motivo: `A competência anterior está com status ${statusControleAnterior}. Homologue e feche a competência anterior antes de fechar esta.`,
  };
}

/**
 * Calcula o delta (em minutos inteiros) entre o resumo homologado anterior
 * e o novo cálculo de refechamento da mesma competência.
 * O delta alimenta a propagação em cascata às competências posteriores.
 * Sem resumo anterior (primeiro fechamento), retorna 0 — não há cadeia oficial.
 */
export function calcularDeltaRefechamentoMinutos(
  resumoExistente: ResumoMensalContabil | null | undefined,
  novoResumo: ResumoMensalContabil
): number {
  if (!resumoExistente) return 0;
  return (
    Math.round(novoResumo.saldoFinalTransportadoMinutos) -
    Math.round(resumoExistente.saldoFinalTransportadoMinutos)
  );
}

// -------------------------------------------------------------
// 7. FASE 5 — PRAZO DE VALIDADE DO BANCO DE HORAS E METADADOS DE RASTREIO
// -------------------------------------------------------------

/**
 * Prazo legal de compensação do banco de horas, em meses (SPTF, Art. 59 §5º).
 * Configurável centralmente (6 ou 12 meses) — única fonte de verdade usada
 * pelos metadados do resumo_mensal e pela prescrição dos lançamentos.
 */
export const PRAZO_BANCO_HORAS_MESES = 6;

export type SituacaoValidade = 'REGULAR' | 'ATENCAO' | 'CRITICO' | 'VENCIDO';

/** Entrada mínima de rastreio por lançamento (sem dados pessoais). */
export interface LancamentoRastreioInput {
  /** Saldo do lançamento em minutos inteiros (positivo = crédito gerado). */
  saldoCalculadoMinutos: number;
  /** Minutos do crédito ainda não compensados (saldo_remanescente).
   *  Ausente = crédito totalmente em aberto (nada compensado ainda). */
  saldoRemanescenteMinutos?: number | null;
}

export interface MetadadosValidade {
  minutosGerados: number;
  minutosCompensados: number;
  minutosDisponiveis: number;
  dataGeracao: string;      // YYYY-MM-01 (primeiro dia da competência)
  prazoMeses: number;
  dataVencimento: string;   // YYYY-MM-DD
  situacao: SituacaoValidade;
}

/**
 * Apura os totais de créditos gerados e compensados do mês a partir dos
 * lançamentos já em memória (o motor FIFO mantém o saldo_remanescente).
 * Zero leituras do Firestore.
 */
export function apurarRastreioLancamentos(lancamentos: LancamentoRastreioInput[]): {
  minutosGerados: number;
  minutosCompensados: number;
} {
  let minutosGerados = 0;
  let minutosCompensados = 0;
  for (const l of lancamentos) {
    if (!l || !l.saldoCalculadoMinutos || l.saldoCalculadoMinutos <= 0) continue;
    const gerado = Math.round(l.saldoCalculadoMinutos);
    const remanescente =
      typeof l.saldoRemanescenteMinutos === 'number' && isFinite(l.saldoRemanescenteMinutos)
        ? Math.max(0, Math.min(Math.round(l.saldoRemanescenteMinutos), gerado))
        : gerado;
    minutosGerados += gerado;
    minutosCompensados += gerado - remanescente;
  }
  return { minutosGerados, minutosCompensados };
}

/** Soma N meses a uma data YYYY-MM-DD (sempre mantendo o dia original). */
function adicionarMesesData(dataISO: string, meses: number): string {
  const [ano, mes] = dataISO.split('-').map(Number);
  const total = (mes - 1) + meses;
  const novoAno = ano + Math.floor(total / 12);
  const novoMes = (total % 12) + 1;
  const dia = dataISO.slice(8, 10);
  return `${novoAno}-${String(novoMes).padStart(2, '0')}-${dia}`;
}

/** Diferença em dias entre duas datas YYYY-MM-DD (b - a). */
function diferencaDias(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

/**
 * Calcula os metadados de validade consolidados da competência para um
 * servidor: gerados, compensados, disponíveis, geração, prazo e vencimento.
 * `dataReferencia` (YYYY-MM-DD) é injetável para testes determinísticos.
 */
export function calcularMetadadosValidade(params: {
  competencia: string;
  minutosGerados: number;
  minutosCompensados: number;
  prazoMeses?: number;
  dataReferencia?: string;
}): MetadadosValidade {
  const prazo = params.prazoMeses ?? PRAZO_BANCO_HORAS_MESES;
  const dataGeracao = `${params.competencia}-01`;
  const dataVencimento = adicionarMesesData(dataGeracao, prazo);
  const minutosGerados = Math.max(0, Math.round(params.minutosGerados));
  const minutosCompensados = Math.max(0, Math.round(params.minutosCompensados));
  const minutosDisponiveis = Math.max(0, minutosGerados - minutosCompensados);

  const dataRef = params.dataReferencia || new Date().toISOString().split('T')[0];
  const diasRestantes = diferencaDias(dataRef, dataVencimento);

  let situacao: SituacaoValidade = 'REGULAR';
  if (minutosDisponiveis > 0) {
    if (diasRestantes < 0) {
      situacao = 'VENCIDO';
    } else if (diasRestantes <= 30) {
      situacao = 'CRITICO';
    } else if (diasRestantes <= 60) {
      situacao = 'ATENCAO';
    }
  }

  return {
    minutosGerados,
    minutosCompensados,
    minutosDisponiveis,
    dataGeracao,
    prazoMeses: prazo,
    dataVencimento,
    situacao,
  };
}

/**
 * Porta de homologação: apenas gestor global (SUPER_ADMIN/GESTOR_RH) e
 * competência não fechada podem homologar. Usada pela UI e testável.
 */
export function podeHomologarCompetencia(isGlobalAdmin: boolean, statusAtual: string): boolean {
  return isGlobalAdmin && statusAtual !== 'FECHADO';
}

export interface DiffServidorAuditoria {
  matricula: string;
  saldoFinalAnteriorMinutos: number;
  saldoFinalNovoMinutos: number;
  deltaMinutos: number;
}

/**
 * Monta o payload estruturado de auditoria para fechamento/refechamento de
 * competência: valor anterior → novo por servidor, usuário, data/hora,
 * motivo e impacto consolidado. Minimização LGPD: apenas matrícula e
 * valores contábeis (sem nome, CPF ou salário).
 */
export function montarResumoAuditoriaFechamento(params: {
  competencia: string;
  operadorEmail: string;
  diffs: DiffServidorAuditoria[];
  mesesAfetadosCascata: string[];
  dataHora?: string;
}): Record<string, any> {
  const deltaTotalMinutos = params.diffs.reduce((acc, d) => acc + Math.round(d.deltaMinutos), 0);
  return {
    competencia: params.competencia,
    usuario: params.operadorEmail,
    dataHora: params.dataHora || new Date().toISOString(),
    motivo: params.diffs.length > 0 ? 'REFECHAMENTO_RETIFICACAO' : 'HOMOLOGACAO_FECHAMENTO',
    impacto: {
      servidoresAlterados: params.diffs.length,
      deltaTotalMinutos,
      mesesAfetadosCascata: params.mesesAfetadosCascata,
    },
    alteracoesPorServidor: params.diffs.map((d) => ({
      matricula: d.matricula,
      saldoFinalAnteriorMinutos: Math.round(d.saldoFinalAnteriorMinutos),
      saldoFinalNovoMinutos: Math.round(d.saldoFinalNovoMinutos),
      deltaMinutos: Math.round(d.deltaMinutos),
    })),
  };
}
