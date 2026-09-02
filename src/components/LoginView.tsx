import React, { useState } from 'react';
import { authService, getFirebaseAuthErrorMessage, DEFAULT_MASTER_ACCOUNTS } from '../services/authService';
import { AuthSession } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  UserCheck, 
  Cloud, 
  ChevronRight,
  Lock,
  Copy,
  Check
} from 'lucide-react';

interface LoginViewProps {
  onOpenSelfService: () => void;
  onLoginSuccess?: (session: AuthSession) => void;
  theme?: 'dark' | 'light';
}

export const LoginView: React.FC<LoginViewProps> = ({
  onOpenSelfService,
  onLoginSuccess,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedMasterEmail, setSelectedMasterEmail] = useState('comarafab@gmail.com');

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHostname = () => {
    if (currentHostname && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleApplyLoginSuccess = (user: any, processed: any) => {
    if (processed.status === 'inativo' || processed.status === 'bloqueado') {
      setErrorMessage('Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.');
      return;
    }

    if (processed.status === 'pendente') {
      setErrorMessage('Sua conta foi registrada no sistema e aguarda liberação de perfil pelo administrador.');
      return;
    }

    const session: AuthSession = {
      email: processed.admin.email,
      nome: processed.admin.nome || user.displayName || 'Gestor RH',
      saram: processed.admin.saram,
      nomeGuerra: processed.admin.nomeGuerra,
      postoGraduacao: processed.admin.postoGraduacao,
      funcao: processed.admin.funcao || processed.admin.cargo,
      canteiroSede: processed.admin.canteiroSede || processed.admin.sede || 'TODAS',
      role: (processed.admin.nivelAcesso || processed.admin.role || 'GESTOR_RH') as any,
      cargo: processed.admin.cargo || 'Gestor RH',
      sede: processed.admin.sede || processed.admin.canteiroCodigo || 'KO',
      canteiroCodigo: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
      canteiroId: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
      tratamentoTitulo: processed.admin.tratamentoTitulo,
      loginTime: new Date().toISOString(),
    };
    authService.saveCurrentSession(session);
    setSuccessMessage(`Bem-vindo(a), ${session.nome}!`);
    if (onLoginSuccess) {
      onLoginSuccess(session);
    } else {
      window.location.reload();
    }
  };

  // Login com Google Workspace via Popup (Firebase Auth SDK)
  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    setSuccessMessage(null);
    try {
      const { user, processed } = await authService.signInWithGoogle();
      handleApplyLoginSuccess(user, processed);
    } catch (error: any) {
      console.error('Erro no Google Sign-In Popup:', error);
      const code = error?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setErrorMessage('A janela de autenticação foi fechada antes de concluir o login.');
      } else if (code === 'auth/unauthorized-domain') {
        setIsUnauthorizedDomain(true);
        setErrorMessage(getFirebaseAuthErrorMessage(code, error.message));
      } else {
        setErrorMessage(getFirebaseAuthErrorMessage(code, error.message));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevMasterLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const { user, processed } = await authService.signInWithDevMaster(selectedMasterEmail);
      handleApplyLoginSuccess(user, processed);
    } catch (err: any) {
      console.error('Erro no login mestre:', err);
      setErrorMessage(err?.message || 'Falha ao processar login mestre.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-between font-mono transition-colors ${
      isDark ? 'bg-[#0F1B33] text-[#E2E8F0]' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Top Brand Bar */}
      <header className={`p-4 sm:px-8 border-b flex items-center justify-between ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center space-x-3">
          <ComaraLogo size="md" />
          <div>
            <div className="flex items-center space-x-2">
              <span className={`font-bold text-sm tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                BANCO DE HORAS SPTF / COMARA
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRODUÇÃO CLOUD
              </span>
            </div>
            <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Sedes Operacionais: KO (Coari) • BE (Belém) • MN (Manaus)
            </p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
            <Cloud className="w-3.5 h-3.5" />
            <span>Google Cloud Firestore Backend</span>
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="w-full max-w-md space-y-6">
          
          {/* Card Container */}
          <div className={`p-6 sm:p-8 rounded-2xl border shadow-2xl relative overflow-hidden ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-slate-200/50'
          }`}>
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-400"></div>

            {/* Header Text with Official COMARA Shield */}
            <div className="text-center space-y-2 mb-6">
              <div className="flex justify-center mb-2">
                <ComaraLogo size="xl" />
              </div>
              <h1 className={`text-xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Acesso ao Painel de Gestão & RH
              </h1>
              <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                COMARA • Comissão de Aeroportos da Região Amazônica
              </p>
            </div>

            {/* Diagnostic Panel for Unauthorized Domain */}
            {isUnauthorizedDomain && (
              <div className={`mb-5 p-4 rounded-xl border text-xs space-y-3 animate-in fade-in ${
                isDark ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-sm block">Domínio não autorizado no Firebase Auth</strong>
                    <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                      O Google OAuth requer que a URL deste ambiente esteja cadastrada na lista de domínios autorizados do Firebase Console.
                    </p>
                  </div>
                </div>

                {/* Hostname Copy Block */}
                <div className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 font-mono text-[11px] ${
                  isDark ? 'bg-[#0B1426] border-amber-900/50 text-amber-300' : 'bg-white border-amber-200 text-amber-950'
                }`}>
                  <span className="truncate flex-1 font-semibold">{currentHostname}</span>
                  <button
                    type="button"
                    onClick={handleCopyHostname}
                    className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                  >
                    {copiedDomain ? <Check className="w-3 h-3 text-white" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedDomain ? 'Copiado!' : 'Copiar Domínio'}</span>
                  </button>
                </div>

                <div className="text-[11px] leading-relaxed space-y-1 opacity-90">
                  <p><strong>Como autorizar no Firebase Console:</strong></p>
                  <p>1. Acesse <strong>Firebase Console &gt; Authentication &gt; Settings</strong></p>
                  <p>2. Na aba <strong>Authorized domains</strong>, clique em <strong>Add domain</strong></p>
                  <p>3. Cole <code className="px-1 py-0.5 rounded bg-black/20 font-mono">{currentHostname}</code> e salve.</p>
                </div>
              </div>
            )}

            {/* Alerts */}
            {errorMessage && !isUnauthorizedDomain && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-800/60 text-emerald-300 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* Google Workspace Sign-In Button */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className={`w-full py-3.5 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-3 transition-all shadow-md active:scale-98 cursor-pointer disabled:opacity-50 ${
                  isDark 
                    ? 'bg-[#243756] hover:bg-[#335075] text-white border-[#335075]' 
                    : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-300 hover:border-slate-400 shadow-xs'
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{isLoading ? 'Autenticando...' : 'Entrar com Google Workspace'}</span>
              </button>

              {/* Contingency Master Login */}
              <div className="pt-2 border-t border-slate-700/30">
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={selectedMasterEmail}
                    onChange={(e) => setSelectedMasterEmail(e.target.value)}
                    className={`w-full sm:flex-1 py-2 px-2.5 rounded-lg text-[11px] font-semibold border outline-hidden ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-100 border-slate-300 text-slate-800'
                    }`}
                  >
                    {DEFAULT_MASTER_ACCOUNTS.map((acc) => (
                      <option key={acc.email} value={acc.email}>
                        {acc.nome} ({acc.email})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleDevMasterLogin}
                    disabled={isLoading}
                    className="w-full sm:w-auto py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                  >
                    Acesso Mestre
                  </button>
                </div>
              </div>

              <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
                isDark ? 'bg-[#0F1B33]/60 border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}>
                <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  O acesso administrativo é restrito a contas corporativas autorizadas. Novos usuários entram em fila de homologação.
                </span>
              </div>
            </div>
          </div>

          {/* Atalho para o Portal do Colaborador (Autoatendimento) */}
          <div className={`p-4 rounded-2xl border transition-all ${
            isDark ? 'bg-[#16243D]/80 border-[#243756] hover:border-blue-500/40' : 'bg-white border-slate-200 hover:border-blue-400'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Portal do Colaborador
                  </h3>
                  <p className={`text-[10px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    Consulta simplificada e individual por Matrícula
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenSelfService}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-98 cursor-pointer"
              >
                <span>Acessar</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Compliance Footer Note */}
          <div className="text-center text-[10px] text-[#94A3B8] flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            <span>Autenticação Centralizada Google Workspace • RBAC Rigoroso CLT</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className={`p-4 border-t text-center text-[10px] ${
        isDark ? 'bg-[#16243D] border-[#243756] text-[#94A3B8]' : 'bg-white border-slate-200 text-slate-500'
      }`}>
        Sistema de Banco de Horas CLT v2.0 • Backend Cloud Firestore Centralizado • Sedes KO / BE / MN
      </footer>
    </div>
  );
};
