/**
 * Serviço de Gerenciamento de Competências e Fechamento Mensal no Firestore (CompetenciaService)
 * 
 * Responsabilidades:
 * 1. Controle de Ciclo de Vida: ABERTO -> FECHADO -> REABERTO
 * 2. Idempotência estrita e Prevenção de Concorrência via runTransaction
 * 3. Cálculos 100% em minutos inteiros via competenciaEngine
 * 4. Persistência em lote (writeBatch) particionado em chunks <= 400 documentos
 * 5. Recálculo em cascata multi-anos por propagação de Delta (Δ)
 * 6. Subscrições isoladas por competência (where('competencia', '==', YYYY-MM)) com clean unsubscribe
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  writeBatch,
  runTransaction,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { COLLECTIONS, sanitizeFirestoreData } from './firestoreService';
import { registrarLogAuditoria } from './auditService';
import {
  StatusCompetencia,
  ColaboradorBase,
  LancamentoSimples,
  ResumoMensalContabil,
  getCompetenciaAnterior,
  getProximaCompetencia,
  isCompetenciaValida,
  compararCompetencias,
  calcularCompetenciaColaborador,
  propagarDeltaCascata,
  isFechamentoIdempotente,
  horasParaMinutos,
  validarPreRequisitoFechamento,
  calcularDeltaRefechamentoMinutos,
  apurarRastreioLancamentos,
  calcularMetadadosValidade,
  montarResumoAuditoriaFechamento,
  DiffServidorAuditoria,
} from './competenciaEngine';
import { TimeRecord, InsalubrityRecord, Employee } from '../types';

export interface CompetenciaControle {
  id: string; // "YYYY-MM"
  ano: number;
  mes: number;
  status: StatusCompetencia;
  fechadoEm?: string;
  fechadoPorEmail?: string;
  totalColaboradoresFechados?: number;
  reabertoEm?: string;
  reabertoPorEmail?: string;
  motivoReabertura?: string;
  processandoFechamento?: boolean;
  processandoInicio?: number;
  processandoPorEmail?: string;
  versaoCalculo: number;
  atualizadoEm: string;
}

export interface FecharCompetenciaParams {
  competencia: string;
  colaboradores: Employee[];
  lancamentosDoMes: TimeRecord[];
  operadorEmail: string;
  onProgress?: (percent: number, current: number, total: number) => void;
}

export interface ResultadoFechamento {
  sucesso: boolean;
  competencia: string;
  totalColaboradores: number;
  totalLancamentos: number;
  idempotente: boolean;
  mesesAfetadosCascata: string[];
  mensagem: string;
}

export interface RecalculoCascataParams {
  matricula: string;
  competenciaOrigem: string;
  deltaMinutos: number;
  operadorEmail: string;
  motivo: string;
}

export interface ResultadoCascata {
  sucesso: boolean;
  matricula: string;
  competenciaOrigem: string;
  deltaMinutos: number;
  mesesAfetados: string[];
}

export const competenciaService = {
  /**
   * Obtém os metadados de controle de uma competência ("YYYY-MM").
   * Se não existir no banco, assume o status virtual ABERTO.
   */
  async obterCompetenciaControle(competencia: string): Promise<CompetenciaControle> {
    if (!isCompetenciaValida(competencia)) {
      throw new Error(`Competência com formato inválido: ${competencia}`);
    }

    try {
      const docRef = doc(db, COLLECTIONS.COMPETENCIAS_CONTROLE, competencia);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        return snap.data() as CompetenciaControle;
      }

      const [anoStr, mesStr] = competencia.split('-');
      return {
        id: competencia,
        ano: parseInt(anoStr, 10),
        mes: parseInt(mesStr, 10),
        status: 'ABERTO',
        versaoCalculo: 1,
        atualizadoEm: new Date().toISOString(),
      };
    } catch (err: any) {
      console.warn(`Erro ao obter competencia_controle/${competencia}:`, err);
      const [anoStr, mesStr] = competencia.split('-');
      return {
        id: competencia,
        ano: parseInt(anoStr, 10),
        mes: parseInt(mesStr, 10),
        status: 'ABERTO',
        versaoCalculo: 1,
        atualizadoEm: new Date().toISOString(),
      };
    }
  },

  /**
   * Lista todas as competências cadastradas em competencias_controle ordenadas cronologicamente.
   */
  async listarCompetenciasControle(): Promise<CompetenciaControle[]> {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.COMPETENCIAS_CONTROLE));
      const list: CompetenciaControle[] = [];
      snap.forEach((d) => list.push(d.data() as CompetenciaControle));
      return list.sort((a, b) => compararCompetencias(a.id, b.id));
    } catch (err) {
      console.warn('Erro ao listar competencias_controle:', err);
      return [];
    }
  },

  /**
   * Obtém os resumos consolidados de todos os servidores para uma competência ("YYYY-MM").
   */
  async obterResumosMensaisPorCompetencia(competencia: string): Promise<ResumoMensalContabil[]> {
    if (!isCompetenciaValida(competencia)) return [];
    try {
      const q = query(
        collection(db, COLLECTIONS.RESUMO_MENSAL),
        where('competencia', '==', competencia)
      );
      const snap = await getDocs(q);
      const list: ResumoMensalContabil[] = [];
      snap.forEach((d) => list.push(d.data() as ResumoMensalContabil));
      return list;
    } catch (err) {
      console.warn(`Erro ao obter resumo_mensal para ${competencia}:`, err);
      return [];
    }
  },

  /**
   * Obtém o resumo consolidado de um servidor específico para uma competência.
   */
  async obterResumoMensalServidor(matricula: string, competencia: string): Promise<ResumoMensalContabil | null> {
    if (!matricula || !isCompetenciaValida(competencia)) return null;
    try {
      const id = `${matricula}_${competencia}`;
      const snap = await getDoc(doc(db, COLLECTIONS.RESUMO_MENSAL, id));
      if (snap.exists()) {
        return snap.data() as ResumoMensalContabil;
      }
      return null;
    } catch (err) {
      console.warn(`Erro ao obter resumo de ${matricula} em ${competencia}:`, err);
      return null;
    }
  },

  /**
   * FECHAR COMPETÊNCIA (Idempotente, Atômico e com Trava de Concorrência)
   */
  async fecharCompetencia(params: FecharCompetenciaParams): Promise<ResultadoFechamento> {
    const { competencia, colaboradores, lancamentosDoMes, operadorEmail, onProgress } = params;

    if (!isCompetenciaValida(competencia)) {
      throw new Error(`Competência inválida: ${competencia}`);
    }

    const compDocRef = doc(db, COLLECTIONS.COMPETENCIAS_CONTROLE, competencia);

    // 0. Pré-requisito contábil (Fase 4): a competência anterior (C-1) precisa
    // estar com status FECHADO. Sem controle de C-1 no banco (implantação /
    // primeiro mês do sistema), o fechamento é permitido.
    const competenciaAnteriorVerificada = getCompetenciaAnterior(competencia);
    const controleAnteriorSnap = await getDoc(
      doc(db, COLLECTIONS.COMPETENCIAS_CONTROLE, competenciaAnteriorVerificada)
    );
    const statusControleAnterior = controleAnteriorSnap.exists()
      ? String(controleAnteriorSnap.data()?.status || 'ABERTO')
      : null;
    const preRequisito = validarPreRequisitoFechamento(statusControleAnterior);
    if (!preRequisito.valido) {
      throw new Error(
        `Fechamento bloqueado (competência anterior ${competenciaAnteriorVerificada}): ${preRequisito.motivo}`
      );
    }

    // 1. Adquire lock de concorrência com timeout de 60s
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(compDocRef);
      if (snap.exists()) {
        const data = snap.data() as CompetenciaControle;
        if (data.status === 'FECHADO') {
          // Já fechado, permitimos idempotência
        } else if (data.processandoFechamento && data.processandoInicio) {
          const decorrido = Date.now() - data.processandoInicio;
          if (decorrido < 60000) {
            throw new Error(`Fechamento em andamento por ${data.processandoPorEmail || 'outro operador'}. Aguarde a conclusão.`);
          }
        }
      }

      const [anoStr, mesStr] = competencia.split('-');
      tx.set(
        compDocRef,
        {
          id: competencia,
          ano: parseInt(anoStr, 10),
          mes: parseInt(mesStr, 10),
          processandoFechamento: true,
          processandoInicio: Date.now(),
          processandoPorEmail: operadorEmail,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    try {
      // 2. Busca resumos da competência imediatamente anterior (C-1)
      const competenciaAnterior = getCompetenciaAnterior(competencia);
      const resumosAnteriores = await this.obterResumosMensaisPorCompetencia(competenciaAnterior);
      const mapaResumosAnteriores = new Map<string, ResumoMensalContabil>();
      resumosAnteriores.forEach((r) => mapaResumosAnteriores.set(r.matricula, r));

      // Busca resumos já existentes da própria competência (para checar idempotência)
      const resumosAtuais = await this.obterResumosMensaisPorCompetencia(competencia);
      const mapaResumosAtuais = new Map<string, ResumoMensalContabil>();
      resumosAtuais.forEach((r) => mapaResumosAtuais.set(r.matricula, r));

      // 3. Converte os lançamentos para o formato normalizado LancamentoSimples
      const lancamentosNormalizados: LancamentoSimples[] = lancamentosDoMes.map((l) => {
        const saldoCalculado = Number(l.saldoCalculado) || 0;
        const tipo = saldoCalculado >= 0 ? 'CREDITO' : 'DEBITO';
        const minutos = horasParaMinutos(Math.abs(saldoCalculado));
        return {
          id: l.id,
          matricula: l.matricula,
          dataRegistro: l.dataRegistro,
          competencia: l.dataRegistro ? l.dataRegistro.slice(0, 7) : competencia,
          tipo,
          minutos,
          descricao: l.observacao || l.tipoOcorrencia,
        };
      });

      // 4. Executa o cálculo contábil para cada colaborador
      const novosResumos: ResumoMensalContabil[] = [];
      // Fase 4: apura o delta retroativo de cada servidor refechado para cascata
      const pendenciasCascata: { matricula: string; deltaMinutos: number }[] = [];
      // Fase 5 — Diffs de auditoria: valor anterior → novo por servidor
      const diffsServidores: DiffServidorAuditoria[] = [];
      let todosIdempotentes = resumosAtuais.length > 0 && resumosAtuais.length === colaboradores.length;

      for (const emp of colaboradores) {
        const colaboradorBase: ColaboradorBase = {
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede,
          saldoInicialMinutos: emp.saldoInicialHoras !== undefined ? horasParaMinutos(emp.saldoInicialHoras) : undefined,
        };

        const resumoAnterior = mapaResumosAnteriores.get(emp.matricula) || null;
        const novoResumo = calcularCompetenciaColaborador({
          colaborador: colaboradorBase,
          competencia,
          resumoAnterior,
          lancamentosDoMes: lancamentosNormalizados,
          status: 'FECHADO',
        });

        novosResumos.push(novoResumo);

        // Fase 5 — Metadados de validade no resumo (rastreabilidade consolidada,
        // calculados em memória: zero leituras extras do Firestore)
        const lancamentosRastreio = lancamentosDoMes
          .filter(
            (l) =>
              (l.matricula || '').trim().toUpperCase() === (emp.matricula || '').trim().toUpperCase()
          )
          .map((l) => ({
            saldoCalculadoMinutos: horasParaMinutos(l.saldoCalculado),
            saldoRemanescenteMinutos:
              typeof l.saldo_remanescente === 'number' ? horasParaMinutos(l.saldo_remanescente) : undefined,
          }));
        const rastreio = apurarRastreioLancamentos(lancamentosRastreio);
        Object.assign(
          novoResumo,
          calcularMetadadosValidade({
            competencia,
            minutosGerados: rastreio.minutosGerados,
            minutosCompensados: rastreio.minutosCompensados,
          })
        );

        const resumoExistente = mapaResumosAtuais.get(emp.matricula);
        if (!isFechamentoIdempotente(resumoExistente, novoResumo)) {
          todosIdempotentes = false;
          // Refechamento: registra a versão seguinte do resumo do servidor
          novoResumo.versao = ((resumoExistente?.versao as number) || 1) + 1;
          // Fase 4: apura o delta retroativo a propagar nas competências posteriores
          const deltaMinutos = calcularDeltaRefechamentoMinutos(resumoExistente, novoResumo);
          if (deltaMinutos !== 0) {
            pendenciasCascata.push({ matricula: emp.matricula, deltaMinutos });
          }
          // Fase 5 — Auditoria enriquecida: valor anterior → novo por servidor
          if (resumoExistente) {
            diffsServidores.push({
              matricula: emp.matricula,
              saldoFinalAnteriorMinutos: Math.round(resumoExistente.saldoFinalTransportadoMinutos),
              saldoFinalNovoMinutos: Math.round(novoResumo.saldoFinalTransportadoMinutos),
              deltaMinutos,
            });
          }
        }
      }

      // 5. Se já estiver 100% fechado e idêntico, encerra como idempotente
      if (todosIdempotentes) {
        await runTransaction(db, async (tx) => {
          tx.update(compDocRef, {
            status: 'FECHADO',
            processandoFechamento: false,
            fechadoEm: new Date().toISOString(),
            fechadoPorEmail: operadorEmail,
            totalColaboradoresFechados: colaboradores.length,
          });
        });

        return {
          sucesso: true,
          competencia,
          totalColaboradores: colaboradores.length,
          totalLancamentos: lancamentosDoMes.length,
          idempotente: true,
          mesesAfetadosCascata: [],
          mensagem: `Competência ${competencia} já homologada anteriormente sem alterações.`,
        };
      }

      // 6. Gravação em Lotes (writeBatch) com chunking defensivo de 300 operações
      const CHUNK_SIZE = 300;
      for (let i = 0; i < novosResumos.length; i += CHUNK_SIZE) {
        const chunk = novosResumos.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);

        chunk.forEach((resumo) => {
          const ref = doc(db, COLLECTIONS.RESUMO_MENSAL, resumo.id);
          batch.set(ref, sanitizeFirestoreData(resumo), { merge: false });
        });

        await batch.commit();

        if (onProgress) {
          const processados = Math.min(i + CHUNK_SIZE, novosResumos.length);
          const pct = Math.round((processados / novosResumos.length) * 100);
          onProgress(pct, processados, novosResumos.length);
        }
      }

      // 7. Atualiza o documento de controle da competência para FECHADO
      //    Fase 4: refechamento (REABERTO/FECHADO) incrementa versaoCalculo
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(compDocRef);
        const dataAtual = snap.exists() ? snap.data() : null;
        const statusAnterior = dataAtual ? String(dataAtual.status || '') : '';
        const refechamento = statusAnterior === 'FECHADO' || statusAnterior === 'REABERTO';
        const versaoCalculo = refechamento ? ((dataAtual?.versaoCalculo as number) || 1) + 1 : 1;
        const [anoStr, mesStr] = competencia.split('-');
        tx.set(
          compDocRef,
          {
            id: competencia,
            ano: parseInt(anoStr, 10),
            mes: parseInt(mesStr, 10),
            status: 'FECHADO',
            processandoFechamento: false,
            fechadoEm: new Date().toISOString(),
            fechadoPorEmail: operadorEmail,
            totalColaboradoresFechados: colaboradores.length,
            versaoCalculo,
            atualizadoEm: new Date().toISOString(),
          },
          { merge: true }
        );
      });

      // 8. Fase 4 — Recálculo em cascata: propaga o delta retroativo às
      //    competências posteriores já homologadas (movimentos próprios intactos)
      const mesesAfetadosCascata: string[] = [];
      for (const pendencia of pendenciasCascata) {
        const resultadoCascata = await this.recalcularCascata({
          matricula: pendencia.matricula,
          competenciaOrigem: competencia,
          deltaMinutos: pendencia.deltaMinutos,
          operadorEmail,
          motivo: `Refechamento homologado da competência ${competencia}`,
        });
        mesesAfetadosCascata.push(...resultadoCascata.mesesAfetados);
      }

      // 9. Trilha de auditoria enriquecida (Fase 5): valor anterior → novo por
      //    servidor, usuário, data/hora, motivo e impacto — em logs_auditoria
      //    existente, sem dados pessoais além de matrícula
      await registrarLogAuditoria({
        usuarioId: operadorEmail,
        usuarioNome: operadorEmail,
        canteiroId: 'GLOBAL',
        recursoId: competencia,
        tipoAcao: 'FECHAMENTO_COMPETENCIA',
        detalhes: `Homologação e Fechamento da Competência ${competencia}. ${colaboradores.length} colaboradores consolidados. Total lançamentos: ${lancamentosDoMes.length}.`,
        detalhesJson: montarResumoAuditoriaFechamento({
          competencia,
          operadorEmail,
          diffs: diffsServidores,
          mesesAfetadosCascata,
        }),
      });

      return {
        sucesso: true,
        competencia,
        totalColaboradores: colaboradores.length,
        totalLancamentos: lancamentosDoMes.length,
        idempotente: false,
        mesesAfetadosCascata,
        mensagem: `Competência ${competencia} homologada e fechada com sucesso!${
          mesesAfetadosCascata.length > 0
            ? ` Recálculo em cascata propagado a ${mesesAfetadosCascata.length} resumo(s) de competências posteriores.`
            : ''
        }`,
      };
    } catch (error: any) {
      // Libera a trava em caso de falha
      await runTransaction(db, async (tx) => {
        tx.update(compDocRef, {
          processandoFechamento: false,
        });
      }).catch(() => {});
      throw error;
    }
  },

  /**
   * REABRIR COMPETÊNCIA (Com justificativa obrigatória e auditoria)
   */
  async reabrirCompetencia(competencia: string, operadorEmail: string, motivo: string): Promise<void> {
    if (!isCompetenciaValida(competencia)) {
      throw new Error(`Competência inválida: ${competencia}`);
    }
    if (!motivo || motivo.trim().length < 10) {
      throw new Error('A justificativa administrativa de reabertura é obrigatória (mínimo 10 caracteres).');
    }

    const compDocRef = doc(db, COLLECTIONS.COMPETENCIAS_CONTROLE, competencia);

    // Fase 5 — captura o status anterior para auditoria (mesma leitura da transação)
    let statusAnteriorReabertura = 'ABERTO';
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(compDocRef);
      const versaoAtual = snap.exists() ? (snap.data().versaoCalculo || 1) : 1;
      if (snap.exists()) {
        statusAnteriorReabertura = String(snap.data()?.status || 'ABERTO');
      }

      tx.set(
        compDocRef,
        {
          id: competencia,
          status: 'REABERTO',
          reabertoEm: new Date().toISOString(),
          reabertoPorEmail: operadorEmail,
          motivoReabertura: motivo.trim(),
          versaoCalculo: versaoAtual + 1,
          atualizadoEm: new Date().toISOString(),
        },
        { merge: true }
      );
    });

    // Fase 5 — Auditoria enriquecida: status anterior → novo, usuário,
    // data/hora, motivo e impacto (sem leituras adicionais)
    await registrarLogAuditoria({
      usuarioId: operadorEmail,
      usuarioNome: operadorEmail,
      canteiroId: 'GLOBAL',
      recursoId: competencia,
      tipoAcao: 'REABERTURA_COMPETENCIA',
      detalhes: `Reabertura da Competência ${competencia}. Motivo: ${motivo.trim()}`,
      detalhesJson: {
        competencia,
        usuario: operadorEmail,
        dataHora: new Date().toISOString(),
        motivo: motivo.trim(),
        alteracao: {
          statusAnterior: statusAnteriorReabertura,
          novoStatus: 'REABERTO',
        },
        impacto:
          'Competência desbloqueada para retificação de lançamentos; o refechamento propagará o delta às competências posteriores homologadas (recálculo em cascata).',
      },
    });
  },

  /**
   * RECÁLCULO EM CASCATA DEVIDO A ALTERAÇÃO RETROATIVA
   * Propaga o Delta (Δ) em minutos por todas as competências posteriores existentes.
   */
  async recalcularCascata(params: RecalculoCascataParams): Promise<ResultadoCascata> {
    const { matricula, competenciaOrigem, deltaMinutos, operadorEmail, motivo } = params;

    if (deltaMinutos === 0) {
      return {
        sucesso: true,
        matricula,
        competenciaOrigem,
        deltaMinutos: 0,
        mesesAfetados: [],
      };
    }

    // 1. Busca todos os resumos do servidor em qualquer competência
    const q = query(
      collection(db, COLLECTIONS.RESUMO_MENSAL),
      where('matricula', '==', matricula)
    );
    const snap = await getDocs(q);
    const todosResumos: ResumoMensalContabil[] = [];
    snap.forEach((d) => todosResumos.push(d.data() as ResumoMensalContabil));

    // Filtra e ordena estritamente os meses posteriores a competenciaOrigem
    const posteriores = todosResumos
      .filter((r) => compararCompetencias(r.competencia, competenciaOrigem) > 0)
      .sort((a, b) => compararCompetencias(a.competencia, b.competencia));

    if (posteriores.length === 0) {
      return {
        sucesso: true,
        matricula,
        competenciaOrigem,
        deltaMinutos,
        mesesAfetados: [],
      };
    }

    // 2. Aplica a propagação matemática em memória
    const resumosAjustados = propagarDeltaCascata({
      matricula,
      competenciaOrigem,
      deltaMinutos,
      resumosSubsequentesOrdenados: posteriores,
    });

    // 3. Grava as atualizações em lote no Firestore
    const batch = writeBatch(db);
    resumosAjustados.forEach((resumo) => {
      const ref = doc(db, COLLECTIONS.RESUMO_MENSAL, resumo.id);
      batch.set(ref, sanitizeFirestoreData(resumo), { merge: true });
    });
    await batch.commit();

    const mesesAfetados = resumosAjustados.map((r) => r.competencia);

    // 4. Registra na trilha de auditoria
    await registrarLogAuditoria({
      usuarioId: operadorEmail,
      usuarioNome: operadorEmail,
      canteiroId: 'GLOBAL',
      recursoId: `${matricula}_CASCATA`,
      tipoAcao: 'RECALCULO_CASCATA',
      detalhes: `Recálculo em cascata da matrícula ${matricula}: Delta de ${deltaMinutos} min aplicado a ${mesesAfetados.length} competências posteriores (${mesesAfetados.join(', ')}). Origem: retificação em ${competenciaOrigem}. Motivo: ${motivo}`,
    });

    return {
      sucesso: true,
      matricula,
      competenciaOrigem,
      deltaMinutos,
      mesesAfetados,
    };
  },

  /**
   * SUBSCRIÇÃO EM TEMPO REAL DE LANÇAMENTOS POR COMPETÊNCIA
   * Ouve estritamente a competência selecionada (ex: "2026-08"), garantindo:
   * - Zero leitura de lançamentos de outros meses
   * - Retorno de função limpa de Unsubscribe para cancelar o listener anterior
   */
  subscribeLancamentosPorCompetencia(
    competencia: string,
    onSuccess: (records: TimeRecord[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string
  ): Unsubscribe {
    if (!isCompetenciaValida(competencia)) {
      onSuccess([]);
      return () => {};
    }

    const [ano, mes] = competencia.split('-');
    const dataInicio = `${competencia}-01`;
    const ultimoDia = new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate();
    const dataFim = `${competencia}-${String(ultimoDia).padStart(2, '0')}`;

    const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

    let q;
    if (normalizedCanteiro) {
      q = query(
        collection(db, COLLECTIONS.LANCAMENTOS),
        where('dataRegistro', '>=', dataInicio),
        where('dataRegistro', '<=', dataFim),
        where('employeeSede', '==', normalizedCanteiro)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.LANCAMENTOS),
        where('dataRegistro', '>=', dataInicio),
        where('dataRegistro', '<=', dataFim)
      );
    }

    return onSnapshot(
      q,
      (snap) => {
        const list: TimeRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            matricula: data.matricula,
            employeeName: data.employeeName,
            employeeSede: data.employeeSede,
            employeeFuncao: data.employeeFuncao,
            employeeAvatarUrl: data.employeeAvatarUrl,
            dataRegistro: data.dataRegistro,
            data_ocorrencia: data.data_ocorrencia || data.dataRegistro,
            tipoOcorrencia: data.tipoOcorrencia,
            codigoOcorrencia: data.codigoOcorrencia,
            horasBrutas: Number(data.horasBrutas) || 0,
            multiplicador: Number(data.multiplicador) || 1,
            saldoCalculado: Number(data.saldoCalculado) || 0,
            horasDescontoFolha: Number(data.horasDescontoFolha) || 0,
            destinoLancamento: data.destinoLancamento || 'BANCO_HORAS',
            saldo_remanescente: data.saldo_remanescente !== undefined ? Number(data.saldo_remanescente) : undefined,
            status_compensacao: data.status_compensacao,
            liquidacoes: data.liquidacoes || [],
            eFeriado: !!data.eFeriado,
            nomeFeriado: data.nomeFeriado,
            diaSemana: Number(data.diaSemana) || 0,
            diaSemanaNome: data.diaSemanaNome || '',
            observacao: data.observacao,
            comprovante: data.comprovante,
            criadoPorEmail: data.criadoPorEmail,
            criadoEm: data.criadoEm || new Date().toISOString(),
          });
        });
        onSuccess(list);
      },
      (err) => {
        console.warn(`Erro no listener de lançamentos para competência ${competencia}:`, err);
        if (onError) onError(err);
      }
    );
  },

  /**
   * SUBSCRIÇÃO EM TEMPO REAL DE INSALUBRIDADE POR COMPETÊNCIA
   * Totalmente independente do saldo de horas. Traz estritamente os laudos daquela competência.
   */
  subscribeInsalubridadePorCompetencia(
    competencia: string,
    onSuccess: (records: InsalubrityRecord[]) => void,
    onError?: (error: Error) => void,
    canteiroId?: string
  ): Unsubscribe {
    if (!isCompetenciaValida(competencia)) {
      onSuccess([]);
      return () => {};
    }

    const [ano, mes] = competencia.split('-');
    const dataInicio = `${competencia}-01`;
    const ultimoDia = new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate();
    const dataFim = `${competencia}-${String(ultimoDia).padStart(2, '0')}`;

    const normalizedCanteiro = (canteiroId && canteiroId !== 'TODAS' && canteiroId !== 'TODOS') ? canteiroId.toUpperCase() : null;

    let q;
    if (normalizedCanteiro) {
      q = query(
        collection(db, COLLECTIONS.INSALUBRIDADE),
        where('dataEvento', '>=', dataInicio),
        where('dataEvento', '<=', dataFim),
        where('branch', '==', normalizedCanteiro)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.INSALUBRIDADE),
        where('dataEvento', '>=', dataInicio),
        where('dataEvento', '<=', dataFim)
      );
    }

    return onSnapshot(
      q,
      (snap) => {
        const list: InsalubrityRecord[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            matricula: data.matricula || data.employeeId || '',
            nomeColaborador: data.nomeColaborador || data.employeeName || '',
            sede: data.sede || data.branch || 'SEDE',
            funcao: data.funcao || '',
            dataEvento: data.dataEvento,
            atividadeDesempenhada: data.atividadeDesempenhada || '',
            grauExposicao: data.grauExposicao || (data.percentual ? `${data.percentual}%` : '20%'),
            quantidadeHorasDias: Number(data.quantidadeHorasDias) || Number(data.tempoExposicaoHoras) || 1,
            unidade: data.unidade || 'DIAS',
            responsavelLancamento: data.responsavelLancamento || data.criadoPor || 'Sistema',
            observacoes: data.observacoes,
            criadoEm: data.criadoEm || new Date().toISOString(),
            criadoPorEmail: data.criadoPorEmail || data.criadoPor,
          });
        });
        onSuccess(list);
      },
      (err) => {
        console.warn(`Erro no listener de insalubridade para competência ${competencia}:`, err);
        if (onError) onError(err);
      }
    );
  },
};
