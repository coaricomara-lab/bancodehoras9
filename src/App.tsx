import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Employee, TimeRecord, Attachment, AdminUser, AdminRole, AuthSession, InsalubrityRecord, SystemConfig, GrauInsalubridade, ConstructionSite, PaystubRecord, DispensaSptfRecord } from './types';
import { storageService } from './services/storageService';
import { firestoreService, BatchProgressInfo } from './services/firestoreService';
import { seedService } from './services/seedService';
import { auth, googleProvider, testFirestoreConnection, isPermissionError, isQuotaError } from './services/firebase';
import { authService, isMasterAdminEmail, getFirebaseAuthErrorMessage } from './services/authService';
import { 
  onAuthStateChanged, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut, 
  User as FirebaseUser 
} from 'firebase/auth';

import { Navbar, ActiveTab, UserMode } from './components/Navbar';
import { LookerDashboard } from './components/LookerDashboard';
import { EmployeeManagement } from './components/EmployeeManagement';
import { EmployeeStatement } from './components/EmployeeStatement';
import { EmployeeSelfServicePortal } from './components/EmployeeSelfServicePortal';
import { AdminPermissionsManagement } from './components/AdminPermissionsManagement';
import { SettingsPage } from './components/SettingsPage';
import { BackupRestorePanel } from './components/BackupRestorePanel';
import { GoogleArchitectureSpec } from './components/GoogleArchitectureSpec';
import { AdminLockScreen } from './components/AdminLockScreen';
import { CollaboratorLandingView } from './components/CollaboratorLandingView';
import { AdminLoginModal } from './components/AdminLoginModal';
import { DailyEntryModal } from './components/DailyEntryModal';
import { QuickBatchEntryModal } from './components/QuickBatchEntryModal';
import { SptfDispensaModal } from './components/SptfDispensaModal';
import { SiteSupervisorMobileView } from './components/SiteSupervisorMobileView';
import { CertificatePreviewModal } from './components/CertificatePreviewModal';
import { ImportTimeRecordsModal } from './components/ImportTimeRecordsModal';
import { InsalubrityManagement } from './components/InsalubrityManagement';
import { CanteirosManagement } from './components/CanteirosManagement';
import { ExecutiveReportsView } from './components/ExecutiveReportsView';
import { ContrachequesManagement } from './components/ContrachequesManagement';
import { DispensasFaltasManagement } from './components/DispensasFaltasManagement';
import { AuditTrailView } from './components/AuditTrailView';
import { ComaraLogoModal } from './components/ComaraLogoModal';
import { DatabaseSafetyActionModal, SafetyActionType } from './components/DatabaseSafetyActionModal';
import { SessionTimeoutModal } from './components/SessionTimeoutModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ProtectedRoute } from './components/ProtectedRoute';
import { rbacService } from './services/rbacService';
import { registrarLogAuditoria } from './services/auditService';
import { competenciaService, CompetenciaControle } from './services/competenciaService';
import { CompetenciaStatusBar } from './components/CompetenciaStatusBar';
import { CompetenciaManagementModal } from './components/CompetenciaManagementModal';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CheckCircle2, AlertCircle, Cloud, RefreshCw, X, Database, ShieldAlert, BookOpen, ArrowLeft, LogOut, Lock } from 'lucide-react';

export interface AppUser {
  uid?: string;
  email: string;
  nome: string;
  displayName?: string | null;
  role: AdminRole;
  cargo?: string;
  sede?: string;
  canteiroCodigo?: string;
  canteiroId?: string;
  loginTime?: string;
  photoURL?: string | null;
  tratamentoTitulo?: string;
  postoGraduacao?: string;
  nomeGuerra?: string;
  saram?: string;
  funcao?: string;
  canteiroSede?: string;
}

export default function App() {
  // Auth State - Inicializado como nulo para impedir qualquer auto-login indevido ao reabrir o navegador
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userRole, setUserRole] = useState<AdminRole | null>(null);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState(false);
  const [isVerifyingPermissions, setIsVerifyingPermissions] = useState(false);
  const [pendingAccessUser, setPendingAccessUser] = useState<{ email: string; nome: string; foto?: string | null; status?: 'pendente' | 'inativo' | 'bloqueado' } | null>(null);
  const [isViewingManualModal, setIsViewingManualModal] = useState(false);

  // Firestore Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [insalubrityRecords, setInsalubrityRecords] = useState<InsalubrityRecord[]>(() => storageService.getInsalubrityRecords());
  const [dispensasSptf, setDispensasSptf] = useState<DispensaSptfRecord[]>([]);
  const [constructionSites, setConstructionSites] = useState<ConstructionSite[]>([]);
  const [paystubs, setPaystubs] = useState<PaystubRecord[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>(() => storageService.getSystemConfig());
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedMatricula, setSelectedMatricula] = useState<string>('');
  const selectedMatriculaRef = useRef<string>(selectedMatricula);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    selectedMatriculaRef.current = selectedMatricula;
  }, [selectedMatricula]);
  const [theme, setTheme] = useState<'dark' | 'light'>(storageService.getTheme());
  const [userMode, setUserMode] = useState<UserMode>('ADMIN');

  // Sync data-theme attribute for CSS variable resolution (design token system)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Modals state
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [isSafetyModalOpen, setIsSafetyModalOpen] = useState(false);
  const [safetyActionType, setSafetyActionType] = useState<SafetyActionType>('CLEAR_DATABASE');

  // Firestore Status / Error Handling State
  const [firestoreErrorNotice, setFirestoreErrorNotice] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Batch Progress State (para grandes lotes de 4.500+ registros)
  const [batchProgress, setBatchProgress] = useState<{
    isOpen: boolean;
    title: string;
    processed: number;
    total: number;
    percent: number;
    chunkIndex: number;
    totalChunks: number;
  } | null>(null);

  // Modals state
  const [isDailyEntryModalOpen, setIsDailyEntryModalOpen] = useState(false);
  const [dailyEntryInitialRecord, setDailyEntryInitialRecord] = useState<TimeRecord | null>(null);
  const [isQuickBatchModalOpen, setIsQuickBatchModalOpen] = useState(false);
  const [isImportRecordsModalOpen, setIsImportRecordsModalOpen] = useState(false);
  const [dailyEntryPreselectedMatricula, setDailyEntryPreselectedMatricula] = useState<string | undefined>();
  const [dailyEntryPreselectedDate, setDailyEntryPreselectedDate] = useState<string | undefined>();
  
  // Dispensa de SPTF Modal State
  const [isSptfDispensaModalOpen, setIsSptfDispensaModalOpen] = useState(false);
  const [sptfDispensaPreselectedMatricula, setSptfDispensaPreselectedMatricula] = useState<string | undefined>();
  
  // Certificate Preview Modal
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [previewEmployeeName, setPreviewEmployeeName] = useState<string | undefined>();
  const [previewRecordDate, setPreviewRecordDate] = useState<string | undefined>();

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // -------------------------------------------------------------
  // Competência e Fechamento Contábil
  // -------------------------------------------------------------
  const [currentCompetencia, setCurrentCompetencia] = useState<string>(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [competenciaControle, setCompetenciaControle] = useState<CompetenciaControle | null>(null);
  const [isCompetenciaModalOpen, setIsCompetenciaModalOpen] = useState(false);

  const carregarControleCompetencia = useCallback(async (comp: string) => {
    try {
      const ctrl = await competenciaService.obterCompetenciaControle(comp);
      setCompetenciaControle(ctrl);
    } catch (err) {
      console.warn('Erro ao obter controle de competência:', err);
    }
  }, []);

  useEffect(() => {
    carregarControleCompetencia(currentCompetencia);
  }, [currentCompetencia, carregarControleCompetencia]);

  // Debounce de 250ms na navegação de competência (Requisito 6C da especificação):
  // cliques acelerados em avançar/voltar executam apenas a leitura da competência final.
  const competenciaDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSelectCompetencia = useCallback((comp: string) => {
    if (competenciaDebounceRef.current) {
      clearTimeout(competenciaDebounceRef.current);
    }
    competenciaDebounceRef.current = setTimeout(() => {
      setCurrentCompetencia(comp);
    }, 250);
  }, []);
  useEffect(() => {
    return () => {
      if (competenciaDebounceRef.current) {
        clearTimeout(competenciaDebounceRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------
  // 1. Real-Time Cloud Firestore Sync com Fallback Robusto & Tenancy
  // -------------------------------------------------------------
  const currentUserCanteiro = currentUser ? rbacService.getUserCanteiroId(currentUser) : undefined;
  const isGlobalUser = rbacService.isGlobalRole(userRole);
  const activeCanteiro = !isGlobalUser ? currentUserCanteiro : undefined;

  const initFirestoreSubscriptions = useCallback(() => {
    setIsSyncing(true);
    testFirestoreConnection();

    // Subscribe to Employees in Firestore
    const unsubEmployees = firestoreService.subscribeEmployees(
      (emps) => {
        setEmployees(emps);
        setFirestoreErrorNotice(null);
        if (emps.length > 0) {
          storageService.saveEmployees(emps);
        }
        if (emps.length > 0 && !selectedMatriculaRef.current) {
          setSelectedMatricula(emps[0].matricula);
        }
        setIsSyncing(false);
      },
      (err) => {
        console.warn('Fallback local para colaboradores:', err);
        // 1.5: Handle quota exceeded — show clear message, use cached data, don't retry
        if (isQuotaError(err)) {
          setFirestoreErrorNotice('Cota do Cloud Firestore excedida. Operando com dados em cache local.');
        } else if (isPermissionError(err)) {
          setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
        }
        setEmployees(prev => (prev.length > 0 ? prev : storageService.getEmployees()));
        setIsSyncing(false);
      },
      activeCanteiro
    );

    // Subscribe to Time Records in Firestore
    const unsubRecords = firestoreService.subscribeTimeRecords(
      (recs) => {
        setRecords(recs);
        setFirestoreErrorNotice(null);
        if (recs.length > 0) {
          storageService.saveTimeRecords(recs);
        }
      },
      (err) => {
        console.warn('Fallback local para lançamentos:', err);
        // 1.5: Handle quota exceeded — show clear message, use cached data, don't retry
        if (isQuotaError(err)) {
          setFirestoreErrorNotice('Cota do Cloud Firestore excedida. Operando com dados em cache local.');
        } else if (isPermissionError(err)) {
          setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
        }
        setRecords(prev => (prev.length > 0 ? prev : storageService.getTimeRecords()));
      },
      activeCanteiro
    );

    // Realtime subscription para admin_users no Firestore (com fallback local seguro)
    const unsubAdmins = firestoreService.subscribeAdmins(
      (admins) => {
        const cleaned = admins.filter(a => a.email && !a.email.includes('@empresa.com.br') && a.email !== 'admin@comara.mil.br');
        setAdminUsers(cleaned);
        if (cleaned.length > 0) {
          storageService.saveAdmins(cleaned);
        }
      },
      (err) => {
        console.warn('Fallback local para administradores:', err);
        setAdminUsers(prev => (prev.length > 0 ? prev : storageService.getAdmins()));
      }
    );

    // Subscribe to Insalubrity Records in Firestore
    const unsubInsalubrity = firestoreService.subscribeInsalubrityRecords(
      (items) => {
        setInsalubrityRecords(items);
        if (items.length > 0) {
          storageService.saveInsalubrityRecords(items);
        }
      },
      (err) => {
        console.warn('Fallback local para insalubridade:', err);
        setInsalubrityRecords(prev => (prev.length > 0 ? prev : storageService.getInsalubrityRecords()));
      },
      activeCanteiro
    );

    // 1.2/1.3: canteiros_obras — one-time fetch with local cache instead of onSnapshot listener
    firestoreService.getConstructionSites().then((sites) => {
      setConstructionSites(sites);
    }).catch((err) => {
      console.warn('Fallback para canteiros:', err);
    });

    // 1.2/1.3: system_config — one-time fetch with local cache instead of onSnapshot listener
    firestoreService.getSystemConfigOnce().then((cfg) => {
      if (cfg) {
        setSystemConfig(cfg);
        storageService.saveSystemConfig(cfg);
      }
    }).catch((err) => {
      console.warn('Fallback local para system config:', err);
      const local = storageService.getSystemConfig();
      setSystemConfig(local);
    });

    // Subscribe to Paystubs (Contracheques Digitais) in Firestore
    const unsubPaystubs = firestoreService.subscribePaystubs(
      (items) => {
        setPaystubs(items);
        if (items.length > 0) {
          storageService.savePaystubs(items);
        }
      },
      (err) => {
        console.warn('Fallback para contracheques:', err);
        setPaystubs(prev => (prev.length > 0 ? prev : storageService.getPaystubs()));
      },
      activeCanteiro
    );

    // Subscribe to Dispensas de SPTF in Firestore
    const unsubDispensas = firestoreService.subscribeDispensasSptf(
      (items) => {
        setDispensasSptf(items);
        if (items.length > 0) {
          storageService.saveDispensasSptf(items);
        }
      },
      (err) => {
        console.warn('Fallback local para dispensas SPTF:', err);
        setDispensasSptf(prev => (prev.length > 0 ? prev : storageService.getDispensasSptf()));
      },
      activeCanteiro
    );

    return () => {
      try {
        if (typeof unsubEmployees === 'function') unsubEmployees();
      } catch (e) {
        console.warn('Erro ao cancelar listener de colaboradores:', e);
      }
      try {
        if (typeof unsubRecords === 'function') unsubRecords();
      } catch (e) {
        console.warn('Erro ao cancelar listener de lançamentos:', e);
      }
      try {
        if (typeof unsubInsalubrity === 'function') unsubInsalubrity();
      } catch (e) {
        console.warn('Erro ao cancelar listener de insalubridade:', e);
      }
      try {
        if (typeof unsubPaystubs === 'function') unsubPaystubs();
      } catch (e) {
        console.warn('Erro ao cancelar listener de contracheques:', e);
      }
      try {
        if (typeof unsubDispensas === 'function') unsubDispensas();
      } catch (e) {
        console.warn('Erro ao cancelar listener de dispensas SPTF:', e);
      }
      try {
        if (typeof unsubAdmins === 'function') unsubAdmins();
      } catch (e) {
        console.warn('Erro ao cancelar listener de administradores:', e);
      }
    };
  }, [userRole, activeCanteiro]);

  useEffect(() => {
    // 1.4: Guard against duplicate listeners — only subscribe when user is verified
    if (isSubscribedRef.current) return;
    if (isAuthLoading) return;
    if (!currentUser || !userRole) return;
    isSubscribedRef.current = true;
    const cleanup = initFirestoreSubscriptions();
    return () => {
      isSubscribedRef.current = false;
      if (typeof cleanup === 'function') cleanup();
    };
  }, [initFirestoreSubscriptions, currentUser?.email, userRole, isAuthLoading]);


  // -------------------------------------------------------------
  // 2. Monitor and Enforce Strict RBAC on Authentication State
  // -------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setIsAuthLoading(false);

      if (user) {
        const email = user.email?.toLowerCase().trim() || '';
        if (!email) {
          setIsVerifyingPermissions(false);
          return;
        }

        try {
          const processed = await authService.processAuthenticatedUser(user);

          if (processed.status === 'pendente') {
            setPendingAccessUser({
              email: processed.admin.email,
              nome: processed.admin.nome || user.displayName || email.split('@')[0],
              foto: processed.admin.foto || user.photoURL || null,
              status: 'pendente'
            });
            setCurrentUser(null);
            setUserRole(null);
            setUserMode('ADMIN');
            authService.clearSession();
            setIsVerifyingPermissions(false);
            return;
          }

          if (processed.status === 'inativo' || processed.status === 'bloqueado' || processed.admin.ativo === false) {
            setPendingAccessUser({
              email: processed.admin.email,
              nome: processed.admin.nome || user.displayName || email.split('@')[0],
              foto: processed.admin.foto || user.photoURL || null,
              status: 'inativo'
            });
            setCurrentUser(null);
            setUserRole(null);
            setUserMode('ADMIN');
            authService.clearSession();
            setIsVerifyingPermissions(false);
            return;
          }

          // Usuário ativo e com perfil liberado
          const appUser: AppUser = {
            uid: user.uid,
            email: processed.admin.email,
            nome: processed.admin.nome,
            displayName: user.displayName || processed.admin.nome,
            role: processed.isSuperAdmin ? 'SUPER_ADMIN' : processed.admin.nivelAcesso,
            cargo: processed.admin.cargo,
            loginTime: new Date().toISOString(),
            photoURL: user.photoURL || processed.admin.foto,
          };
          setPendingAccessUser(null);
          setCurrentUser(prev => {
            if (prev && prev.uid === appUser.uid && prev.email === appUser.email && prev.role === appUser.role) {
              return prev;
            }
            return appUser;
          });
          setUserRole(appUser.role);
          setUserMode(appUser.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
          authService.saveCurrentSession({
            email: processed.admin.email,
            nome: processed.admin.nome,
            role: appUser.role,
            cargo: processed.admin.cargo,
            loginTime: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('[onAuthStateChanged] Erro ao processar perfil do usuário:', err);
        } finally {
          setIsVerifyingPermissions(false);
        }
      } else {
        // Sem sessão autenticada ativa no Firebase Auth:
        // Verifica se há uma sessão institucional mestre salva no storage local
        const savedSession = authService.getCurrentSession();
        if (savedSession && isMasterAdminEmail(savedSession.email)) {
          const appUser: AppUser = {
            uid: `session-${savedSession.email}`,
            email: savedSession.email,
            nome: savedSession.nome,
            displayName: savedSession.nome,
            role: savedSession.role,
            cargo: savedSession.cargo,
            sede: savedSession.sede || 'TODAS',
            canteiroCodigo: savedSession.canteiroCodigo || 'KO',
            canteiroSede: savedSession.canteiroSede || 'TODAS',
            loginTime: savedSession.loginTime || new Date().toISOString(),
          };
          setPendingAccessUser(null);
          setCurrentUser(prev => {
            if (prev && prev.email === appUser.email && prev.role === appUser.role) {
              return prev;
            }
            return appUser;
          });
          setUserRole(appUser.role);
          setUserMode(appUser.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
          setIsVerifyingPermissions(false);
          return;
        }

        setIsVerifyingPermissions(false);
        authService.clearSession();
        setCurrentUser(null);
        setUserRole(null);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const refreshAdminAccessStatus = useCallback(async (email?: string, userOverride?: FirebaseUser | null) => {
    const userToProcess = userOverride || auth.currentUser;
    const targetEmail = (email || userToProcess?.email || '').trim().toLowerCase();
    if (!targetEmail) return null;

    try {
      const processed = await authService.processAuthenticatedUser(
        userToProcess || ({ email: targetEmail, displayName: targetEmail.split('@')[0] } as FirebaseUser)
      );

      if (processed.status === 'pendente') {
        setPendingAccessUser({
          email: processed.admin.email,
          nome: processed.admin.nome || userToProcess?.displayName || targetEmail.split('@')[0],
          foto: processed.admin.foto || userToProcess?.photoURL || null,
          status: 'pendente'
        });
        setCurrentUser(null);
        setUserRole(null);
        setUserMode('ADMIN');
        authService.clearSession();
        return null;
      }

      if (processed.status === 'inativo' || processed.status === 'bloqueado' || processed.admin.ativo === false) {
        setPendingAccessUser({
          email: processed.admin.email,
          nome: processed.admin.nome || userToProcess?.displayName || targetEmail.split('@')[0],
          foto: processed.admin.foto || userToProcess?.photoURL || null,
          status: 'inativo'
        });
        setCurrentUser(null);
        setUserRole(null);
        setUserMode('ADMIN');
        authService.clearSession();
        return null;
      }

      const appUser: AppUser = {
        uid: userToProcess?.uid || auth.currentUser?.uid,
        email: processed.admin.email,
        nome: processed.admin.nome,
        displayName: userToProcess?.displayName || processed.admin.nome,
        role: processed.isSuperAdmin ? 'SUPER_ADMIN' : processed.admin.nivelAcesso,
        cargo: processed.admin.cargo,
        loginTime: new Date().toISOString(),
        photoURL: userToProcess?.photoURL || processed.admin.foto,
      };
      setPendingAccessUser(null);
      setCurrentUser(appUser);
      setUserRole(appUser.role);
      setUserMode(appUser.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
      authService.saveCurrentSession({
        email: processed.admin.email,
        nome: processed.admin.nome,
        role: appUser.role,
        cargo: processed.admin.cargo,
        loginTime: appUser.loginTime || new Date().toISOString(),
      });
      return appUser;
    } catch (err) {
      console.warn('Erro ao atualizar status de acesso do admin:', err);
      return null;
    }
  }, []);

  // -------------------------------------------------------------
  // Processamento do Retorno do Redirecionamento Google Auth
  // -------------------------------------------------------------
  useEffect(() => {
    let isSubscribed = true;

    async function checkRedirect() {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user && isSubscribed) {
          const user = result.user;
          const processed = await authService.processAuthenticatedUser(user);

          if (processed.status === 'inativo' || processed.status === 'bloqueado') {
            authService.clearSession();
            setCurrentUser(null);
            setUserRole(null);
            setPendingAccessUser(null);
            showToast('Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.', 'error');
          } else if (processed.status === 'pendente') {
            setPendingAccessUser({
              email: processed.admin.email,
              nome: processed.admin.nome || user.displayName || processed.admin.email.split('@')[0],
              foto: processed.admin.foto || user.photoURL || null,
            });
            setCurrentUser(null);
            setUserRole(null);
            setUserMode('ADMIN');
            showToast('Sua conta foi registrada e aguarda liberação do administrador.', 'info');
          } else {
            const appUser: AppUser = {
              uid: user.uid,
              email: processed.admin.email,
              nome: processed.admin.nome,
              displayName: user.displayName || processed.admin.nome,
              role: processed.isSuperAdmin ? 'SUPER_ADMIN' : processed.admin.nivelAcesso,
              cargo: processed.admin.cargo,
              sede: processed.admin.sede || processed.admin.canteiroSede || 'TODAS',
              canteiroCodigo: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
              loginTime: new Date().toISOString(),
              photoURL: user.photoURL || processed.admin.foto,
            };
            setPendingAccessUser(null);
            setCurrentUser(appUser);
            setUserRole(appUser.role);
            setUserMode(appUser.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
            authService.saveCurrentSession({
              email: processed.admin.email,
              nome: processed.admin.nome,
              role: appUser.role,
              cargo: processed.admin.cargo,
              saram: processed.admin.saram,
              nomeGuerra: processed.admin.nomeGuerra,
              postoGraduacao: processed.admin.postoGraduacao,
              funcao: processed.admin.funcao || processed.admin.cargo,
              canteiroSede: processed.admin.canteiroSede || processed.admin.sede || 'TODAS',
              sede: processed.admin.sede || processed.admin.canteiroSede || 'TODAS',
              loginTime: new Date().toISOString(),
            });
            setFirestoreErrorNotice(null);
            showToast(`Bem-vindo(a), ${user.displayName || processed.admin.nome}!`, 'success');
          }
        }
      } catch (err: any) {
        console.error('Erro ao capturar retorno do redirecionamento Google:', err);
        if (isSubscribed) {
          const errorMsg = err?.message || 'Falha ao processar autenticação Google.';
          showToast(errorMsg, 'error');
        }
      }
    }

    checkRedirect();

    return () => {
      isSubscribed = false;
    };
  }, [showToast]);

  // Helper unificado para aplicar sessão de usuário autenticado
  const applyUserAuth = (user: { uid?: string; email: string; displayName?: string | null; photoURL?: string | null }, processed: any) => {
    if (processed.status === 'inativo' || processed.status === 'bloqueado' || processed.admin.ativo === false) {
      authService.clearSession();
      setCurrentUser(null);
      setUserRole(null);
      setPendingAccessUser({
        email: processed.admin.email,
        nome: processed.admin.nome || user.displayName || processed.admin.email.split('@')[0],
        foto: processed.admin.foto || user.photoURL || null,
        status: 'inativo'
      });
      showToast('Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.', 'error');
      return { success: false, error: 'Usuário desativado. Procure o Gerente ou DA do canteiro para solicitar o desbloqueio.' };
    }

    if (processed.status === 'pendente') {
      setPendingAccessUser({
        email: processed.admin.email,
        nome: processed.admin.nome || user.displayName || processed.admin.email.split('@')[0],
        foto: processed.admin.foto || user.photoURL || null,
        status: 'pendente'
      });
      setCurrentUser(null);
      setUserRole(null);
      setUserMode('ADMIN');
      showToast('Sua conta foi registrada e aguarda liberação do administrador.', 'info');
      return { success: true, pending: true };
    }

    const appUser: AppUser = {
      uid: user.uid || `user-${processed.admin.email}`,
      email: processed.admin.email,
      nome: processed.admin.nome,
      displayName: user.displayName || processed.admin.nome,
      role: processed.isSuperAdmin ? 'SUPER_ADMIN' : processed.admin.nivelAcesso,
      cargo: processed.admin.cargo,
      sede: processed.admin.sede || processed.admin.canteiroSede || 'TODAS',
      canteiroCodigo: processed.admin.canteiroCodigo || processed.admin.sede || 'KO',
      loginTime: new Date().toISOString(),
      photoURL: user.photoURL || processed.admin.foto,
    };
    setPendingAccessUser(null);
    setCurrentUser(appUser);
    setUserRole(appUser.role);
    setUserMode(appUser.role === 'AUDITOR' ? 'COLABORADOR' : 'ADMIN');
    authService.saveCurrentSession({
      email: processed.admin.email,
      nome: processed.admin.nome,
      role: appUser.role,
      cargo: processed.admin.cargo,
      saram: processed.admin.saram,
      nomeGuerra: processed.admin.nomeGuerra,
      postoGraduacao: processed.admin.postoGraduacao,
      funcao: processed.admin.funcao || processed.admin.cargo,
      canteiroSede: processed.admin.canteiroSede || processed.admin.sede || 'TODAS',
      sede: processed.admin.sede || processed.admin.canteiroSede || 'TODAS',
      loginTime: new Date().toISOString(),
    });
    setFirestoreErrorNotice(null);
    showToast(`Bem-vindo(a), ${user.displayName || processed.admin.nome}!`, 'success');
    return { success: true, pending: false };
  };

  // Auth Handler: Google Workspace Sign-In (Firebase Auth SDK via Popup)
  const handleGoogleSignIn = async () => {
    try {
      setIsVerifyingPermissions(true);
      const { user, processed } = await authService.signInWithGoogle();
      return applyUserAuth(user, processed);
    } catch (err: any) {
      const code = err?.code || '';
      let errorMsg = err?.message || 'Falha ao autenticar com Google Workspace.';
      if (code === 'auth/popup-closed-by-user') {
        errorMsg = 'A janela de login do Google foi fechada antes de concluir.';
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        errorMsg = `Domínio não autorizado no Firebase Auth (${host}). Você pode adicionar o domínio no Firebase Console ou usar o Acesso de Contingência.`;
      } else {
        errorMsg = getFirebaseAuthErrorMessage(code, errorMsg);
      }
      console.warn('Aviso na autenticação Google Popup:', err);
      showToast(errorMsg, 'error');
      return { success: false, error: errorMsg, code };
    } finally {
      setIsVerifyingPermissions(false);
    }
  };

  // Auth Handler: Acesso de Contingência / Homologação para Contas Master
  const handleDevAdminSignIn = async (email: string = 'coari.comara@gmail.com') => {
    try {
      setIsVerifyingPermissions(true);
      const { user, processed } = await authService.signInWithDevMaster(email);
      return applyUserAuth(user, processed);
    } catch (err: any) {
      console.warn('Aviso no acesso de desenvolvimento:', err);
      const errorMsg = err?.message || 'Falha no acesso de contingência.';
      showToast(errorMsg, 'error');
      return { success: false, error: errorMsg };
    } finally {
      setIsVerifyingPermissions(false);
    }
  };

  const handleToggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    storageService.saveTheme(next);
  };

  const handleToggleUserMode = (mode: UserMode) => {
    setUserMode(mode);
    if (mode === 'COLABORADOR' && activeTab === 'permissoes_admin') {
      showToast('Modo Colaborador ativado: Acessos administrativos restritos.', 'info');
    } else if (mode === 'ADMIN') {
      showToast('Modo Administrador (RH) ativado: Acesso de gestão concedido.', 'info');
    }
  };

  // Limpeza completa de estado de autenticação e armazenamento local.
  // Compartilhada entre logout manual e auto-logoff por inatividade, garante
  // que nenhuma sessão fantasma persista (localStorage + sessionStorage + estado React).
  const resetAuthAndStorage = useCallback(() => {
    try { localStorage.clear(); } catch (e) { console.warn('Erro ao limpar localStorage:', e); }
    try { sessionStorage.clear(); } catch (e) { console.warn('Erro ao limpar sessionStorage:', e); }
    setPendingAccessUser(null);
    setCurrentUser(null);
    setUserRole(null);
    setUserMode('ADMIN');
    setActiveTab('extrato');
    setIsAdminLoginModalOpen(false);
    setIsViewingManualModal(false);
    setIsDailyEntryModalOpen(false);
    setIsQuickBatchModalOpen(false);
    setIsImportRecordsModalOpen(false);
    setPreviewAttachment(null);
    setBatchProgress(null);
  }, []);

  const handleSignOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Erro ao desconectar do Firebase:', err);
    } finally {
      resetAuthAndStorage();
      showToast('Sessão encerrada com sucesso.', 'info');
    }
  };

  // Logoff Seguro por Inatividade do Usuário (Auto-Logoff com redirecionamento e notificação)
  const handleInactivityTimeout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error('Erro ao desconectar do Firebase na inatividade:', err);
    } finally {
      resetAuthAndStorage();
      showToast('Sessão finalizada por inatividade. Faça login novamente.', 'info');
    }
  }, [showToast, resetAuthAndStorage]);

  // Monitor de Inatividade do Usuário Adaptativo (useInactivityTimeout)
  // Perfil AUX_DA (Canteiro): 15 minutos sem interação
  // Perfil RH_ADMIN / Administrador / Super Admin: 30 minutos sem interação
  // Faltando 60 segundos: Dispara aviso prévio com contagem regressiva
  const {
    isWarning: isIdleWarning,
    remainingSeconds: idleRemainingSeconds,
    profileLabel: idleProfileLabel,
    resetTimer: resetIdleTimer,
    forceTimeout: forceIdleTimeout,
  } = useInactivityTimeout({
    enabled: !!currentUser,
    role: userRole,
    warnSeconds: 60,
    onTimeout: handleInactivityTimeout,
  });

  // Firestore Write: Salvar Lançamento Individual
  const handleSaveRecord = async (newRecord: TimeRecord) => {
    const isEdit = records.some(r => r.id === newRecord.id);
    try {
      await firestoreService.saveTimeRecord(newRecord, currentUser?.email || 'admin@rh.cloud');
      showToast(`Lançamento de ${newRecord.horasBrutas}h gravado no Cloud Firestore com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: newRecord.employeeSede || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: isEdit ? 'EDICAO_LANCAMENTO' : 'LANCAMENTO_HORAS',
        detalhes: `${isEdit ? 'Edição' : 'Lançamento manual'} para Matrícula ${newRecord.matricula} (${newRecord.employeeName || ''}): ${newRecord.tipoOcorrencia} de ${newRecord.horasBrutas}h (Saldo: ${newRecord.saldoCalculado >= 0 ? '+' : ''}${newRecord.saldoCalculado}h) em ${newRecord.dataRegistro}.`,
        recursoId: newRecord.id,
        detalhesJson: {
          matricula: newRecord.matricula,
          tipoOcorrencia: newRecord.tipoOcorrencia,
          horasBrutas: newRecord.horasBrutas,
          saldoCalculado: newRecord.saldoCalculado,
          dataRegistro: newRecord.dataRegistro,
        }
      });
    } catch (error: any) {
      console.error('Erro ao salvar no Firestore, usando fallback local:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      const updatedRecords = storageService.addTimeRecord(newRecord);
      setRecords([...updatedRecords]);
      showToast(`Lançamento de ${newRecord.horasBrutas}h salvo no cache local.`, 'info');
    }
  };

  // Firestore Write: Importar Lote de Lançamentos Diários com Suporte a Arquivos Grandes (4.500+ itens)
  const handleImportRecordsBatch = async (importedRecords: TimeRecord[]) => {
    const total = importedRecords.length;
    const totalChunks = Math.ceil(total / 400);

    setBatchProgress({
      isOpen: true,
      title: 'Importando Lançamentos no Cloud Firestore',
      processed: 0,
      total,
      percent: 0,
      chunkIndex: 1,
      totalChunks,
    });

    try {
      const res = await firestoreService.importTimeRecordsBatch(
        importedRecords,
        (progress: BatchProgressInfo) => {
          setBatchProgress({
            isOpen: true,
            title: `Gravando no Cloud Firestore (Lote ${progress.chunkIndex}/${progress.totalChunks})...`,
            processed: progress.processed,
            total: progress.total,
            percent: progress.percent,
            chunkIndex: progress.chunkIndex,
            totalChunks: progress.totalChunks,
          });
        }
      );

      setBatchProgress(null);

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'LANCAMENTO_HORAS',
        detalhes: `Importação em lote de ${importedRecords.length.toLocaleString('pt-BR')} lançamentos de banco de horas sincronizados no Firestore.`,
        detalhesJson: { totalRegistros: importedRecords.length }
      });

      if (res.errors.length > 0) {
        showToast(`${res.count} de ${total} lançamentos sincronizados com alguns alertas.`, 'info');
      } else {
        showToast(`${res.count.toLocaleString('pt-BR')} lançamentos sincronizados no Cloud Firestore com sucesso!`, 'success');
      }
    } catch (error: any) {
      console.error('Erro no batch import Firestore, salvando localmente:', error);
      setBatchProgress(null);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      const updatedRecords = storageService.addTimeRecordsBatch(importedRecords);
      setRecords([...updatedRecords]);
      showToast(`${importedRecords.length.toLocaleString('pt-BR')} lançamentos salvos no cache local.`, 'info');
    }
  };

  // Firestore Write: Atualizar / Importar Colaboradores em Lotes
  const handleUpdateEmployees = async (newEmployees: Employee[]) => {
    const total = newEmployees.length;
    const totalChunks = Math.ceil(total / 400);

    setBatchProgress({
      isOpen: true,
      title: 'Sincronizando Base de Colaboradores',
      processed: 0,
      total,
      percent: 0,
      chunkIndex: 1,
      totalChunks,
    });

    try {
      const res = await firestoreService.importEmployeesBatch(
        newEmployees,
        (progress: BatchProgressInfo) => {
          setBatchProgress({
            isOpen: true,
            title: `Atualizando Colaboradores (${progress.processed}/${progress.total})...`,
            processed: progress.processed,
            total: progress.total,
            percent: progress.percent,
            chunkIndex: progress.chunkIndex,
            totalChunks: progress.totalChunks,
          });
        }
      );

      setBatchProgress(null);

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'ALTERACAO_FUNCAO',
        detalhes: `Importação/Atualização cadastral em lote de ${newEmployees.length.toLocaleString('pt-BR')} colaboradores no sistema.`,
        detalhesJson: { totalColaboradores: newEmployees.length }
      });

      if (newEmployees.length > 0 && !selectedMatricula) {
        setSelectedMatricula(newEmployees[0].matricula);
      }
      showToast(`Base oficial de ${res.count.toLocaleString('pt-BR')} colaboradores gravada no Cloud Firestore!`, 'success');
    } catch (error: any) {
      console.error('Erro ao gravar colaboradores no Firestore, salvando localmente:', error);
      setBatchProgress(null);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.saveEmployees(newEmployees);
      setEmployees([...newEmployees]);
      if (newEmployees.length > 0 && !selectedMatricula) {
        setSelectedMatricula(newEmployees[0].matricula);
      }
      showToast(`Lista de colaboradores atualizada localmente (${newEmployees.length} registros).`, 'info');
    }
  };

  // -------------------------------------------------------------
  // Safety Intercept Handlers para Destructive Actions
  // -------------------------------------------------------------
  const handleTriggerClearDataSafety = () => {
    if (userRole !== 'SUPER_ADMIN') {
      showToast('Ação bloqueada: Apenas Super Administradores podem limpar a base central de dados.', 'error');
      return;
    }
    setSafetyActionType('CLEAR_DATABASE');
    setIsSafetyModalOpen(true);
  };

  const handleTriggerLoadMocksSafety = () => {
    if (userRole === 'AUDITOR') {
      showToast('Ação bloqueada: Auditores possuem apenas permissão de leitura.', 'error');
      return;
    }
    setSafetyActionType('LOAD_MOCKS');
    setIsSafetyModalOpen(true);
  };

  const handleExecuteClearDatabase = async () => {
    try {
      const result = await seedService.clearAllOperationalData();
      storageService.clearAllData();
      setEmployees([]);
      setRecords([]);
      setInsalubrityRecords([]);
      setConstructionSites([]);
      setPaystubs([]);
      setDispensasSptf([]);
      setSelectedMatricula('');
      showToast(result.message || 'Base Operacional zerada com sucesso para produção!', 'success');
    } catch (error: any) {
      console.error('Erro ao limpar Firestore:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.clearAllData();
      setEmployees([]);
      setRecords([]);
      setInsalubrityRecords([]);
      setConstructionSites([]);
      setPaystubs([]);
      setDispensasSptf([]);
      setSelectedMatricula('');
      showToast('Base operacional zerada localmente.', 'info');
    }
  };

  const handleExecuteLoadMocks = async () => {
    try {
      const result = await seedService.seedTrainingData();
      const emps = storageService.getEmployees();
      const recs = storageService.getTimeRecords();
      const insalubrity = storageService.getInsalubrityRecords();
      const sites = storageService.getConstructionSites ? storageService.getConstructionSites() : [];
      const stubs = storageService.getPaystubs();
      const disp = storageService.getDispensasSptf();

      setEmployees(emps);
      setRecords(recs);
      setInsalubrityRecords(insalubrity);
      if (sites.length > 0) setConstructionSites(sites);
      setPaystubs(stubs);
      setDispensasSptf(disp);

      if (emps.length > 0) {
        setSelectedMatricula(emps[0].matricula);
      }
      showToast(result.message || 'Modo Treinamento: dados de exemplo carregados com sucesso no Firestore!', 'success');
    } catch (err: any) {
      console.error('Erro ao carregar dados de treinamento:', err);
      const mockEmps = storageService.getEmployees();
      const mockRecs = storageService.getTimeRecords();
      setEmployees(mockEmps);
      setRecords(mockRecs);
      showToast('Dados de treinamento carregados no cache local.', 'info');
    }
  };

  const handleRestoreSnapshot = async (snapshot: any) => {
    try {
      if (snapshot.data?.employees) {
        await firestoreService.importEmployeesBatch(snapshot.data.employees);
        storageService.saveEmployees(snapshot.data.employees);
        setEmployees(snapshot.data.employees);
      }
      if (snapshot.data?.records) {
        await firestoreService.importTimeRecordsBatch(snapshot.data.records);
        storageService.saveTimeRecords(snapshot.data.records);
        setRecords(snapshot.data.records);
      }
      if (snapshot.data?.insalubrityRecords) {
        await firestoreService.saveInsalubrityBatch(snapshot.data.insalubrityRecords);
        for (const r of snapshot.data.insalubrityRecords) {
          storageService.saveInsalubrityRecord(r);
        }
        setInsalubrityRecords(snapshot.data.insalubrityRecords);
      }
      showToast(`Ponto de restauração de ${snapshot.formattedDate} restaurado com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao restaurar backup:', err);
      showToast('Falha ao restaurar ponto de restauração.', 'error');
    }
  };

  const handleOpenNewEntry = (matricula?: string | any, defaultDate?: string | any) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite inclusão manual de lançamentos.', 'error');
      return;
    }
    const safeDate = typeof defaultDate === 'string' ? defaultDate : undefined;
    const targetComp = safeDate ? safeDate.slice(0, 7) : currentCompetencia;
    if (competenciaControle?.status === 'FECHADO' && targetComp === currentCompetencia) {
      showToast(`A competência ${currentCompetencia} está homologada e fechada. Para novos apontamentos neste período, solicite a reabertura administrativa.`, 'error');
      return;
    }
    const safeMat = typeof matricula === 'string' ? matricula : (employees[0]?.matricula || '');
    setDailyEntryInitialRecord(null);
    setDailyEntryPreselectedMatricula(safeMat);
    setDailyEntryPreselectedDate(safeDate);
    setIsDailyEntryModalOpen(true);
  };

  const handleOpenEditEntry = (record: TimeRecord) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite alteração de lançamentos.', 'error');
      return;
    }
    if (!record || typeof record !== 'object' || typeof record.id !== 'string') return;
    const recordComp = (record.dataRegistro || record.data_ocorrencia || '').slice(0, 7);
    if (competenciaControle?.status === 'FECHADO' && recordComp === currentCompetencia) {
      showToast(`Este lançamento pertence à competência ${currentCompetencia}, que está homologada e fechada. Reabra a competência para efetuar alterações.`, 'error');
      return;
    }
    setDailyEntryInitialRecord(record);
    setDailyEntryPreselectedMatricula(typeof record.matricula === 'string' ? record.matricula : '');
    setDailyEntryPreselectedDate(typeof record.dataRegistro === 'string' ? record.dataRegistro : record.data_ocorrencia);
    setIsDailyEntryModalOpen(true);
  };

  const handleDeleteRecord = async (id: string) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite exclusão de lançamentos.', 'error');
      return;
    }
    if (typeof id !== 'string') return;
    const targetRec = records.find(r => r.id === id);
    const recordComp = (targetRec?.dataRegistro || targetRec?.data_ocorrencia || '').slice(0, 7);
    if (competenciaControle?.status === 'FECHADO' && recordComp === currentCompetencia) {
      showToast(`Exclusão bloqueada: O lançamento pertence à competência ${currentCompetencia}, que está homologada e fechada.`, 'error');
      return;
    }
    try {
      await firestoreService.deleteTimeRecord(id);
      storageService.deleteTimeRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      showToast('Lançamento excluído com sucesso do Cloud Firestore!', 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: targetRec?.employeeSede || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'EXCLUSAO_REGISTRO',
        detalhes: `Exclusão de lançamento de ${targetRec?.horasBrutas || 0}h (${targetRec?.tipoOcorrencia || 'Registro'}) da Matrícula ${targetRec?.matricula || id}.`,
        recursoId: id,
      });
    } catch (err: any) {
      console.error('Erro ao excluir lançamento:', err);
      storageService.deleteTimeRecord(id);
      setRecords(prev => prev.filter(r => r.id !== id));
      showToast('Lançamento removido do cache local.', 'info');
    }
  };

  // Handlers para Guia de Dispensa de SPTF (Compensação em Banco de Horas)
  const handleOpenSptfDispensa = (matricula?: string | any) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite emissão de dispensas de SPTF.', 'error');
      return;
    }
    if (competenciaControle?.status === 'FECHADO') {
      showToast(`A competência ${currentCompetencia} está homologada e fechada. Emissão de dispensas com compensação neste mês bloqueada.`, 'error');
      return;
    }
    const safeMat = typeof matricula === 'string' ? matricula : undefined;
    setSptfDispensaPreselectedMatricula(safeMat);
    setIsSptfDispensaModalOpen(true);
  };

  const handleSaveDispensaSptf = async (dispensa: DispensaSptfRecord, lancamentoRecord: TimeRecord) => {
    try {
      await firestoreService.emitDispensaSptf(dispensa, lancamentoRecord);
      storageService.addDispensaSptf(dispensa);
      storageService.addTimeRecord(lancamentoRecord);
      showToast(`Guia de Dispensa de SPTF #${dispensa.numeroGuia} emitida e debitada no Banco de Horas com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: dispensa.secaoCanteiro || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'EMISSAO_DISPENSA',
        detalhes: `Dispensa emitida para o servidor Matrícula ${dispensa.matricula} (${dispensa.nome}) - ${dispensa.totalHoras.toFixed(1)}h abatidas (Guia #${dispensa.numeroGuia || 'S/N'}).`,
        recursoId: dispensa.id,
        detalhesJson: {
          dispensaId: dispensa.id,
          matricula: dispensa.matricula,
          nome: dispensa.nome,
          totalHoras: dispensa.totalHoras,
          data: dispensa.data,
          horarioInicio: dispensa.horarioInicio,
          horarioFim: dispensa.horarioFim,
          numeroGuia: dispensa.numeroGuia,
          secaoCanteiro: dispensa.secaoCanteiro,
        }
      });
    } catch (error: any) {
      console.error('Erro ao emitir Dispensa de SPTF no Firestore:', error);
      if (isPermissionError(error)) {
        setFirestoreErrorNotice('Erro de permissão no banco de dados. Verifique a autenticação.');
      }
      storageService.addDispensaSptf(dispensa);
      const updatedRecords = storageService.addTimeRecord(lancamentoRecord);
      setRecords([...updatedRecords]);
      setDispensasSptf(prev => [dispensa, ...prev]);
      showToast(`Guia de Dispensa #${dispensa.numeroGuia} emitida e salva localmente.`, 'info');
    }
  };

  const handleDeleteDispensaSptf = async (dispensaId: string, lancamentoId?: string) => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Seu nível de acesso não permite exclusão de dispensas.', 'error');
      return;
    }
    const targetDispensa = dispensasSptf.find(d => d.id === dispensaId);
    try {
      await firestoreService.deleteDispensaSptf(dispensaId, lancamentoId);
      storageService.deleteDispensaSptf(dispensaId);
      if (lancamentoId) {
        storageService.deleteTimeRecord(lancamentoId);
        setRecords(prev => prev.filter(r => r.id !== lancamentoId));
      }
      setDispensasSptf(prev => prev.filter(d => d.id !== dispensaId));
      showToast('Guia de Dispensa de SPTF cancelada com sucesso!', 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: targetDispensa?.secaoCanteiro || currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'CANCELAMENTO_DISPENSA',
        detalhes: `Cancelamento de Guia de Dispensa de SPTF #${targetDispensa?.numeroGuia || dispensaId} (Servidor: ${targetDispensa?.nome || targetDispensa?.matricula || 'N/A'}).`,
        recursoId: dispensaId,
      });
    } catch (err: any) {
      console.error('Erro ao excluir dispensa SPTF:', err);
      storageService.deleteDispensaSptf(dispensaId);
      if (lancamentoId) {
        storageService.deleteTimeRecord(lancamentoId);
        setRecords(prev => prev.filter(r => r.id !== lancamentoId));
      }
      setDispensasSptf(prev => prev.filter(d => d.id !== dispensaId));
      showToast('Guia de Dispensa removida localmente.', 'info');
    }
  };

  const handleOpenQuickBatchModal = () => {
    if (userRole === 'AUDITOR' || userMode === 'COLABORADOR') {
      showToast('Ação bloqueada: Apenas Gestores e Super Admins podem realizar lançamentos em lote.', 'error');
      return;
    }
    if (competenciaControle?.status === 'FECHADO') {
      showToast(`A competência ${currentCompetencia} está homologada e fechada. Apontamentos em lote bloqueados neste período.`, 'error');
      return;
    }
    setIsQuickBatchModalOpen(true);
  };

  const handleViewStatement = (matricula: string) => {
    setSelectedMatricula(matricula);
    setActiveTab('extrato');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewAttachment = (attachment: Attachment, empName?: string, recordDate?: string) => {
    setPreviewAttachment(attachment);
    setPreviewEmployeeName(empName);
    setPreviewRecordDate(recordDate);
  };

  // Handlers para Módulo de Insalubridade
  const handleSaveInsalubrityRecord = async (record: InsalubrityRecord) => {
    setInsalubrityRecords((prev) => {
      const recKey = record.id || `${record.matricula.trim().toUpperCase()}_${record.dataEvento}`;
      const idx = prev.findIndex(r => (r.id && r.id === record.id) || `${r.matricula.trim().toUpperCase()}_${r.dataEvento}` === recKey);
      let updated: InsalubrityRecord[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = record;
      } else {
        updated = [record, ...prev];
      }
      storageService.saveInsalubrityRecords(updated);
      return updated;
    });

    try {
      await firestoreService.saveInsalubrityRecord(record);
      showToast('Registro de insalubridade gravado com sucesso no Cloud Firestore!');
    } catch (err: any) {
      console.error('Erro ao salvar registro de insalubridade no Firestore:', err);
      showToast('Registro de insalubridade gravado localmente.', 'info');
    }
  };

  const handleSaveInsalubrityBatch = async (recordsToSave: InsalubrityRecord[]) => {
    setInsalubrityRecords((prev) => {
      const map = new Map<string, InsalubrityRecord>();
      prev.forEach((r) => {
        const key = r.id || `${r.matricula.trim().toUpperCase()}_${r.dataEvento}`;
        map.set(key, r);
      });
      recordsToSave.forEach((r) => {
        const key = r.id || `${r.matricula.trim().toUpperCase()}_${r.dataEvento}`;
        map.set(key, r);
      });
      const merged = Array.from(map.values());
      storageService.saveInsalubrityRecords(merged);
      return merged;
    });

    try {
      await firestoreService.saveInsalubrityBatch(recordsToSave);
      showToast(`${recordsToSave.length} lançamentos de insalubridade salvos com sucesso!`, 'success');
    } catch (err: any) {
      console.error('Erro ao salvar lote de insalubridade no Firestore:', err);
      showToast(`${recordsToSave.length} lançamentos salvos no cache local.`, 'info');
    }
  };

  const handleDeleteInsalubrityRecord = async (id: string) => {
    setInsalubrityRecords((prev) => {
      const updated = prev.filter(r => r.id !== id);
      storageService.saveInsalubrityRecords(updated);
      return updated;
    });

    try {
      await firestoreService.deleteInsalubrityRecord(id);
      showToast('Registro de insalubridade removido.');
    } catch (err: any) {
      console.error('Erro ao deletar registro de insalubridade:', err);
      showToast('Registro removido do cache local.', 'info');
    }
  };

  const handleFetchInsalubrityPeriod = async (startDate: string, endDate: string, forceRefresh = false): Promise<InsalubrityRecord[]> => {
    try {
      const isGlobal = rbacService.isGlobalRole(userRole);
      const activeCanteiro = (!isGlobal && currentUser)
        ? rbacService.getUserCanteiroId(currentUser)
        : undefined;

      const records = await firestoreService.fetchInsalubrityRecordsByPeriod({
        startDate,
        endDate,
        canteiroId: activeCanteiro,
        forceRefresh,
      });

      if (records && records.length > 0) {
        setInsalubrityRecords((prev) => {
          const map = new Map<string, InsalubrityRecord>();
          prev.forEach(r => map.set(r.id || `${r.matricula.trim().toUpperCase()}_${r.dataEvento}`, r));
          records.forEach(r => map.set(r.id || `${r.matricula.trim().toUpperCase()}_${r.dataEvento}`, r));
          const merged = Array.from(map.values());
          storageService.saveInsalubrityRecords(merged);
          return merged;
        });
      }
      return records;
    } catch (err) {
      console.warn('Erro ao carregar período sob demanda de insalubridade:', err);
      return [];
    }
  };

  const handleUpdateEmployeeGrauFixa = async (empId: string, grau: GrauInsalubridade) => {
    const emp = employees.find(e => e.id === empId || e.matricula === empId);
    if (!emp) return;
    const updated = { ...emp, grauInsalubridadeFixa: grau };
    try {
      await firestoreService.saveEmployee(updated);
      const newEmps = employees.map(e => (e.id === empId || e.matricula === empId) ? updated : e);
      setEmployees(newEmps);
      storageService.saveEmployees(newEmps);
      showToast(`Insalubridade contratual de ${emp.nome} atualizada para ${grau}.`);
    } catch (err: any) {
      console.error('Erro ao atualizar insalubridade contratual:', err);
      const newEmps = employees.map(e => (e.id === empId || e.matricula === empId) ? updated : e);
      setEmployees(newEmps);
      storageService.saveEmployees(newEmps);
      showToast(`Insalubridade contratual atualizada no cache local (${grau}).`, 'info');
    }
  };

  const handleSaveSystemConfig = async (cfg: SystemConfig) => {
    try {
      await firestoreService.saveSystemConfig(cfg);
      setSystemConfig(cfg);
      storageService.saveSystemConfig(cfg);
      showToast('Identidade visual COMARA atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao salvar configurações globais:', err);
      setSystemConfig(cfg);
      storageService.saveSystemConfig(cfg);
      showToast('Configurações salvas no cache local.', 'info');
    }
  };

  const handleSaveConstructionSite = async (site: Partial<ConstructionSite>) => {
    const rawCode = site.code || site.codigo || 'KO';
    const rawName = site.name || site.nome || `Canteiro ${rawCode}`;
    const rawChief = site.chief || site.chefeCanteiro || '';
    const rawChefeDa = site.chefeDa || '';
    const rawAuxDa = site.auxDa || '';
    try {
      await firestoreService.saveConstructionSite(site);
      showToast('Canteiro de obras salvo com sucesso no Firestore!');

      // Audit Trail: Passagem de Bastão / Troca de Cargo / Atualização de Canteiro
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: rawCode,
        tipoAcao: 'PASSAGEM_BASTAO',
        detalhes: `Atualização de chefia/dados do canteiro ${rawCode} (${rawName}): Chefe: "${rawChief || 'N/A'}", Chefe DA: "${rawChefeDa || 'N/A'}", Aux DA: "${rawAuxDa || 'N/A'}".`,
        recursoId: site.id || `canteiro-${rawCode}`,
        detalhesJson: {
          canteiroCodigo: rawCode,
          nome: rawName,
          chefeCanteiro: rawChief,
          chefeDa: rawChefeDa,
          auxDa: rawAuxDa,
          status: site.status,
          grauInsalubridade: site.insalubrityLevel || site.grauInsalubridade,
        }
      });
    } catch (err: any) {
      console.error('Erro ao salvar canteiro no Firestore:', err);
      // Fallback local
      const id = site.id || `canteiro-${Date.now()}`;
      const newSite: ConstructionSite = {
        id,
        name: site.name || 'Canteiro',
        code: site.code || 'CT-01',
        branch: site.branch || 'KO',
        status: site.status || 'ACTIVE',
        ...site,
      } as ConstructionSite;
      setConstructionSites((prev) => {
        const idx = prev.findIndex((s) => s.id === id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = newSite;
          return copy;
        }
        return [...prev, newSite];
      });
      showToast('Canteiro salvo no cache local.', 'info');
    }
  };

  const handleDeleteConstructionSite = async (id: string) => {
    const targetSite = constructionSites.find(s => s.id === id);
    try {
      await firestoreService.deleteConstructionSite(id);
      showToast('Canteiro de obras removido com sucesso.');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: targetSite?.code || targetSite?.branch || 'TODOS',
        tipoAcao: 'EXCLUSAO_REGISTRO',
        detalhes: `Exclusão do canteiro de obras "${targetSite?.name || id}" (Código: ${targetSite?.code || 'N/A'}).`,
        recursoId: id,
      });
    } catch (err: any) {
      console.error('Erro ao remover canteiro:', err);
      setConstructionSites((prev) => prev.filter((s) => s.id !== id));
      showToast('Canteiro removido localmente.', 'info');
    }
  };

  const handleSaveBatchPaystubs = async (newPaystubs: PaystubRecord[]) => {
    try {
      setBatchProgress({
        isOpen: true,
        processed: 0,
        total: newPaystubs.length,
        percent: 0,
        chunkIndex: 1,
        totalChunks: Math.ceil(newPaystubs.length / 400),
        title: 'Importando Contracheques Digitais COMARA'
      });

      await firestoreService.saveBatchPaystubs(newPaystubs, (prog) => {
        setBatchProgress({
          isOpen: true,
          processed: prog.processed,
          total: prog.total,
          percent: prog.percent,
          chunkIndex: prog.chunkIndex,
          totalChunks: prog.totalChunks,
          title: 'Importando Contracheques Digitais COMARA'
        });
      });

      setBatchProgress(null);
      showToast(`${newPaystubs.length} contracheques importados e gravados com sucesso!`, 'success');

      // Audit Trail
      registrarLogAuditoria({
        usuarioId: currentUser?.email || currentUserEmail || 'sistema@comara.aer.mil.br',
        usuarioNome: (currentUser as any)?.nome || (currentUser as any)?.displayName || currentUserEmail || 'Operador',
        usuarioPerfil: userRole || 'DESCONHECIDO',
        canteiroId: currentUser?.canteiroCodigo || 'TODOS',
        tipoAcao: 'IMPORTACAO_FOLHA',
        detalhes: `Importação de folha concluída: ${newPaystubs.length.toLocaleString('pt-BR')} contracheques gravados no Firestore.`,
        detalhesJson: {
          totalContracheques: newPaystubs.length,
          mesAno: newPaystubs[0]?.mesAno || newPaystubs[0]?.periodo || '',
        }
      });
    } catch (err: any) {
      setBatchProgress(null);
      console.error('Erro ao salvar contracheques no Firestore:', err);
      showToast('Erro ao gravar contracheques no Firestore.', 'error');
    }
  };

  const handleDeletePaystub = async (id: string) => {
    try {
      await firestoreService.deletePaystub(id);
      showToast('Contracheque excluído com sucesso.');
    } catch (err: any) {
      console.error('Erro ao deletar contracheque:', err);
      showToast('Erro ao remover contracheque.', 'error');
    }
  };

  const isDark = theme === 'dark';
  const isAdmin = userMode === 'ADMIN' && userRole !== 'AUDITOR';
  const currentUserEmail = currentUser?.email || 'sistema@anonimo';

  // -------------------------------------------------------------
  // RENDER: LOADING STATE
  // -------------------------------------------------------------
  if (isAuthLoading) {
    return (
      <div 
        translate="no"
        className={`notranslate min-h-screen flex items-center justify-center font-mono text-xs ${
          isDark ? 'bg-[#0F1B33] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          <span className="text-gray-400">Verificando credenciais Cloud Firestore...</span>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: VERIFYING PERMISSIONS (S-001 — no provisional role)
  // -------------------------------------------------------------
  if (isVerifyingPermissions) {
    return (
      <div 
        translate="no"
        className={`notranslate min-h-screen flex items-center justify-center font-mono text-xs ${
          isDark ? 'bg-[#0F1B33] text-white' : 'bg-slate-50 text-slate-900'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin"></div>
          <span className="text-gray-400">Verificando permissões...</span>
        </div>
      </div>
    );
  }

  const handleCheckPendingStatus = async () => {
    const email = pendingAccessUser?.email || auth.currentUser?.email || '';
    if (!email) {
      setPendingAccessUser(null);
      return;
    }
    const result = await refreshAdminAccessStatus(email);
    if (!result) {
      showToast('Seu cadastro continua pendente de aprovação.', 'info');
    }
  };

  // -------------------------------------------------------------
  // RENDER: BLOQUEIO DE ACESSO PENDENTE / INATIVO (GOOGLE WORKSPACE)
  // -------------------------------------------------------------
  if (pendingAccessUser) {
    const isInactive = pendingAccessUser.status === 'inativo' || pendingAccessUser.status === 'bloqueado';

    if (isViewingManualModal) {
      return (
        <div className={`notranslate min-h-screen flex flex-col ${isDark ? 'bg-[#0F1B33] text-white' : 'bg-slate-50 text-slate-900'}`}>
          <header className={`py-3 px-4 border-b flex items-center justify-between z-10 sticky top-0 backdrop-blur-md ${isDark ? 'bg-[#16243D]/90 border-[#243756]' : 'bg-white/90 border-slate-200'}`}>
            <button
              type="button"
              onClick={() => setIsViewingManualModal(false)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Tela de Acesso</span>
            </button>
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-400">Autenticado como:</span>
              <span className="text-blue-400 font-bold">{pendingAccessUser.email}</span>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${isDark ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-red-200 text-red-600 hover:bg-red-50'}`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </header>
          <main className="flex-1 p-4 md:p-6 max-w-[1880px] mx-auto w-full">
            <GoogleArchitectureSpec theme={theme} />
          </main>
        </div>
      );
    }

    return (
      <div className={`notranslate min-h-screen flex items-center justify-center px-4 py-12 ${isDark ? 'bg-[#0F1B33] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <div className={`w-full max-w-lg rounded-3xl border p-8 text-center shadow-2xl ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border ${isInactive ? (isDark ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-amber-200 bg-amber-50 text-amber-600') : (isDark ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-blue-200 bg-blue-50 text-blue-600')}`}>
            {isInactive ? <ShieldAlert className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />}
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isInactive ? 'Acesso desativado' : 'Acesso pendente'}
          </h2>
          <p className={`mt-4 text-sm leading-6 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
            {isInactive ? (
              <>Sua conta <span className="font-semibold text-blue-500">{pendingAccessUser.email}</span> está atualmente inativa no sistema. Procure a Seção de TI ou o Gerente do canteiro para solicitar o desbloqueio.</>
            ) : (
              <>Sua conta <span className="font-semibold text-blue-500">{pendingAccessUser.email}</span> foi registrada com sucesso. Solicite ao RH, TI ou Administrador a liberação do seu perfil de acesso.</>
            )}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={handleCheckPendingStatus}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-500 active:scale-[0.98] cursor-pointer"
            >
              Verificar Status novamente
            </button>
            <button
              type="button"
              onClick={() => setIsViewingManualModal(true)}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${isDark ? 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Manual do Sistema</span>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className={`inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${isDark ? 'border-[#335075] bg-[#243756] text-white hover:bg-[#335075]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PORTAL DO COLABORADOR (LANDING PAGE PADRÃO / LGPD)
  // -------------------------------------------------------------
  if (!currentUser) {
    return (
      <div translate="no" className="notranslate min-h-screen flex flex-col">
        {/* Banner de Aviso de Permissão (se houver) */}
        {firestoreErrorNotice && (
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-300 text-xs flex items-center justify-between z-50">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{firestoreErrorNotice} (O sistema está operando com dados locais seguros).</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => initFirestoreSubscriptions()}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 rounded text-[11px] font-bold text-amber-200 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reconectar</span>
              </button>
              <button onClick={() => setFirestoreErrorNotice(null)} className="text-amber-400 hover:text-amber-200 p-0.5">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Toast Notification */}
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 ${
            isDark ? 'bg-[#16243D] text-[#E2E8F0] border-[#243756]' : 'bg-white text-slate-900 border-slate-200'
          } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}

        <ErrorBoundary fallbackTitle="Portal do Colaborador">
          <CollaboratorLandingView
            employees={employees}
            records={records}
            insalubrityRecords={insalubrityRecords}
            paystubs={paystubs}
            onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onViewAttachment={handleViewAttachment}
          />
        </ErrorBoundary>

        {/* Modal de Login Administrativo RH */}
        <AdminLoginModal
          isOpen={isAdminLoginModalOpen}
          onClose={() => setIsAdminLoginModalOpen(false)}
          onGoogleSignIn={handleGoogleSignIn}
          onDevAdminSignIn={handleDevAdminSignIn}
          isDark={isDark}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: VISÃO EXCLUSIVA MOBILE CHEFE / ENCARREGADO / AUX DA (RBAC)
  // -------------------------------------------------------------
  if (
    userRole === 'CHEFE_CANTEIRO' || 
    userRole === 'ENCARREGADO_CANTEIRO' || 
    userRole === 'AUX_DA' || 
    userRole === 'ENCARREGADO_DA'
  ) {
    return (
      <div translate="no" className="notranslate min-h-screen flex flex-col">
        {toastMessage && (
          <div className={`fixed bottom-5 right-5 z-50 ${
            isDark ? 'bg-[#16243D] text-[#E2E8F0] border-[#243756]' : 'bg-white text-slate-900 border-slate-200'
          } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
            {toastMessage.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        )}
        <ErrorBoundary fallbackTitle="Portal de Campo - Canteiro / Divisão Administrativa">
          <SiteSupervisorMobileView
            employees={employees}
            records={records}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onLogout={handleSignOut}
            currentUser={currentUser}
            onOpenSptfDispensa={handleOpenSptfDispensa}
            onOpenNewEntry={(mat) => handleOpenNewEntry(mat)}
            onOpenQuickBatchModal={() => setIsQuickBatchModalOpen(true)}
          />
        </ErrorBoundary>

        {/* Modal: Emissão de Dispensa de SPTF no Canteiro (Guia A4 2 Vias) */}
        <SptfDispensaModal
          isOpen={isSptfDispensaModalOpen}
          onClose={() => {
            setIsSptfDispensaModalOpen(false);
            setSptfDispensaPreselectedMatricula(undefined);
          }}
          employees={employees}
          records={records}
          constructionSites={constructionSites}
          preselectedMatricula={sptfDispensaPreselectedMatricula}
          onSaveDispensa={handleSaveDispensaSptf}
          systemConfig={systemConfig}
          currentUserEmail={currentUserEmail}
          currentUserName={(currentUser as any)?.nome || (currentUser as any)?.displayName || 'Gestor SPTF'}
          theme={theme}
        />

        {/* Modal de Aviso de Expiração de Sessão por Inatividade */}
        <SessionTimeoutModal
          isOpen={isIdleWarning}
          remainingSeconds={idleRemainingSeconds}
          warnSeconds={60}
          profileLabel={idleProfileLabel}
          isDark={isDark}
          onStayLoggedIn={resetIdleTimer}
          onLogoutNow={forceIdleTimeout}
        />
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: PAINEL DE GESTÃO RH AUTENTICADO (CLOUD FIRESTORE)
  // -------------------------------------------------------------
  return (
    <div 
      translate="no"
      className={`notranslate min-h-screen ${isDark ? 'bg-[#0B1426] text-[#E2E8F0]' : 'bg-[#F8FAFC] text-slate-900'} flex flex-col font-sans antialiased selection:bg-[#3B82F6] selection:text-white transition-colors`}
    >
      
      {/* Banner de Aviso de Permissão de Banco de Dados */}
      {firestoreErrorNotice && (
        <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2.5 text-amber-300 text-xs flex items-center justify-between z-40">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">{firestoreErrorNotice} (O sistema mantém o funcionamento contínuo via cache local sincronizado).</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => initFirestoreSubscriptions()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg text-[11px] font-bold text-amber-200 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Tentar Reconectar</span>
            </button>
            <button onClick={() => setFirestoreErrorNotice(null)} className="text-amber-400 hover:text-amber-200 p-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className={`fixed bottom-5 right-5 z-50 ${
          isDark ? 'bg-[#16243D] text-[#E2E8F0] border-[#243756]' : 'bg-white text-slate-900 border-slate-200'
        } px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-semibold animate-in slide-in-from-bottom-5 duration-200`}>
          {toastMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Modal de Progresso de Gravação em Lote (4.500+ registros) */}
      {batchProgress && batchProgress.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl ${
            isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Database className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h4 className="font-bold text-sm">{batchProgress.title}</h4>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                  Gravando em lotes atômicos de até 400 registros
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono">
                <span className={isDark ? 'text-gray-400' : 'text-slate-600'}>
                  Lote {batchProgress.chunkIndex} de {batchProgress.totalChunks}
                </span>
                <span className="font-bold text-blue-500">
                  {batchProgress.percent}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-700/30 overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300 rounded-full"
                  style={{ width: `${batchProgress.percent}%` }}
                />
              </div>
              <p className={`text-[11px] text-right font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                {batchProgress.processed.toLocaleString('pt-BR')} de {batchProgress.total.toLocaleString('pt-BR')} registros gravados
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenNewEntry={() => handleOpenNewEntry()}
        onOpenQuickBatchModal={handleOpenQuickBatchModal}
        onOpenSptfDispensa={() => handleOpenSptfDispensa()}
        onResetData={handleTriggerLoadMocksSafety}
        onClearData={handleTriggerClearDataSafety}
        onOpenImportRecordsModal={() => setIsImportRecordsModalOpen(true)}
        onOpenLogoModal={() => setIsLogoModalOpen(true)}
        systemConfig={systemConfig}
        totalEmployees={employees.length}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        userMode={userMode}
        onToggleUserMode={handleToggleUserMode}
        currentUserEmail={currentUserEmail}
        userRole={userRole}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-[1880px] w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6">
        {/* Barra de Gestão Contábil de Competência (Homologação & Transporte de Saldos) */}
        <div className="mb-6">
          <CompetenciaStatusBar
            competencia={currentCompetencia}
            controle={competenciaControle}
            onSelectCompetencia={handleSelectCompetencia}
            onOpenManagementModal={() => setIsCompetenciaModalOpen(true)}
            isGlobalAdmin={isGlobalUser}
            theme={theme}
          />
        </div>

        <ErrorBoundary fallbackTitle="Erro ao carregar aba selecionada">
          {activeTab === 'dashboard' && (
            <LookerDashboard
              employees={employees}
              records={records}
              constructionSites={constructionSites}
              onOpenNewEntryModal={(mat) => handleOpenNewEntry(mat)}
              onOpenEditEntryModal={(rec) => handleOpenEditEntry(rec)}
              onDeleteRecord={(id) => handleDeleteRecord(id)}
              onViewEmployeeStatement={(mat) => handleViewStatement(mat)}
              onViewAttachment={handleViewAttachment}
              onOpenImportRecordsModal={() => setIsImportRecordsModalOpen(true)}
              onOpenQuickBatchModal={() => setIsQuickBatchModalOpen(true)}
              onOpenSptfDispensa={() => handleOpenSptfDispensa()}
              onNavigateToEmployees={() => setActiveTab('colaboradores')}
              onResetData={handleTriggerLoadMocksSafety}
              onClearData={handleTriggerClearDataSafety}
              userRole={userRole}
              theme={theme}
            />
          )}

          {activeTab === 'colaboradores' && (
            <EmployeeManagement
              employees={employees}
              records={records}
              constructionSites={constructionSites}
              dispensas={dispensasSptf}
              onUpdateEmployees={handleUpdateEmployees}
              onViewStatement={(mat) => handleViewStatement(mat)}
              onQuickNewEntry={(mat) => handleOpenNewEntry(mat)}
              onOpenSptfDispensa={(mat) => handleOpenSptfDispensa(mat)}
              theme={theme}
            />
          )}

          {activeTab === 'canteiros' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Canteiros Restrita"
              fallbackMessage="Apenas administradores de TI (SUPER_ADMIN) ou RH Sede possuem permissão para criar, editar ou desativar canteiros de obras."
            >
              <CanteirosManagement
                constructionSites={constructionSites}
                employees={employees}
                insalubrityRecords={insalubrityRecords}
                onSaveSite={handleSaveConstructionSite}
                onDeleteSite={handleDeleteConstructionSite}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'insalubridade' && (
            <ProtectedRoute
              requiredPermission={(role) => rbacService.canValidateInsalubrity(role) || role === 'AUDITOR'}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Módulo de Insalubridade"
              fallbackMessage="Seu perfil não possui autorização para homologação de laudos de insalubridade."
            >
              <InsalubrityManagement
                employees={employees}
                insalubrityRecords={insalubrityRecords}
                onSaveRecord={handleSaveInsalubrityRecord}
                onSaveBatchRecords={handleSaveInsalubrityBatch}
                onDeleteRecord={handleDeleteInsalubrityRecord}
                onUpdateEmployeeGrauFixa={handleUpdateEmployeeGrauFixa}
                onUpdateEmployees={handleUpdateEmployees}
                onNavigateToReports={() => setActiveTab('relatorios')}
                onFetchPeriod={handleFetchInsalubrityPeriod}
                systemConfig={systemConfig}
                onUpdateSystemConfig={handleSaveSystemConfig}
                constructionSites={constructionSites}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'relatorios' && (
            <ExecutiveReportsView
              employees={employees}
              records={records}
              insalubrityRecords={insalubrityRecords}
              constructionSites={constructionSites}
              systemConfig={systemConfig}
              currentUserEmail={currentUserEmail}
              userRole={userRole}
              onSaveInsalubrityBatch={handleSaveInsalubrityBatch}
              onFetchInsalubrityPeriod={handleFetchInsalubrityPeriod}
              onNavigateToInsalubrity={() => setActiveTab('insalubridade')}
              onOpenSptfDispensa={() => handleOpenSptfDispensa()}
              theme={theme}
            />
          )}

          {activeTab === 'extrato' && (
            <EmployeeStatement
              employees={employees}
              records={records}
              insalubrityRecords={insalubrityRecords}
              constructionSites={constructionSites}
              paystubs={paystubs}
              selectedMatricula={selectedMatricula}
              onSelectMatricula={setSelectedMatricula}
              onBack={() => setActiveTab('dashboard')}
              onOpenNewEntry={(mat) => handleOpenNewEntry(mat)}
              onOpenSptfDispensa={(mat) => handleOpenSptfDispensa(mat)}
              onOpenEditEntry={(rec) => handleOpenEditEntry(rec)}
              onDeleteRecord={(id) => handleDeleteRecord(id)}
              onViewAttachment={handleViewAttachment}
              onUpdateEmployees={handleUpdateEmployees}
              theme={theme}
            />
          )}

          {activeTab === 'portal_colaborador' && (
            <EmployeeSelfServicePortal
              employees={employees}
              records={records}
              paystubs={paystubs}
              theme={theme}
            />
          )}

          {activeTab === 'dispensas_faltas' && (
            <DispensasFaltasManagement
              employees={employees}
              constructionSites={constructionSites}
              currentUserEmail={currentUserEmail}
              userRole={userRole}
              theme={theme}
              onViewEmployeeStatement={(mat) => handleViewStatement(mat)}
              onOpenNewEntry={(mat) => handleOpenNewEntry(mat)}
              onOpenNewDispensa={(mat) => handleOpenSptfDispensa(mat)}
              onDeleteDispensa={handleDeleteDispensaSptf}
            />
          )}

          {activeTab === 'contracheques' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Folha & Contracheques Restrita"
              fallbackMessage="A importação da folha de pagamento e gestão de espelhos de contracheque são exclusivas da equipe central de RH (Sede) e TI."
            >
              <ContrachequesManagement
                employees={employees}
                paystubs={paystubs}
                constructionSites={constructionSites}
                onSaveBatchPaystubs={handleSaveBatchPaystubs}
                onSaveEmployees={handleUpdateEmployees}
                onDeletePaystub={handleDeletePaystub}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'permissoes_admin' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN']}
              requiredPermission={(role, u) => rbacService.canManageAdmins(role, u?.email)}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Gestão de Permissões e Acessos RH"
              fallbackMessage="O gerenciamento de usuários administrativos, regras de 48h e níveis de acesso é de uso exclusivo do Super Administrador (TI)."
            >
              <AdminPermissionsManagement
                theme={theme}
                currentUserEmail={currentUserEmail}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'auditoria' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN', 'RH_ADMIN', 'GESTOR_RH', 'AUDITOR']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Trilha de Auditoria & Logs de Segurança"
              fallbackMessage="O acesso aos registros de auditoria e logs de segurança é restrito a Administradores (Super Admin e RH Admin) para conformidade com a LGPD."
            >
              <AuditTrailView
                constructionSites={constructionSites}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                theme={theme}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'configuracoes_instituicao' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Configurações Institucionais Restritas"
              fallbackMessage="A parametrização de identidade da Organização Militar, cargos de comando, horários e normas de cálculo é restrita exclusivamente ao Administrador Geral (SUPER_ADMIN / TI)."
            >
              <SettingsPage
                theme={theme}
                currentUserEmail={currentUserEmail}
                userRole={userRole}
                onShowToast={(msg, type) => showToast(msg, type)}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'backup_restauracao' && (
            <ProtectedRoute
              allowedRoles={['SUPER_ADMIN']}
              currentUserRole={userRole}
              currentUser={currentUser}
              onRedirectToDashboard={() => setActiveTab('dashboard')}
              fallbackTitle="Backup e Restauração Restritos"
              fallbackMessage="A exportação e restauração completa do Firestore são operações exclusivas do Super Administrador (TI)."
            >
              <BackupRestorePanel 
                theme={theme} 
                userRole={userRole} 
                onTriggerSeed={handleTriggerLoadMocksSafety}
                onTriggerClear={handleTriggerClearDataSafety}
              />
            </ProtectedRoute>
          )}

          {activeTab === 'arquitetura' && (
            <GoogleArchitectureSpec theme={theme} />
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className={`${isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-white border-slate-200 text-slate-500'} border-t py-4 px-6 text-center text-xs mt-auto transition-colors`}>
        <div className="max-w-[1880px] mx-auto px-2 sm:px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-mono text-[11px] sm:text-xs flex items-center gap-1.5 justify-center sm:justify-start">
            <Cloud className="w-3.5 h-3.5 text-blue-500" />
            <span>Base Oficial Conectada ao Cloud Firestore ({employees.length.toLocaleString('pt-BR')} colaboradores • {records.length.toLocaleString('pt-BR')} lançamentos)</span>
          </span>
          <span className="text-[11px] sm:text-xs font-sans">
            COMARA • Sistema de Gestão de Banco de Horas SPTF & LGPD
          </span>
        </div>
      </footer>

      {/* MODALS */}
      {/* 1. Modal: Lançamento Diário Individual */}
      <DailyEntryModal
        isOpen={isDailyEntryModalOpen}
        onClose={() => setIsDailyEntryModalOpen(false)}
        employees={employees}
        preselectedMatricula={dailyEntryPreselectedMatricula}
        preselectedDate={dailyEntryPreselectedDate}
        initialRecord={dailyEntryInitialRecord}
        onSaveRecord={handleSaveRecord}
        onSaveBatch={handleImportRecordsBatch}
        onDeleteRecord={handleDeleteRecord}
        theme={theme}
      />

      {/* 2. Modal: Lançamento Rápido em Lote */}
      <QuickBatchEntryModal
        isOpen={isQuickBatchModalOpen}
        onClose={() => setIsQuickBatchModalOpen(false)}
        employees={employees}
        onSaveBatch={handleImportRecordsBatch}
        userRole={userRole}
        theme={theme}
      />

      {/* 3. Modal: Emissão de Dispensa de SPTF (Compensação com Guia A4 2 Vias) */}
      <SptfDispensaModal
        isOpen={isSptfDispensaModalOpen}
        onClose={() => {
          setIsSptfDispensaModalOpen(false);
          setSptfDispensaPreselectedMatricula(undefined);
        }}
        employees={employees}
        records={records}
        constructionSites={constructionSites}
        preselectedMatricula={sptfDispensaPreselectedMatricula}
        onSaveDispensa={handleSaveDispensaSptf}
        systemConfig={systemConfig}
        currentUserEmail={currentUserEmail}
        currentUserName={(currentUser as any)?.nome || (currentUser as any)?.displayName || 'Gestor SPTF'}
        theme={theme}
      />

      {/* 4. Modal: Importar Lançamentos Diários CSV */}
      <ImportTimeRecordsModal
        isOpen={isImportRecordsModalOpen}
        onClose={() => setIsImportRecordsModalOpen(false)}
        employees={employees}
        onImportRecords={handleImportRecordsBatch}
        theme={theme}
      />

      {/* 5. Modal: Pré-visualização de Atestados / Certificados */}
      <CertificatePreviewModal
        isOpen={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
        attachment={previewAttachment}
        employeeName={previewEmployeeName}
        recordDate={previewRecordDate}
        theme={theme}
      />

      {/* 6. Modal: Configuração de Logo e Identidade Visual COMARA */}
      <ComaraLogoModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        currentConfig={systemConfig}
        onSaveConfig={handleSaveSystemConfig}
        theme={theme}
      />

      {/* 7. Modal: Confirmação e Segurança de Banco de Dados com Ponto de Restauração */}
      <DatabaseSafetyActionModal
        isOpen={isSafetyModalOpen}
        onClose={() => setIsSafetyModalOpen(false)}
        actionType={safetyActionType}
        employees={employees}
        records={records}
        insalubrityRecords={insalubrityRecords}
        constructionSites={constructionSites}
        systemConfig={systemConfig}
        onConfirmClear={handleExecuteClearDatabase}
        onConfirmLoadMocks={handleExecuteLoadMocks}
        onRestoreSnapshot={handleRestoreSnapshot}
        theme={theme}
      />

      {/* 8. Modal de Aviso de Expiração de Sessão por Inatividade (Auto-Logoff) */}
      <SessionTimeoutModal
        isOpen={isIdleWarning}
        remainingSeconds={idleRemainingSeconds}
        warnSeconds={60}
        profileLabel={idleProfileLabel}
        isDark={isDark}
        onStayLoggedIn={resetIdleTimer}
        onLogoutNow={forceIdleTimeout}
      />

      {/* 9. Indicador de Conexão Offline PWA */}
      <OfflineIndicator theme={theme} />

      {/* 10. Modal: Gestão de Competência e Fechamento Contábil */}
      <CompetenciaManagementModal
        isOpen={isCompetenciaModalOpen}
        onClose={() => setIsCompetenciaModalOpen(false)}
        competencia={currentCompetencia}
        controle={competenciaControle}
        employees={employees}
        records={records}
        currentUserEmail={currentUserEmail}
        isGlobalAdmin={isGlobalUser}
        theme={theme}
        onCompetenciaUpdated={(comp) => carregarControleCompetencia(comp)}
        onShowToast={showToast}
      />
    </div>
  );
}
