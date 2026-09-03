/**
 * Relatório de Liquidação / Rescisão (Fase 5)
 *
 * Extrato de horas não compensadas por colaborador, para envio ao
 * RH / financeiro (calculado para pagamento em eventual rescisão).
 *
 * Restrições atendidas:
 * - Usa apenas os lançamentos JÁ carregados em memória (props): zero leituras extras.
 * - Somente leitura: NENHUMA escrita no Firestore, nenhuma baixa automática.
 * - Sem dados pessoais persistentes: o extrato existe apenas em tela.
 */
import React, { useMemo } from 'react';
import { X, FileText, Printer, Info } from 'lucide-react';
import { TimeRecord, Employee } from '../types';
import { getRecordPrescriptionInfo } from '../utils/calculations';
import {
  horasParaMinutos,
  minutosParaStringFormatada,
  minutosParaHorasDecimais,
  PRAZO_BANCO_HORAS_MESES,
} from '../services/competenciaEngine';
import { Button, Badge } from './ui';

interface LiquidacaoReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  records: TimeRecord[];
  employees: Employee[];
  competencia: string;
  currentUserEmail: string;
  theme?: 'dark' | 'light';
}

interface LinhaLiquidacao {
  matricula: string;
  nome: string;
  sede: string;
  minutosAbertos: number;
  quantidadeCreditos: number;
  dataLimiteMaisProxima: string;
  situacao: 'REGULAR' | 'ATENCAO' | 'CRITICO' | 'VENCIDO';
}

const ORDEM: Record<LinhaLiquidacao['situacao'], number> = {
  VENCIDO: 0,
  CRITICO: 1,
  ATENCAO: 2,
  REGULAR: 3,
};

export const LiquidacaoReportModal: React.FC<LiquidacaoReportModalProps> = ({
  isOpen,
  onClose,
  records,
  employees,
  competencia,
  currentUserEmail,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';

  const linhas = useMemo<LinhaLiquidacao[]>(() => {
    const nomePorMatricula = new Map<string, { nome: string; sede: string }>();
    employees.forEach((e) =>
      nomePorMatricula.set(e.matricula.trim().toUpperCase(), { nome: e.nome, sede: e.sede || '' })
    );

    const porMatricula = new Map<string, LinhaLiquidacao>();

    for (const rec of records) {
      const saldo = Number(rec.saldoCalculado) || 0;
      if (saldo <= 0.001) continue;
      const restanteHoras =
        typeof rec.saldo_remanescente === 'number' ? rec.saldo_remanescente : Math.abs(saldo);
      if (restanteHoras <= 0.001) continue;

      const prescription = getRecordPrescriptionInfo(rec.data_ocorrencia || rec.dataRegistro);
      const matricula = (rec.matricula || '').trim().toUpperCase();
      const minutos = horasParaMinutos(restanteHoras);

      const atual = porMatricula.get(matricula);
      if (atual) {
        atual.minutosAbertos += minutos;
        atual.quantidadeCreditos += 1;
        if (prescription.dataLimiteCompensacao < atual.dataLimiteMaisProxima) {
          atual.dataLimiteMaisProxima = prescription.dataLimiteCompensacao;
        }
        if (ORDEM[prescription.statusPrescricao] < ORDEM[atual.situacao]) {
          atual.situacao = prescription.statusPrescricao;
        }
      } else {
        const cad = nomePorMatricula.get(matricula);
        porMatricula.set(matricula, {
          matricula,
          nome: cad?.nome || '',
          sede: (rec.employeeSede as string) || cad?.sede || '',
          minutosAbertos: minutos,
          quantidadeCreditos: 1,
          dataLimiteMaisProxima: prescription.dataLimiteCompensacao,
          situacao: prescription.statusPrescricao,
        });
      }
    }

    return Array.from(porMatricula.values()).sort((a, b) =>
      a.dataLimiteMaisProxima.localeCompare(b.dataLimiteMaisProxima)
    );
  }, [records, employees]);

  if (!isOpen) return null;

  const totalMinutos = linhas.reduce((acc, l) => acc + l.minutosAbertos, 0);
  const totalVencidos = linhas.filter(
    (l) => l.situacao === 'VENCIDO' || l.situacao === 'CRITICO'
  ).length;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        id="relatorio-liquidacao-modal"
        className={`w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden ${
          isDark ? 'bg-[#16243D] border-[#243756] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-[#243756] bg-[#0B1426]/60' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">Extrato de Liquidação / Rescisão</h2>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Horas não compensadas por colaborador — para conferência do RH / Financeiro
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 max-h-[62vh] overflow-y-auto">
          <div className={`text-xs mb-4 flex flex-wrap gap-x-6 gap-y-1 font-mono ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            <span>Competência de referência: <strong className="text-blue-500">{competencia}</strong></span>
            <span>Prazo legal: <strong className="text-blue-500">{PRAZO_BANCO_HORAS_MESES} meses</strong></span>
            <span>Servidores com horas em aberto: <strong className="text-blue-500">{linhas.length}</strong></span>
            <span>Total não compensado: <strong className="text-emerald-500">{minutosParaStringFormatada(totalMinutos)}</strong> ({minutosParaHorasDecimais(totalMinutos).toFixed(2)}h)</span>
          </div>

          {linhas.length === 0 ? (
            <div className={`py-12 text-center text-sm border border-dashed rounded-xl ${isDark ? 'border-slate-700 text-slate-400' : 'border-slate-300 text-slate-500'}`}>
              Nenhum colaborador possui horas em aberto não compensadas.
            </div>
          ) : (
            <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-[#243756]' : 'border-slate-200'}`}>
              <table className="w-full text-xs">
                <thead className={isDark ? 'bg-[#0B1426]/80 text-slate-300' : 'bg-slate-50 text-slate-600'}>
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Matrícula</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Colaborador</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Sede</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Horas em Aberto</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Créditos</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Vence em</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/20">
                  {linhas.map((l) => (
                    <tr key={l.matricula} className={isDark ? 'hover:bg-[#0B1426]/50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 font-mono">{l.matricula}</td>
                      <td className="px-3 py-2">{l.nome || '—'}</td>
                      <td className="px-3 py-2 font-mono">{l.sede || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-500">
                        {minutosParaStringFormatada(l.minutosAbertos)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{l.quantidadeCreditos}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {l.dataLimiteMaisProxima.split('-').reverse().join('/')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Badge
                          variant={
                            l.situacao === 'VENCIDO'
                              ? 'danger'
                              : l.situacao === 'CRITICO'
                              ? 'warning'
                              : l.situacao === 'ATENCAO'
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {l.situacao}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className={isDark ? 'bg-[#0B1426]/80 text-slate-200' : 'bg-slate-50 text-slate-800'}>
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 font-bold">TOTAL GERAL</td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-500">
                      {minutosParaStringFormatada(totalMinutos)}
                    </td>
                    <td colSpan={3} className="px-3 py-2.5 text-[11px] font-mono opacity-70">
                      {totalVencidos} servidor(es) em vencimento crítico
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div
            className={`mt-4 p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
              isDark ? 'bg-[#0B1426]/50 border-[#243756] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-400" />
            <span>
              Extrato gerado em <strong>{new Date().toLocaleString('pt-BR')}</strong> por{' '}
              <strong>{currentUserEmail}</strong>. Documento de conferência para o RH/Financeiro —{' '}
              <strong>nenhum dado foi gravado ou alterado</strong> no banco de horas (sem baixa automática).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-t ${
            isDark ? 'border-[#243756] bg-[#0B1426]/60' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {linhas.length} colaborador(es) · Total: {minutosParaStringFormatada(totalMinutos)}
          </span>
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="md" onClick={onClose}>
              Fechar
            </Button>
            <Button
              id="btn-imprimir-liquidacao"
              variant="primary"
              size="md"
              onClick={() => window.print()}
              disabled={linhas.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir / Salvar PDF
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
