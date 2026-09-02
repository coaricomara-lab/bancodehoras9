import React, { useState, useEffect, useRef } from 'react';
import { 
  UserPlus, 
  Edit2, 
  X, 
  Camera, 
  Check, 
  AlertCircle, 
  Lock, 
  Sparkles, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  HelpCircle,
  User,
  ShieldCheck,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { Branch, ConstructionSite, Employee, EmployeeStatus } from '../types';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';

interface InfoTooltipProps {
  content: string;
  theme?: 'dark' | 'light';
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ content, theme = 'dark' }) => {
  const [show, setShow] = useState(false);
  const isDark = theme === 'dark';

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={(e) => {
          e.preventDefault();
          setShow(!show);
        }}
        className="text-slate-400 hover:text-blue-400 transition-colors p-0.5 focus:outline-hidden cursor-help"
        aria-label="Informação adicional"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {show && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-lg shadow-xl text-[11px] leading-relaxed pointer-events-none transition-all duration-200 border ${
            isDark
              ? 'bg-[#0B1426] text-slate-200 border-[#243756] shadow-black/60'
              : 'bg-white text-slate-700 border-slate-200 shadow-slate-300/50'
          }`}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export interface EmployeeFormModalProps {
  isOpen: boolean;
  employee?: Employee | null;
  employees?: Employee[];
  constructionSites?: ConstructionSite[];
  theme?: 'dark' | 'light';
  onClose: () => void;
  onSaveSuccess?: (savedEmployee: Employee, allUpdatedEmployees?: Employee[]) => void;
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  employee,
  employees = [],
  constructionSites = [],
  theme = 'dark',
  onClose,
  onSaveSuccess,
}) => {
  const isDark = theme === 'dark';
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Tab state: 'dados' | 'regime'
  const [activeTab, setActiveTab] = useState<'dados' | 'regime'>('dados');

  // Form fields
  const [matricula, setMatricula] = useState('');
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('Operador de Campo');
  const [sede, setSede] = useState<Branch>('KO');
  const [sedeAtual, setSedeAtual] = useState<Branch>('KO');
  const [isAlocadoTemporario, setIsAlocadoTemporario] = useState(false);
  const [dataInicioAlocacao, setDataInicioAlocacao] = useState('');
  const [dataFimAlocacao, setDataFimAlocacao] = useState('');
  const [dataAdmissao, setDataAdmissao] = useState('');
  const [status, setStatus] = useState<EmployeeStatus>('Ativo');
  const [dataInicioStatus, setDataInicioStatus] = useState('');
  const [dataFimStatus, setDataFimStatus] = useState('');
  const [motivoStatus, setMotivoStatus] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [grauInsalubridadeFixa, setGrauInsalubridadeFixa] = useState<string>('ISENTO');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  // UI status
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const isEditing = Boolean(employee);

  // Initialize form whenever modal opens or employee prop changes
  useEffect(() => {
    if (isOpen) {
      setActiveTab('dados');
      setFormError('');
      setShowInitialPassword(false);

      if (employee) {
        setMatricula(employee.matricula);
        setNome(employee.nome);
        setFuncao(employee.funcao || employee.cargo || 'Operador de Campo');
        setSede(employee.sede_origem || employee.sede || 'KO');
        setSedeAtual(employee.sede_atual || employee.sede || 'KO');
        setIsAlocadoTemporario(Boolean(employee.sede_atual && employee.sede_atual !== (employee.sede_origem || employee.sede)));
        setDataInicioAlocacao(employee.dataInicioAlocacao || '');
        setDataFimAlocacao(employee.dataFimAlocacao || '');
        setDataAdmissao(employee.dataAdmissao || '2024-01-01');
        setStatus(employee.status || 'Ativo');
        setDataInicioStatus(employee.dataInicioStatus || '');
        setDataFimStatus(employee.dataFimStatus || '');
        setMotivoStatus(employee.motivoStatus || '');
        setEmail(employee.email || '');
        setTelefone(employee.telefone || '');
        setSaldoInicial(employee.saldoInicialHoras || 0);
        setGrauInsalubridadeFixa(employee.grauInsalubridadeFixa || 'ISENTO');
        setAvatarUrl(employee.avatarUrl || employee.url_foto_perfil || '');
        setInitialPassword('');
      } else {
        setMatricula(`MAT-${Math.floor(1000 + Math.random() * 9000)}`);
        setNome('');
        setFuncao('Operador de Campo');
        setSede('KO');
        setSedeAtual('KO');
        setIsAlocadoTemporario(false);
        setDataInicioAlocacao('');
        setDataFimAlocacao('');
        setDataAdmissao(new Date().toISOString().split('T')[0]);
        setStatus('Ativo');
        setDataInicioStatus('');
        setDataFimStatus('');
        setMotivoStatus('');
        setEmail('');
        setTelefone('');
        setSaldoInicial(0);
        setGrauInsalubridadeFixa('ISENTO');
        setAvatarUrl('');
        setInitialPassword('');
      }
    }
  }, [isOpen, employee]);

  if (!isOpen) return null;

  const handleGenerateRandom6DigitPassword = () => {
    const random6 = Math.floor(100000 + Math.random() * 900000).toString();
    setInitialPassword(random6);
    setShowInitialPassword(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      setTimeout(() => {
        const photoData = event.target?.result as string;
        setAvatarUrl(photoData);
        setIsUploadingPhoto(false);
      }, 400);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!matricula.trim() || !nome.trim()) {
      setActiveTab('dados');
      setFormError('Matrícula e Nome são campos obrigatórios.');
      return;
    }

    const cleanMatricula = matricula.trim().toUpperCase();

    if (!isEditing && employees.length > 0) {
      const exists = employees.some((e) => e.matricula.toUpperCase() === cleanMatricula);
      if (exists) {
        setActiveTab('dados');
        setFormError(`Já existe um colaborador cadastrado com a matrícula "${cleanMatricula}".`);
        return;
      }
    }

    const hasInitialPassword = initialPassword.trim().length >= 4;

    const primeiroAcesso = hasInitialPassword
      ? false
      : (isEditing ? (employee!.primeiroAcesso ?? true) : true);

    const senhaCadastrada = hasInitialPassword
      ? true
      : (isEditing ? (employee!.senhaCadastrada ?? false) : false);

    const employeeToSave: Employee = {
      id: employee ? employee.id : `emp-${Date.now()}`,
      matricula: cleanMatricula,
      nome: nome.trim(),
      funcao: funcao.trim() || 'Técnico de Manutenção',
      cargo: funcao.trim() || 'Técnico de Manutenção',
      sede,
      sede_origem: sede,
      sede_atual: isAlocadoTemporario ? sedeAtual : sede,
      dataInicioAlocacao: isAlocadoTemporario ? dataInicioAlocacao : undefined,
      dataFimAlocacao: isAlocadoTemporario ? dataFimAlocacao : undefined,
      dataAdmissao: dataAdmissao || '2024-01-15',
      status,
      dataInicioStatus: ['Férias', 'Afastado'].includes(status) ? dataInicioStatus : undefined,
      dataFimStatus: ['Férias', 'Afastado'].includes(status) ? dataFimStatus : undefined,
      motivoStatus: ['Férias', 'Afastado'].includes(status) ? motivoStatus : undefined,
      email: email.trim(),
      telefone: telefone.trim(),
      saldoInicialHoras: Number(saldoInicial) || 0,
      grauInsalubridadeFixa: (grauInsalubridadeFixa as any) || 'ISENTO',
      primeiroAcesso,
      senhaCadastrada,
      senhaInicial: hasInitialPassword ? initialPassword.trim() : undefined,
      avatarUrl: avatarUrl || undefined,
      url_foto_perfil: avatarUrl || undefined,
      id_drive_foto: employee?.id_drive_foto || `foto_${cleanMatricula}_drive`,
    };

    setIsSaving(true);
    try {
      // 1. Gravação direta no Firestore
      await firestoreService.saveEmployee(employeeToSave);

      // 2. Se o RH definiu a senha inicial, registra no módulo de Auth
      if (hasInitialPassword) {
        await authService.setPasswordByAdmin(
          cleanMatricula,
          nome.trim(),
          initialPassword.trim(),
          'RH'
        );
      }

      // 3. Log de Auditoria no Firestore
      await firestoreService.logSystemEvent({
        tipo: 'ALTERACAO_PERMISSAO_RBAC',
        descricao: isEditing 
          ? `Edição de perfil/cadastro do colaborador #${cleanMatricula} (${nome.trim()})`
          : `Cadastro de novo colaborador #${cleanMatricula} (${nome.trim()})`,
        usuario: 'GESTOR_RH',
        matricula: cleanMatricula,
        detalhes: {
          matricula: cleanMatricula,
          nome: nome.trim(),
          funcao: funcao.trim(),
          sede,
          status,
        }
      });

      // 4. Lista atualizada
      let updatedList: Employee[] = [];
      if (employees.length > 0) {
        if (isEditing) {
          updatedList = employees.map((emp) => (emp.id === employeeToSave.id ? employeeToSave : emp));
        } else {
          updatedList = [employeeToSave, ...employees];
        }
      }

      onSaveSuccess?.(employeeToSave, updatedList.length > 0 ? updatedList : undefined);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar colaborador:', err);
      setFormError(err?.message || 'Erro ao gravar informações no Cloud Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-modal-title"
    >
      <div 
        className={`w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border flex flex-col max-h-[92vh] sm:max-h-[88vh] ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
        }`}
        id="employee-form-modal"
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
          isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <Edit2 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            ) : (
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
            )}
            <h3 id="employee-modal-title" className={`font-bold text-sm sm:text-base ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isEditing ? 'Editar Colaborador' : 'Cadastrar Novo Colaborador'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className={`p-1 rounded-lg text-slate-400 hover:text-red-400 transition-colors cursor-pointer ${
              isDark ? 'hover:bg-[#243756]' : 'hover:bg-slate-200'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Controls (Dividido em 2 abas para caber em telas menores) */}
        <div className={`flex border-b px-4 pt-2 gap-2 shrink-0 ${
          isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('dados')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
              activeTab === 'dados'
                ? isDark
                  ? 'border-blue-500 text-blue-400 bg-[#16243D]'
                  : 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>1. Dados Cadastrais & Lotação</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('regime')}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-t-lg transition-all border-b-2 cursor-pointer ${
              activeTab === 'regime'
                ? isDark
                  ? 'border-blue-500 text-blue-400 bg-[#16243D]'
                  : 'border-blue-600 text-blue-600 bg-white shadow-xs'
                : isDark
                  ? 'border-transparent text-slate-400 hover:text-slate-200'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>2. Regime, Banco & Acesso</span>
          </button>
        </div>

        {/* Form Error Banner */}
        {formError && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-red-950/40 border border-red-800/60 rounded-lg text-xs text-red-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {/* Scrollable Form Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs font-mono">
          
          {/* ========================================================================= */}
          {/* ABA 1: DADOS CADASTRAIS & LOTAÇÃO                                         */}
          {/* ========================================================================= */}
          {activeTab === 'dados' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Foto de Perfil / Upload Google Drive */}
              <div className={`p-3 rounded-xl border flex items-center gap-3.5 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="relative group shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Foto do colaborador"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full object-cover border-2 border-blue-500/50 shadow-md"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border flex items-center justify-center font-bold text-sm sm:text-base ${
                      isDark 
                        ? 'bg-[#243756] border-[#335075] text-blue-400' 
                        : 'bg-blue-50 border-blue-200 text-blue-600'
                    }`}>
                      {nome ? nome.split(' ').map((n) => n[0]).slice(0, 2).join('') : <Camera className="w-5 h-5 text-slate-400" />}
                    </div>
                  )}
                  {isUploadingPhoto && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className={`font-bold text-[11px] block font-sans ${
                      isDark ? 'text-[#E2E8F0]' : 'text-slate-800'
                    }`}>
                      Foto de Perfil (Google Drive)
                    </label>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="text-[10px] text-red-500 hover:underline cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                  <p className={`text-[10px] font-sans truncate ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                    Salva em <code className="text-blue-500">/Banco_de_Horas/Fotos_Colaboradores/FOTO_{matricula || 'MAT'}.jpg</code>
                  </p>
                  <div className="flex items-center gap-2 pt-0.5">
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className={`px-2.5 py-1 border rounded-md font-medium text-[10px] inline-flex items-center gap-1.5 transition-colors active:scale-[0.98] font-sans cursor-pointer ${
                        isDark 
                          ? 'bg-[#243756] hover:bg-[#335075] text-[#E2E8F0] border-[#335075]' 
                          : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <Camera className="w-3 h-3 text-blue-500" />
                      {avatarUrl ? 'Alterar Imagem' : 'Carregar Imagem (JPG/PNG)'}
                    </button>
                    {avatarUrl && (
                      <span className="text-[10px] text-emerald-500 inline-flex items-center gap-1 font-mono">
                        <Check className="w-3 h-3" /> Imagem vinculada
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Matrícula & Sede / Canteiro de Origem */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Matrícula <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={matricula}
                    onChange={(e) => setMatricula(e.target.value)}
                    placeholder="Ex: MAT-1090"
                    className={`w-full px-3 py-2 rounded-lg font-mono font-bold border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Sede / Canteiro <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={sede}
                    onChange={(e) => setSede(e.target.value as Branch)}
                    className={`w-full px-3 py-2 rounded-lg font-semibold border focus:outline-hidden cursor-pointer ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  >
                    {Array.isArray(constructionSites) && constructionSites.length > 0 ? (
                      constructionSites.map((site) => {
                        const code = (site.code || site.codigo || site.branch || site.sede || '').toUpperCase();
                        const name = site.name || site.nome || `Canteiro ${code}`;
                        return (
                          <option key={site.id || code} value={code}>
                            {code} — {name}
                          </option>
                        );
                      })
                    ) : (
                      <>
                        <option value="KO">KO — Coari (AM)</option>
                        <option value="BE">BE — Belém (PA)</option>
                        <option value="MN">MN — Manaus (AM)</option>
                        <option value="SP">SP — São Paulo (SP)</option>
                        <option value="RJ">RJ — Rio de Janeiro (RJ)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Nome Completo */}
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do colaborador"
                  className={`w-full px-3 py-2 rounded-lg border font-sans text-xs focus:outline-hidden ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                  required
                />
              </div>

              {/* Função / Cargo & Data de Admissão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Função / Cargo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex: Operador de Campo / Técnico"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                    required
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Data de Admissão
                  </label>
                  <input
                    type="date"
                    value={dataAdmissao}
                    onChange={(e) => setDataAdmissao(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Status do Colaborador */}
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EmployeeStatus)}
                  className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden cursor-pointer ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                >
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo / Desligado</option>
                  <option value="Afastado">Afastado (INSS / Licença)</option>
                  <option value="Férias">Férias</option>
                </select>
              </div>

              {/* Campos Condicionais de Status (Férias / Afastamento) */}
              {['Férias', 'Afastado'].includes(status) && (
                <div className={`p-3.5 rounded-xl border space-y-2.5 animate-in fade-in ${
                  isDark ? 'bg-amber-950/20 border-amber-800/40' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className={`flex items-center gap-1.5 font-bold text-[11px] ${
                    isDark ? 'text-amber-400' : 'text-amber-800'
                  }`}>
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Período Vigente de {status.toUpperCase()}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                        Data Início do Período *
                      </label>
                      <input
                        type="date"
                        required
                        value={dataInicioStatus}
                        onChange={(e) => setDataInicioStatus(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                          isDark 
                            ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20' 
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                        Data Término do Período *
                      </label>
                      <input
                        type="date"
                        required
                        value={dataFimStatus}
                        onChange={(e) => setDataFimStatus(e.target.value)}
                        className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                          isDark 
                            ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20' 
                            : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                        }`}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                      Motivo / Justificativa (Ex: Período Aquisitivo 2024, Licença INSS)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Férias 30 dias regulamentares"
                      value={motivoStatus}
                      onChange={(e) => setMotivoStatus(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                        isDark 
                          ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20' 
                          : 'bg-white border-slate-300 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                      }`}
                    />
                  </div>
                </div>
              )}

              {/* Contatos: E-mail & Telefone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@empresa.com.br"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                    Telefone
                  </label>
                  <input
                    type="text"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    placeholder="(92) 99999-9999"
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* ABA 2: REGIME, BANCO DE HORAS & ACESSO                                    */}
          {/* ========================================================================= */}
          {activeTab === 'regime' && (
            <div className="space-y-3.5 animate-in fade-in">
              {/* Insalubridade & Saldo Inicial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                      Insalubridade Fixa (NR-15)
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Percentual de adicional de insalubridade fixo em folha de pagamento (NR-15). ISENTO (0%), 10% (Grau Mínimo), 20% (Grau Médio) ou 40% (Grau Máximo)."
                    />
                  </div>
                  <select
                    value={grauInsalubridadeFixa}
                    onChange={(e) => setGrauInsalubridadeFixa(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border focus:outline-hidden cursor-pointer font-bold ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' 
                        : 'bg-white border-slate-300 text-amber-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                    }`}
                  >
                    <option value="ISENTO">ISENTO (Padrão)</option>
                    <option value="10%">10% (Grau Mínimo)</option>
                    <option value="20%">20% (Grau Médio)</option>
                    <option value="40%">40% (Grau Máximo)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className={`block font-semibold ${isDark ? 'text-[#94A3B8]' : 'text-slate-700'}`}>
                      Saldo Inicial (Horas)
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Saldo legado de horas extras ou débitos anteriores ao início do controle neste sistema."
                    />
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(parseFloat(e.target.value) || 0)}
                    placeholder="0.0"
                    className={`w-full px-3 py-2 rounded-lg font-bold border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Prestação de Serviço Temporária (Missão em Outro Canteiro) */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-blue-950/20 border-blue-900/40' : 'bg-blue-50 border-blue-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isAlocadoTemporario}
                        onChange={(e) => setIsAlocadoTemporario(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                      />
                      <span className={`font-bold text-[11px] ${isDark ? 'text-blue-400' : 'text-blue-800'}`}>
                        Prestação de Serviço Temporária (Missão em Outro Canteiro)
                      </span>
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content={`As horas registradas durante a vigência da missão temporária serão computadas e visualizadas no canteiro selecionado (${sedeAtual}).`}
                    />
                  </div>
                </div>

                {isAlocadoTemporario && (
                  <div className="space-y-2.5 pt-1 animate-in fade-in">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                          Canteiro Alocado
                        </label>
                        <select
                          value={sedeAtual}
                          onChange={(e) => setSedeAtual(e.target.value as Branch)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs font-bold border focus:outline-hidden cursor-pointer ${
                            isDark 
                              ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                          }`}
                        >
                          {Array.isArray(constructionSites) && constructionSites.length > 0 ? (
                            constructionSites.map((site) => {
                              const code = (site.code || site.codigo || site.branch || site.sede || '').toUpperCase();
                              const name = site.name || site.nome || `Canteiro ${code}`;
                              return (
                                <option key={site.id || code} value={code}>
                                  {code} — {name}
                                </option>
                              );
                            })
                          ) : (
                            <>
                              <option value="KO">KO — Coari</option>
                              <option value="BE">BE — Belém</option>
                              <option value="MN">MN — Manaus</option>
                              <option value="SP">SP — São Paulo</option>
                              <option value="RJ">RJ — Rio de Janeiro</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                          Início da Missão
                        </label>
                        <input
                          type="date"
                          value={dataInicioAlocacao}
                          onChange={(e) => setDataInicioAlocacao(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                            isDark 
                              ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`block font-semibold text-[10px] mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                          Término Previsto
                        </label>
                        <input
                          type="date"
                          value={dataFimAlocacao}
                          onChange={(e) => setDataFimAlocacao(e.target.value)}
                          className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-hidden ${
                            isDark 
                              ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20' 
                              : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Senha Inicial do Colaborador (Opcional - RH) */}
              <div className={`p-3.5 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-[#0F1B33] border-[#335075]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <label className={`flex items-center gap-1.5 font-bold text-xs ${
                      isDark ? 'text-[#E2E8F0]' : 'text-slate-800'
                    }`}>
                      <Lock className="w-3.5 h-3.5 text-blue-500" />
                      <span>Senha Inicial do Colaborador (Opcional - RH)</span>
                    </label>
                    <InfoTooltip 
                      theme={theme}
                      content="Regra: Se preenchida, o colaborador poderá consultar o extrato imediatamente informando Matrícula + Senha. Se deixada em branco, o colaborador definirá sua própria senha no Primeiro Acesso."
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateRandom6DigitPassword}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all active:scale-95 cursor-pointer ${
                        isDark 
                          ? 'bg-blue-950/50 text-blue-300 border-blue-700/60 hover:bg-blue-900/60 shadow-xs' 
                          : 'bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100 shadow-xs'
                      }`}
                      title="Gerar sugestão de senha numérica aleatória de 6 dígitos"
                    >
                      <Sparkles className="w-3 h-3 text-blue-400" />
                      <span>Gerar 6 Dígitos</span>
                    </button>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      employee?.senhaCadastrada 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {employee?.senhaCadastrada ? 'Senha cadastrada' : 'Primeiro acesso pendente'}
                    </span>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type={showInitialPassword ? 'text' : 'password'}
                    value={initialPassword}
                    onChange={(e) => setInitialPassword(e.target.value)}
                    placeholder={isEditing ? "Deixe em branco para manter a senha atual ou use o gerador acima" : "Digite ou clique em 'Gerar 6 Dígitos' (mín. 4 caracteres)"}
                    className={`w-full px-3 py-2 pr-10 rounded-lg text-xs font-mono border focus:outline-hidden ${
                      isDark 
                        ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowInitialPassword(!showInitialPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 p-1 cursor-pointer"
                    aria-label={showInitialPassword ? "Ocultar senha" : "Exibir senha"}
                  >
                    {showInitialPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className={`pt-3 mt-2 border-t flex flex-wrap items-center justify-between gap-2 font-sans ${
            isDark ? 'border-[#243756]' : 'border-slate-200'
          }`}>
            {/* Quick Tab Switcher */}
            <div>
              {activeTab === 'dados' ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('regime')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all active:scale-[0.98] cursor-pointer ${
                    isDark 
                      ? 'border-[#335075] text-slate-300 hover:bg-[#243756]' 
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span>Próximo: Regime & Acesso</span>
                  <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveTab('dados')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all active:scale-[0.98] cursor-pointer ${
                    isDark 
                      ? 'border-[#335075] text-slate-300 hover:bg-[#243756]' 
                      : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5 text-blue-500" />
                  <span>Voltar aos Dados</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                disabled={isSaving}
                onClick={onClose}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg cursor-pointer disabled:opacity-50 transition-colors ${
                  isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 text-xs font-bold text-white bg-[#3B82F6] hover:bg-blue-600 rounded-lg shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-[0.98] transition-transform"
              >
                {isSaving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                <span>{isSaving ? 'Gravando no Firestore...' : (isEditing ? 'Salvar Alterações' : 'Salvar Colaborador')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
