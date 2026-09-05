import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Lock,
  Unlock,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  RefreshCw,
  ShieldCheck,
  FileText
} from 'lucide-react';
import {
  competenciaService,
  CompetenciaControle,
  ResultadoFechamento
} from '../services/competenciaService';
import {
  MONTH_NAMES_FULL,
  getCompetenciaAnterior,
  minutosParaHorasDecimais,
  podeHomologarCompetencia,
  podeGerenciarCanteiro,
  statusEfetivoCanteiro,
} from '../services/competenciaEngine';
import { AdminRole, ConstructionSite, Employee, TimeRecord } from '../types';
import { Button, Badge } from './ui';
import { ValidityAlertsPanel } from './ValidityAlertsPanel';
import { LiquidacaoReportModal } from './LiquidacaoReportModal';

interface CompetenciaManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  competencia: string; // "YYYY-MM"
  controle: CompetenciaControle | null;
  employees: Employee[];
  records: TimeRecord[];
  currentUserEmail: string;
  isGlobalAdmin: boolean;
  userRole?: AdminRole;
  currentUserCanteiro?: string;
  constructionSites: ConstructionSite[];
  theme?: 'dark' | 'light';
  onCompetenciaUpdated: (comp: string) => void;
  onShowToast: (text: string, type?: 'success' | 'error' | 'info') => void;
}

export const CompetenciaManagementModal: React.FC<CompetenciaManagementModalProps> = ({
  isOpen,
  onClose,
  competencia,
  controle,
  employees,
  records,
  currentUserEmail,
  isGlobalAdmin,
  userRole,
  currentUserCanteiro,
  constructionSites,
  theme = 'dark',
  onCompetenciaUpdated,
  onShowToast,
}) => {
  const isDark = theme === 'dark';

  const [activeTab, setActiveTab] = useState<'fechamento' | 'fechamento-canteiro' | 'historico'>('fechamento');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; current: number; total: number } | null>(null);
  
  // Reabertura
  const [isReabrirModalOpen, setIsReabrirModalOpen] = useState(false);
  const [motivoReabertura, setMotivoReabertura] = useState('');
  const [erroReabertura, setErroReabertura] = useState<string | null>(null);

  // Lista do histórico
  const [todasCompetencias, setTodasCompetencias] = useState<CompetenciaControle[]>([]);
  const [isLoadingHistorico, setIsLoadingHistorico] = useState(false);

  // Fase 5 — Relatório de Liquidação/Rescisão (extrato em memória, sem escrita)
  const [isLiquidacaoReportOpen, setIsLiquidacaoReportOpen] = useState(false);

  // Carrega histórico quando abre a aba
  useEffect(() => {
    if (activeTab === 'historico' && isOpen) {
      setIsLoadingHistorico(true);
      competenciaService.listarCompetenciasControle()
        .then((list) => setTodasCompetencias(list))
        .finally(() => setIsLoadingHistorico(false));
    }
  }, [activeTab, isOpen]);

  if (!isOpen) return null;

  const [anoStr, mesStr] = competencia.split('-');
  const mesIndex = parseInt(mesStr, 10) - 1;
  const mesNome = MONTH_NAMES_FULL[mesIndex] || mesStr;
  const competenciaFormatada = `${mesNome} de ${anoStr}`;
  const statusAtual = controle?.status || 'ABERTO';

  // Cálculos do mês atual em memória para prévia
  const lancamentosDoMes = records.filter(r => r.dataRegistro?.startsWith(competencia));
  const creditosHoras = lancamentosDoMes
    .filter(r => (Number(r.saldoCalculado) || 0) > 0)
    .reduce((acc, r) => acc + Number(r.saldoCalculado), 0);
  const debitosHoras = lancamentosDoMes
    .filter(r => (Number(r.saldoCalculado) || 0) < 0)
    .reduce((acc, r) => acc + Math.abs(Number(r.saldoCalculado)), 0);

  // Manipulador de Fechamento / Homologação
  const handleExecutarFechamento = async () => {
    if (!isGlobalAdmin) {
      onShowToast('Apenas administradores podem homologar e fechar competências.', 'error');
      return;
    }

    const confirmMsg = `Confirma a homologação contábil da Competência ${competenciaFormatada}?\n\n- ${employees.length} colaboradores serão consolidados.\n- Saldos finais serão transportados para ${getCompetenciaAnterior(competencia)} como saldo inicial.\n- Lançamentos do mês ficarão protegidos contra alterações.`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    setProgress({ percent: 0, current: 0, total: employees.length });

    try {
      const res: ResultadoFechamento = await competenciaService.fecharCompetencia({
        competencia,
        colaboradores: employees,
        lancamentosDoMes,
        operadorEmail: currentUserEmail,
        onProgress: (percent, current, total) => {
          setProgress({ percent, current, total });
        },
      });

      onShowToast(res.mensagem, res.idempotente ? 'info' : 'success');
      onCompetenciaUpdated(competencia);
    } catch (err: any) {
      console.error('Erro no fechamento da competência:', err);
      onShowToast(err.message || 'Falha ao homologar competência.', 'error');
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  // Manipulador de Reabertura
  const handleExecutarReabertura = async () => {
    if (!motivoReabertura.trim() || motivoReabertura.trim().length < 10) {
      setErroReabertura('A justificativa administrativa de reabertura deve conter ao menos 10 caracteres.');
      return;
    }

    setIsProcessing(true);
    setErroReabertura(null);

    try {
      await competenciaService.reabrirCompetencia(competencia, currentUserEmail, motivoReabertura);
      onShowToast(`Competência ${competenciaFormatada} reaberta com sucesso.`, 'success');
      setIsReabrirModalOpen(false);
      setMotivoReabertura('');
      onCompetenciaUpdated(competencia);
    } catch (err: any) {
      console.error('Erro na reabertura da competência:', err);
      setErroReabertura(err.message || 'Falha ao reabrir competência.');
    } finally {
      setIsProcessing(false);
    }
  };

  const canteirosDisponiveis = constructionSites.length > 0
    ? constructionSites.map((site) => ({ id: site.codigo || site.id, nome: site.nome || site.name || site.codigo || site.id }))
    : Array.from(new Set(employees.map((employee) => employee.sede).filter(Boolean))).map((id) => ({ id, nome: id }));

  const handleFecharCanteiro = async (canteiroId: string) => {
    if (!podeGerenciarCanteiro(userRole, currentUserCanteiro, canteiroId)) {
      onShowToast('Você só pode gerenciar o fechamento do seu canteiro.', 'error');
      return;
    }
    if (!window.confirm(`Confirma o fechamento do canteiro ${canteiroId} na competência ${competencia}?`)) return;
    setIsProcessing(true);
    try {
      await competenciaService.fecharCanteiro({
        competencia,
        canteiroId,
        operadorEmail: currentUserEmail,
        operadorRole: userRole,
      });
      onShowToast(`Canteiro ${canteiroId} fechado com sucesso.`, 'success');
      onCompetenciaUpdated(competencia);
    } catch (err: any) {
      onShowToast(err.message || 'Falha ao fechar canteiro.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReabrirCanteiro = async (canteiroId: string) => {
    if (!podeGerenciarCanteiro(userRole, currentUserCanteiro, canteiroId)) {
      onShowToast('Você só pode gerenciar o fechamento do seu canteiro.', 'error');
      return;
    }
    const motivo = window.prompt(`Informe o motivo da reabertura do canteiro ${canteiroId} (mínimo 10 caracteres):`, '');
    if (!motivo || motivo.trim().length < 10) {
      onShowToast('A justificativa de reabertura deve conter ao menos 10 caracteres.', 'error');
      return;
    }
    setIsProcessing(true);
    try {
      await competenciaService.reabrirCanteiro({
        competencia,
        canteiroId,
        operadorEmail: currentUserEmail,
        operadorRole: userRole,
        motivo,
      });
      onShowToast(`Canteiro ${canteiroId} reaberto com sucesso.`, 'success');
      onCompetenciaUpdated(competencia);
    } catch (err: any) {
      onShowToast(err.message || 'Falha ao reabrir canteiro.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        id="competencia-management-modal"
        className={`w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden transition-all duration-200 ${
          isDark
            ? 'bg-[#16243D] border-[#243756] text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isDark ? 'border-[#243756] bg-[#0B1426]/60' : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold tracking-tight">Gestão de Competência e Fechamento</h2>
                <Badge
                  variant={
                    statusAtual === 'FECHADO'
                      ? 'danger'
                      : statusAtual === 'REABERTO'
                      ? 'warning'
                      : 'success'
                  }
                >
                  {statusAtual === 'FECHADO' ? (
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3" /> FECHADO
                    </span>
                  ) : statusAtual === 'REABERTO' ? (
                    <span className="flex items-center gap-1">
                      <Unlock className="w-3 h-3" /> REABERTO
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> ABERTO
                    </span>
                  )}
                </Badge>
              </div>
              <p className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Período Contábil: <strong className="text-blue-500">{competenciaFormatada}</strong> ({competencia})
              </p>
            </div>
          </div>
          <button
            id="btn-close-competencia-modal"
            onClick={onClose}
            disabled={isProcessing}
            className={`p-2 rounded-lg transition-colors ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-abas */}
        <div className={`flex border-b px-6 pt-2 ${isDark ? 'border-[#243756] bg-[#0B1426]/40' : 'border-slate-100 bg-slate-50/50'}`}>
          <button
            id="tab-fechamento"
            onClick={() => setActiveTab('fechamento')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'fechamento'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Homologação e Ciclo</span>
          </button>
          <button
            id="tab-historico"
            onClick={() => setActiveTab('historico')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'historico'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Histórico de Competências</span>
          </button>
          <button
            id="tab-fechamento-canteiro"
            onClick={() => setActiveTab('fechamento-canteiro')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'fechamento-canteiro'
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Fechamento por Canteiro</span>
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'fechamento' ? (
            <div className="space-y-6">
              {/* Barra de Progresso durante processamento */}
              {isProcessing && progress && (
                <div className={`p-4 rounded-xl border animate-pulse ${isDark ? 'bg-blue-950/40 border-blue-800/40' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-center justify-between text-xs font-semibold mb-2">
                    <span className="flex items-center gap-2 text-blue-500">
                      <RefreshCw className="w-4 h-4 animate-spin" /> Homologando e consolidando colaboradores...
                    </span>
                    <span className="text-blue-500 font-mono">{progress.percent}%</span>
                  </div>
                  <div className="w-full bg-slate-700/30 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-2 transition-all duration-300"
                      style={{ width: `${progress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-mono">
                    <span>{progress.current} de {progress.total} servidores processados</span>
                    <span>Gravação em lotes (writeBatch)</span>
                  </div>
                </div>
              )}

              {/* Grid de Resumo dos Dados do Mês */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B1426]/80 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 font-medium">Colaboradores</span>
                    <Users className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono tracking-tight">{employees.length}</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Efetivo cadastrado ativo</p>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B1426]/80 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 font-medium">Lançamentos no Mês</span>
                    <FileText className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold font-mono tracking-tight">{lancamentosDoMes.length}</div>
                  <p className="text-[11px] text-slate-400 mt-0.5">Eventos apontados em {mesNome}</p>
                </div>

                <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#0B1426]/80 border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-400 font-medium">Movimentação Bruta</span>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                      <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                    </div>
                  </div>
                  <div className="text-sm font-mono font-semibold">
                    <span className="text-emerald-500">+{creditosHoras.toFixed(1)}h</span>
                    <span className="mx-1 text-slate-500">/</span>
                    <span className="text-rose-500">-{debitosHoras.toFixed(1)}h</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Créditos e débitos operacionais</p>
                </div>
              </div>

              {/* Fase 5 — Alertas de validade (30/60 dias), 100% em memória: zero consultas */}
              <ValidityAlertsPanel records={records} employees={employees} theme={theme} />

              {/* Status e Ações */}
              {statusAtual === 'FECHADO' ? (
                <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-rose-950/20 border-rose-800/40 text-slate-200' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-rose-500/20 text-rose-400 shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-rose-400">Competência Homologada e Fechada</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Os saldos contábeis deste mês estão consolidados no banco de dados e transportados para o mês seguinte. Para resguardar a integridade da folha de pagamento, novos apontamentos ou alterações estão restritos.
                      </p>
                      {controle?.fechadoEm && (
                        <div className="mt-2 text-xs font-mono text-slate-400">
                          Homologado em: <strong>{new Date(controle.fechadoEm).toLocaleString('pt-BR')}</strong> por <strong>{controle.fechadoPorEmail || 'Administrador'}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  {isGlobalAdmin && (
                    <div className="pt-3 border-t border-rose-800/30 flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        Necessita corrigir lançamentos ou retificar a folha?
                      </span>
                      <Button
                        id="btn-abrir-modal-reabertura"
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsReabrirModalOpen(true)}
                        disabled={isProcessing}
                        className="text-xs font-semibold text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
                      >
                        <Unlock className="w-3.5 h-3.5 mr-1.5" />
                        Reabrir Competência
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-5 rounded-xl border space-y-4 ${isDark ? 'bg-blue-950/20 border-blue-800/40' : 'bg-blue-50 border-blue-200'}`}>
                  <div className="flex items-start space-x-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-blue-400">
                        {statusAtual === 'REABERTO' ? 'Competência Reaberta Administrativamente' : 'Competência Aberta para Lançamentos'}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {statusAtual === 'REABERTO'
                          ? `Esta competência foi reaberta por ${controle?.reabertoPorEmail || 'RH'}. Justificativa: "${controle?.motivoReabertura}". Finalizadas as correções, clique em Homologar abaixo.`
                          : 'Apontamentos e dispensas de SPTF podem ser lançados livremente. Ao encerrar as conferências da folha, homologue a competência para consolidar os saldos contábeis e transportá-los.'}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-blue-800/30 flex items-center justify-between">
                    <div className="flex items-center text-xs text-slate-400 space-x-1.5">
                      <Info className="w-4 h-4 text-blue-400" />
                      <span>Processamento idempotente e atômico em minutos inteiros.</span>
                    </div>
                    <Button
                      id="btn-homologar-fechar"
                      variant="primary"
                      size="md"
                      onClick={handleExecutarFechamento}
                      disabled={isProcessing || !podeHomologarCompetencia(isGlobalAdmin, statusAtual)}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-lg shadow-blue-600/20"
                    >
                      <FileCheck2 className="w-4 h-4 mr-2" />
                      {isProcessing ? 'Homologando...' : 'Homologar e Fechar Mês'}
                    </Button>
                  </div>
                </div>
              )}

              {/* Informações Regulatórias e Contábeis COMARA */}
              <div className={`p-4 rounded-xl border text-xs space-y-2 ${isDark ? 'bg-[#0B1426]/50 border-[#243756] text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-blue-400" /> Diretrizes de Fechamento Contábil
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] leading-relaxed">
                  <li><strong>Transporte de Saldos:</strong> O saldo final consolidado do mês é adotado automaticamente como saldo inicial da competência seguinte.</li>
                  <li><strong>Imutabilidade de Histórico:</strong> Fechar a competência impede alterações indevidas em períodos já auditados e enviados para pagamento.</li>
                  <li><strong>Recálculo em Cascata:</strong> Caso lançamentos retroativos sejam retificados em uma competência anterior, o sistema propaga o delta linearmente pelas competências posteriores fechadas com registro de auditoria.</li>
                </ul>
              </div>

              {/* Fase 5 — Extrato de Liquidação/Rescisão (em memória, sem escrita no banco) */}
              <div className="flex items-center justify-end">
                <Button
                  id="btn-relatorio-liquidacao"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsLiquidacaoReportOpen(true)}
                  disabled={isProcessing}
                  className="text-xs font-semibold text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5" />
                  Extrato de Liquidação / Rescisão (RH)
                </Button>
              </div>
            </div>
          ) : activeTab === 'fechamento-canteiro' ? (
            <div className="space-y-4">
              <div className={`rounded-xl border p-4 text-xs ${isDark ? 'border-[#243756] bg-[#0B1426]/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                Cada canteiro possui fechamento independente. O mês seguinte só aceita lançamentos quando este canteiro estiver fechado.
              </div>
              {canteirosDisponiveis.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-400">Nenhum canteiro cadastrado.</div>
              ) : (
                <div className="space-y-2">
                  {canteirosDisponiveis.map((canteiro) => {
                    const status = statusEfetivoCanteiro(controle?.statusCanteiros, canteiro.id);
                    const podeGerenciar = podeGerenciarCanteiro(userRole, currentUserCanteiro, canteiro.id);
                    return (
                      <div key={canteiro.id} className={`flex items-center justify-between gap-3 rounded-xl border p-4 ${isDark ? 'border-[#243756] bg-[#0B1426]/60' : 'border-slate-200 bg-white'}`}>
                        <div>
                          <div className="font-semibold text-sm">{canteiro.nome}</div>
                          <div className="text-[11px] text-slate-400">Código: {canteiro.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={status === 'FECHADO' ? 'danger' : 'success'}>{status}</Badge>
                          {podeGerenciar && status === 'FECHADO' && (
                            <Button variant="secondary" size="sm" onClick={() => handleReabrirCanteiro(canteiro.id)} disabled={isProcessing}>
                              <Unlock className="w-3.5 h-3.5 mr-1" /> Reabrir Canteiro
                            </Button>
                          )}
                          {podeGerenciar && status !== 'FECHADO' && (
                            <Button variant="primary" size="sm" onClick={() => handleFecharCanteiro(canteiro.id)} disabled={isProcessing}>
                              <Lock className="w-3.5 h-3.5 mr-1" /> Fechar Canteiro
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Aba Histórico */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Registro de competências cadastradas no sistema</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setIsLoadingHistorico(true);
                    competenciaService.listarCompetenciasControle()
                      .then((list) => setTodasCompetencias(list))
                      .finally(() => setIsLoadingHistorico(false));
                  }}
                  disabled={isLoadingHistorico}
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isLoadingHistorico ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              {isLoadingHistorico ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mb-2" />
                  <span>Carregando histórico contábil...</span>
                </div>
              ) : todasCompetencias.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed rounded-xl border-slate-700">
                  <Calendar className="w-8 h-8 mx-auto text-slate-500 mb-2 opacity-60" />
                  <p className="font-medium text-sm">Nenhuma competência homologada no histórico.</p>
                  <p className="text-xs mt-1">As competências aparecerão aqui conforme forem homologadas e fechadas.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todasCompetencias.map((comp) => {
                    const [ano, mes] = comp.id.split('-');
                    const nome = MONTH_NAMES_FULL[parseInt(mes, 10) - 1] || mes;
                    return (
                      <div
                        key={comp.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                          comp.id === competencia
                            ? isDark
                              ? 'bg-blue-950/30 border-blue-500/50'
                              : 'bg-blue-50 border-blue-400'
                            : isDark
                            ? 'bg-[#0B1426]/60 border-[#243756]'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-lg ${
                            comp.status === 'FECHADO'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : comp.status === 'REABERTO'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {comp.status === 'FECHADO' ? (
                              <Lock className="w-4 h-4" />
                            ) : comp.status === 'REABERTO' ? (
                              <Unlock className="w-4 h-4" />
                            ) : (
                              <CheckCircle2 className="w-4 h-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-sm">{nome} / {ano}</span>
                              <span className="text-xs font-mono text-slate-400">({comp.id})</span>
                              {comp.id === competencia && (
                                <Badge variant="brand">Selecionada</Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {comp.status === 'FECHADO' ? (
                                <span>Fechado em {new Date(comp.fechadoEm || comp.atualizadoEm).toLocaleDateString('pt-BR')} • {comp.totalColaboradoresFechados || 0} servidores</span>
                              ) : comp.status === 'REABERTO' ? (
                                <span>Reaberto em {new Date(comp.reabertoEm || comp.atualizadoEm).toLocaleDateString('pt-BR')} • Motivo: {comp.motivoReabertura}</span>
                              ) : (
                                <span>Competência aberta para registros</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <Badge
                          variant={
                            comp.status === 'FECHADO'
                              ? 'danger'
                              : comp.status === 'REABERTO'
                              ? 'warning'
                              : 'success'
                          }
                        >
                          {comp.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t ${isDark ? 'border-[#243756] bg-[#0B1426]/60' : 'border-slate-100 bg-slate-50'}`}>
          <div className="text-xs text-slate-400">
            Mês Ativo: <strong className="text-blue-500">{competenciaFormatada}</strong>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isProcessing}
          >
            Fechar Janela
          </Button>
        </div>
      </div>

      {/* Fase 5 — Relatório de Liquidação/Rescisão (leitura em memória, sem escrita) */}
      <LiquidacaoReportModal
        isOpen={isLiquidacaoReportOpen}
        onClose={() => setIsLiquidacaoReportOpen(false)}
        records={records}
        employees={employees}
        competencia={competencia}
        currentUserEmail={currentUserEmail}
        theme={theme}
      />

      {/* Modal Secundário: Reabertura com Justificativa */}
      {isReabrirModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div
            id="modal-reabertura-competencia"
            className={`w-full max-w-lg rounded-2xl border p-6 shadow-2xl space-y-4 ${
              isDark ? 'bg-[#16243D] border-[#243756] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex items-center space-x-3 text-amber-500">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="text-base font-bold">Reabertura de Competência Homologada</h3>
                <p className="text-xs text-slate-400">Requer justificativa legal para trilha de auditoria</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 leading-relaxed">
              <strong>Atenção:</strong> Reabrir a competência <strong>{competenciaFormatada}</strong> permite novas edições e recálculos no banco de horas. A ação será gravada permanentemente nos logs de auditoria com seu e-mail ({currentUserEmail}).
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Justificativa Administrativa (Obrigatória)
              </label>
              <textarea
                id="input-motivo-reabertura"
                value={motivoReabertura}
                onChange={(e) => setMotivoReabertura(e.target.value)}
                placeholder="Ex: Retificação de folha conforme memorando COMARA nº 42/2026 para ajuste de horas extras de missão..."
                rows={3}
                disabled={isProcessing}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  isDark ? 'bg-[#0B1426] border-[#243756] text-slate-200' : 'bg-slate-50 border-slate-300 text-slate-900'
                }`}
              />
              <div className="flex justify-between text-[11px] text-slate-400">
                <span>Mínimo 10 caracteres</span>
                <span>{motivoReabertura.length} caracteres</span>
              </div>
            </div>

            {erroReabertura && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{erroReabertura}</span>
              </div>
            )}

            <div className="flex items-center justify-end space-x-3 pt-2">
              <Button
                variant="ghost"
                size="md"
                onClick={() => {
                  setIsReabrirModalOpen(false);
                  setMotivoReabertura('');
                  setErroReabertura(null);
                }}
                disabled={isProcessing}
              >
                Cancelar
              </Button>
              <Button
                id="btn-confirmar-reabertura"
                variant="danger"
                size="md"
                onClick={handleExecutarReabertura}
                disabled={isProcessing || motivoReabertura.trim().length < 10}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              >
                {isProcessing ? 'Reabrindo...' : 'Confirmar Reabertura'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
