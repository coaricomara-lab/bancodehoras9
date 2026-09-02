import React, { useState } from 'react';
import { 
  AlertCircle, 
  X, 
  Lock,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  UserCheck
} from 'lucide-react';
import { authService, DEFAULT_MASTER_ACCOUNTS } from '../services/authService';
import { ComaraLogo } from './ComaraLogo';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoogleSignIn: () => Promise<any>;
  onDevAdminSignIn?: (email?: string) => Promise<any>;
  isDark: boolean;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onGoogleSignIn,
  onDevAdminSignIn,
  isDark,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMasterEmail, setSelectedMasterEmail] = useState<string>('comarafab@gmail.com');

  if (!isOpen) return null;

  const currentHostname = typeof window !== 'undefined' ? window.location.hostname : '';

  const handleCopyHostname = () => {
    if (currentHostname && navigator.clipboard) {
      navigator.clipboard.writeText(currentHostname);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    }
  };

  const handleGoogleSubmit = async () => {
    setErrorMessage(null);
    setIsUnauthorizedDomain(false);
    setIsLoading(true);
    try {
      const res = await onGoogleSignIn() as any;
      if (res?.success) {
        await authService.logAccess(
          'ADMIN_AUTH',
          'Google Workspace User',
          'LOGIN_GESTAO_RH',
          true,
          'Login administrativo RH via Google Workspace autenticado com sucesso'
        );
        onClose();
      } else if (res?.error) {
        setErrorMessage(res.error);
        if (res.code === 'auth/unauthorized-domain' || res.error.includes('não está na lista de domínios autorizados') || res.error.includes('unauthorized-domain')) {
          setIsUnauthorizedDomain(true);
        }
      }
    } catch (err: any) {
      console.error('Erro no login Google:', err);
      const errText = err?.message || 'Falha ao autenticar com Google Workspace.';
      setErrorMessage(errText);
      if (err?.code === 'auth/unauthorized-domain' || errText.includes('unauthorized-domain')) {
        setIsUnauthorizedDomain(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevMasterSubmit = async (emailToUse?: string) => {
    const targetEmail = emailToUse || selectedMasterEmail;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (onDevAdminSignIn) {
        const res = await onDevAdminSignIn(targetEmail);
        if (res?.success) {
          await authService.logAccess(
            targetEmail,
            'Super Administrador COMARA (Homologação)',
            'LOGIN_GESTAO_RH',
            true,
            `Acesso administrativo mestre de homologação (${targetEmail}) realizado com sucesso`
          );
          onClose();
          return;
        } else if (res?.error) {
          setErrorMessage(res.error);
        }
      } else {
        const { user, processed } = await authService.signInWithDevMaster(targetEmail);
        if (processed.status === 'ativo') {
          authService.saveCurrentSession({
            email: processed.admin.email,
            nome: processed.admin.nome,
            role: 'SUPER_ADMIN',
            cargo: processed.admin.cargo,
            loginTime: new Date().toISOString(),
          });
          await authService.logAccess(
            targetEmail,
            processed.admin.nome,
            'LOGIN_GESTAO_RH',
            true,
            `Acesso administrativo mestre direto (${targetEmail})`
          );
          onClose();
          window.location.reload();
        } else {
          setErrorMessage(processed.message || 'Falha ao acessar conta mestre.');
        }
      }
    } catch (err: any) {
      console.error('Erro no login de contingência:', err);
      setErrorMessage(err?.message || 'Erro ao processar login mestre.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
      <div className={`w-full max-w-lg p-6 sm:p-8 rounded-3xl border shadow-2xl space-y-5 relative animate-in zoom-in-95 max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-[#16243D] border-[#335075] text-white' : 'bg-white border-slate-200 text-slate-900'
      }`}>
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className={`absolute top-5 right-5 p-1.5 rounded-xl border transition-colors active:scale-[0.98] cursor-pointer ${
            isDark ? 'bg-[#243756] border-[#335075] text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-800'
          }`}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header with Official COMARA Shield */}
        <div className="text-center space-y-2 pt-1">
          <div className="flex justify-center mb-1">
            <ComaraLogo size="lg" />
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Acesso à Gestão & RH • COMARA
          </h2>
          <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            Autenticação corporativa para Gestores, Encarregados e Administradores
          </p>
        </div>

        {/* Diagnostic Panel for Unauthorized Domain */}
        {isUnauthorizedDomain && (
          <div className={`p-4 rounded-2xl border text-xs space-y-3 animate-in fade-in ${
            isDark ? 'bg-amber-950/40 border-amber-800/60 text-amber-200' : 'bg-amber-50 border-amber-300 text-amber-900'
          }`}>
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-sm block">Domínio não autorizado no Firebase Auth</strong>
                <p className="mt-1 leading-relaxed text-[11px] opacity-90">
                  O Google OAuth requer que a URL deste ambiente esteja cadastrada na lista de domínios autorizados do seu projeto Firebase.
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

        {/* Error Alert (Generic) */}
        {errorMessage && !isUnauthorizedDomain && (
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* Google Workspace Sign-In */}
        <div>
          <button
            type="button"
            onClick={handleGoogleSubmit}
            disabled={isLoading}
            className={`w-full py-3.5 px-4 rounded-xl text-xs sm:text-sm font-bold border transition-all active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer shadow-md ${
              isDark 
                ? 'bg-[#243756] hover:bg-[#335075] border-[#335075] text-white' 
                : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
            } disabled:opacity-50`}
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isLoading ? 'Autenticando...' : 'Entrar com Google Workspace'}</span>
          </button>
        </div>

        {/* Divider / Contingency Access */}
        <div className="relative flex py-1 items-center">
          <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
          <span className={`flex-shrink mx-3 text-[10px] uppercase font-bold tracking-wider ${
            isDark ? 'text-[#94A3B8]' : 'text-slate-400'
          }`}>
            Contingência & Homologação
          </span>
          <div className={`flex-grow border-t ${isDark ? 'border-[#243756]' : 'border-slate-200'}`} />
        </div>

        {/* Master Admin / Dev One-Click Bypass */}
        <div className={`p-3.5 rounded-2xl border space-y-3 ${
          isDark ? 'bg-[#0F1B33]/80 border-[#243756]' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Acesso Super Administrador (TI / RH)
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Master RBAC
            </span>
          </div>

          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
            Permite acesso imediato ao painel com perfil de Super Administrador para validação das regras e gestão de dados.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <select
              value={selectedMasterEmail}
              onChange={(e) => setSelectedMasterEmail(e.target.value)}
              className={`w-full sm:flex-1 py-2 px-3 rounded-xl text-xs font-semibold border outline-hidden transition-all ${
                isDark 
                  ? 'bg-[#16243D] border-[#335075] text-white focus:border-blue-500' 
                  : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500'
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
              onClick={() => handleDevMasterSubmit(selectedMasterEmail)}
              disabled={isLoading}
              className="w-full sm:w-auto py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Acessar Painel</span>
            </button>
          </div>
        </div>

        {/* RBAC Notice */}
        <div className={`p-3 rounded-xl border text-[11px] leading-relaxed flex items-start gap-2 ${
          isDark ? 'bg-[#0F1B33]/60 border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}>
          <Lock className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
          <span>Acesso corporativo restrito às contas cadastradas na matriz de permissões RBAC da Organização Militar.</span>
        </div>

        {/* Footer info */}
        <div className={`pt-1 text-center text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
          <span>COMARA • Comissão de Aeroportos da Região Amazônica / FAB</span>
        </div>

      </div>
    </div>
  );
};

