import React from 'react';
import { AlertCircle, CheckCircle2, Lock } from 'lucide-react';
import {
  StatusCanteiros,
  normalizarCanteiroId,
  statusEfetivoCanteiro,
} from '../services/competenciaEngine';

interface CanteiroLockBannerProps {
  competencia: string;
  competenciaAnterior: string;
  canteiroId?: string;
  statusCanteiros?: StatusCanteiros;
  isSuperAdmin?: boolean;
  theme?: 'dark' | 'light';
}

export const CanteiroLockBanner: React.FC<CanteiroLockBannerProps> = ({
  competencia,
  competenciaAnterior,
  canteiroId,
  statusCanteiros,
  isSuperAdmin = false,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const normalizedCanteiro = normalizarCanteiroId(canteiroId);
  const status = normalizedCanteiro ? statusEfetivoCanteiro(statusCanteiros, normalizedCanteiro) : 'ABERTO';
  const liberado = isSuperAdmin || status === 'FECHADO';

  if (!normalizedCanteiro) {
    return (
      <div className={`sticky top-0 z-20 mb-4 rounded-xl border px-4 py-3 text-xs ${isDark ? 'border-slate-700 bg-slate-900/95 text-slate-300' : 'border-slate-200 bg-white/95 text-slate-600'}`}>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-400" />
          <span>Selecione um canteiro para visualizar a trava de lançamentos da competência {competencia}.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`sticky top-0 z-20 mb-4 rounded-xl border px-4 py-3 text-xs ${
        liberado
          ? isDark
            ? 'border-emerald-800/50 bg-emerald-950/30 text-emerald-200'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : isDark
          ? 'border-rose-800/50 bg-rose-950/30 text-rose-200'
          : 'border-rose-200 bg-rose-50 text-rose-800'
      }`}
    >
      <div className="flex items-center gap-2 font-semibold">
        {liberado ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
        <span>
          {liberado ? 'Canteiro Liberado para Digitação' : 'Lançamentos Bloqueados: feche o mês anterior deste canteiro'}
        </span>
      </div>
      <p className="mt-1 opacity-80">
        Canteiro {normalizedCanteiro} | competência {competencia} | mês anterior verificado: {competenciaAnterior}
        {isSuperAdmin ? ' | Bypass de SUPER_ADMIN disponível mediante confirmação.' : ''}
      </p>
    </div>
  );
};
