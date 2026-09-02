import React from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { CompetenciaControle } from '../services/competenciaService';
import { MONTH_NAMES_FULL, getCompetenciaAnterior, getProximaCompetencia } from '../services/competenciaEngine';
import { Badge, Button } from './ui';

interface CompetenciaStatusBarProps {
  competencia: string; // "YYYY-MM"
  controle: CompetenciaControle | null;
  onSelectCompetencia: (comp: string) => void;
  onOpenManagementModal: () => void;
  isGlobalAdmin: boolean;
  theme?: 'dark' | 'light';
}

export const CompetenciaStatusBar: React.FC<CompetenciaStatusBarProps> = ({
  competencia,
  controle,
  onSelectCompetencia,
  onOpenManagementModal,
  isGlobalAdmin,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const status = controle?.status || 'ABERTO';

  const [anoStr, mesStr] = competencia.split('-');
  const mesIndex = parseInt(mesStr, 10) - 1;
  const mesNome = MONTH_NAMES_FULL[mesIndex] || mesStr;

  const compAnterior = getCompetenciaAnterior(competencia);
  const compProxima = getProximaCompetencia(competencia);

  return (
    <div
      id="competencia-status-bar"
      className={`rounded-xl border transition-all ${
        status === 'FECHADO'
          ? isDark
            ? 'bg-[#16243D]/90 border-rose-900/40 shadow-sm'
            : 'bg-rose-50/70 border-rose-200 shadow-sm'
          : status === 'REABERTO'
          ? isDark
            ? 'bg-[#16243D]/90 border-amber-900/40 shadow-sm'
            : 'bg-amber-50/70 border-amber-200 shadow-sm'
          : isDark
          ? 'bg-[#16243D]/90 border-[#243756] shadow-sm'
          : 'bg-white border-slate-200 shadow-sm'
      }`}
    >
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        {/* Navegação de Competência */}
        <div className="flex items-center space-x-2">
          <div className="flex items-center rounded-lg border border-slate-700/40 p-0.5 bg-[#0B1426]/40">
            <button
              id="btn-prev-competencia"
              onClick={() => onSelectCompetencia(compAnterior)}
              title={`Ir para mês anterior (${compAnterior})`}
              className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-300 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 py-1 flex items-center space-x-2 font-mono text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-slate-100 font-sans">{mesNome} / {anoStr}</span>
              <span className="text-[11px] text-slate-400 font-mono">({competencia})</span>
            </div>
            <button
              id="btn-next-competencia"
              onClick={() => onSelectCompetencia(compProxima)}
              title={`Ir para próximo mês (${compProxima})`}
              className="p-1.5 rounded-md hover:bg-slate-700/50 text-slate-300 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Badge de Status da Competência */}
          <Badge
            variant={
              status === 'FECHADO'
                ? 'danger'
                : status === 'REABERTO'
                ? 'warning'
                : 'success'
            }
          >
            {status === 'FECHADO' ? (
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3" /> MÊS HOMOLOGADO / FECHADO
              </span>
            ) : status === 'REABERTO' ? (
              <span className="flex items-center gap-1">
                <Unlock className="w-3 h-3" /> REABERTO EM RETIFICAÇÃO
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> ABERTO P/ APONTAMENTOS
              </span>
            )}
          </Badge>
        </div>

        {/* Mensagem descritiva e Botão de Ação */}
        <div className="flex items-center space-x-3">
          {status === 'FECHADO' ? (
            <div className="hidden md:flex items-center text-xs text-rose-400 gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Apontamentos travados para resguardar a folha homologada.</span>
            </div>
          ) : (
            <div className="hidden md:flex items-center text-xs text-slate-400 gap-1.5">
              <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Controle contábil com transporte automático de saldos.</span>
            </div>
          )}

          <Button
            id="btn-gerenciar-competencia"
            variant="secondary"
            size="sm"
            onClick={onOpenManagementModal}
            className={`font-semibold text-xs ${
              status === 'FECHADO'
                ? 'border-rose-700/40 text-rose-300 hover:bg-rose-500/10'
                : 'border-blue-700/40 text-blue-400 hover:bg-blue-500/10'
            }`}
          >
            {status === 'FECHADO' ? 'Ver Homologação' : 'Homologar / Fechar Mês'}
          </Button>
        </div>
      </div>
    </div>
  );
};
