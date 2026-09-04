import { OccurrenceType, Branch, TimeRecord, Employee, MonthlyEmployeeSummary } from '../types';
import { BRAZILIAN_HOLIDAYS_2025_2026 } from '../constants/defaultData';
import { HorariosInstituicao, RegrasCalculoInstituicao } from '../types/institutionConfig';
import { PRAZO_BANCO_HORAS_MESES } from '../services/competenciaEngine';

export type DestinationTarget = 'FOLHA_PAGAMENTO' | 'BANCO_HORAS' | 'NEUTRO_AUDITORIA';

export interface CalculationResult {
  multiplicador: number;
  saldoCalculado: number; // Impacto no Banco de Horas (+ crédito, - débito, 0 neutro)
  horasDescontoFolha: number; // Horas enviadas para Desconto em Folha / Contracheque
  horasBrutasEfetivas?: number;
  deducaoAlmoco?: number;
  destinoLancamento: DestinationTarget;
  diaSemana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  diaSemanaNome: string;
  eFeriado: boolean;
  nomeFeriado?: string;
  descricaoRegra: string;
  requerComprovante: boolean;
  requerObservacao: boolean;
}

const DIAS_SEMANA = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

/**
 * REGRA CENTRALIZADA: CÁLCULO DAS HORAS COM TRAVA DO ALMOÇO
 * - O período configurado (padrão: 12:00 às 13:00) é HORA DE ALMOÇO obrigatória (não remunerado e não computável).
 * - Se o horário cruzar a janela de almoço, subtrai exatamente o tempo de almoço (até a duração configurada) do saldo total.
 * - Exemplo: Das 07:00 às 16:00 (9 horas relógio com 1h de almoço) = 8.0h a abater no Banco de Horas.
 */
export function calculateLunchOverlap(
  start?: string, 
  end?: string, 
  lunchStartStr = '12:00', 
  lunchEndStr = '13:00'
): {
  rawHours: number;
  lunchDeductionHours: number;
  netHours: number;
} {
  if (!start || !end) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  if (isNaN(h1) || isNaN(m1) || isNaN(h2) || isNaN(m2)) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const startMinutes = h1 * 60 + m1;
  const endMinutes = h2 * 60 + m2;
  const diffMinutes = endMinutes - startMinutes;
  if (diffMinutes <= 0) {
    return { rawHours: 0, lunchDeductionHours: 0, netHours: 0 };
  }

  const rawHours = Number((diffMinutes / 60).toFixed(2));

  // Janela obrigatória de almoço parametrizada dinamicamente
  const [lsH, lsM] = (lunchStartStr || '12:00').split(':').map(Number);
  const [leH, leM] = (lunchEndStr || '13:00').split(':').map(Number);
  const lunchStart = (isNaN(lsH) ? 12 : lsH) * 60 + (isNaN(lsM) ? 0 : lsM);
  const lunchEnd = (isNaN(leH) ? 13 : leH) * 60 + (isNaN(leM) ? 0 : leM);

  const overlapStart = Math.max(startMinutes, lunchStart);
  const overlapEnd = Math.min(endMinutes, lunchEnd);
  const lunchOverlapMinutes = Math.max(0, overlapEnd - overlapStart);
  const lunchDeductionHours = Number((lunchOverlapMinutes / 60).toFixed(2));

  const netMinutes = Math.max(0, diffMinutes - lunchOverlapMinutes);
  const netHours = Number((netMinutes / 60).toFixed(2));

  return {
    rawHours,
    lunchDeductionHours,
    netHours,
  };
}

/**
 * Verifica se uma data é feriado considerando feriados nacionais e municipais/estaduais por sede.
 */
export function checkIsHoliday(dataString: string, sede?: Branch | string): { eFeriado: boolean; nome?: string } {
  if (!dataString) return { eFeriado: false };
  
  const found = BRAZILIAN_HOLIDAYS_2025_2026.find(h => {
    if (h.data !== dataString) return false;
    if (!h.sedeAtingida || h.sedeAtingida === 'TODAS') return true;
    if (sede && h.sedeAtingida === sede) return true;
    return false;
  });

  if (found) {
    return { eFeriado: true, nome: found.nome };
  }
  return { eFeriado: false };
}

/**
 * Obtém o dia da semana a partir da data YYYY-MM-DD (tratando fuso horário local).
 */
export function parseDateInfo(dataString: string) {
  if (!dataString) {
    const today = new Date();
    return {
      diaSemana: today.getDay(),
      diaSemanaNome: DIAS_SEMANA[today.getDay()],
    };
  }
  
  // Criar data sem distorção UTC
  const [year, month, day] = dataString.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const diaSemana = dateObj.getDay();
  return {
    diaSemana,
    diaSemanaNome: DIAS_SEMANA[diaSemana],
  };
}

export interface CalculationOptions {
  horarios?: Partial<HorariosInstituicao>;
  regrasCalculo?: Partial<RegrasCalculoInstituicao>;
}

/**
 * Calcula o saldo diário de horas creditadas/debitadas aplicando regras SPTF / Acordo Coletivo
 * e suporte universal à trava de almoço configurável dinamicamente.
 */
export function calculateSPTFBalance(
  tipo: OccurrenceType,
  horasBrutas: number,
  dataString: string,
  forcarFeriado?: boolean,
  sede?: Branch,
  applyLunchLock?: boolean,
  horarioInicio?: string,
  horarioFim?: string,
  options?: CalculationOptions
): CalculationResult {
  const { diaSemana, diaSemanaNome } = parseDateInfo(dataString);
  const holidayCheck = checkIsHoliday(dataString, sede);
  const eFeriado = forcarFeriado !== undefined ? forcarFeriado : holidayCheck.eFeriado;
  const nomeFeriado = holidayCheck.nome;

  const lunchStartStr = options?.horarios?.inicioAlmoco || '12:00';
  const lunchEndStr = options?.horarios?.fimAlmoco || '13:00';

  let effectiveHoras = horasBrutas;
  let deducaoAlmoco = 0;

  if (applyLunchLock) {
    if (horarioInicio && horarioFim) {
      const lunchCalc = calculateLunchOverlap(horarioInicio, horarioFim, lunchStartStr, lunchEndStr);
      effectiveHoras = lunchCalc.netHours;
      deducaoAlmoco = lunchCalc.lunchDeductionHours;
    } else if (horasBrutas >= 5.0) {
      deducaoAlmoco = 1.0;
      effectiveHoras = Math.max(0, horasBrutas - 1.0);
    }
  }

  // Multiplicadores dinâmicos (com fallback seguro para padrão SPTF)
  const multSegSex = options?.regrasCalculo?.multiplicadores?.segundaSexta ?? options?.regrasCalculo?.multiplicadorSegundaSexta ?? 1.0;
  const multSab = options?.regrasCalculo?.multiplicadores?.sabado ?? options?.regrasCalculo?.multiplicadorSabado ?? 1.5;
  const multDomFer = options?.regrasCalculo?.multiplicadores?.domingoFeriado ?? options?.regrasCalculo?.multiplicadorDomingoFeriado ?? 2.0;

  let multiplicador = 1.0;
  let saldoCalculado = 0.0;
  let horasDescontoFolha = 0.0;
  let destinoLancamento: DestinationTarget = 'BANCO_HORAS';
  let descricaoRegra = '';
  let requerComprovante = false;
  let requerObservacao = false;

  switch (tipo) {
    case 'TRABALHO': {
      destinoLancamento = 'BANCO_HORAS';
      if (diaSemana === 0 || eFeriado) {
        // Domingo ou Feriado -> x2.0 (Horas em dobro 1:2)
        multiplicador = multDomFer;
        saldoCalculado = effectiveHoras * multDomFer;
        descricaoRegra = eFeriado 
          ? `Feriado (${nomeFeriado || 'Oficial'}): Multiplicador x ${multDomFer} (Horas em Dobro no Banco)`
          : `Domingo: Multiplicador x ${multDomFer} (Horas em Dobro no Banco)`;
      } else if (diaSemana === 6) {
        // Sábado -> x1.5 (Adicional de Sábado 1:1,5)
        multiplicador = multSab;
        saldoCalculado = effectiveHoras * multSab;
        descricaoRegra = `Sábado: Multiplicador x ${multSab} (Adicional no Banco)`;
      } else {
        // Segunda a Sexta -> x1.0 (Horas Normais 1:1)
        multiplicador = multSegSex;
        saldoCalculado = effectiveHoras * multSegSex;
        descricaoRegra = `Segunda a Sexta: Multiplicador x ${multSegSex} (Horas Normais no Banco)`;
      }
      break;
    }

    // REGRA: ACABOU BANHOU (Conclusão antecipada da missão - NÃO desconta do banco de horas)
    case 'ACABOU_BANHOU': {
      multiplicador = 1.0;
      saldoCalculado = 0.0; // NÃO gera débito e NÃO desconta do banco
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Acabou Banhou: Conclusão antecipada da missão com liberação operacional combinada. Registro neutro sem débito no banco de horas (0h) e sem desconto em folha.`;
      requerComprovante = false;
      requerObservacao = false;
      break;
    }

    // REGRA 1: FALTA (SEM JUSTIFICATIVA)
    // Envia para Desconto em Folha / Contracheque (0h no Banco de Horas)
    case 'FALTA_INJUSTIFICADA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0; // NÃO afeta o saldo do Banco de Horas
      horasDescontoFolha = effectiveHoras > 0 ? effectiveHoras : 8.0;
      destinoLancamento = 'FOLHA_PAGAMENTO';
      descricaoRegra = `Falta Injustificada ('F' / 'D'): Enviada para Desconto em Folha / Contracheque (${horasDescontoFolha.toFixed(1)}h a descontar na folha; 0h no Banco de Horas).`;
      requerObservacao = true;
      break;
    }

    // REGRA 2: DISPENSA DE SPTF / SAÍDA ANTECIPADA / COMPENSAÇÃO DE BANCO DE HORAS
    case 'DISPENSA_SPTF':
    case 'COMPENSACAO_DISPENSA':
    case 'COMPENSACAO':
    case 'DISPENSA_OPERACIONAL': {
      multiplicador = 1.0;
      const horasDebito = Math.abs(effectiveHoras) > 0 ? Math.abs(effectiveHoras) : 8.0;
      saldoCalculado = -horasDebito;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'BANCO_HORAS';
      descricaoRegra = (tipo === 'DISPENSA_SPTF' || tipo === 'COMPENSACAO_DISPENSA')
        ? `Dispensa de SPTF: Débito de -${horasDebito.toFixed(1)}h no Banco de Horas com emissão de guia oficial em 2 vias.`
        : `Dispensa / Compensação ('COMP'): Debita -${horasDebito.toFixed(1)}h do Banco de Horas acumulado.`;
      requerObservacao = (tipo !== 'DISPENSA_SPTF' && tipo !== 'COMPENSACAO_DISPENSA');
      break;
    }

    // REGRA 3: FALTA JUSTIFICADA (ATESTADO MÉDICO, LICENÇA LEGAL, ORDEM JUDICIAL, ETC.)
    // Registro neutro para auditoria (0h no Banco e 0h na Folha)
    case 'ATESTADO_MEDICO': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Atestado Médico ('AT'): Registro neutro para auditoria (0h no Banco de Horas, 0h no Desconto em Folha). Anexo e observação obrigatórios.`;
      requerComprovante = true;
      requerObservacao = true;
      break;
    }

    case 'FALTA_JUSTIFICADA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Falta Justificada (Ordem Judicial/Gala/Luto): Registro neutro para auditoria (0h no Banco, 0h na Folha).`;
      requerObservacao = true;
      break;
    }

    case 'FERIAS': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Férias ('FE'): Período regular homologado. Registro neutro (0h no Banco, 0h na Folha).`;
      requerObservacao = false;
      break;
    }

    case 'LICENCA': {
      multiplicador = 0.0;
      saldoCalculado = 0.0;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'NEUTRO_AUDITORIA';
      descricaoRegra = `Licença Remunerada/Legal ('LIC'): Registro neutro para auditoria (0h no Banco, 0h na Folha).`;
      requerComprovante = true;
      requerObservacao = true;
      break;
    }

    default: {
      multiplicador = 1.0;
      saldoCalculado = effectiveHoras;
      horasDescontoFolha = 0.0;
      destinoLancamento = 'BANCO_HORAS';
      descricaoRegra = 'Lançamento regular no Banco de Horas';
    }
  }

  return {
    multiplicador,
    saldoCalculado: Number(saldoCalculado.toFixed(2)),
    horasDescontoFolha: Number(horasDescontoFolha.toFixed(2)),
    horasBrutasEfetivas: Number(effectiveHoras.toFixed(2)),
    deducaoAlmoco: Number(deducaoAlmoco.toFixed(2)),
    destinoLancamento,
    diaSemana,
    diaSemanaNome,
    eFeriado,
    nomeFeriado,
    descricaoRegra,
    requerComprovante,
    requerObservacao
  };
}

export const calculateCLTBalance = calculateSPTFBalance;

/**
 * Formata horas decimais em string legível com sinal: ex: "+12,50h", "-8,00h", "0,00h"
 */
export function formatHoursDecimal(hours: number): string {
  const sign = hours > 0 ? '+' : '';
  return `${sign}${hours.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h`;
}

/**
 * Converte horas decimais para formato HH:MM (ex: 2.5 -> "02:30", -8.25 -> "-08:15")
 */
export function formatHoursToHHMM(hours: number): string {
  const isNegative = hours < 0;
  const absHours = Math.abs(hours);
  const h = Math.floor(absHours);
  const m = Math.round((absHours - h) * 60);
  const formatted = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : `+${formatted}`;
}

/**
 * Converte saldo em horas para equivalente em dias de trabalho (Jornada base SPTF 8h/dia)
 */
export function formatHoursToDays(hours: number): string {
  const dias = hours / 8;
  const sign = dias > 0 ? '+' : '';
  return `${sign}${dias.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} dias`;
}

/**
 * Consolida o saldo total de um colaborador (Saldo Inicial + Soma dos Lançamentos)
 */
export function getEmployeeTotalBalance(
  matricula: string,
  employees: Employee[],
  records: TimeRecord[]
): {
  saldoTotalHoras: number;
  saldoTotalDias: number;
  saldoInicial: number;
  totalCreditos: number;
  totalDebitos: number;
  totalAtestados: number;
  totalFaltas: number;
  totalHorasDescontoFolha: number;
  totalHorasExtras50: number;
  totalHorasExtras100: number;
  status: 'CREDOR' | 'DEVEDOR' | 'ZERADO';
} {
  const cleanMat = (matricula || '').trim().toUpperCase();
  const emp = employees.find(e => e.matricula.trim().toUpperCase() === cleanMat || e.matricula.replace(/^0+/, '') === cleanMat.replace(/^0+/, ''));
  const saldoInicial = emp?.saldoInicialHoras || 0;
  
  const empRecords = records.filter(r => 
    r.matricula.trim().toUpperCase() === cleanMat || 
    r.matricula.replace(/^0+/, '') === cleanMat.replace(/^0+/, '')
  );

  let totalCreditos = 0;
  let totalDebitos = 0;
  let totalAtestados = 0;
  let totalFaltas = 0;
  let totalHorasDescontoFolha = 0;
  let totalHorasExtras50 = 0;
  let totalHorasExtras100 = 0;

  empRecords.forEach(r => {
    // 1. Créditos no Banco de Horas
    if (r.saldoCalculado > 0) {
      totalCreditos += r.saldoCalculado;
    } 
    // 2. Débitos no Banco de Horas (Dispensas operacionais, saídas antecipadas, folgas compensatórias)
    else if (r.saldoCalculado < 0) {
      totalDebitos += Math.abs(r.saldoCalculado);
    }

    // 3. Faltas Injustificadas -> Desconto em Folha
    if (r.tipoOcorrencia === 'FALTA_INJUSTIFICADA') {
      totalFaltas++;
      totalHorasDescontoFolha += (r.horasDescontoFolha || (r.horasBrutas > 0 ? r.horasBrutas : 8.0));
    }

    // 4. Atestados / Justificativas
    if (r.tipoOcorrencia === 'ATESTADO_MEDICO' || r.tipoOcorrencia === 'FALTA_JUSTIFICADA') {
      totalAtestados++;
    }

    // 5. Horas extras por multiplicador
    if (r.tipoOcorrencia === 'TRABALHO') {
      if (r.multiplicador === 1.5) {
        totalHorasExtras50 += r.horasBrutas;
      } else if (r.multiplicador === 2.0) {
        totalHorasExtras100 += r.horasBrutas;
      }
    }
  });

  const saldoTotalHoras = Number((saldoInicial + totalCreditos - totalDebitos).toFixed(2));
  const saldoTotalDias = Number((saldoTotalHoras / 8).toFixed(2));

  let status: 'CREDOR' | 'DEVEDOR' | 'ZERADO' = 'ZERADO';
  if (saldoTotalHoras > 0.05) status = 'CREDOR';
  else if (saldoTotalHoras < -0.05) status = 'DEVEDOR';

  return {
    saldoTotalHoras,
    saldoTotalDias,
    saldoInicial,
    totalCreditos: Number(totalCreditos.toFixed(2)),
    totalDebitos: Number(totalDebitos.toFixed(2)),
    totalAtestados,
    totalFaltas,
    totalHorasDescontoFolha: Number(totalHorasDescontoFolha.toFixed(2)),
    totalHorasExtras50: Number(totalHorasExtras50.toFixed(2)),
    totalHorasExtras100: Number(totalHorasExtras100.toFixed(2)),
    status
  };
}

/**
 * Informações de prescrição / validade SPTF de uma hora acumulada no banco (Regra 180 dias SPTF / 6 meses)
 */
export interface PrescriptionInfo {
  dataOrigem: string;
  dataLimiteCompensacao: string; // YYYY-MM-DD (Data + 180 dias)
  diasDecorridos: number;
  diasRestantes: number;
  statusPrescricao: 'REGULAR' | 'ATENCAO' | 'CRITICO' | 'VENCIDO';
}

/**
 * Calcula a data limite de compensação e dias restantes para prescrição SPTF (Art. 59 § 5º do SPTF - 6 meses).
 */
export function getRecordPrescriptionInfo(dataRegistro: string, diasValidade: number = PRAZO_BANCO_HORAS_MESES * 30): PrescriptionInfo {
  if (!dataRegistro) {
    return {
      dataOrigem: '',
      dataLimiteCompensacao: '',
      diasDecorridos: 0,
      diasRestantes: 180,
      statusPrescricao: 'REGULAR'
    };
  }

  const [year, month, day] = dataRegistro.split('-').map(Number);
  const dataOrigemObj = new Date(year, month - 1, day);
  
  const dataLimiteObj = new Date(dataOrigemObj);
  dataLimiteObj.setDate(dataLimiteObj.getDate() + diasValidade);
  
  const dataLimiteCompensacao = dataLimiteObj.toISOString().split('T')[0];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dataOrigemObj.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - dataOrigemObj.getTime();
  const diasDecorridos = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const diasRestantes = diasValidade - diasDecorridos;

  let statusPrescricao: 'REGULAR' | 'ATENCAO' | 'CRITICO' | 'VENCIDO' = 'REGULAR';
  if (diasRestantes < 0) {
    statusPrescricao = 'VENCIDO';
  } else if (diasRestantes <= 30) {
    statusPrescricao = 'CRITICO';
  } else if (diasRestantes <= 60) {
    statusPrescricao = 'ATENCAO';
  }

  return {
    dataOrigem: dataRegistro,
    dataLimiteCompensacao,
    diasDecorridos,
    diasRestantes,
    statusPrescricao
  };
}

/**
 * Executa o motor FIFO (First-In, First-Out) de liquidação e abatimento automático
 * de horas do banco de horas por colaborador, vinculando as datas de origem e baixa.
 */
export function calculateFifoLiquidations(
  records: TimeRecord[],
  _saldoInicial: number = 0
): {
  processedRecords: TimeRecord[];
  totalHorasLiquidadas: number;
  totalHorasPendentes: number;
} {
  // Ordenar registros cronologicamente por data de registro
  const sortedRecords = [...records].sort((a, b) => {
    if (a.dataRegistro !== b.dataRegistro) {
      return a.dataRegistro.localeCompare(b.dataRegistro);
    }
    return (a.criadoEm || '').localeCompare(b.criadoEm || '');
  });

  // Inicializar cada registro com os campos de rastreabilidade
  const recordMap = new Map<string, TimeRecord>();
  sortedRecords.forEach(r => {
    const cloned: TimeRecord = {
      ...r,
      data_ocorrencia: r.data_ocorrencia || r.dataRegistro,
      saldo_remanescente: r.saldoCalculado !== 0 ? Math.abs(r.saldoCalculado) : 0,
      status_compensacao: r.saldoCalculado === 0 ? 'TOTALMENTE_COMPENSADO' : 'ABERTO',
      liquidacoes: []
    };
    recordMap.set(r.id, cloned);
  });

  // Filas para FIFO
  const creditQueue: TimeRecord[] = [];
  const debitQueue: TimeRecord[] = [];

  sortedRecords.forEach(r => {
    const current = recordMap.get(r.id)!;

    if (current.saldoCalculado > 0.001) {
      // É um crédito de horas (hora extra, trabalho fim de semana, etc.)
      let creditRemaining = current.saldoCalculado;

      // Se houver débitos anteriores em aberto na fila de débitos, quita-os primeiro
      while (creditRemaining > 0.001 && debitQueue.length > 0) {
        const oldestDebit = debitQueue[0];
        const debitUnpaid = oldestDebit.saldo_remanescente || 0;

        const amountToPay = Math.min(creditRemaining, debitUnpaid);
        creditRemaining = Number((creditRemaining - amountToPay).toFixed(4));
        oldestDebit.saldo_remanescente = Number((debitUnpaid - amountToPay).toFixed(4));

        // Registrar vínculo no débito
        oldestDebit.liquidacoes = oldestDebit.liquidacoes || [];
        oldestDebit.liquidacoes.push({
          id_origem: oldestDebit.id,
          id_baixa: current.id,
          data_origem: oldestDebit.dataRegistro,
          data_baixa: current.dataRegistro,
          horas_liquidadas: Number(amountToPay.toFixed(2)),
          tipo_baixa: current.tipoOcorrencia,
          observacao: current.observacao || 'Compensado por horas trabalhadas posteriores'
        });

        // Registrar vínculo no crédito
        current.liquidacoes = current.liquidacoes || [];
        current.liquidacoes.push({
          id_origem: oldestDebit.id,
          id_baixa: current.id,
          data_origem: oldestDebit.dataRegistro,
          data_baixa: current.dataRegistro,
          horas_liquidadas: Number(amountToPay.toFixed(2)),
          tipo_baixa: oldestDebit.tipoOcorrencia,
          observacao: oldestDebit.observacao || 'Abatimento de débito anterior'
        });

        if (oldestDebit.saldo_remanescente <= 0.001) {
          oldestDebit.saldo_remanescente = 0;
          oldestDebit.status_compensacao = 'TOTALMENTE_COMPENSADO';
          debitQueue.shift();
        } else {
          oldestDebit.status_compensacao = 'PARCIALMENTE_COMPENSADO';
        }
      }

      current.saldo_remanescente = Number(creditRemaining.toFixed(2));
      if (current.saldo_remanescente <= 0.001) {
        current.saldo_remanescente = 0;
        current.status_compensacao = 'TOTALMENTE_COMPENSADO';
      } else if (current.saldo_remanescente < current.saldoCalculado) {
        current.status_compensacao = 'PARCIALMENTE_COMPENSADO';
        creditQueue.push(current);
      } else {
        current.status_compensacao = 'ABERTO';
        creditQueue.push(current);
      }

    } else if (current.saldoCalculado < -0.001) {
      // É um débito de horas (folga compensatória, falta injustificada, etc.)
      let debitRemaining = Math.abs(current.saldoCalculado);

      // Quitar com os créditos em aberto mais antigos (FIFO)
      while (debitRemaining > 0.001 && creditQueue.length > 0) {
        const oldestCredit = creditQueue[0];
        const creditAvailable = oldestCredit.saldo_remanescente || 0;

        const amountToPay = Math.min(debitRemaining, creditAvailable);
        debitRemaining = Number((debitRemaining - amountToPay).toFixed(4));
        oldestCredit.saldo_remanescente = Number((creditAvailable - amountToPay).toFixed(4));

        // Registrar vínculo no crédito (indicando quando e como foi baixado)
        oldestCredit.liquidacoes = oldestCredit.liquidacoes || [];
        oldestCredit.liquidacoes.push({
          id_origem: oldestCredit.id,
          id_baixa: current.id,
          data_origem: oldestCredit.dataRegistro,
          data_baixa: current.dataRegistro,
          horas_liquidadas: Number(amountToPay.toFixed(2)),
          tipo_baixa: current.tipoOcorrencia,
          observacao: current.observacao || 'Compensado / Folga usufruída'
        });

        // Registrar vínculo no débito
        current.liquidacoes = current.liquidacoes || [];
        current.liquidacoes.push({
          id_origem: oldestCredit.id,
          id_baixa: current.id,
          data_origem: oldestCredit.dataRegistro,
          data_baixa: current.dataRegistro,
          horas_liquidadas: Number(amountToPay.toFixed(2)),
          tipo_baixa: oldestCredit.tipoOcorrencia,
          observacao: oldestCredit.observacao || `Origem em ${oldestCredit.dataRegistro}`
        });

        if (oldestCredit.saldo_remanescente <= 0.001) {
          oldestCredit.saldo_remanescente = 0;
          oldestCredit.status_compensacao = 'TOTALMENTE_COMPENSADO';
          creditQueue.shift();
        } else {
          oldestCredit.status_compensacao = 'PARCIALMENTE_COMPENSADO';
        }
      }

      current.saldo_remanescente = Number(debitRemaining.toFixed(2));
      if (current.saldo_remanescente <= 0.001) {
        current.saldo_remanescente = 0;
        current.status_compensacao = 'TOTALMENTE_COMPENSADO';
      } else if (current.saldo_remanescente < Math.abs(current.saldoCalculado)) {
        current.status_compensacao = 'PARCIALMENTE_COMPENSADO';
        debitQueue.push(current);
      } else {
        current.status_compensacao = 'ABERTO';
        debitQueue.push(current);
      }
    } else {
      // 0 horas (ex: atestado médico, férias)
      current.saldo_remanescente = 0;
      current.status_compensacao = 'TOTALMENTE_COMPENSADO';
    }
  });

  const processedRecords = Array.from(recordMap.values());
  
  let totalHorasLiquidadas = 0;
  let totalHorasPendentes = 0;

  processedRecords.forEach(r => {
    if (r.saldoCalculado > 0) {
      const liquidado = r.saldoCalculado - (r.saldo_remanescente || 0);
      totalHorasLiquidadas += Math.max(0, liquidado);
      totalHorasPendentes += r.saldo_remanescente || 0;
    }
  });

  return {
    processedRecords,
    totalHorasLiquidadas: Number(totalHorasLiquidadas.toFixed(2)),
    totalHorasPendentes: Number(totalHorasPendentes.toFixed(2))
  };
}

/**
 * Agrupa os lançamentos mês a mês por colaborador para geração do Resumo Mensal Acumulado
 */
export function generateMonthlySummaries(
  employees: Employee[],
  records: TimeRecord[],
  selectedMonth?: string // YYYY-MM
): MonthlyEmployeeSummary[] {
  const summaries: MonthlyEmployeeSummary[] = [];

  employees.forEach(emp => {
    // Pegar todos os meses com registros ou o mês selecionado
    const empRecords = records.filter(r => r.matricula === emp.matricula);
    
    // Meses únicos
    const monthsSet = new Set<string>();
    if (selectedMonth) {
      monthsSet.add(selectedMonth);
    } else {
      empRecords.forEach(r => {
        monthsSet.add(r.dataRegistro.substring(0, 7));
      });
      if (monthsSet.size === 0) {
        monthsSet.add(new Date().toISOString().substring(0, 7));
      }
    }

    const sortedMonths = Array.from(monthsSet).sort();

    let saldoAcumulado = emp.saldoInicialHoras || 0;

    sortedMonths.forEach(anoMes => {
      const monthRecords = empRecords.filter(r => r.dataRegistro.startsWith(anoMes));
      
      let creditos = 0;
      let debitos = 0;
      let atestados = 0;
      let faltas = 0;
      let he50 = 0;
      let he100 = 0;

      monthRecords.forEach(r => {
        if (r.saldoCalculado > 0) creditos += r.saldoCalculado;
        if (r.saldoCalculado < 0) debitos += Math.abs(r.saldoCalculado);
        if (r.tipoOcorrencia === 'ATESTADO_MEDICO') atestados++;
        if (r.tipoOcorrencia === 'FALTA_INJUSTIFICADA') faltas++;
        if (r.tipoOcorrencia === 'TRABALHO' && r.multiplicador === 1.5) he50 += r.horasBrutas;
        if (r.tipoOcorrencia === 'TRABALHO' && r.multiplicador === 2.0) he100 += r.horasBrutas;
      });

      const saldoAnterior = saldoAcumulado;
      const saldoFinal = Number((saldoAnterior + creditos - debitos).toFixed(2));
      saldoAcumulado = saldoFinal;

      summaries.push({
        matricula: emp.matricula,
        nome: emp.nome,
        funcao: emp.funcao,
        sede: emp.sede,
        anoMes,
        saldoAnteriorHoras: Number(saldoAnterior.toFixed(2)),
        creditoHorasMes: Number(creditos.toFixed(2)),
        debitoHorasMes: Number(debitos.toFixed(2)),
        saldoFinalHoras: saldoFinal,
        saldoFinalDias: Number((saldoFinal / 8).toFixed(2)),
        totalAtestados: atestados,
        totalFaltas: faltas,
        totalHorasExtras50: he50,
        totalHorasExtras100: he100,
      });
    });
  });

  return summaries;
}
