/**
 * Painel de Alertas de Validade do Banco de Horas (Fase 5)
 *
 * Exibe avisos preventivos de horas em aberto próximas do vencimento
 * (prazo legal de compensação — ver PRAZO_BANCO_HORAS_MESES).
 *
 * Importante: calcula tudo a partir dos lançamentos JÁ carregados em
 * memória (props), reaproveitando o rastreio FIFO (saldo_remanescente)
 * e a prescrição por lançamento. ZERO consultas ao Firestore.
 */
import React, { useMemo } from 'react';
import { AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import { TimeRecord, Employee } from '../types';
import { getRecordPrescriptionInfo } from '../utils/calculations';
import {
  horasParaMinutos,
  minutosParaStringFormatada,
  PRAZO_BANCO_HORAS_MESES,
} from '../services/competenciaEngine';

interface ValidityAlertsPanelProps {
  records: TimeRecord[];
  employees: Employee[];
  theme?: 'dark' | 'light';
}

type SituacaoAlerta = 'ATENCAO' | 'CRITICO' | 'VENCIDO';

interface AlertaValidade {
  matricula: string;
  nome: string;
  minutosAbertos: number;
  quantidadeCreditos: number;
  dataLimiteMaisProxima: string;
  situacao: SituacaoAlerta;
}

// Quanto menor, mais urgente
const ORDEM_SITUACAO: Record<SituacaoAlerta, number> = {
  VENCIDO: 0,
  CRITICO: 1,
  ATENCAO: 2,
};

export const ValidityAlertsPanel: React.FC<ValidityAlertsPanelProps> = ({
  records,
  employees,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  const { criticos, atencoes } = useMemo(() => {
    const nomePorMatricula = new Map<string, string>();
    employees.forEach((e) => nomePorMatricula.set(e.matricula.trim().toUpperCase(), e.nome));

    const porMatricula = new Map<string, AlertaValidade>();

    for (const rec of records) {
      const saldo = Number(rec.saldoCalculado) || 0;
      if (saldo <= 0.001) continue; // apenas créditos geram vencimento

      // FIFO já mantém saldo_remanescente; ausente = crédito totalmente em aberto
      const restanteHoras =
        typeof rec.saldo_remanescente === 'number' ? rec.saldo_remanescente : Math.abs(saldo);
      if (restanteHoras <= 0.001) continue; // já compensado

      const prescription = getRecordPrescriptionInfo(rec.data_ocorrencia || rec.dataRegistro);
      if (prescription.statusPrescricao === 'REGULAR') continue;

      const situacao = prescription.statusPrescricao as SituacaoAlerta;
      const matricula = (rec.matricula || '').trim().toUpperCase();
      const minutos = horasParaMinutos(restanteHoras);

      const atual = porMatricula.get(matricula);
      if (atual) {
        atual.minutosAbertos += minutos;
        atual.quantidadeCreditos += 1;
        if (prescription.dataLimiteCompensacao < atual.dataLimiteMaisProxima) {
          atual.dataLimiteMaisProxima = prescription.dataLimiteCompensacao;
        }
        if (ORDEM_SITUACAO[situacao] < ORDEM_SITUACAO[atual.situacao]) {
          atual.situacao = situacao;
        }
      } else {
        porMatricula.set(matricula, {
          matricula,
          nome: nomePorMatricula.get(matricula) || '',
          minutosAbertos: minutos,
          quantidadeCreditos: 1,
          dataLimiteMaisProxima: prescription.dataLimiteCompensacao,
          situacao,
        });
      }
    }

    const lista = Array.from(porMatricula.values()).sort((a, b) =>
      a.dataLimiteMaisProxima.localeCompare(b.dataLimiteMaisProxima)
    );
    return {
      criticos: lista.filter((a) => a.situacao === 'VENCIDO' || a.situacao === 'CRITICO'),
      atencoes: lista.filter((a) => a.situacao === 'ATENCAO'),
    };
  }, [records, employees]);

  if (criticos.length === 0 && atencoes.length === 0) {
    return (
      <div
        id="validity-alerts-panel"
        className={`p-3.5 rounded-xl border flex items-center gap-2 text-xs ${
          isDark
            ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}
      >
        <ShieldCheck className="w-4 h-4 shrink-0" />
        <span>
          Nenhuma hora em aberto próxima do vencimento (prazo de compensação: {PRAZO_BANCO_HORAS_MESES} meses).
        </span>
      </div>
    );
  }

  const renderLista = (alertas: AlertaValidade[], titulo: string, variante: 'vermelho' | 'ambar') => (
    <div
      className={`p-3.5 rounded-xl border space-y-2 ${
        variante === 'vermelho'
          ? isDark
            ? 'bg-rose-950/20 border-rose-800/40'
            : 'bg-rose-50 border-rose-200'
          : isDark
          ? 'bg-amber-950/20 border-amber-800/40'
          : 'bg-amber-50 border-amber-200'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 text-xs font-bold ${
          variante === 'vermelho'
            ? isDark
              ? 'text-rose-400'
              : 'text-rose-700'
            : isDark
            ? 'text-amber-400'
            : 'text-amber-700'
        }`}
      >
        <AlertTriangle className="w-4 h-4" />
        <span>{titulo}</span>
        <span className="font-mono">({alertas.length})</span>
      </div>
      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
        {alertas.map((a) => (
          <div
            key={a.matricula}
            className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-mono ${
              isDark ? 'bg-[#0B1426]/70 text-slate-300' : 'bg-white text-slate-700 border border-slate-200'
            }`}
          >
            <span className="truncate">
              <strong className={isDark ? 'text-slate-100' : 'text-slate-900'}>{a.matricula}</strong>
              {a.nome ? ` · ${a.nome}` : ''}
            </span>
            <span className="shrink-0 flex items-center gap-2">
              <strong>{minutosParaStringFormatada(a.minutosAbertos)}</strong>
              <span className="flex items-center gap-0.5 opacity-70">
                <Clock className="w-3 h-3" />
                {a.dataLimiteMaisProxima.split('-').reverse().join('/')}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div id="validity-alerts-panel" className="space-y-2">
      {criticos.length > 0 &&
        renderLista(
          criticos,
          'Horas vencidas ou vencendo em até 30 dias — providência imediata',
          'vermelho'
        )}
      {atencoes.length > 0 &&
        renderLista(atencoes, 'Horas vencendo entre 31 e 60 dias — planejamento de compensação', 'ambar')}
    </div>
  );
};
