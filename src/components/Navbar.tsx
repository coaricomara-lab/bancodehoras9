import React, { useState, useRef, useEffect } from 'react';
import { SystemConfig, AdminRole } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { PWAInstallButton } from './PWAInstallButton';
import { rbacService, ROLE_INFO } from '../services/rbacService';
import { 
  BarChart3, 
  Plus, 
  Users, 
  BookOpen, 
  RotateCcw, 
  Zap, 
  ShieldCheck, 
  UserCheck, 
  Sun, 
  Moon, 
  Lock, 
  ChevronDown, 
  Settings, 
  Shield, 
  User, 
  ExternalLink, 
  Sparkles, 
  Check, 
  Trash2, 
  UploadCloud, 
  FileSpreadsheet, 
  LogOut, 
  Cloud,
  HardHat,
  Building2,
  Building,
  Image as ImageIcon,
  Clock,
  CalendarCheck2,
  Receipt,
  FileText,
  FileCheck,
  DatabaseBackup
} from 'lucide-react';

export type ActiveTab = 'dashboard' | 'colaboradores' | 'dispensas_faltas' | 'canteiros' | 'insalubridade' | 'contracheques' | 'relatorios' | 'extrato' | 'portal_colaborador' | 'permissoes_admin' | 'auditoria' | 'arquitetura' | 'configuracoes_instituicao' | 'backup_restauracao';
export type UserMode = 'ADMIN' | 'COLABORADOR';

interface NavbarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewEntry: () => void;
  onOpenQuickBatchModal: () => void;
  onOpenSptfDispensa?: () => void;
  onResetData: () => void;
  onClearData: () => void;
  onOpenImportRecordsModal: () => void;
  onOpenLogoModal?: () => void;
  systemConfig?: SystemConfig;
  totalEmployees: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  userMode: UserMode;
  onToggleUserMode: (mode: UserMode) => void;
  onSelectRole?: (role: AdminRole) => void;
  currentUserEmail: string;
  userRole?: AdminRole | string;
  onSignOut?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewEntry,
  onOpenQuickBatchModal,
  onOpenSptfDispensa,
  onResetData,
  onClearData,
  onOpenImportRecordsModal,
  onOpenLogoModal,
  systemConfig,
  totalEmployees,
  theme,
  onToggleTheme,
  userMode,
  onToggleUserMode,
  onSelectRole,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  onSignOut,
}) => {
  const isDark = theme === 'dark';
  const isAdmin = userMode === 'ADMIN';
  const currentRole = (userRole || 'SUPER_ADMIN') as AdminRole;
  const roleMeta = ROLE_INFO[currentRole] || ROLE_INFO.AUX_DA;
  const isAuxDA = currentRole === 'AUX_DA' || (currentRole as string) === 'AUXILIAR_DA';

  const canManageAdmins = rbacService.canManageAdmins(currentRole);
  const canManageSystem = rbacService.canManageSystemConfig(currentRole);
  const canManageBackups = currentRole === 'SUPER_ADMIN';
  const canImportFolha = rbacService.canImportFolha(currentRole);
  const canManageCanteiros = rbacService.canManageCanteiros(currentRole);
  const canViewAuditLogs = rbacService.canViewAuditLogs(currentRole);
  const canLaunchHours = rbacService.canLaunchHours(currentRole);
  const canLaunchInsalubrity = rbacService.canLaunchInsalubrity(currentRole);
  const canIssueDispensa = rbacService.canIssueDispensa(currentRole);

  // Dropdown states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={`${
      isDark ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
    } border-b sticky top-0 z-40 shadow-xs transition-colors`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* ========================================================= */}
          {/* 1. ESQUERDA: LOGOTIPO & MARCA COM CANTEIRO */}
          {/* ========================================================= */}
          <div 
            className="flex items-center space-x-3 cursor-pointer shrink-0 group select-none" 
            onClick={() => onSelectTab('dashboard')}
            title="Ir para o Dashboard Principal"
          >
            <ComaraLogo logoUrl={systemConfig?.logoUrl} size="sm" />
            <div>
              <div className="flex items-center space-x-2">
                <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  COMARA <span className="text-[#3B82F6]">SPTF</span>
                </span>
                <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded border ${
                  isDark 
                    ? 'bg-[#243756] text-blue-400 border-[#335075]' 
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  RH Cloud
                </span>
              </div>
              <p className={`text-[10px] font-mono font-medium ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                Sedes: <span className="text-[#3B82F6] font-bold">KO</span> • BE • MN
              </p>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. CENTRO: ABAS PRINCIPAIS EM GRUPO LIMPO */}
          {/* ========================================================= */}
          <nav className="hidden lg:flex items-center space-x-1 bg-transparent p-1 rounded-xl">
            {/* Aba 1: Dashboard */}
            <button
              onClick={() => onSelectTab('dashboard')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'dashboard' || activeTab === 'extrato'
                  ? isDark 
                    ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Dashboard</span>
            </button>

            {/* Aba 2: Colaboradores */}
            <button
              onClick={() => onSelectTab('colaboradores')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'colaboradores'
                  ? isDark 
                    ? 'bg-[#243756] text-white border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-blue-400" />
              <span>Colaboradores</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-normal ${
                isDark ? 'bg-[#0F1B33] text-[#94A3B8]' : 'bg-slate-200 text-slate-700'
              }`}>
                {totalEmployees}
              </span>
            </button>

            {/* Aba 3: Insalubridade (Matriz Simples & Completa) */}
            <button
              onClick={() => onSelectTab('insalubridade')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'insalubridade'
                  ? isDark 
                    ? 'bg-[#243756] text-amber-400 border border-[#335075] shadow-xs' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardHat className="w-3.5 h-3.5 text-amber-400" />
              <span>Insalubridade</span>
            </button>

            {/* Aba 4: Contracheques Digitais (Importação e Gestão) */}
            <button
              onClick={() => onSelectTab('contracheques')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'contracheques'
                  ? isDark 
                    ? 'bg-[#243756] text-emerald-400 border border-[#335075] shadow-xs' 
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 text-emerald-400" />
              <span>Contracheques</span>
            </button>

            {/* Aba 5: Dispensas & Faltas */}
            <button
              onClick={() => onSelectTab('dispensas_faltas')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'dispensas_faltas'
                  ? isDark 
                    ? 'bg-[#243756] text-blue-400 border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Dispensas & Faltas</span>
            </button>

            {/* Aba 6: Manual */}
            <button
              onClick={() => onSelectTab('arquitetura')}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'arquitetura'
                  ? isDark 
                    ? 'bg-[#243756] text-cyan-400 border border-[#335075] shadow-xs' 
                    : 'bg-blue-50 text-cyan-700 border border-cyan-200 font-bold shadow-xs'
                  : isDark 
                    ? 'text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D]' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manual</span>
            </button>
          </nav>

          {/* ========================================================= */}
          {/* 3. DIREITA: AÇÕES RÁPIDAS, ENGRENAGEM, PERFIL & LOGOFF */}
          {/* ========================================================= */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
            
            {/* BOTÃO INSTALAR APLICATIVO (PWA) */}
            <PWAInstallButton variant="navbar" theme={theme} />

            {/* ALTERNADOR DE TEMA (SOL / LUA) */}
            <button
              onClick={onToggleTheme}
              className={`p-2 rounded-xl transition-colors active:scale-[0.98] border cursor-pointer ${
                isDark 
                  ? 'bg-[#16243D] hover:bg-[#243756] text-amber-400 hover:text-amber-300 border-[#243756]' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border-slate-200'
              }`}
              title={isDark ? 'Alternar para Tema Claro' : 'Alternar para Tema Escuro'}
              aria-label="Alternar tema"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* DROPDOWN DE CONFIGURAÇÕES & LANÇAMENTOS (ÍCONE DE ENGRENAGEM ⚙️) */}
            <div className="relative" ref={settingsRef}>
              <button
                onClick={() => {
                  setIsSettingsOpen(!isSettingsOpen);
                }}
                className={`p-2 rounded-xl transition-colors active:scale-[0.98] border cursor-pointer ${
                  isSettingsOpen
                    ? isDark 
                      ? 'bg-[#243756] text-white border-blue-500/50 shadow-xs' 
                      : 'bg-slate-200 text-slate-900 border-blue-300 shadow-xs'
                    : isDark 
                      ? 'bg-[#16243D] hover:bg-[#243756] text-[#94A3B8] hover:text-white border-[#243756]' 
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border-slate-200'
                }`}
                title="Lançamentos, Configurações e Menu do Sistema"
                aria-label="Configurações e Lançamentos"
              >
                <Settings className={`w-4 h-4 transition-transform duration-200 ${isSettingsOpen ? 'rotate-45 text-[#3B82F6]' : ''}`} />
              </button>

              {/* Menu Suspenso de Configurações & Ações */}
              {isSettingsOpen && (
                <div className={`absolute right-0 mt-2 w-80 max-h-[85vh] overflow-y-auto rounded-2xl shadow-2xl border py-2 z-50 animate-in fade-in zoom-in-95 duration-150 ${
                  isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-800'
                }`}>
                  
                  {/* SEÇÃO 0: IDENTIFICAÇÃO DO USUÁRIO & SINCRONIZAÇÃO */}
                  <div className={`px-3.5 py-2.5 border-b ${isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 ${
                        currentRole === 'SUPER_ADMIN' 
                          ? 'bg-purple-600' 
                          : currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH'
                            ? 'bg-indigo-600' 
                            : currentRole === 'GERENTE_CANTEIRO'
                              ? 'bg-blue-600'
                              : currentRole.includes('CHEFE')
                                ? 'bg-amber-600'
                                : currentRole.includes('ENCARREGADO')
                                  ? 'bg-emerald-600'
                                  : 'bg-cyan-600'
                      }`}>
                        {currentRole === 'SUPER_ADMIN' ? 'TI' : currentRole === 'RH_ADMIN' || currentRole === 'GESTOR_RH' ? 'RH' : currentRole === 'AUX_DA' ? 'DA' : 'OP'}
                      </div>
                      <div className="overflow-hidden min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`font-bold text-xs truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                            {roleMeta.label}
                          </span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ${
                            isDark ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}>
                            Cloud
                          </span>
                        </div>
                        <p className={`text-[10px] font-mono truncate mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          {currentUserEmail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SEÇÃO 1: PERFIL DE ACESSO ATIVO (6 NÍVEIS) */}
                  <div className="p-2.5 border-b border-inherit">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block mb-1.5 px-1 ${
                      isDark ? 'text-[#94A3B8]' : 'text-slate-500'
                    }`}>
                      Perfil de Acesso Ativo (6 Níveis)
                    </span>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('SUPER_ADMIN');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'SUPER_ADMIN' && isAdmin
                            ? isDark ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/60 shadow-xs font-bold' : 'bg-indigo-50 text-indigo-800 border border-indigo-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="TI: Acesso total global, auditoria e configurações"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">Super Admin</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('RH_ADMIN');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'RH_ADMIN' && isAdmin
                            ? isDark ? 'bg-purple-950/60 text-purple-300 border border-purple-700/60 shadow-xs font-bold' : 'bg-purple-50 text-purple-800 border border-purple-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="RH Sede: Acesso global, folha e auditoria"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">RH Admin</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('GERENTE_CANTEIRO');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'GERENTE_CANTEIRO' && isAdmin
                            ? isDark ? 'bg-amber-950/60 text-amber-300 border border-amber-700/60 shadow-xs font-bold' : 'bg-amber-50 text-amber-800 border border-amber-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Gerente: Visualização e acompanhamento do canteiro ativo"
                      >
                        <Building2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="truncate">Gerente Cant.</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('CHEFE_CANTEIRO');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'CHEFE_CANTEIRO' && isAdmin
                            ? isDark ? 'bg-blue-950/60 text-blue-300 border border-blue-700/60 shadow-xs font-bold' : 'bg-blue-50 text-blue-800 border border-blue-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Chefe / Encarregado: Operacional de campo, lançamentos e dispensas"
                      >
                        <HardHat className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">Chefe Canteiro</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('CHEFE_DA');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'CHEFE_DA' && isAdmin
                            ? isDark ? 'bg-teal-950/60 text-teal-300 border border-teal-700/60 shadow-xs font-bold' : 'bg-teal-50 text-teal-800 border border-teal-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Chefe DA: Gestão administrativa e auditoria local"
                      >
                        <HardHat className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                        <span className="truncate">Chefe DA</span>
                      </button>

                      <button
                        onClick={() => {
                          onToggleUserMode('ADMIN');
                          if (onSelectRole) onSelectRole('AUX_DA');
                        }}
                        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          currentRole === 'AUX_DA' && isAdmin
                            ? isDark ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-700/60 shadow-xs font-bold' : 'bg-cyan-50 text-cyan-800 border border-cyan-300 shadow-xs font-bold'
                            : isDark ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-white border border-[#243756]' : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200'
                        }`}
                        title="Auxiliar DA: Tela restrita de campo para lançamentos e dispensas"
                      >
                        <HardHat className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">Auxiliar DA</span>
                      </button>
                    </div>
                  </div>
                  
                  {/* SEÇÃO 2: LANÇAMENTOS E OPERAÇÕES RÁPIDAS */}
                  <div className={`px-3.5 py-1.5 border-b text-[10px] uppercase font-bold tracking-wider flex items-center justify-between ${
                    isDark ? 'border-[#243756] text-blue-400 bg-blue-950/20' : 'border-slate-100 text-blue-600 bg-blue-50/50'
                  }`}>
                    <span>Lançamentos & Operações</span>
                    <Plus className="w-3.5 h-3.5" />
                  </div>

                  <div className="p-1 space-y-0.5">
                    {/* 1.1 Lançamento de Horas em Lote / Rápido */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenQuickBatchModal();
                      }}
                      className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-blue-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 mt-0.5">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span>Lançamento de Horas</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                          }`}>
                            Lote / Rápido
                          </span>
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Horas extras, trabalhos e faltas para múltiplos colaboradores
                        </p>
                      </div>
                    </button>

                    {/* 1.2 Lançamento Individual de Horas */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenNewEntry();
                      }}
                      className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-cyan-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20 mt-0.5">
                        <CalendarCheck2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Lançamento Individual (Horas)</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            Diário
                          </span>
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Lançamento único com anexo de atestado/comprovante
                        </p>
                      </div>
                    </button>

                    {/* 1.3 Nova Dispensa de SPTF */}
                    {onOpenSptfDispensa && (
                      <button
                        id="btn-nav-nova-dispensa-sptf"
                        onClick={() => {
                          setIsSettingsOpen(false);
                          onOpenSptfDispensa();
                        }}
                        className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors active:scale-[0.98] cursor-pointer ${
                          isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-emerald-50/70 text-slate-800'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20 mt-0.5">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold flex items-center justify-between">
                            <span>Nova Dispensa de SPTF</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                              isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              2 Vias A4
                            </span>
                          </div>
                          <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                            Emissão de guia com débito automático no banco
                          </p>
                        </div>
                      </button>
                    )}

                    {/* 1.4 Lançamento de Insalubridade */}
                    <button
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onSelectTab('insalubridade');
                      }}
                      className={`w-full px-3 py-2 text-xs text-left flex items-start gap-2.5 rounded-xl transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-amber-50/70 text-slate-800'
                      }`}
                    >
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20 mt-0.5">
                        <HardHat className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold flex items-center justify-between">
                          <span>Lançamento de Insalubridade</span>
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                          }`}>
                            NR-15
                          </span>
                        </div>
                        <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Planilha mensal de efetivo, atividades e auditoria técnica
                        </p>
                      </div>
                    </button>
                  </div>

                  {/* SEÇÃO 2: GESTÃO & SISTEMA */}
                  <div className={`mt-2 px-3.5 py-1.5 border-y text-[10px] uppercase font-bold tracking-wider ${
                    isDark ? 'border-[#243756] text-[#94A3B8] bg-[#0F1B33]' : 'border-slate-100 text-slate-500 bg-slate-50'
                  }`}>
                    Gestão & Sistema
                  </div>

                  {/* 2.1 Canteiros de Obras */}
                  {canManageCanteiros && (
                    <button
                      onClick={() => {
                        onSelectTab('canteiros');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        activeTab === 'canteiros'
                          ? isDark ? 'bg-amber-950/30 text-amber-300' : 'bg-amber-50 text-amber-800'
                          : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Canteiros de Obras</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Cadastro de sedes, chefias e equipes
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.2 Relatórios */}
                  <button
                    onClick={() => {
                      onSelectTab('relatorios');
                      setIsSettingsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                      activeTab === 'relatorios'
                        ? isDark ? 'bg-indigo-950/30 text-indigo-300' : 'bg-indigo-50 text-indigo-800'
                        : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Relatórios</div>
                      <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Extratos, auditoria e exportação
                      </span>
                    </div>
                  </button>

                  {/* 2.2.1 Consulta de Dispensas e Faltas */}
                  <button
                    onClick={() => {
                      onSelectTab('dispensas_faltas');
                      setIsSettingsOpen(false);
                    }}
                    className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                      activeTab === 'dispensas_faltas'
                        ? isDark ? 'bg-blue-950/40 text-blue-300' : 'bg-blue-50 text-blue-800 font-bold'
                        : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                      <FileCheck className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold">Dispensas & Faltas</div>
                      <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Consulta mensal de guias emitidas e ausências
                      </span>
                    </div>
                  </button>

                  {/* 2.3 Configurações da Instituição - SUPER_ADMIN */}
                  {canManageSystem && (
                    <button
                      onClick={() => {
                        onSelectTab('configuracoes_instituicao');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        activeTab === 'configuracoes_instituicao'
                          ? isDark ? 'bg-blue-950/40 text-blue-300' : 'bg-blue-50 text-blue-800 font-bold'
                          : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <Building className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Configurações da OM</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-300">
                            SUPER ADMIN
                          </span>
                        </div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          OM, cargos, sedes e modelos
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.4 Backup e Restauração - SUPER_ADMIN */}
                  {canManageBackups && (
                    <button
                      onClick={() => {
                        onSelectTab('backup_restauracao');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        activeTab === 'backup_restauracao'
                          ? isDark ? 'bg-cyan-950/30 text-cyan-300' : 'bg-cyan-50 text-cyan-800'
                          : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <DatabaseBackup className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Backup e Restauração</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-cyan-500/20 text-cyan-300">SUPER ADMIN</span>
                        </div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Exportar e restaurar a base Firestore</span>
                      </div>
                    </button>
                  )}

                  {/* 2.5 Configurações do Sistema (Logo & Modo Insalubridade) */}
                  {canManageSystem && onOpenLogoModal && (
                    <button
                      onClick={() => {
                        onOpenLogoModal();
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
                        <Settings className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Configurações do Sistema</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Logo COMARA e modo de insalubridade
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.6 Gestão de Acessos & Permissões */}
                  {canManageAdmins && (
                    <button
                      onClick={() => {
                        onSelectTab('permissoes_admin');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        activeTab === 'permissoes_admin'
                          ? isDark ? 'bg-purple-950/30 text-purple-300' : 'bg-purple-50 text-purple-800'
                          : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Gestão de Acessos (RBAC)</span>
                          {!isAdmin && <Lock className="w-3 h-3 text-amber-400" />}
                        </div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Controle de permissões e administradores
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.7 Auditoria & Logs de Segurança */}
                  {canViewAuditLogs && (
                    <button
                      onClick={() => {
                        onSelectTab('auditoria');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        activeTab === 'auditoria'
                          ? isDark ? 'bg-indigo-950/30 text-indigo-300' : 'bg-indigo-50 text-indigo-800'
                          : isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold flex items-center justify-between">
                          <span>Trilha de Auditoria & Logs</span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-indigo-500/20 text-indigo-300">
                            LGPD
                          </span>
                        </div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Logs imutáveis de segurança e operações
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.8 Instalar Aplicativo (PWA) MenuItem */}
                  <PWAInstallButton variant="menu-item" theme={theme} />

                  {(canImportFolha || canManageSystem) && <div className={`my-1 border-t ${isDark ? 'border-[#243756]' : 'border-slate-100'}`} />}

                  {/* 2.9 Importar Lançamentos (CSV) */}
                  {canImportFolha && (
                    <button
                      onClick={() => {
                        onOpenImportRecordsModal();
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                        <UploadCloud className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Importar Lançamentos (CSV)</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Carga de histórico do banco de horas
                        </span>
                      </div>
                    </button>
                  )}

                  {/* 2.10 Gerenciar/Importar Colaboradores */}
                  {canImportFolha && (
                    <button
                      onClick={() => {
                        onSelectTab('colaboradores');
                        setIsSettingsOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold">Importar Pessoas (CSV)</div>
                        <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Cadastro em massa de funcionários
                        </span>
                      </div>
                    </button>
                  )}

                  {canManageSystem && (
                    <>
                      <div className={`my-1 border-t ${isDark ? 'border-[#243756]' : 'border-slate-100'}`} />

                      {/* 2.11 Zerar Base de Dados para Importação Real */}
                      <button
                        onClick={() => {
                          onClearData();
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                          isDark ? 'hover:bg-[#243756] text-rose-300' : 'hover:bg-rose-50 text-rose-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 border border-rose-500/20">
                          <Trash2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-rose-500 dark:text-rose-400">Zerar Base para Produção</div>
                          <span className={`text-[10px] block opacity-80`}>
                            Limpar dados operacionais para iniciar produção real
                          </span>
                        </div>
                      </button>

                      {/* 2.12 Modo Treinamento (Seed Oficial) */}
                      <button
                        onClick={() => {
                          onResetData();
                          setIsSettingsOpen(false);
                        }}
                        className={`w-full px-3.5 py-2 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
                          isDark ? 'hover:bg-[#243756] text-indigo-300' : 'hover:bg-indigo-50 text-indigo-700'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-indigo-400">Modo Treinamento (Seed)</div>
                          <span className={`text-[10px] block opacity-80`}>
                            Carregar canteiros, colaboradores e simulação oficial
                          </span>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* BOTÃO DEDICADO DE LOGOFF (APENAS ÍCONE DE SAÍDA) */}
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className={`p-2 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${
                  isDark 
                    ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40 shadow-xs' 
                    : 'bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border-red-200 shadow-xs'
                }`}
                title="Encerrar Sessão (Sair)"
                aria-label="Encerrar Sessão (Sair)"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}

          </div>
        </div>
      </div>

      {/* Navegação Mobile Compacta */}
      <div className={`md:hidden flex items-center justify-around border-t ${
        isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
      } px-2 py-1.5 text-xs overflow-x-auto`}>
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'dashboard' || activeTab === 'extrato'
              ? isDark ? 'text-blue-400 font-bold bg-[#243756]' : 'text-blue-700 font-bold bg-blue-50'
              : isDark ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => onSelectTab('colaboradores')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium flex items-center gap-1 ${
            activeTab === 'colaboradores'
              ? isDark ? 'text-blue-400 font-bold bg-[#243756]' : 'text-blue-700 font-bold bg-blue-50'
              : isDark ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          <span>Pessoas</span>
        </button>
        <button
          onClick={() => onSelectTab('insalubridade')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'insalubridade'
              ? isDark ? 'text-amber-400 font-bold bg-[#243756]' : 'text-amber-700 font-bold bg-amber-50'
              : isDark ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Insalubridade
        </button>
        <button
          onClick={() => onSelectTab('arquitetura')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap font-medium ${
            activeTab === 'arquitetura'
              ? isDark ? 'text-cyan-400 font-bold bg-[#243756]' : 'text-cyan-700 font-bold bg-cyan-50'
              : isDark ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Manual
        </button>
      </div>
    </header>
  );
};
