import React, { useState, useMemo } from 'react';
import { Employee, TimeRecord, Attachment, InsalubrityRecord, PaystubRecord } from '../types';
import { authService } from '../services/authService';
import { cleanCPF } from '../utils/lgpdUtils';
import { ComaraLogo } from './ComaraLogo';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { InfoTooltip } from './InfoTooltip';
import { ContrachequeMirrorView } from './ContrachequeMirrorView';
import { SessionTimeoutModal } from './SessionTimeoutModal';
import { LgpdConsentBanner } from './LgpdConsentBanner';
import { PWAInstallButton } from './PWAInstallButton';
import { useIdleTimer } from '../hooks/useIdleTimer';
import { 
  ShieldCheck, 
  Lock, 
  User, 
  Key, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  FileText, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Printer, 
  LogOut, 
  Sun, 
  Moon, 
  HelpCircle, 
  Building2, 
  Sparkles, 
  Mail, 
  Info, 
  ShieldAlert, 
  ArrowLeft,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Biohazard,
  Shield,
  Receipt,
  X
} from 'lucide-react';

interface CollaboratorLandingViewProps {
  employees: Employee[];
  records: TimeRecord[];
  insalubrityRecords?: InsalubrityRecord[];
  paystubs?: PaystubRecord[];
  onOpenAdminLogin: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onViewAttachment?: (attachment: Attachment, empName?: string, recordDate?: string) => void;
}

export const CollaboratorLandingView: React.FC<CollaboratorLandingViewProps> = ({
  employees,
  records,
  insalubrityRecords = [],
  paystubs = [],
  onOpenAdminLogin,
  theme,
  onToggleTheme,
  onViewAttachment,
}) => {
  const isDark = theme === 'dark';

  // Login form state
  const [matriculaInput, setMatriculaInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Authenticated Employee State
  const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);
  const [collaboratorTab, setCollaboratorTab] = useState<'EXTRATO' | 'CONTRACHEQUE'>('EXTRATO');
  const [selectedPaystubId, setSelectedPaystubId] = useState<string>('');

  // Modal: First Access / Reset Password State (100% Firestore)
  const [isFirstAccessModalOpen, setIsFirstAccessModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Filter for date range on authenticated employee statement
  const [periodFilter, setPeriodFilter] = useState<'ALL' | '30D' | '90D' | '180D'>('ALL');
  const [isMobileRecordsOpen, setIsMobileRecordsOpen] = useState(false);

  const formatCPF = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  };

  // Handle Login Authentication (Matrícula ou CPF)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const rawInput = matriculaInput.trim();
    if (!rawInput) {
      setErrorMessage('Por favor, informe sua Matrícula ou CPF.');
      return;
    }

    if (!passwordInput.trim()) {
      setErrorMessage('Digite sua senha de acesso cadastrada.');
      return;
    }

    setIsLoading(true);

    const cleanInput = rawInput.toUpperCase();
    const cleanDigits = cleanCPF(rawInput);

    // Locate employee in the central database by Matrícula or CPF
    const matchedEmployee = employees.find((emp) => {
      const empMat = emp.matricula.trim().toUpperCase();
      const empMatNoZero = empMat.replace(/^0+/, '');
      const cleanEmpDigits = cleanCPF(emp.cpf);

      // Match por Matrícula
      if (empMat === cleanInput || empMatNoZero === cleanInput.replace(/^0+/, '')) {
        return true;
      }

      // Match por CPF
      if (cleanDigits && cleanDigits.length >= 9 && cleanEmpDigits && (cleanEmpDigits === cleanDigits || cleanEmpDigits.endsWith(cleanDigits))) {
        return true;
      }

      return false;
    });

    if (!matchedEmployee) {
      setIsLoading(false);
      setErrorMessage(`Cadastro não localizado para "${rawInput}". Verifique a matrícula ou CPF digitado.`);
      return;
    }

    // Verify Password & Access
    try {
      const verifyRes = await authService.verifyEmployeePassword(
        matchedEmployee.matricula,
        passwordInput,
        matchedEmployee
      );

      if (verifyRes.success) {
        setAuthenticatedEmployee(matchedEmployee);
        setSuccessMessage(`Bem-vindo(a), ${matchedEmployee.nome}! Consulta autorizada.`);
        setPasswordInput('');
      } else {
        setErrorMessage(verifyRes.message);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Ocorreu um erro ao validar sua senha. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Open First Access / Password Reset Modal (100% Firestore)
  const handleOpenFirstAccess = () => {
    setIsFirstAccessModalOpen(true);
  };

  // Log Out from Employee Statement
  const handleEmployeeLogout = (inactivity: boolean = false) => {
    setAuthenticatedEmployee(null);
    setMatriculaInput('');
    setPasswordInput('');
    if (inactivity) {
      setErrorMessage('Sessão finalizada por inatividade. Faça login novamente.');
    } else {
      setErrorMessage(null);
    }
    setSuccessMessage(null);
  };

  // Monitor de Inatividade do Colaborador (15 minutos no Canteiro / Terminal)
  const {
    isWarning: isIdleWarning,
    remainingSeconds: idleRemainingSeconds,
    profileLabel: idleProfileLabel,
    resetTimer: resetIdleTimer,
    forceTimeout: forceIdleTimeout,
  } = useIdleTimer({
    enabled: !!authenticatedEmployee,
    role: 'AUX_DA',
    warnSeconds: 60,
    onTimeout: () => handleEmployeeLogout(true),
  });

  // Calculate Balance & Records for Authenticated Employee
  const employeeData = useMemo(() => {
    if (!authenticatedEmployee) return null;

    const empMat = authenticatedEmployee.matricula.trim().toUpperCase();
    const empRecords = records.filter(
      (r) => r.matricula.trim().toUpperCase() === empMat ||
             r.matricula.replace(/^0+/, '').toUpperCase() === empMat.replace(/^0+/, '')
    );

    // Filter by period
    const now = new Date();
    const filteredRecords = empRecords.filter((rec) => {
      if (periodFilter === 'ALL') return true;
      const recDate = new Date(rec.dataRegistro);
      const diffDays = (now.getTime() - recDate.getTime()) / (1000 * 3600 * 24);
      if (periodFilter === '30D') return diffDays <= 30;
      if (periodFilter === '90D') return diffDays <= 90;
      if (periodFilter === '180D') return diffDays <= 180;
      return true;
    }).sort((a, b) => b.dataRegistro.localeCompare(a.dataRegistro));

    // Calculate metrics
    const saldoInicial = authenticatedEmployee.saldoInicialHoras || 0;
    const somaLancamentos = empRecords.reduce((acc, curr) => acc + (curr.saldoCalculado || 0), 0);
    const saldoTotalHoras = saldoInicial + somaLancamentos;
    const saldoTotalDias = (saldoTotalHoras / 8).toFixed(1);

    const totalCreditos = empRecords
      .filter((r) => r.saldoCalculado > 0)
      .reduce((acc, curr) => acc + curr.saldoCalculado, 0);

    const totalDebitos = empRecords
      .filter((r) => r.saldoCalculado < 0)
      .reduce((acc, curr) => acc + Math.abs(curr.saldoCalculado), 0);

    const totalAtestados = empRecords.filter((r) => r.tipoOcorrencia === 'ATESTADO_MEDICO').length;

    // Colaborador Insalubridade Records
    const collabInsalubrities = insalubrityRecords.filter(
      (ins) => ins.matricula.trim().toUpperCase() === empMat ||
               ins.matricula.replace(/^0+/, '').toUpperCase() === empMat.replace(/^0+/, '')
    );

    // Status: POSITIVO, NEGATIVO, ZERADO
    const statusSaldo: 'POSITIVO' | 'NEGATIVO' | 'ZERADO' = 
      saldoTotalHoras > 0.05 ? 'POSITIVO' : saldoTotalHoras < -0.05 ? 'NEGATIVO' : 'ZERADO';

    return {
      records: filteredRecords,
      allRecordsCount: empRecords.length,
      saldoInicial,
      saldoTotalHoras,
      saldoTotalDias,
      totalCreditos,
      totalDebitos,
      totalAtestados,
      collabInsalubrities,
      statusSaldo,
    };
  }, [authenticatedEmployee, records, insalubrityRecords, periodFilter]);

  // Contracheques exclusivos do servidor autenticado (LGPD)
  const myPaystubs = useMemo(() => {
    if (!authenticatedEmployee) return [];
    const empMat = authenticatedEmployee.matricula.trim().toUpperCase();
    return paystubs
      .filter((p) => {
        const pMat = p.matricula.trim().toUpperCase();
        return pMat === empMat || pMat.replace(/^0+/, '') === empMat.replace(/^0+/, '');
      })
      .sort((a, b) => (b.mesAno || '').localeCompare(a.mesAno || ''));
  }, [authenticatedEmployee, paystubs]);

  const currentPaystub = useMemo(() => {
    if (myPaystubs.length === 0) return null;
    if (selectedPaystubId) {
      const found = myPaystubs.find(p => p.id === selectedPaystubId);
      if (found) return found;
    }
    return myPaystubs[0];
  }, [myPaystubs, selectedPaystubId]);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0B1426] text-[#E2E8F0]' : 'bg-[#F1F5F9] text-slate-900'} flex flex-col font-sans transition-colors`}>
      
      {/* ------------------------------------------------------------- */}
      {/* CABEÇALHO COMPACTO COM BOTÃO DISCRETO DE ACESSO GESTÃO RH    */}
      {/* ------------------------------------------------------------- */}
      <header className={`hidden sm:flex py-2.5 sm:py-3.5 px-4 sm:px-8 border-b items-center justify-between transition-all ${
        isDark ? 'bg-[#11203A] border-[#233654]' : 'bg-white border-slate-200 shadow-xs'
      }`}>
        <div className="flex items-center space-x-2.5 sm:space-x-3">
          <ComaraLogo size="sm" />
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-black text-xs sm:text-base tracking-tight">COMARA</span>
              <span className={`text-[9px] sm:text-[10px] font-mono px-1.5 sm:px-2 py-0.5 rounded-full font-bold uppercase ${
                isDark ? 'bg-blue-950/60 text-blue-400 border border-blue-800/50' : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                Autoatendimento SPTF
              </span>
            </div>
            <p className={`text-[10px] sm:text-[11px] font-medium hidden sm:block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Portal do Colaborador • Consulta Segura de Banco de Horas
            </p>
          </div>
        </div>

        {/* Top Right: PWA Install, Theme Toggle & Discrete Admin Access Button */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5">
          <PWAInstallButton variant="navbar" theme={theme} />

          <button
            type="button"
            onClick={onToggleTheme}
            className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl border transition-colors active:scale-[0.98] cursor-pointer ${
              isDark 
                ? 'bg-[#1B2D4A] border-[#335075] text-amber-400 hover:text-amber-300' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
            title="Alternar Tema Visual"
            aria-label="Alternar Tema Visual"
          >
            {isDark ? <Sun className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Moon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          </button>

          {/* Botão Discreto de Acesso Administrativo/Gestão */}
          <button
            type="button"
            onClick={onOpenAdminLogin}
            className={`flex items-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-semibold transition-all active:scale-[0.98] cursor-pointer ${
              isDark 
                ? 'text-gray-400 hover:text-blue-300 hover:bg-blue-950/40 border border-transparent hover:border-blue-900/40' 
                : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/60 border border-transparent hover:border-blue-200'
            }`}
            title="Acesso exclusivo para Gestores e RH"
          >
            <Key className="w-3.5 h-3.5 text-blue-500/80" />
            <span className="hidden sm:inline">Acesso Gestão</span>
            <span className="sm:hidden text-[10px]">Gestor</span>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* CONTEÚDO PRINCIPAL CENTRALIZADO */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 lg:p-10 w-full max-w-6xl mx-auto">
        
        {/* ========================================================= */}
        {/* VIEW 1: FORMULÁRIO CENTRAL DE CONSULTA (NÃO AUTENTICADO)  */}
        {/* ========================================================= */}
        {!authenticatedEmployee ? (
          <div className="w-full max-w-lg space-y-4 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
            
            {/* Banner de Boas-Vindas com Brasão Oficial da COMARA */}
            <div className="text-center space-y-2 sm:space-y-3">
              <div className="flex justify-center">
                <ComaraLogo size="xl" />
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>COMARA Comissão de Aeroportos da Região Amazônica</span>
              </div>
              <h1 className="text-xl sm:text-3xl font-extrabold tracking-tight">
                Consulte seu Banco de Horas
              </h1>
              <p className={`text-xs sm:text-sm ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Informe seu CPF ou matrícula e senha cadastrada para visualizar seu saldo e extrato individual.
              </p>
            </div>

            {/* Card Central de Login */}
            <div className={`p-5 sm:p-8 rounded-2xl sm:rounded-3xl border shadow-xl transition-all ${
              isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'
            }`}>
              
              <form onSubmit={handleLogin} className="space-y-4 sm:space-y-5">
                
                {/* Feedback Messages */}
                {errorMessage && (
                  <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                    <div className="flex-1">
                      <span>{errorMessage}</span>
                      {errorMessage.includes('Primeiro acesso') && (
                        <button
                          type="button"
                          onClick={handleOpenFirstAccess}
                          className="block mt-1.5 font-bold underline hover:text-red-300 cursor-pointer"
                        >
                          Criar senha agora →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {successMessage && (
                  <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{successMessage}</span>
                  </div>
                )}

                {/* Campo CPF / Matrícula */}
                <div className="space-y-1.5">
                  <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-[#CBD5E1]' : 'text-slate-700'}`}>
                    CPF ou Matrícula do Colaborador
                  </label>
                  <div className="relative">
                    <User className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={matriculaInput}
                      onChange={(e) => setMatriculaInput(e.target.value.toUpperCase())}
                      placeholder="Digite seu CPF ou Matrícula"
                      required
                      className={`w-full pl-10 pr-4 py-3 rounded-xl text-sm font-bold tracking-wider uppercase border transition-all outline-none ${
                        isDark 
                          ? 'bg-[#0F1B33] border-[#2A4063] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
                      }`}
                    />
                  </div>
                </div>

                {/* Campo Senha */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className={`block text-xs font-bold uppercase tracking-wider ${isDark ? 'text-[#CBD5E1]' : 'text-slate-700'}`}>
                      Senha de Acesso
                    </label>
                    <button
                      type="button"
                      onClick={handleOpenFirstAccess}
                      className="text-[11px] font-semibold text-blue-500 hover:text-blue-400 transition-colors active:scale-[0.98] cursor-pointer"
                    >
                      Esqueceu ou 1º Acesso?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="••••••••"
                      required
                      className={`w-full pl-10 pr-11 py-3 rounded-xl text-sm border transition-all outline-none ${
                        isDark 
                          ? 'bg-[#0F1B33] border-[#2A4063] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                          : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-xs cursor-pointer ${
                        isDark ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botão Principal de Consulta */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.99] transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Consultar Extrato & Saldo</span>
                    </>
                  )}
                </button>

                {/* Link de Primeiro Acesso em Destaque */}
                <div className={`pt-3 border-t text-center ${isDark ? 'border-[#2A4063]' : 'border-slate-100'}`}>
                  <button
                    type="button"
                    onClick={handleOpenFirstAccess}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                      isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                    } cursor-pointer transition-all active:scale-[0.98]`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Primeiro Acesso? Crie sua senha de segurança aqui</span>
                  </button>
                </div>

              </form>

            </div>

            {/* No Mobile: Botão/Ícone Compacto com Instruções LGPD & Regras SPTF */}
            <div className="flex sm:hidden justify-center pt-1">
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(true)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-[0.98] cursor-pointer shadow-xs ${
                  isDark 
                    ? 'bg-[#11203A]/90 border-[#233654] text-slate-300 hover:text-white hover:border-blue-500/50' 
                    : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Privacidade, LGPD & Regras SPTF</span>
                <Info className="w-3 h-3 text-blue-400" />
              </button>
            </div>

            {/* No Desktop: Rodapé Informativo de Segurança com Link para Detalhes */}
            <div className={`hidden sm:block p-3.5 sm:p-4 rounded-xl sm:rounded-2xl border text-center text-xs space-y-1 ${
              isDark ? 'bg-[#11203A]/60 border-[#233654] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              <div className="flex items-center justify-center gap-1.5 font-semibold text-[11px]">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>Privacidade Garantida • Visualização Restrita ao Próprio Colaborador</span>
                <button
                  type="button"
                  onClick={() => setIsPrivacyModalOpen(true)}
                  className="ml-1 text-blue-500 hover:text-blue-400 hover:underline inline-flex items-center gap-0.5 cursor-pointer font-bold"
                >
                  <Info className="w-3 h-3" />
                  <span>Saiba mais</span>
                </button>
              </div>
              <p className="text-[10px]">
                Regras SPTF com multiplicadores automáticos (1.0x Seg-Sex, 1.5x Sáb, 2.0x Dom/Fer, -8h Faltas).
              </p>
            </div>

          </div>
        ) : (
          
          /* ========================================================= */
          /* VIEW 2: EXTRATO DO COLABORADOR COM FEEDBACK DE CORES      */
          /* ========================================================= */
          employeeData && (
            <div className="w-full space-y-6 animate-in fade-in duration-300">
              
              {/* Barra de Topo do Colaborador: Botão de Sair */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEmployeeLogout()}
                    className={`flex items-center gap-2 py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] cursor-pointer ${
                      isDark ? 'bg-[#16243D] border-[#2A4063] text-gray-300 hover:text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Encerrar Consulta</span>
                  </button>
                  <span className={`text-xs font-mono hidden sm:inline ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    Matrícula: <strong>{authenticatedEmployee.matricula}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] cursor-pointer ${
                      isDark ? 'bg-[#243756] border-[#335075] text-blue-400 hover:text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Imprimir Extrato</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleEmployeeLogout()}
                    className="flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-red-600/90 hover:bg-red-600 text-white transition-all active:scale-[0.98] cursor-pointer shadow-sm"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair</span>
                  </button>
                </div>
              </div>

              {/* Seletor de Sub-Abas do Colaborador: Extrato vs Contracheque */}
              <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3 print:hidden">
                <button
                  type="button"
                  onClick={() => setCollaboratorTab('EXTRATO')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    collaboratorTab === 'EXTRATO'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                      : isDark ? 'bg-[#16243D] hover:bg-[#233654] text-gray-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  <span>Banco de Horas & Insalubridade</span>
                </button>

                <button
                  type="button"
                  onClick={() => setCollaboratorTab('CONTRACHEQUE')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                    collaboratorTab === 'CONTRACHEQUE'
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/20'
                      : isDark ? 'bg-[#16243D] hover:bg-[#233654] text-gray-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Receipt className="w-4 h-4 text-emerald-400" />
                  <span>Meu Contracheque Digital (Oficial)</span>
                  {myPaystubs.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono">
                      {myPaystubs.length}
                    </span>
                  )}
                </button>
              </div>

              {/* RENDERIZAÇÃO: CONTRACHEQUE DIGITAL */}
              {collaboratorTab === 'CONTRACHEQUE' && (
                <div className="space-y-6">
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
                    isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-blue-500" />
                      <div>
                        <h4 className="font-bold text-sm">Demonstrativo de Pagamento Oficial</h4>
                        <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                          Documentos liberados para a matrícula {authenticatedEmployee.matricula}
                        </p>
                      </div>
                    </div>

                    {myPaystubs.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">Competência:</span>
                        <select
                          value={currentPaystub?.id || ''}
                          onChange={(e) => setSelectedPaystubId(e.target.value)}
                          className={`py-2 px-3.5 rounded-xl text-xs font-bold font-mono border ${
                            isDark ? 'bg-[#0F1B33] border-[#2A4063] text-white' : 'bg-white border-slate-300 text-slate-900'
                          }`}
                        >
                          {myPaystubs.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.periodo || p.mesAno} — Líquido: R$ {(p.valorLiquido || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <span className="text-xs text-amber-400 font-semibold">
                        Nenhum contracheque localizado no momento.
                      </span>
                    )}
                  </div>

                  {currentPaystub ? (
                    <ContrachequeMirrorView
                      paystub={currentPaystub}
                      theme={theme}
                    />
                  ) : (
                    <div className={`p-12 rounded-2xl border text-center ${
                      isDark ? 'bg-[#16243D] border-[#2A4063] text-gray-400' : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                      <Receipt className="w-12 h-12 text-slate-500 mx-auto mb-3 stroke-1" />
                      <h5 className="font-bold text-base text-gray-200 mb-1">Nenhum Contracheque Disponível</h5>
                      <p className="text-xs max-w-md mx-auto">
                        O arquivo de folha de pagamento ainda não foi importado pelo setor de RH da COMARA para sua matrícula ({authenticatedEmployee.matricula}).
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* RENDERIZAÇÃO: BANCO DE HORAS & INSALUBRIDADE */}
              {collaboratorTab === 'EXTRATO' && (
                <div className="space-y-6">

              {/* --------------------------------------------------- */}
              {/* CARTÃO DIGITAL DE SALDO DO COLABORADOR              */}
              {/* VERDE (> 0h) | VERMELHO (< 0h) | NEUTRO/AZUL (= 0h) */}
              {/* --------------------------------------------------- */}
              <div className={`p-6 sm:p-8 rounded-3xl border-2 shadow-2xl transition-all relative overflow-hidden ${
                employeeData.statusSaldo === 'POSITIVO'
                  ? isDark 
                    ? 'bg-gradient-to-br from-[#062414] via-[#0b331f] to-[#16243D] border-emerald-500/60 text-white shadow-emerald-950/40' 
                    : 'bg-gradient-to-br from-emerald-50 via-teal-50 to-white border-emerald-500 text-emerald-950 shadow-emerald-200/50'
                  : employeeData.statusSaldo === 'NEGATIVO'
                  ? isDark 
                    ? 'bg-gradient-to-br from-[#2b0808] via-[#3d0f0f] to-[#16243D] border-red-500/60 text-white shadow-red-950/40' 
                    : 'bg-gradient-to-br from-red-50 via-rose-50 to-white border-red-500 text-red-950 shadow-red-200/50'
                  : isDark 
                    ? 'bg-gradient-to-br from-[#0c1a2e] via-[#11233d] to-[#16243D] border-blue-500/50 text-white shadow-blue-950/30' 
                    : 'bg-gradient-to-br from-blue-50 via-slate-50 to-white border-blue-400 text-slate-900 shadow-slate-200/50'
              }`}>
                
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  
                  {/* Informações do Colaborador */}
                  <div className="flex items-center gap-4">
                    {authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl ? (
                      <img
                        src={authenticatedEmployee.url_foto_perfil || authenticatedEmployee.avatarUrl}
                        alt={authenticatedEmployee.nome}
                        className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-md shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-black/20 border-2 border-white/20 flex items-center justify-center font-extrabold text-xl sm:text-2xl shrink-0">
                        {authenticatedEmployee.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-lg sm:text-2xl truncate">
                          {authenticatedEmployee.nome}
                        </span>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border shrink-0 ${
                          authenticatedEmployee.status === 'Ativo'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        }`}>
                          {authenticatedEmployee.status}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs opacity-90 font-medium mt-1.5">
                        <span>Matrícula: <strong>#{authenticatedEmployee.matricula}</strong></span>
                        <span>•</span>
                        <span>Função: <strong>{authenticatedEmployee.funcao || authenticatedEmployee.cargo}</strong></span>
                        <span>•</span>
                        <span>Sede: <strong>{authenticatedEmployee.sede_atual || authenticatedEmployee.sede}</strong></span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1 font-bold text-amber-300">
                          <Biohazard className="w-3.5 h-3.5" />
                          <span>Insalubridade: {authenticatedEmployee.grauInsalubridadeFixa ? `${authenticatedEmployee.grauInsalubridadeFixa} (NR-15)` : 'Não Aplicável / 0%'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback de Saldo em Grande Destaque */}
                  <div className={`p-5 sm:p-6 rounded-2xl border flex flex-col items-center md:items-end justify-center min-w-[220px] ${
                    employeeData.statusSaldo === 'POSITIVO'
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-400'
                      : employeeData.statusSaldo === 'NEGATIVO'
                      ? 'bg-red-950/50 border-red-500/60 text-red-400'
                      : 'bg-blue-950/50 border-blue-500/50 text-blue-300'
                  }`}>
                    <span className="text-[11px] uppercase font-bold tracking-wider opacity-90">
                      Saldo Total Consolidado
                    </span>
                    
                    <div className="flex items-baseline gap-1 my-1">
                      {employeeData.statusSaldo === 'POSITIVO' ? (
                        <TrendingUp className="w-7 h-7 mr-1" />
                      ) : employeeData.statusSaldo === 'NEGATIVO' ? (
                        <TrendingDown className="w-7 h-7 mr-1" />
                      ) : (
                        <Clock className="w-7 h-7 mr-1" />
                      )}
                      <span className="text-4xl sm:text-5xl font-black font-mono tracking-tight">
                        {employeeData.saldoTotalHoras > 0 ? `+${employeeData.saldoTotalHoras.toFixed(1)}` : employeeData.saldoTotalHoras.toFixed(1)}h
                      </span>
                    </div>

                    <div className="text-xs font-bold opacity-90">
                      Equivalente a <strong>{employeeData.saldoTotalDias} dias</strong> (Base 8h)
                    </div>

                    <span className={`mt-2.5 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wide ${
                      employeeData.statusSaldo === 'POSITIVO'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                        : employeeData.statusSaldo === 'NEGATIVO'
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/30 animate-pulse'
                        : 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
                    }`}>
                      {employeeData.statusSaldo === 'POSITIVO'
                        ? '✔ Saldo Positivo (Crédito a Compensar)'
                        : employeeData.statusSaldo === 'NEGATIVO'
                        ? '⚠ Saldo Negativo (Débito a Liquidar)'
                        : '✔ Banco de Horas Regularizado'}
                    </span>
                  </div>

                </div>

              </div>

              {/* --------------------------------------------------- */}
              {/* CARDS DE RESUMO DE MÉTRICAS                         */}
              {/* --------------------------------------------------- */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3.5 sm:p-4 rounded-2xl border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Créditos Extras</span>
                  <div className="text-lg sm:text-xl font-bold text-emerald-500 mt-1 font-mono">
                    +{employeeData.totalCreditos.toFixed(1)}h
                  </div>
                </div>

                <div className={`p-3.5 sm:p-4 rounded-2xl border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Débitos / Faltas</span>
                  <div className="text-lg sm:text-xl font-bold text-red-500 mt-1 font-mono">
                    -{employeeData.totalDebitos.toFixed(1)}h
                  </div>
                </div>

                <div className={`p-3.5 sm:p-4 rounded-2xl border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Saldo Inicial</span>
                  <div className="text-lg sm:text-xl font-bold text-blue-400 mt-1 font-mono">
                    {employeeData.saldoInicial >= 0 ? `+${employeeData.saldoInicial.toFixed(1)}` : employeeData.saldoInicial.toFixed(1)}h
                  </div>
                </div>

                <div className={`p-3.5 sm:p-4 rounded-2xl border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                  <span className={`text-[10px] uppercase font-bold block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Atestados</span>
                  <div className="text-lg sm:text-xl font-bold text-purple-400 mt-1 font-mono">
                    {employeeData.totalAtestados} homologados
                  </div>
                </div>
              </div>

              {/* --------------------------------------------------- */}
              {/* CARD DE INFORMAÇÕES DE INSALUBRIDADE & LAUDOS NR-15 */}
              {/* --------------------------------------------------- */}
              <div className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-xl border ${
                      authenticatedEmployee.grauInsalubridadeFixa === '40%'
                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                        : authenticatedEmployee.grauInsalubridadeFixa === '20%'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : authenticatedEmployee.grauInsalubridadeFixa === '10%'
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    }`}>
                      <Biohazard className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">Quadro de Insalubridade & Saúde Ocupacional</h4>
                      <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                        Informações do enquadramento conforme NR-15 e Laudo Técnico das Condições Ambientais (LTCAT)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                      authenticatedEmployee.grauInsalubridadeFixa === '40%'
                        ? isDark ? 'bg-red-950/50 text-red-300 border-red-800/60' : 'bg-red-50 text-red-700 border-red-200'
                        : authenticatedEmployee.grauInsalubridadeFixa === '20%'
                        ? isDark ? 'bg-amber-950/50 text-amber-300 border-amber-800/60' : 'bg-amber-50 text-amber-700 border-amber-200'
                        : authenticatedEmployee.grauInsalubridadeFixa === '10%'
                        ? isDark ? 'bg-blue-950/50 text-blue-300 border-blue-800/60' : 'bg-blue-50 text-blue-700 border-blue-200'
                        : isDark ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {authenticatedEmployee.grauInsalubridadeFixa 
                        ? `Adicional Fixo: ${authenticatedEmployee.grauInsalubridadeFixa} (${
                            authenticatedEmployee.grauInsalubridadeFixa === '40%' ? 'Grau Máximo' :
                            authenticatedEmployee.grauInsalubridadeFixa === '20%' ? 'Grau Médio' : 'Grau Mínimo'
                          })`
                        : 'Não Incidente / 0%'}
                    </span>
                  </div>
                </div>

                {employeeData.collabInsalubrities.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block ${isDark ? 'text-gray-400' : 'text-slate-600'}`}>
                      Apontamentos e Laudos Específicos Registrados ({employeeData.collabInsalubrities.length}):
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {employeeData.collabInsalubrities.map((ins) => (
                        <div key={ins.id} className={`p-3 rounded-xl border text-xs flex flex-col justify-between ${
                          isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex items-center justify-between gap-2 font-bold mb-1">
                            <span className="text-amber-400 font-mono">{ins.dataEvento} • {ins.grauExposicao}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                              isDark ? 'bg-slate-800 text-gray-300' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {ins.quantidadeHorasDias} {ins.unidade}
                            </span>
                          </div>
                          <p className="text-[11px] font-medium opacity-90 line-clamp-2">
                            {ins.atividadeDesempenhada}
                          </p>
                          {ins.observacoes && (
                            <p className={`text-[10px] italic mt-1 ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
                              Obs: {ins.observacoes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={`mt-2 p-3 rounded-xl border text-xs flex items-center gap-2 ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}>
                    <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {authenticatedEmployee.grauInsalubridadeFixa 
                        ? `Adicional de insalubridade contratual ativo no percentual de ${authenticatedEmployee.grauInsalubridadeFixa}. Nenhum apontamento episódico adicional registrado.`
                        : 'Não há apontamento de insalubridade para sua função atual no período.'}
                    </span>
                  </div>
                )}
              </div>

              {/* --------------------------------------------------- */}
              {/* VISÃO MOBILE: SANFONA / ACCORDION DE EXTRATO       */}
              {/* Ocultação de detalhes por padrão em telas pequenas */}
              {/* --------------------------------------------------- */}
              <div className="block md:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileRecordsOpen(!isMobileRecordsOpen)}
                  className={`w-full p-4 rounded-2xl border flex items-center justify-between gap-3 font-bold text-xs transition-all active:scale-[0.98] cursor-pointer shadow-xs ${
                    isDark 
                      ? 'bg-[#16243D] border-[#2A4063] text-white hover:border-blue-500/50' 
                      : 'bg-white border-slate-200 text-slate-900 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span>Extrato Diário de Lançamentos ({employeeData.records.length} ocorrências)</span>
                  </div>
                  <div className={`p-1 rounded-lg ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {isMobileRecordsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isMobileRecordsOpen && (
                  <div className="mt-3 space-y-2 animate-in fade-in duration-200">
                    {employeeData.records.length === 0 ? (
                      <div className={`p-4 rounded-xl border text-center text-xs ${
                        isDark ? 'bg-[#16243D] border-[#2A4063] text-gray-500' : 'bg-white border-slate-200 text-slate-400'
                      }`}>
                        Nenhum lançamento no histórico.
                      </div>
                    ) : (
                      employeeData.records.map((rec) => {
                        const isPos = rec.saldoCalculado > 0;
                        const isNeg = rec.saldoCalculado < 0;

                        return (
                          <div
                            key={`mobile-rec-${rec.id}`}
                            className={`p-3 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                              isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200 shadow-xs'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">{rec.dataRegistro}</span>
                                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                  rec.tipoOcorrencia === 'ACABOU_BANHOU'
                                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                                    : rec.tipoOcorrencia === 'TRABALHO' 
                                    ? 'bg-blue-500/10 text-blue-400' 
                                    : rec.tipoOcorrencia === 'ATESTADO_MEDICO'
                                    ? 'bg-purple-500/10 text-purple-400'
                                    : rec.tipoOcorrencia === 'FALTA_INJUSTIFICADA'
                                    ? 'bg-red-500/10 text-red-400'
                                    : 'bg-amber-500/10 text-amber-400'
                                }`}>
                                  {rec.tipoOcorrencia === 'ACABOU_BANHOU' ? '✨ ACABOU BANHOU' : rec.tipoOcorrencia}
                                </span>
                              </div>
                              <div className={`text-[11px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                {rec.diaSemanaNome || 'Dia Útil'} • {rec.horasBrutas}h ({rec.multiplicador}x)
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {rec.comprovante && onViewAttachment && (
                                <button
                                  type="button"
                                  onClick={() => onViewAttachment(rec.comprovante!, authenticatedEmployee.nome, rec.dataRegistro)}
                                  className="text-purple-400 p-1"
                                  title="Ver Anexo"
                                >
                                  <Paperclip className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <span className={`font-mono font-black text-sm ${
                                isPos ? 'text-emerald-500' : isNeg ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {isPos ? `+${rec.saldoCalculado.toFixed(1)}` : rec.saldoCalculado.toFixed(1)}h
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* --------------------------------------------------- */}
              {/* VISÃO DESKTOP: TABELA DE EXTRATO COMPLETO           */}
              {/* --------------------------------------------------- */}
              <div className={`hidden md:block rounded-2xl border shadow-sm overflow-hidden ${
                isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'
              }`}>
                
                {/* Header da Tabela com Filtros de Período */}
                <div className={`p-4 sm:p-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isDark ? 'border-[#2A4063]' : 'border-slate-100'
                }`}>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base">Extrato Detalhado de Lançamentos</h3>
                    <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                      Exibindo {employeeData.records.length} ocorrências registradas na base oficial
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(['ALL', '30D', '90D', '180D'] as const).map((period) => (
                      <button
                        key={period}
                        type="button"
                        onClick={() => setPeriodFilter(period)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                          periodFilter === period
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isDark ? 'bg-[#243756] text-[#94A3B8] hover:text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {period === 'ALL' ? 'Todos' : period === '30D' ? '30 Dias' : period === '90D' ? '90 Dias' : '180 Dias (Semestre)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tabela de Registros */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className={`uppercase font-bold border-b ${
                      isDark ? 'bg-[#0F1B33] border-[#2A4063] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      <tr>
                        <th className="py-3 px-4">Data Registro</th>
                        <th className="py-3 px-4">Tipo Ocorrência</th>
                        <th className="py-3 px-4">Dia Semana</th>
                        <th className="py-3 px-4 text-center">Horas Brutas</th>
                        <th className="py-3 px-4 text-center">Multiplicador SPTF</th>
                        <th className="py-3 px-4 text-right">Saldo Ocorrência</th>
                        <th className="py-3 px-4 text-center">Rastreio / Anexo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200/10">
                      {employeeData.records.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-xs opacity-60">
                            Nenhum lançamento encontrado para o período selecionado.
                          </td>
                        </tr>
                      ) : (
                        employeeData.records.map((rec) => {
                          const isPos = rec.saldoCalculado > 0;
                          const isNeg = rec.saldoCalculado < 0;

                          return (
                            <tr key={rec.id} className={isDark ? 'hover:bg-[#1B2D4A]' : 'hover:bg-slate-50'}>
                              <td className="py-3 px-4 font-mono font-semibold">
                                {rec.dataRegistro}
                              </td>
                              <td className="py-3 px-4 font-medium">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  rec.tipoOcorrencia === 'ACABOU_BANHOU'
                                    ? isDark ? 'bg-cyan-950/40 text-cyan-300 border-cyan-800/40' : 'bg-cyan-50 text-cyan-700 border-cyan-200'
                                    : rec.tipoOcorrencia === 'TRABALHO' 
                                    ? isDark ? 'bg-blue-950/40 text-blue-400 border-blue-800/40' : 'bg-blue-50 text-blue-700 border-blue-200'
                                    : rec.tipoOcorrencia === 'ATESTADO_MEDICO'
                                    ? isDark ? 'bg-purple-950/40 text-purple-400 border-purple-800/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                                    : rec.tipoOcorrencia === 'FALTA_INJUSTIFICADA'
                                    ? isDark ? 'bg-red-950/40 text-red-400 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                                    : isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {rec.tipoOcorrencia === 'ACABOU_BANHOU' ? '✨ ACABOU BANHOU' : rec.tipoOcorrencia}
                                </span>
                              </td>
                              <td className={`py-3 px-4 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                {rec.diaSemanaNome || 'Dia Útil'}
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-medium">
                                {rec.horasBrutas}h
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="font-mono text-[11px] font-bold">
                                  {rec.multiplicador}x
                                </span>
                              </td>
                              <td className={`py-3 px-4 text-right font-mono font-extrabold ${
                                isPos ? 'text-emerald-500' : isNeg ? 'text-red-500' : 'text-gray-400'
                              }`}>
                                {isPos ? `+${rec.saldoCalculado.toFixed(1)}` : rec.saldoCalculado.toFixed(1)}h
                              </td>
                              <td className="py-3 px-4 text-center">
                                {rec.comprovante ? (
                                  <button
                                    type="button"
                                    onClick={() => onViewAttachment && onViewAttachment(rec.comprovante!, authenticatedEmployee.nome, rec.dataRegistro)}
                                    className="p-1 text-purple-400 hover:text-purple-300 hover:underline inline-flex items-center gap-1 text-[11px] cursor-pointer"
                                  >
                                    <Paperclip className="w-3.5 h-3.5" />
                                    <span>Anexo</span>
                                  </button>
                                ) : (
                                  <span className={`text-[11px] ${isDark ? 'text-gray-600' : 'text-slate-400'}`}>-</span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

              </div>
              </div>
              )}

            </div>
          )
        )}

      </main>

      {/* ------------------------------------------------------------- */}
      {/* MODAL: RECUPERAÇÃO DE SENHA / PRIMEIRO ACESSO (100% FIRESTORE) */}
      {/* ------------------------------------------------------------- */}
      <ForgotPasswordModal
        isOpen={isFirstAccessModalOpen}
        onClose={() => setIsFirstAccessModalOpen(false)}
        employees={employees}
        isDark={isDark}
        initialMatricula={matriculaInput}
        onSuccess={(mat, newPass) => {
          setMatriculaInput(mat);
          setPasswordInput(newPass);
          setSuccessMessage('Senha redefinida com sucesso! Você já pode fazer login.');
        }}
      />

      {/* Modal de Aviso de Expiração de Sessão por Inatividade (Colaborador) */}
      <SessionTimeoutModal
        isOpen={isIdleWarning}
        remainingSeconds={idleRemainingSeconds}
        warnSeconds={60}
        profileLabel={idleProfileLabel}
        isDark={isDark}
        onStayLoggedIn={resetIdleTimer}
        onLogoutNow={forceIdleTimeout}
      />

      {/* ------------------------------------------------------------- */}
      {/* MODAL: INSTRUÇÕES DE PRIVACIDADE, LGPD & REGRAS SPTF         */}
      {/* ------------------------------------------------------------- */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div 
            className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
              isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
            }`}
            role="dialog"
            aria-modal="true"
          >
            {/* Cabeçalho do Modal */}
            <div className={`p-4 sm:p-5 border-b flex items-center justify-between ${
              isDark ? 'bg-[#11203A] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
                  isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                }`}>
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Privacidade & LGPD</h3>
                  <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    Tratamento de Dados e Regras do SPTF COMARA
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? 'border-[#243756] text-gray-400 hover:text-white hover:bg-[#243756]' : 'border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo Informativo com Scroll */}
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto text-xs leading-relaxed">
              
              {/* Seção 1: LGPD e Sigilo */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-emerald-500 text-xs">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Proteção de Dados (Lei nº 13.709/2018 - LGPD)</span>
                </div>
                <ul className={`space-y-1.5 list-disc list-inside ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  <li><strong>Finalidade Exclusiva:</strong> Consulta individual de registros funcionais, banco de horas, compensações e contracheques pelo próprio colaborador.</li>
                  <li><strong>Acesso Restrito:</strong> Visualização permitida apenas ao titular autenticado mediante conferência de CPF/Matrícula e senha pessoal.</li>
                  <li><strong>Sigilo e Não Indexação:</strong> Não há compartilhamento externo e as informações são protegidas contra indexação em mecanismos de busca.</li>
                </ul>
              </div>

              {/* Seção 2: Regras do SPTF */}
              <div className={`p-3.5 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex items-center gap-2 font-bold text-blue-500 text-xs">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Regras e Multiplicadores de Horas (SPTF)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                    <span className="text-gray-400 block text-[10px]">Segunda a Sexta</span>
                    <strong className="text-blue-400">1.0x</strong> (Horas normais)
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                    <span className="text-gray-400 block text-[10px]">Sábados</span>
                    <strong className="text-purple-400">1.5x</strong> (+50% adicional)
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                    <span className="text-gray-400 block text-[10px]">Domingos & Feriados</span>
                    <strong className="text-emerald-400">2.0x</strong> (+100% adicional)
                  </div>
                  <div className={`p-2 rounded-lg border ${isDark ? 'bg-[#16243D] border-[#2A4063]' : 'bg-white border-slate-200'}`}>
                    <span className="text-gray-400 block text-[10px]">Falta Injustificada</span>
                    <strong className="text-red-400">-8.0h</strong> (Dedução automática)
                  </div>
                </div>
              </div>

              {/* Seção 3: Canais de Atendimento */}
              <div className={`p-3 rounded-xl border flex items-start gap-2.5 text-[11px] ${
                isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
              }`}>
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Dúvidas sobre lançamentos ou cadastro?</strong>
                  <p className="mt-0.5">Procure a Seção de Recursos Humanos ou a Fiscalização do seu canteiro de obras para solicitar revisões ou esclarecimentos.</p>
                </div>
              </div>

            </div>

            {/* Rodapé do Modal */}
            <div className={`p-3 sm:p-4 border-t flex justify-end ${
              isDark ? 'bg-[#11203A] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => setIsPrivacyModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 active:scale-[0.98] transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Entendido, Fechar
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className={`py-4 px-6 border-t text-center text-xs mt-auto ${
        isDark ? 'bg-[#0F1B33] border-[#233654] text-[#94A3B8]' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© COMARA • Sistema de Banco de Horas SPTF • LGPD Segura</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onOpenAdminLogin}
              className="sm:hidden hover:underline flex items-center gap-1 text-slate-400 hover:text-blue-400 font-medium transition-colors cursor-pointer text-[11px]"
            >
              <Key className="w-3 h-3 text-blue-500" />
              <span>Acesso Gestão</span>
            </button>
            <span className="font-mono text-[11px]">Sedes: KO (Coari) • BE (Belém) • MN (Manaus)</span>
          </div>
        </div>
      </footer>

      {/* Banner Responsivo de Consentimento LGPD */}
      <LgpdConsentBanner isDark={isDark} />

    </div>
  );
};
