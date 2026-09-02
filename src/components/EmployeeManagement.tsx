import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Employee, TimeRecord, Branch, EmployeeStatus, ConstructionSite } from '../types';
import { parseEmployeesCSV, generateEmployeesTemplateCSV, triggerFileDownload } from '../utils/csvHandler';
import { getEmployeeTotalBalance, formatHoursDecimal, formatHoursToDays } from '../utils/calculations';
import { firestoreService } from '../services/firestoreService';
import { authService } from '../services/authService';
import { batchSyncEmployees, getSyncStatistics } from '../services/employeeSyncService';
import { 
  Users, 
  UploadCloud, 
  Download, 
  UserPlus, 
  PlusCircle,
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Edit2,
  Plus, 
  Building, 
  FileSpreadsheet, 
  ExternalLink,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Camera,
  Image as ImageIcon,
  Check,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  X,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  Sparkles,
  Printer,
  FileText,
  Loader2
} from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { IconButton } from './IconButton';
import { PortariaAttendanceSheetModal } from './PortariaAttendanceSheetModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { DispensaSptfRecord } from '../types';

interface EmployeeManagementProps {
  employees: Employee[];
  records: TimeRecord[];
  constructionSites?: ConstructionSite[];
  dispensas?: DispensaSptfRecord[];
  onUpdateEmployees: (employees: Employee[]) => void;
  onViewStatement: (matricula: string) => void;
  onQuickNewEntry: (matricula: string) => void;
  onOpenSptfDispensa?: (matricula?: string) => void;
  theme?: 'dark' | 'light';
}

export type BalanceFilter = 'TODOS' | 'CREDOR' | 'DEVEDOR' | 'ZERADO';
export type SortKey = 'nome' | 'saldo' | 'matricula' | 'funcao' | 'sede' | 'dataAdmissao' | 'status' | 'statusBanco';
export type MobileSortOption = 'nome_asc' | 'nome_desc' | 'saldo_asc' | 'saldo_desc';

export interface SortConfig {
  key: SortKey;
  direction: 'asc' | 'desc';
}

export const EmployeeManagement: React.FC<EmployeeManagementProps> = ({
  employees,
  records,
  constructionSites = [],
  dispensas = [],
  onUpdateEmployees,
  onViewStatement,
  onQuickNewEntry,
  onOpenSptfDispensa,
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 0. Detecção Responsiva de Mobile (< 768px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Estados de Filtro & Busca
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSede, setFilterSede] = useState<string>('TODAS');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('TODOS');
  
  // 2. Estado de Ordenação Dinâmica
  const [sortOption, setSortOption] = useState<MobileSortOption>('nome_asc');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'nome',
    direction: 'asc',
  });

  const [mobileExpandedMatricula, setMobileExpandedMatricula] = useState<string | null>(null);
  
  // CSV Import State
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    percent: number;
    currentName?: string;
    statusText?: string;
  } | null>(null);
  const [importFeedback, setImportFeedback] = useState<{
    success: boolean;
    message: string;
    errors?: string[];
  } | null>(null);

  // Manual Employee Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isPortariaModalOpen, setIsPortariaModalOpen] = useState(false);

  // -------------------------------------------------------------
  // CONTAGENS DE SALDO (PILLS KPI COUNTER)
  // -------------------------------------------------------------
  const balanceCounts = useMemo(() => {
    let todos = 0;
    let credor = 0;
    let devedor = 0;
    let zerado = 0;

    employees.forEach(emp => {
      const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
      todos++;
      if (bal.saldoTotalHoras > 0.05) credor++;
      else if (bal.saldoTotalHoras < -0.05) devedor++;
      else zerado++;
    });

    return { todos, credor, devedor, zerado };
  }, [employees, records]);

  // -------------------------------------------------------------
  // COMBINAÇÃO DE BUSCA, FILTROS E ORDENAÇÃO VIA useMemo
  // -------------------------------------------------------------
  const filteredAndSortedEmployees = useMemo(() => {
    return employees
      .map((emp) => {
        const bal = getEmployeeTotalBalance(emp.matricula, employees, records);
        return { emp, bal };
      })
      .filter(({ emp, bal }) => {
        // 1. Filtro de Sede
        if (filterSede !== 'TODAS' && emp.sede !== filterSede && emp.sede_atual !== filterSede) {
          return false;
        }

        // 2. Filtro de Status Contratual
        if (filterStatus !== 'TODOS' && emp.status !== filterStatus) {
          return false;
        }

        // 3. Filtro Rápido de Saldo (Pills)
        if (balanceFilter === 'CREDOR' && bal.saldoTotalHoras <= 0.05) {
          return false;
        }
        if (balanceFilter === 'DEVEDOR' && bal.saldoTotalHoras >= -0.05) {
          return false;
        }
        if (balanceFilter === 'ZERADO' && Math.abs(bal.saldoTotalHoras) > 0.05) {
          return false;
        }

        // 4. Busca Textual por Nome, Matrícula ou Função/Cargo
        if (searchTerm.trim()) {
          const q = searchTerm.toLowerCase().trim();
          const matchMat = emp.matricula.toLowerCase().includes(q);
          const matchNome = emp.nome.toLowerCase().includes(q);
          const matchFunc = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
          if (!matchMat && !matchNome && !matchFunc) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortConfig.key) {
          case 'nome':
            comparison = a.emp.nome.localeCompare(b.emp.nome, 'pt-BR', { sensitivity: 'base' });
            break;
          case 'saldo':
            // Ordenação numérica real considerando positivos e negativos
            comparison = a.bal.saldoTotalHoras - b.bal.saldoTotalHoras;
            break;
          case 'matricula':
            comparison = a.emp.matricula.localeCompare(b.emp.matricula, 'pt-BR', { numeric: true });
            break;
          case 'funcao':
            comparison = (a.emp.funcao || '').localeCompare(b.emp.funcao || '', 'pt-BR', { sensitivity: 'base' });
            break;
          case 'sede':
            comparison = (a.emp.sede || '').localeCompare(b.emp.sede || '', 'pt-BR');
            break;
          case 'dataAdmissao':
            comparison = (a.emp.dataAdmissao || '').localeCompare(b.emp.dataAdmissao || '');
            break;
          case 'status':
            comparison = (a.emp.status || '').localeCompare(b.emp.status || '');
            break;
          case 'statusBanco':
            comparison = a.bal.status.localeCompare(b.bal.status);
            break;
          default:
            comparison = 0;
        }
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
  }, [employees, records, filterSede, filterStatus, balanceFilter, searchTerm, sortConfig]);

  // -------------------------------------------------------------
  // HANDLERS DE ORDENAÇÃO (MOBILE & DESKTOP)
  // -------------------------------------------------------------
  const handleSortOptionChange = (option: MobileSortOption) => {
    setSortOption(option);
    switch (option) {
      case 'nome_asc':
        setSortConfig({ key: 'nome', direction: 'asc' });
        break;
      case 'nome_desc':
        setSortConfig({ key: 'nome', direction: 'desc' });
        break;
      case 'saldo_asc':
        // Mais Devedor (Menor Saldo Primeiro: ex -20h antes de +10h)
        setSortConfig({ key: 'saldo', direction: 'asc' });
        break;
      case 'saldo_desc':
        // Mais Credor (Maior Saldo Primeiro: ex +20h antes de -10h)
        setSortConfig({ key: 'saldo', direction: 'desc' });
        break;
    }
  };

  const handleSort = (key: SortKey) => {
    setSortConfig((prev) => {
      const newDir = prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : (key === 'saldo' ? 'desc' : 'asc');
      if (key === 'nome') {
        setSortOption(newDir === 'asc' ? 'nome_asc' : 'nome_desc');
      } else if (key === 'saldo') {
        setSortOption(newDir === 'asc' ? 'saldo_asc' : 'saldo_desc');
      }
      return {
        key,
        direction: newDir,
      };
    });
  };

  // Helper visual para os ícones de ordenação nos cabeçalhos
  const renderSortIcon = (key: SortKey) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity ml-1 inline shrink-0" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-400 font-bold ml-1 inline shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-400 font-bold ml-1 inline shrink-0" />
    );
  };

  const handleDownloadTemplate = () => {
    const csvContent = generateEmployeesTemplateCSV();
    triggerFileDownload(csvContent, 'template_colaboradores_banco_horas.csv');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportFeedback(null);
    setImportProgress({
      processed: 0,
      total: 0,
      percent: 0,
      statusText: 'Lendo e validando estrutura do arquivo CSV...'
    });

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parseResult = await parseEmployeesCSV(content, employees, 'update');

        if (!parseResult.success || parseResult.data.length === 0) {
          setImportFeedback({
            success: false,
            message: `Falha na importação do CSV. Verifique a formatação do arquivo.`,
            errors: parseResult.errors,
          });
          setIsImporting(false);
          setImportProgress(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        const totalItems = parseResult.data.length;
        setImportProgress({
          processed: 0,
          total: totalItems,
          percent: 0,
          statusText: `Preparando sincronização de ${totalItems} colaborador(es)...`
        });

        // Create department code map for each employee
        // Parse from sede field or departamento field (which contains the department code)
        const departmentCodesMap: Record<string, string | undefined> = {};
        parseResult.data.forEach((emp) => {
          // Map departmentCode from the parsed employee data
          departmentCodesMap[emp.matricula] = emp.departamento || emp.sede || 'KO';
        });

        // Perform batch sync with Firestore using new UPSERT logic
        const syncResults = await batchSyncEmployees(
          parseResult.data,
          departmentCodesMap,
          constructionSites || [],
          (progress) => {
            const currentEmp = parseResult.data[progress.processed - 1];
            const empLabel = currentEmp?.nome ? `${currentEmp.nome} (${currentEmp.matricula || ''})` : undefined;
            setImportProgress({
              processed: progress.processed,
              total: progress.total,
              percent: progress.percent,
              currentName: empLabel,
              statusText: `Sincronizando colaboradores no Firestore (${progress.processed}/${progress.total})...`
            });
          }
        );

        const stats = getSyncStatistics(syncResults);

        setImportProgress({
          processed: totalItems,
          total: totalItems,
          percent: 100,
          statusText: 'Atualizando base de dados em tempo real...'
        });

        // Reload all employees from Firestore to reflect changes
        const allEmployees = await firestoreService.getAllEmployees();
        onUpdateEmployees(allEmployees);

        setImportFeedback({
          success: stats.successful > 0,
          message: `Importação concluída! Criados: ${stats.created} | Atualizados: ${stats.updated} | Falhados: ${stats.failed}`,
          errors: syncResults
            .filter((r) => !r.success)
            .map((r) => `${r.matricula} (${r.nome}): ${r.message}`),
        });
      } catch (err: any) {
        console.error('Erro na importação CSV:', err);
        setImportFeedback({
          success: false,
          message: `Erro ao processar importação: ${err.message}`,
          errors: [err.message],
        });
      } finally {
        setIsImporting(false);
        setImportProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleOpenAddModal = () => {
    setEditingEmployee(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (emp: Employee) => {
    setEditingEmployee(emp);
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="no-print space-y-6">
        {isMobile ? (
        /* ========================================================= */
        /* 1. VISÃO EXCLUSIVA MOBILE (< 768px)                       */
        /* ========================================================= */
        <div className="p-2 font-sans" id="mobile-employee-management">
          {/* Barra de Controle Mobile (Topo da Tela): Busca + Select de Ordenação + Pílulas */}
          <div className="flex flex-col gap-2 mb-4">
            {/* 1. Barra de Pesquisa */}
            <div className="relative w-full">
              <input 
                type="text" 
                placeholder="Pesquisar por nome ou matrícula..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className={`p-3 pr-9 border rounded-lg w-full text-base focus:outline-hidden ${
                  isDark 
                    ? 'bg-[#16243D] border-[#243756] text-white placeholder-[#94A3B8] focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                    : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                }`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={`absolute right-3 top-3.5 text-xs p-1 cursor-pointer ${isDark ? 'text-[#94A3B8] hover:text-white' : 'text-slate-400 hover:text-slate-700'}`}
                  title="Limpar pesquisa"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
            {/* 2. Seletor de Ordenação */}
            <select 
              value={sortOption} 
              onChange={(e) => handleSortOptionChange(e.target.value as MobileSortOption)}
              className={`p-3 border rounded-lg w-full bg-white font-medium text-base focus:outline-hidden cursor-pointer ${
                isDark 
                  ? '!bg-[#16243D] border-[#243756] text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20' 
                  : 'bg-white border-slate-300 text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
              }`}
            >
              <option value="nome_asc">Nome (A - Z)</option>
              <option value="nome_desc">Nome (Z - A)</option>
              <option value="saldo_asc">Mais Devedor (Menor Saldo)</option>
              <option value="saldo_desc">Mais Credor (Maior Saldo)</option>
            </select>

            {/* 3. Pílulas de Filtro Rápido: [Todos] [Positivos] [Negativos] */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setBalanceFilter('TODOS')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all active:scale-[0.98] cursor-pointer select-none ${
                  balanceFilter === 'TODOS'
                    ? isDark 
                      ? 'bg-blue-600/30 text-blue-400 border-blue-500/50 shadow-xs' 
                      : 'bg-blue-100 text-blue-800 border-blue-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#16243D] text-[#94A3B8] border-[#243756]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Todos ({balanceCounts.todos})
              </button>

              <button
                type="button"
                onClick={() => setBalanceFilter('CREDOR')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all active:scale-[0.98] cursor-pointer select-none ${
                  balanceFilter === 'CREDOR'
                    ? isDark 
                      ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-xs' 
                      : 'bg-green-100 text-green-800 border-green-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#16243D] text-[#94A3B8] border-[#243756]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Positivos ({balanceCounts.credor})
              </button>

              <button
                type="button"
                onClick={() => setBalanceFilter('DEVEDOR')}
                className={`flex-1 py-2 px-1 rounded-lg text-xs font-bold text-center border transition-all active:scale-[0.98] cursor-pointer select-none ${
                  balanceFilter === 'DEVEDOR'
                    ? isDark 
                      ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-xs' 
                      : 'bg-red-100 text-red-800 border-red-300 shadow-xs font-black'
                    : isDark 
                      ? 'bg-[#16243D] text-[#94A3B8] border-[#243756]' 
                      : 'bg-white text-slate-600 border-slate-200'
                }`}
              >
                Negativos ({balanceCounts.devedor})
              </button>
            </div>
          </div>

          {/* Lista Mobile Enxuta (Cards de Linha Única) */}
          <div className="flex flex-col gap-2">
            {filteredAndSortedEmployees.length === 0 ? (
              <div className={`p-6 rounded-lg border text-center ${
                isDark ? 'bg-[#16243D] border-[#243756] text-gray-400' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                <p className="text-xs font-semibold">Nenhum colaborador encontrado com os filtros atuais.</p>
              </div>
            ) : (
              filteredAndSortedEmployees.map(({ emp, bal }) => {
                const isPositivo = bal.saldoTotalHoras >= 0;
                const formattedSaldo = bal.saldoTotalHoras > 0 
                  ? `+${bal.saldoTotalHoras.toFixed(1)}h` 
                  : `${bal.saldoTotalHoras.toFixed(1)}h`;

                return (
                  <div 
                    key={emp.matricula} 
                    onClick={() => onViewStatement(emp.matricula)}
                    className={`p-3 rounded-lg border flex justify-between items-center shadow-xs cursor-pointer active:scale-[0.99] transition-all ${
                      isDark 
                        ? 'bg-[#16243D] border-[#243756] hover:border-blue-500/50' 
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="min-w-0 pr-3">
                      <p className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-800'}`}>
                        {emp.nome}
                      </p>
                      <p className={`text-xs mt-0.5 font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
                        Matrícula: {emp.matricula}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full font-bold text-sm shrink-0 font-mono ${
                      isPositivo 
                        ? isDark 
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60' 
                          : 'bg-green-100 text-green-700 border border-green-200' 
                        : isDark 
                          ? 'bg-red-950/80 text-red-400 border border-red-800/60' 
                          : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {formattedSaldo}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        /* ========================================================= */
        /* 2. VISÃO DESKTOP (HEADER BANNER + FILTROS + TABELA)       */
        /* ========================================================= */
        <div className="space-y-6" id="desktop-employee-management">
          {/* Header Banner */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border shadow-xs transition-all ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full font-mono border ${
                  isDark ? 'bg-[#243756] text-blue-400 border-[#335075]' : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  Módulo A • Pessoas
                </span>
                <span className={`text-xs font-mono ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Gestão de Pessoas & Lotação
                </span>
              </div>
              <h2 className={`text-xl font-bold mt-2 tracking-tight flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                <span>Gestão e Importação de Colaboradores</span>
                <InfoTooltip 
                  theme={isDark ? 'dark' : 'light'} 
                  content="Cadastre novos colaboradores manualmente ou realize a carga massiva via arquivo .CSV com suporte a tratamento automático de duplicidades pela Matrícula." 
                />
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <IconButton
                id="btn-colaboradores-relacao-portaria"
                icon={Printer}
                variant="secondary"
                size="md"
                tooltip="Imprimir Relação de Entrada e Saída de Servidores (Portaria)"
                aria-label="Relação de Entrada e Saída de Portaria"
                onClick={() => setIsPortariaModalOpen(true)}
              />

              {onOpenSptfDispensa && (
                <IconButton
                  id="btn-colaboradores-dispensa-expediente"
                  icon={FileText}
                  variant="secondary"
                  size="md"
                  tooltip="Emitir Guia Oficial de Dispensa de Expediente (SPTF)"
                  aria-label="Dispensa de Expediente"
                  onClick={() => onOpenSptfDispensa()}
                />
              )}

              <IconButton
                id="btn-colaboradores-baixar-template"
                icon={FileSpreadsheet}
                variant="secondary"
                size="md"
                tooltip="Baixar Planilha Modelo CSV com Instruções"
                aria-label="Baixar Template CSV"
                onClick={handleDownloadTemplate}
              />
              
              <div className="relative inline-flex group">
                <label 
                  aria-label="Importar Base de Colaboradores CSV"
                  className={`w-9 h-9 p-2 rounded-xl inline-flex items-center justify-center transition-all duration-150 cursor-pointer active:scale-95 border ${
                    isImporting
                      ? 'bg-blue-900/40 text-blue-400 border-blue-700/50 cursor-not-allowed animate-pulse'
                      : isDark 
                        ? 'text-emerald-400 bg-emerald-950/40 hover:bg-emerald-900/60 border-emerald-800/40' 
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                  }`}
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  ) : (
                    <UploadCloud className="w-4 h-4" />
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isImporting}
                  />
                </label>
                <div
                  role="tooltip"
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 pointer-events-none whitespace-nowrap px-2.5 py-1.5 text-xs font-medium rounded-lg shadow-xl border bg-[#111317] dark:bg-[#1E3252] text-white border-[#335075] dark:border-[#383D4A]"
                >
                  {isImporting ? 'Processando importação...' : 'Importar Arquivo CSV de Colaboradores'}
                </div>
              </div>

              <IconButton
                icon={UserPlus}
                variant="primary"
                size="md"
                tooltip="Cadastrar Novo Colaborador"
                aria-label="Novo Colaborador"
                onClick={handleOpenAddModal}
              />
            </div>
          </div>

          {/* Active Import Progress Banner */}
          {isImporting && (
            <div className={`p-4 rounded-xl border space-y-2.5 text-xs shadow-md transition-all animate-fadeIn ${
              isDark ? 'bg-[#16243D] border-blue-500/40 text-[#E2E8F0]' : 'bg-blue-50/90 border-blue-200 text-blue-950'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-500 shrink-0">
                    <Loader2 className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-blue-600 dark:text-blue-400">
                        Importando e Sincronizando Colaboradores
                      </p>
                      {importProgress?.total ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600/20 text-blue-600 dark:text-blue-300 border border-blue-500/30">
                          {importProgress.processed} de {importProgress.total}
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-xs truncate ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                      {importProgress?.currentName 
                        ? `Sincronizando: ${importProgress.currentName}` 
                        : importProgress?.statusText || 'Lendo dados e validando registros...'}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
                    {importProgress?.percent ?? 0}%
                  </span>
                </div>
              </div>

              {/* Progress Bar Track */}
              <div className={`h-2.5 w-full rounded-full overflow-hidden p-0.5 border ${
                isDark ? 'bg-[#0B1426] border-[#243756]' : 'bg-slate-200 border-slate-300'
              }`}>
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-500 to-emerald-500 transition-all duration-300 ease-out shadow-sm"
                  style={{ 
                    width: `${Math.max(importProgress?.total ? (importProgress?.percent || 2) : 10, 2)}%` 
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>Tratamento UPSERT (evita duplicação por CPF e Matrícula)</span>
                <span>Gravando no Firestore...</span>
              </div>
            </div>
          )}

          {/* Import Feedback Banner */}
          {importFeedback && (
            <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              importFeedback.success 
                ? isDark ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : isDark ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start gap-2.5">
                {importFeedback.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold text-sm">{importFeedback.message}</p>
                  {importFeedback.errors && importFeedback.errors.length > 0 && (
                    <ul className={`mt-1.5 list-disc list-inside space-y-0.5 text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                      {importFeedback.errors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setImportFeedback(null)}
                className={`font-bold text-xs cursor-pointer ${isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-500 hover:text-slate-800'}`}
              >
                Fechar
              </button>
            </div>
          )}

          {/* Filter, Search & Balance Pills Bar */}
          <div className={`p-4 rounded-2xl border shadow-xs space-y-3.5 ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            {/* Linha Superior: Campo de Busca + Selects de Sede e Status */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nome, matrícula ou função..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`w-full pl-9 pr-8 py-1.5 rounded-lg text-xs font-mono focus:outline-hidden border ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] placeholder-[#64748B] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20' 
                      : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Limpar busca"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto text-xs font-mono">
                <select
                  value={filterSede}
                  onChange={(e) => setFilterSede(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border focus:outline-hidden cursor-pointer ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                >
                  <option value="TODAS">Todas as Sedes / Canteiros</option>
                  {Array.isArray(constructionSites) && constructionSites.length > 0 ? (
                    constructionSites.map((site) => {
                      const code = (site.code || site.codigo || site.branch || site.sede || '').toUpperCase();
                      const name = site.name || site.nome || `Canteiro ${code}`;
                      return (
                        <option key={site.id || code} value={code}>
                          Sede {code} ({name})
                        </option>
                      );
                    })
                  ) : (
                    <>
                      <option value="KO">Sede KO (Coari)</option>
                      <option value="BE">Sede BE (Belém)</option>
                      <option value="MN">Sede MN (Manaus)</option>
                    </>
                  )}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-2.5 py-1.5 rounded-lg font-medium border focus:outline-hidden cursor-pointer ${
                    isDark 
                      ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20' 
                      : 'bg-white border-slate-300 text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                  }`}
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="Ativo">Ativo</option>
                  <option value="Inativo">Inativo</option>
                  <option value="Afastado">Afastado</option>
                  <option value="Férias">Férias</option>
                </select>
              </div>
            </div>

            {/* Linha Inferior: Pílulas de Filtro Rápido de Saldo (Filter Pills) */}
            <div className={`pt-3 border-t flex flex-wrap items-center justify-between gap-2.5 text-xs font-mono ${
              isDark ? 'border-[#243756]' : 'border-slate-100'
            }`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${
                  isDark ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}>
                  Saldo SPTF:
                </span>

                {/* Pílula: TODOS */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('TODOS')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'TODOS'
                      ? isDark 
                        ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-xs' 
                        : 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-[#E2E8F0] border-[#243756]' 
                        : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  <span>Todos</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'TODOS' 
                      ? isDark ? 'bg-blue-500/30 text-blue-200' : 'bg-blue-200 text-blue-800' 
                      : isDark ? 'bg-[#243756] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.todos}
                  </span>
                </button>

                {/* Pílula: CRÉDITO (POSITIVO) */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('CREDOR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'CREDOR'
                      ? isDark 
                        ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50 shadow-xs' 
                        : 'bg-emerald-50 text-emerald-800 border-emerald-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-emerald-400 border-[#243756]' 
                        : 'bg-white text-slate-600 hover:text-emerald-700 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Crédito (Positivo)</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'CREDOR' 
                      ? isDark ? 'bg-emerald-800/40 text-emerald-200' : 'bg-emerald-200 text-emerald-900' 
                      : isDark ? 'bg-[#243756] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.credor}
                  </span>
                </button>

                {/* Pílula: DÉBITO (NEGATIVO) */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('DEVEDOR')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'DEVEDOR'
                      ? isDark 
                        ? 'bg-red-950/80 text-red-400 border-red-500/50 shadow-xs' 
                        : 'bg-red-50 text-red-800 border-red-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-red-400 border-[#243756]' 
                        : 'bg-white text-slate-600 hover:text-red-700 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span>Débito (Negativo)</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'DEVEDOR' 
                      ? isDark ? 'bg-red-800/40 text-red-200' : 'bg-red-200 text-red-900' 
                      : isDark ? 'bg-[#243756] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.devedor}
                  </span>
                </button>

                {/* Pílula: ZERADO */}
                <button
                  type="button"
                  onClick={() => setBalanceFilter('ZERADO')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 border cursor-pointer select-none ${
                    balanceFilter === 'ZERADO'
                      ? isDark 
                        ? 'bg-slate-800 text-slate-200 border-slate-600 shadow-xs' 
                        : 'bg-slate-200 text-slate-900 border-slate-400 shadow-xs font-black'
                      : isDark 
                        ? 'bg-[#0F1B33] text-[#94A3B8] hover:text-slate-200 border-[#243756]' 
                        : 'bg-white text-slate-600 hover:text-slate-900 border-slate-200'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>Zerado</span>
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                    balanceFilter === 'ZERADO' 
                      ? isDark ? 'bg-slate-700 text-slate-200' : 'bg-slate-300 text-slate-900' 
                      : isDark ? 'bg-[#243756] text-gray-400' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {balanceCounts.zerado}
                  </span>
                </button>
              </div>

              {/* Indicador de Ordenação Ativa e Contador de Resultados */}
              <div className="flex items-center gap-2">
                <span className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Exibindo <strong>{filteredAndSortedEmployees.length}</strong> de {employees.length}
                </span>
                {(searchTerm || filterSede !== 'TODAS' || filterStatus !== 'TODOS' || balanceFilter !== 'TODOS') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterSede('TODAS');
                      setFilterStatus('TODOS');
                      setBalanceFilter('TODOS');
                    }}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* TABELA DESKTOP COMPLETA COM ROLAGEM & SORTING */}
          <div className={`rounded-2xl border shadow-xs overflow-hidden ${
            isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
          }`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className={isDark ? 'bg-[#0F1B33]' : 'bg-slate-50'}>
                  <tr className={`text-[10px] uppercase font-bold border-b tracking-wider select-none ${
                    isDark ? 'text-[#94A3B8] border-[#243756]' : 'text-slate-600 border-slate-200'
                  }`}>
                    {/* 1. Matrícula */}
                    <th 
                      onClick={() => handleSort('matricula')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Matrícula"
                    >
                      <div className="flex items-center gap-1">
                        <span>Matrícula</span>
                        {renderSortIcon('matricula')}
                      </div>
                    </th>

                    {/* 2. Nome */}
                    <th 
                      onClick={() => handleSort('nome')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Nome do Colaborador"
                    >
                      <div className="flex items-center gap-1">
                        <span>Nome do Colaborador</span>
                        {renderSortIcon('nome')}
                      </div>
                    </th>

                    {/* 3. Função / Cargo */}
                    <th 
                      onClick={() => handleSort('funcao')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Função / Cargo"
                    >
                      <div className="flex items-center gap-1">
                        <span>Função / Cargo</span>
                        {renderSortIcon('funcao')}
                      </div>
                    </th>

                    {/* 4. Lotação / Canteiro */}
                    <th 
                      onClick={() => handleSort('sede')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Sede"
                    >
                      <div className="flex items-center gap-1">
                        <span>Lotação / Canteiro</span>
                        {renderSortIcon('sede')}
                      </div>
                    </th>

                    {/* 5. Data Admissão */}
                    <th 
                      onClick={() => handleSort('dataAdmissao')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Data de Admissão"
                    >
                      <div className="flex items-center gap-1">
                        <span>Data Admissão</span>
                        {renderSortIcon('dataAdmissao')}
                      </div>
                    </th>

                    {/* 6. Status Contratual */}
                    <th 
                      onClick={() => handleSort('status')}
                      className="py-3 px-4 cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Status"
                    >
                      <div className="flex items-center gap-1">
                        <span>Status</span>
                        {renderSortIcon('status')}
                      </div>
                    </th>

                    {/* 7. Saldo Atual SPTF (Numérico Real) */}
                    <th 
                      onClick={() => handleSort('saldo')}
                      className="py-3 px-4 text-right cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Saldo de Horas SPTF"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Saldo Atual (SPTF)</span>
                        {renderSortIcon('saldo')}
                      </div>
                    </th>

                    {/* 8. Status Banco */}
                    <th 
                      onClick={() => handleSort('statusBanco')}
                      className="py-3 px-4 text-center cursor-pointer group hover:text-blue-400 transition-colors active:scale-[0.98]"
                      title="Clique para ordenar por Status do Banco"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status Banco</span>
                        {renderSortIcon('statusBanco')}
                      </div>
                    </th>

                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${
                  isDark ? 'divide-[#243756] text-[#E2E8F0]' : 'divide-slate-200 text-slate-800'
                }`}>
                  {filteredAndSortedEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={`py-12 text-center text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-6 h-6 text-gray-500" />
                          <p className="font-semibold text-sm">Nenhum colaborador localizado com os filtros selecionados.</p>
                          <p className="text-[11px]">Tente alterar a busca ou redefinir os filtros de saldo e sede.</p>
                          {(searchTerm || filterSede !== 'TODAS' || filterStatus !== 'TODOS' || balanceFilter !== 'TODOS') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm('');
                                setFilterSede('TODAS');
                                setFilterStatus('TODOS');
                                setBalanceFilter('TODOS');
                              }}
                              className="mt-2 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer"
                            >
                              Limpar Todos os Filtros
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredAndSortedEmployees.map(({ emp, bal }) => {
                      return (
                        <tr key={emp.id} className={`transition-colors ${isDark ? 'hover:bg-[#1E3252]' : 'hover:bg-slate-50/80'}`}>
                          <td className={`py-3.5 px-4 font-mono font-semibold whitespace-nowrap ${
                            isDark ? 'text-[#94A3B8]' : 'text-slate-600'
                          }`}>
                            #{emp.matricula}
                          </td>
                          <td className="py-3.5 px-4 font-sans">
                            <div className="flex items-center gap-3">
                              {emp.avatarUrl || emp.url_foto_perfil ? (
                                <img
                                  src={emp.avatarUrl || emp.url_foto_perfil}
                                  alt={emp.nome}
                                  className={`w-8 h-8 rounded-full object-cover border shrink-0 ${
                                    isDark ? 'border-[#335075]' : 'border-slate-200'
                                  }`}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-[11px] shrink-0 ${
                                  isDark 
                                    ? 'bg-[#243756] border-[#335075] text-blue-400' 
                                    : 'bg-blue-50 border-blue-200 text-blue-700'
                                }`}>
                                  {emp.nome.split(' ').map((n) => n[0]).slice(0, 2).join('')}
                                </div>
                              )}
                              <div>
                                <div className={`font-semibold text-xs ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                                  {emp.nome}
                                </div>
                                {emp.email && (
                                  <div className={`text-[11px] font-mono ${isDark ? 'text-[#64748B]' : 'text-slate-500'}`}>
                                    {emp.email}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                            {emp.funcao}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 font-bold rounded text-[10px] border ${
                                isDark 
                                  ? 'bg-[#243756] text-blue-400 border-[#335075]' 
                                  : 'bg-blue-50 text-blue-700 border-blue-200'
                              }`}>
                                {emp.sede_atual || emp.sede}
                              </span>
                              <span className={`text-[9px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                Origem: {emp.sede_origem || emp.sede}
                              </span>
                              {emp.canteiroId && constructionSites ? (
                                (() => {
                                  const site = constructionSites.find(s => s.id === emp.canteiroId);
                                  return site ? <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-200'}`} title={site.name || site.nome}>{site.code || site.codigo || site.name || site.nome}</span> : null;
                                })()
                              ) : null}
                              {emp.sede_atual && emp.sede_atual !== emp.sede && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                  isDark 
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
                                    : 'bg-amber-50 text-amber-800 border-amber-200'
                                }`} title={`Alocado temporariamente em ${emp.sede_atual}`}>
                                  ➔ {emp.sede_atual}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-3.5 px-4 whitespace-nowrap ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                            {emp.dataAdmissao}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex flex-col gap-1 items-start">
                              <span className={`px-2 py-0.5 rounded font-semibold text-[10px] border ${
                                emp.status === 'Ativo' 
                                  ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : emp.status === 'Férias'
                                  ? isDark ? 'bg-amber-950/40 text-amber-400 border-amber-800/40' : 'bg-amber-50 text-amber-700 border-amber-200'
                                  : isDark ? 'bg-purple-950/40 text-purple-300 border-purple-800/40' : 'bg-purple-50 text-purple-700 border-purple-200'
                              }`}>
                                {emp.status}
                              </span>
                              {emp.dataInicioStatus && emp.dataFimStatus && (
                                <span className={`text-[9px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                                  {emp.dataInicioStatus} a {emp.dataFimStatus}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className={`font-bold text-xs ${
                              bal.saldoTotalHoras > 0 
                                ? isDark ? 'text-green-400' : 'text-emerald-600'
                                : bal.saldoTotalHoras < 0 
                                ? isDark ? 'text-red-400' : 'text-red-600'
                                : isDark ? 'text-[#94A3B8]' : 'text-slate-500'
                            }`}>
                              {formatHoursDecimal(bal.saldoTotalHoras)}
                            </div>
                            <div className={`text-[10px] ${isDark ? 'text-[#64748B]' : 'text-slate-400'}`}>
                              {formatHoursToDays(bal.saldoTotalHoras)}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                              bal.status === 'CREDOR'
                                ? isDark ? 'bg-emerald-950/40 text-green-400 border-emerald-800/40' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : bal.status === 'DEVEDOR'
                                ? isDark ? 'bg-red-950/40 text-red-400 border-red-800/40' : 'bg-red-50 text-red-700 border-red-200'
                                : isDark ? 'bg-[#243756] text-[#94A3B8] border-[#335075]' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {bal.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              {onOpenSptfDispensa && (
                                <IconButton
                                  icon={FileText}
                                  variant="ghost"
                                  size="xs"
                                  tooltip={`Emitir Dispensa de Expediente para ${emp.nome}`}
                                  aria-label={`Dispensa de ${emp.nome}`}
                                  onClick={() => onOpenSptfDispensa(emp.matricula)}
                                />
                              )}
                              <IconButton
                                icon={PlusCircle}
                                variant="subtle"
                                size="xs"
                                tooltip={`Novo Lançamento para ${emp.nome}`}
                                aria-label={`Lançar horas para ${emp.nome}`}
                                onClick={() => onQuickNewEntry(emp.matricula)}
                              />
                              <IconButton
                                icon={Eye}
                                variant="secondary"
                                size="xs"
                                tooltip={`Extrato Completo de ${emp.nome}`}
                                aria-label={`Ver extrato de ${emp.nome}`}
                                onClick={() => onViewStatement(emp.matricula)}
                              />
                              <IconButton
                                icon={Edit2}
                                variant="ghost"
                                size="xs"
                                tooltip={`Editar Cadastro de ${emp.nome}`}
                                aria-label={`Editar ${emp.nome}`}
                                onClick={() => handleOpenEditModal(emp)}
                              />
                            </div>
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

      {/* MODAL DE CADASTRO / EDIÇÃO DE COLABORADOR (UNIFICADO COM 2 ABAS) */}
      <EmployeeFormModal
        isOpen={isModalOpen}
        employee={editingEmployee}
        employees={employees}
        constructionSites={constructionSites}
        theme={theme}
        onClose={() => {
          setIsModalOpen(false);
          setEditingEmployee(null);
        }}
        onSaveSuccess={(savedEmp, updatedList) => {
          if (updatedList) {
            onUpdateEmployees(updatedList);
          } else {
            const newList = editingEmployee
              ? employees.map((emp) => (emp.id === savedEmp.id ? savedEmp : emp))
              : [savedEmp, ...employees];
            onUpdateEmployees(newList);
          }
          setIsModalOpen(false);
          setEditingEmployee(null);
        }}
      />
      </div>

      {/* Modal de Impressão da Relação de Portaria (Entrada e Saída) */}
      <PortariaAttendanceSheetModal
        isOpen={isPortariaModalOpen}
        onClose={() => setIsPortariaModalOpen(false)}
        employees={employees}
        records={records}
        dispensas={dispensas}
        constructionSites={constructionSites}
        defaultSede={filterSede !== 'TODAS' ? filterSede : 'KO'}
        theme={theme}
      />
    </>
  );
};
