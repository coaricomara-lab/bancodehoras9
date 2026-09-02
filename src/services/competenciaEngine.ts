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
