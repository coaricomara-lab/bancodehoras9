import React, { useState, useMemo } from 'react';
import { Employee, InsalubrityRecord, ConstructionSite, AdminRole } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { getSignaturesForCanteiro } from '../services/canteiroService';
import { 
  FileSpreadsheet, 
  Calendar, 
  Search, 
  Download, 
  Printer, 
  Check, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Layers, 
  Trash2, 
  Settings2,
  Briefcase,
  Edit3,
  ArrowRightLeft,
  FileText,
  UploadCloud,
  ChevronDown,
  SlidersHorizontal,
  MoreVertical,
  Plus,
  Users,
  Clock,
  Filter,
  CalendarCheck
} from 'lucide-react';
import { IconButton } from './IconButton';
import { InfoTooltip } from './InfoTooltip';
import { ImportInsalubrityMatrixModal } from './ImportInsalubrityMatrixModal';
import { InsalubritySimplePrintModal } from './InsalubritySimplePrintModal';
import { MonthYearPicker } from './MonthYearPicker';

interface InsalubritySimpleMatrixViewProps {
  employees: Employee[];
  insalubrityRecords: InsalubrityRecord[];
  onSaveRecord: (record: InsalubrityRecord) => Promise<void>;
  onSaveBatchRecords?: (records: InsalubrityRecord[]) => Promise<void>;
  onDeleteRecord: (id: string) => Promise<void>;
  onUpdateEmployees?: (employees: Employee[]) => Promise<void> | void;
  onFetchPeriod?: (startDate: string, endDate: string, forceRefresh?: boolean) => Promise<InsalubrityRecord[]>;
  constructionSites?: ConstructionSite[];
  currentUserEmail?: string;
  userRole?: AdminRole;
  theme?: 'dark' | 'light';
  onSwitchToCompleteMode?: () => void;
  onOpenConversionModal?: () => void;
  onNavigateToReports?: () => void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAY_INITIALS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// Atividades mais frequentes em canteiros de obras COMARA
const DEFAULT_ACTIVITIES = [
  'CANALETA',
  'CONCRETO',
  'TOPOGRAFIA',
  'ASFALTO',
  'MANUTENÇÃO',
  'CARPINTARIA',
  'ARMADOR',
  'TERRAPLENAGEM',
  'DRENAGEM',
  'PINTURA',
  'SERVIÇOS GERAIS'
];

export const InsalubritySimpleMatrixView: React.FC<InsalubritySimpleMatrixViewProps> = ({
  employees,
  insalubrityRecords,
  onSaveRecord,
  onSaveBatchRecords,
  onDeleteRecord,
  onUpdateEmployees,
  constructionSites = [],
  currentUserEmail = 'coari.comara@gmail.com',
  userRole = 'SUPER_ADMIN',
  theme = 'dark',
  onSwitchToCompleteMode,
  onOpenConversionModal,
  onNavigateToReports,
}) => {
  const isDark = theme === 'dark';

  // 1. Período Selecionado (Ano, Mês, Modo de Janela de Dias e Navegação)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0 = Jan
  const [periodViewMode, setPeriodViewMode] = useState<'Q1' | 'Q2' | 'FULL' | 'CUSTOM'>(
    now.getDate() <= 15 ? 'Q1' : 'Q2'
  );
  // Dia inicial da visualização (1 a daysInMonth)
  const [startDayOffset, setStartDayOffset] = useState<number>(now.getDate() <= 15 ? 1 : 16);
  // Tamanho da janela em dias (padrão 15)
  const [windowSize, setWindowSize] = useState<number>(15);

  // 2. Filtros de visualização
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('TODAS');
  const [selectedCargo, setSelectedCargo] = useState<string>('TODOS');
  // 1- Exibe apenas aqueles que tem insalubridade cadastrada por padrão
  const [onlyWithRecords, setOnlyWithRecords] = useState(true);
  // 2- Filtro por data/dia selecionado ao clicar no cabeçalho
  const [selectedDayFilter, setSelectedDayFilter] = useState<string | null>(null);

  // 3. Atividade Ativa para Lançamento Rápido
  const [activeActivity, setActiveActivity] = useState<string>('CONCRETO');
  const [customActivityInput, setCustomActivityInput] = useState<string>('');
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [showFiltersDropdown, setShowFiltersDropdown] = useState(false);

  // 4. Modais
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [cellEditTarget, setCellEditTarget] = useState<{
    emp: Employee;
    dayMeta: { dayNumber: number; formattedDate: string; weekdayInitial: string; isWeekend: boolean };
    record?: InsalubrityRecord;
  } | null>(null);

  const handleImportMatrixBatch = async (
    records: InsalubrityRecord[],
    newEmployees?: Employee[],
    targetMonth?: number,
    targetYear?: number
  ) => {
    if (targetYear !== undefined) setSelectedYear(targetYear);
    if (targetMonth !== undefined) setSelectedMonth(targetMonth);
    setPeriodViewMode('FULL');

    // Cadastra novos colaboradores se houver
    if (newEmployees && newEmployees.length > 0 && onUpdateEmployees) {
      const existingMatriculas = new Set(employees.map(e => e.matricula.trim().toUpperCase()));
      const toAdd = newEmployees.filter(e => !existingMatriculas.has(e.matricula.trim().toUpperCase()));
      if (toAdd.length > 0) {
        await onUpdateEmployees([...employees, ...toAdd]);
      }
    }

    // Salva o lote de registros de insalubridade
    if (onSaveBatchRecords) {
      await onSaveBatchRecords(records);
    }
  };

  // Estado do Formulário em Lote de Atividades (Modo Simples: Data + Atividade + Busca + Seleção)
  const [batchSelectedEmpIds, setBatchSelectedEmpIds] = useState<string[]>([]);
  const [batchActivity, setBatchActivity] = useState('CONCRETO');
  const [batchLaunchDate, setBatchLaunchDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [batchSearchQuery, setBatchSearchQuery] = useState('');
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  // Total de dias no mês selecionado
  const daysInMonth = useMemo(() => {
    return new Date(selectedYear, selectedMonth + 1, 0).getDate();
  }, [selectedYear, selectedMonth]);

  // Lista completa de todos os dias do mês
  const allMonthDays = useMemo(() => {
    const list = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dayOfWeek = date.getDay(); // 0 = Dom, 6 = Sáb
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const formattedDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      list.push({
        dayNumber: day,
        dayOfWeek,
        weekdayInitial: WEEKDAY_INITIALS[dayOfWeek],
        isWeekend,
        formattedDate,
      });
    }
    return list;
  }, [selectedYear, selectedMonth, daysInMonth]);

  // Dias Visíveis na Matriz com base no modo selecionado ou deslocamento de dias
  const visibleDays = useMemo(() => {
    if (periodViewMode === 'Q1') {
      return allMonthDays.filter(d => d.dayNumber >= 1 && d.dayNumber <= 15);
    }
    if (periodViewMode === 'Q2') {
      return allMonthDays.filter(d => d.dayNumber >= 16);
    }
    if (periodViewMode === 'FULL') {
      return allMonthDays;
    }
    // Modo CUSTOM (Janela Deslizante)
    const start = Math.max(1, Math.min(startDayOffset, daysInMonth));
    const end = Math.min(start + windowSize - 1, daysInMonth);
    return allMonthDays.filter(d => d.dayNumber >= start && d.dayNumber <= end);
  }, [allMonthDays, periodViewMode, startDayOffset, windowSize, daysInMonth]);

  // Alias para manter compatibilidade com relatórios e lote
  const currentQuinzenaDays = visibleDays;

  // Rótulo textual do período selecionado
  const currentPeriodLabel = useMemo(() => {
    if (periodViewMode === 'Q1') return '1ª Quinzena (Dias 01 a 15)';
    if (periodViewMode === 'Q2') return `2ª Quinzena (Dias 16 a ${daysInMonth})`;
    if (periodViewMode === 'FULL') return `Mês Completo (Dias 01 a ${daysInMonth})`;
    if (visibleDays.length > 0) {
      const first = visibleDays[0].dayNumber.toString().padStart(2, '0');
      const last = visibleDays[visibleDays.length - 1].dayNumber.toString().padStart(2, '0');
      return `Intervalo Personalizado (Dias ${first} a ${last})`;
    }
    return `Dias 01 a ${daysInMonth}`;
  }, [periodViewMode, daysInMonth, visibleDays]);

  // Deslocar dias para frente ou para trás
  const handleShiftDays = (delta: number) => {
    let currentStart = 1;
    if (periodViewMode === 'Q1') currentStart = 1;
    else if (periodViewMode === 'Q2') currentStart = 16;
    else if (periodViewMode === 'FULL') currentStart = 1;
    else currentStart = startDayOffset;

    let newStart = currentStart + delta;

    if (newStart < 1) {
      // Se recuar além do dia 1, vai para o dia 1 do mês atual (ou volta o mês se já estava em 1)
      if (currentStart === 1) {
        handlePrevMonth();
        return;
      }
      newStart = 1;
    } else if (newStart > daysInMonth - 4) {
      // Se avançar além do fim do mês
      if (currentStart >= daysInMonth - 4) {
        handleNextMonth();
        return;
      }
      newStart = Math.max(1, daysInMonth - windowSize + 1);
    }

    setStartDayOffset(newStart);
    setPeriodViewMode('CUSTOM');
  };

  const handleSelectQuinzena = (q: 'Q1' | 'Q2') => {
    setPeriodViewMode(q);
    setStartDayOffset(q === 'Q1' ? 1 : 16);
  };

  const handleSelectFullMonth = () => {
    setPeriodViewMode('FULL');
    setStartDayOffset(1);
  };

  // Lista de funções disponíveis para o filtro
  const availableCargos = useMemo(() => {
    const set = new Set<string>();
    employees.forEach(e => {
      const c = e.funcao || e.cargo;
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Map de registros de insalubridade indexados por "matricula_YYYY-MM-DD"
  const recordsMap = useMemo(() => {
    const map = new Map<string, InsalubrityRecord>();
    if (!insalubrityRecords || insalubrityRecords.length === 0) return map;
    
    insalubrityRecords.forEach(rec => {
      if (!rec.dataEvento) return;
      const cleanMat = (rec.matricula || '').trim().toUpperCase();
      const rawDate = rec.dataEvento.trim();
      
      // Normaliza formatos diversos de data para YYYY-MM-DD
      let cleanDate = rawDate;
      const dmyMatch = rawDate.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
      if (dmyMatch) {
        let year = parseInt(dmyMatch[3], 10);
        if (year < 100) year += 2000;
        const month = parseInt(dmyMatch[2], 10);
        const day = parseInt(dmyMatch[1], 10);
        cleanDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
      
      const key = `${cleanMat}_${cleanDate}`;
      map.set(key, rec);

      if (cleanDate !== rawDate) {
        map.set(`${cleanMat}_${rawDate}`, rec);
      }
    });
    return map;
  }, [insalubrityRecords]);

  // Lista filtrada de colaboradores
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const cleanMat = emp.matricula.trim().toUpperCase();

      // 1. Busca texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = emp.nome.toLowerCase().includes(q);
        const matchMat = emp.matricula.toLowerCase().includes(q);
        const matchCargo = (emp.funcao || emp.cargo || '').toLowerCase().includes(q);
        if (!matchName && !matchMat && !matchCargo) return false;
      }

      // 2. Sede / Canteiro
      if (selectedBranch !== 'TODAS') {
        const empSede = emp.sede_atual || emp.sede;
        if (empSede !== selectedBranch) return false;
      }

      // 3. Cargo
      if (selectedCargo !== 'TODOS') {
        const empCargo = emp.funcao || emp.cargo;
        if (empCargo !== selectedCargo) return false;
      }

      // 4. Filtro por Data Específica selecionada no cabeçalho
      if (selectedDayFilter) {
        const dayKey = `${cleanMat}_${selectedDayFilter}`;
        if (!recordsMap.has(dayKey)) return false;
      }

      // 5. Apenas com registros de insalubridade no mês/período
      if (onlyWithRecords && !selectedDayFilter) {
        const hasRecInMonth = allMonthDays.some(d => {
          const dayKey = `${cleanMat}_${d.formattedDate}`;
          return recordsMap.has(dayKey);
        });
        if (!hasRecInMonth) return false;
      }

      return true;
    });
  }, [employees, searchQuery, selectedBranch, selectedCargo, onlyWithRecords, selectedDayFilter, recordsMap, allMonthDays]);

  // Contagem de colaboradores ativos no filtro
  const activeCount = useMemo(() => {
    return filteredEmployees.filter(e => {
      const st = (e.status || '').toLowerCase().trim();
      return st === 'ativo' || st === '';
    }).length;
  }, [filteredEmployees]);

  // Estatísticas do Período Visível e do Mês
  const periodStats = useMemo(() => {
    let totalApontamentosPeriodo = 0;
    let totalApontamentosMes = 0;
    const colaboradoresComAtividadePeriodo = new Set<string>();

    const visibleDatesSet = new Set(visibleDays.map(d => d.formattedDate));

    filteredEmployees.forEach(emp => {
      allMonthDays.forEach(d => {
        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
        const rec = recordsMap.get(key);
        if (rec) {
          totalApontamentosMes++;
          if (visibleDatesSet.has(d.formattedDate)) {
            totalApontamentosPeriodo++;
            colaboradoresComAtividadePeriodo.add(emp.matricula);
          }
        }
      });
    });

    const diasUteisPeriodo = visibleDays.filter(d => !d.isWeekend).length;

    return {
      totalApontamentosPeriodo,
      totalApontamentosMes,
      totalColaboradoresAtivosPeriodo: colaboradoresComAtividadePeriodo.size,
      diasUteisPeriodo,
    };
  }, [filteredEmployees, allMonthDays, visibleDays, recordsMap]);

  // Navegação de Mês
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  // Clique rápido em célula da matriz
  const handleCellClick = async (emp: Employee, dayMeta: typeof currentQuinzenaDays[0]) => {
    const key = `${emp.matricula.trim().toUpperCase()}_${dayMeta.formattedDate}`;
    const existing = recordsMap.get(key);

    if (existing) {
      // Abre diálogo para editar a atividade ou excluir o dia
      setCellEditTarget({ emp, dayMeta, record: existing });
    } else {
      // Cria apontamento rápido com a atividade selecionada
      const effectiveActivity = (activeActivity === 'OUTRA' && customActivityInput.trim()) 
        ? customActivityInput.trim().toUpperCase() 
        : activeActivity.toUpperCase();

      const newRec: InsalubrityRecord = {
        id: `ins-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        matricula: emp.matricula,
        nomeColaborador: emp.nome,
        sede: emp.sede_atual || emp.sede || 'KO',
        funcao: emp.funcao || emp.cargo || 'Operacional',
        dataEvento: dayMeta.formattedDate,
        atividadeDesempenhada: effectiveActivity || 'CONCRETO',
        grauExposicao: '20%', // Valor interno padrão para compatibilidade
        quantidadeHorasDias: 8,
        unidade: 'HORAS',
        responsavelLancamento: 'Encarregado de Campo',
        observacoes: `Lançamento Modo Simples - ${effectiveActivity}`,
        criadoEm: new Date().toISOString(),
        criadoPorEmail: currentUserEmail,
      };

      await onSaveRecord(newRec);
    }
  };

  // Lançamento em Lote para Dias Úteis da Quinzena
  const handleFillWeekdaysForEmployee = async (emp: Employee) => {
    const weekdays = currentQuinzenaDays.filter(d => !d.isWeekend);
    const toSave: InsalubrityRecord[] = [];

    const effectiveActivity = (activeActivity === 'OUTRA' && customActivityInput.trim()) 
      ? customActivityInput.trim().toUpperCase() 
      : activeActivity.toUpperCase();

    weekdays.forEach(d => {
      const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
      if (!recordsMap.has(key)) {
        toSave.push({
          id: `ins-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          matricula: emp.matricula,
          nomeColaborador: emp.nome,
          sede: emp.sede_atual || emp.sede || 'KO',
          funcao: emp.funcao || emp.cargo || 'Operacional',
          dataEvento: d.formattedDate,
          atividadeDesempenhada: effectiveActivity || 'CONCRETO',
          grauExposicao: '20%',
          quantidadeHorasDias: 8,
          unidade: 'HORAS',
          responsavelLancamento: 'Encarregado de Campo',
          observacoes: `Lote dias úteis ${currentPeriodLabel} ${MONTH_NAMES[selectedMonth]}/${selectedYear}`,
          criadoEm: new Date().toISOString(),
          criadoPorEmail: currentUserEmail,
        });
      }
    });

    if (toSave.length === 0) {
      alert(`Todos os dias úteis deste período já estão apontados para ${emp.nome}.`);
      return;
    }

    if (onSaveBatchRecords) {
      await onSaveBatchRecords(toSave);
    } else {
      for (const rec of toSave) {
        await onSaveRecord(rec);
      }
    }
  };

  // Limpar Todos os Registros da Quinzena/Período para um Colaborador
  const handleClearQuinzenaForEmployee = async (emp: Employee) => {
    const toDeleteIds: string[] = [];
    currentQuinzenaDays.forEach(d => {
      const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
      const rec = recordsMap.get(key);
      if (rec) {
        toDeleteIds.push(rec.id);
      }
    });

    if (toDeleteIds.length === 0) {
      alert(`Nenhum apontamento encontrado neste período para ${emp.nome}.`);
      return;
    }

    if (window.confirm(`Deseja remover todos os ${toDeleteIds.length} apontamentos de (${currentPeriodLabel}) de ${emp.nome}?`)) {
      for (const id of toDeleteIds) {
        await onDeleteRecord(id);
      }
    }
  };

  // Executar Lote Multi-Colaborador (Modo Simples)
  const handleExecuteMultiBatch = async () => {
    if (batchSelectedEmpIds.length === 0) {
      alert('Selecione ao menos um colaborador.');
      return;
    }

    if (!batchLaunchDate) {
      alert('Informe a data do lançamento.');
      return;
    }

    setIsSavingBatch(true);
    const toSave: InsalubrityRecord[] = [];
    const effectiveActivity = batchActivity.trim().toUpperCase() || 'CONCRETO';

    batchSelectedEmpIds.forEach(empMat => {
      const emp = employees.find(e => e.matricula === empMat);
      if (!emp) return;

      const key = `${emp.matricula.trim().toUpperCase()}_${batchLaunchDate}`;
      const existing = recordsMap.get(key);

      toSave.push({
        id: existing?.id || `ins-${Date.now()}-${Math.floor(Math.random() * 1000000)}`,
        matricula: emp.matricula,
        nomeColaborador: emp.nome,
        sede: emp.sede_atual || emp.sede || 'KO',
        funcao: emp.funcao || emp.cargo || 'Operacional',
        dataEvento: batchLaunchDate,
        atividadeDesempenhada: effectiveActivity,
        grauExposicao: '20%',
        quantidadeHorasDias: 8,
        unidade: 'HORAS',
        responsavelLancamento: 'Encarregado de Campo',
        observacoes: `Lançamento ${effectiveActivity} - ${batchLaunchDate}`,
        criadoEm: existing?.criadoEm || new Date().toISOString(),
        criadoPorEmail: currentUserEmail,
      });
    });

    try {
      if (onSaveBatchRecords) {
        await onSaveBatchRecords(toSave);
      } else {
        for (const rec of toSave) {
          await onSaveRecord(rec);
        }
      }
      setIsBatchModalOpen(false);
      setBatchSelectedEmpIds([]);
      setBatchSearchQuery('');
    } catch (err: any) {
      alert(`Erro ao salvar lote: ${err?.message || 'Falha na gravação'}`);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Exportar Planilha Oficial Simples COMARA em CSV (Sem Porcentagem)
  const handleExportOfficialSpreadsheetCSV = () => {
    const quinzenaLabel = currentPeriodLabel.toUpperCase();
    const headerRow1 = `COMISSAO DE AEROPORTOS DA REGIAO AMAZONICA - COMARA`;
    const headerRow2 = `CONTROLE DO EFETIVO - MODO SIMPLES - ${MONTH_NAMES[selectedMonth].toUpperCase()}/${selectedYear} - ${quinzenaLabel}`;
    const headerRow3 = `CANTEIRO/SEDE: ${selectedBranch} | GERADO EM: ${new Date().toLocaleDateString('pt-BR')}`;
    
    const dayHeaders = currentQuinzenaDays.map(d => `${d.dayNumber} (${d.weekdayInitial})`).join(';');
    const tableHeader = `No;MATRICULA;NOME DO COLABORADOR;FUNCAO / CARGO;${dayHeaders};TOTAL DE DIAS TRABALHADOS;SEDE`;

    const rows = filteredEmployees.map((emp, index) => {
      let markedCount = 0;

      const dayValues = currentQuinzenaDays.map(d => {
        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
        const rec = recordsMap.get(key);
        if (rec) {
          markedCount++;
          return `"${(rec.atividadeDesempenhada || 'TRABALHO').replace(/"/g, '""')}"`;
        }
        return '';
      }).join(';');

      return `${index + 1};${emp.matricula};"${emp.nome.replace(/"/g, '""')}";"${(emp.funcao || emp.cargo || 'Operacional').replace(/"/g, '""')}";${dayValues};${markedCount};${emp.sede_atual || emp.sede || 'KO'}`;
    });

    const csvContent = '\uFEFF' + [headerRow1, headerRow2, headerRow3, '', tableHeader, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodFileSlug = periodViewMode.toLowerCase();
    link.download = `comara_efetivo_simples_${periodFileSlug}_${MONTH_NAMES[selectedMonth].toLowerCase()}_${selectedYear}_${selectedBranch}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------- */}
      {/* 1. CABEÇALHO INSTITUCIONAL COMARA (ESTILO LOOKER DASHBOARD)   */}
      {/* ------------------------------------------------------------- */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl shadow-xs border transition-colors ${
        isDark 
          ? 'bg-[#16243D] text-white border-[#243756]' 
          : 'bg-white text-slate-900 border-slate-200'
      }`}>
        <div>
          <div className="flex items-center space-x-2">
            <span className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 font-mono border ${
              isDark 
                ? 'bg-[#243756] text-blue-400 border-[#335075]' 
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sincronização Ativa
            </span>
            <InfoTooltip 
              theme={theme}
              content="Gestão executiva e controle de apontamentos de atividades e insalubridade em canteiros de obras. Conformidade com NR-15 e normativas COMARA."
            />
          </div>
          <h1 className={`text-xl sm:text-2xl font-bold mt-2 tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            Painel Executivo de Gestão de Insalubridade
          </h1>
        </div>

        {/* Ações Rápidas do Cabeçalho */}
        <div className="flex items-center gap-2">
          {/* Botão + Lançamento em Lote */}
          <IconButton
            id="btn-insalubridade-lancamento-lote"
            icon={Plus}
            variant="primary"
            size="md"
            tooltip="Lançamento em Lote de Atividades"
            aria-label="Lançamento em Lote"
            onClick={() => {
              setBatchSelectedEmpIds([]);
              setIsBatchModalOpen(true);
            }}
          />

          {/* Botão Impressora (Imprimir Folha) */}
          <IconButton
            id="btn-insalubridade-imprimir-folha"
            icon={Printer}
            variant="secondary"
            size="md"
            tooltip="Imprimir Folha de Frequência e Insalubridade (A4)"
            aria-label="Imprimir Folha"
            onClick={() => setIsPrintModalOpen(true)}
          />

          {/* Botão + Ações (Dropdown) */}
          <div className="relative">
            <button
              onClick={() => setShowActionsDropdown(!showActionsDropdown)}
              className={`px-4 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                isDark
                  ? 'border-[#335075] hover:bg-[#243756] text-[#E2E8F0] bg-[#0F1B33]'
                  : 'border-slate-200 hover:bg-slate-100 text-slate-700 bg-slate-50'
              }`}
              id="btn-insalubridade-mais-acoes"
            >
              <span>+ Ações</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showActionsDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActionsDropdown(false)} />
                <div className={`absolute right-0 top-full mt-1.5 z-50 w-56 p-1.5 rounded-xl border shadow-xl ${
                  isDark ? 'bg-[#16243D] border-[#335075]' : 'bg-white border-slate-200'
                }`}>
                  <button
                    onClick={() => {
                      setBatchSelectedEmpIds([]);
                      setIsBatchModalOpen(true);
                      setShowActionsDropdown(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Plus className="w-4 h-4 text-blue-400" />
                    Lançamento em Lote
                  </button>
                  <button
                    onClick={() => {
                      setIsPrintModalOpen(true);
                      setShowActionsDropdown(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Printer className="w-4 h-4 text-blue-400" />
                    Imprimir Folha
                  </button>
                  <button
                    onClick={() => {
                      setIsImportModalOpen(true);
                      setShowActionsDropdown(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <UploadCloud className="w-4 h-4 text-amber-500" />
                    Importar Folha (CSV)
                  </button>
                  <button
                    onClick={() => {
                      handleExportOfficialSpreadsheetCSV();
                      setShowActionsDropdown(false);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Download className="w-4 h-4 text-emerald-400" />
                    Exportar (CSV)
                  </button>
                  {onOpenConversionModal && (userRole === 'SUPER_ADMIN' || userRole === 'GESTOR_RH' || userRole === 'GERENTE_CAMPO' || userRole === 'ROLE_GERENTE') && (
                    <button
                      onClick={() => {
                        onOpenConversionModal();
                        setShowActionsDropdown(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer border-t ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0] border-[#243756]' : 'hover:bg-slate-100 text-slate-700 border-slate-100'
                      }`}
                    >
                      <ArrowRightLeft className="w-4 h-4 text-amber-500" />
                      Converter p/ NR-15
                    </button>
                  )}
                  {onNavigateToReports && (
                    <button
                      onClick={() => {
                        onNavigateToReports();
                        setShowActionsDropdown(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <FileText className="w-4 h-4 text-emerald-400" />
                      Relatório Simples
                    </button>
                  )}
                  {onSwitchToCompleteMode && (
                    <button
                      onClick={() => {
                        onSwitchToCompleteMode();
                        setShowActionsDropdown(false);
                      }}
                      className={`w-full px-3.5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                        isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Settings2 className="w-4 h-4 text-blue-400" />
                      Modo Completo (NR-15)
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. CARDS RESUMO DO PERÍODO SELECIONADO (ESTILO LOOKER DASHBOARD) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-5">
        {/* KPI 1: Efetivo Filtrado */}
        <div className={`p-5 xl:p-6 rounded-2xl border shadow-xs transition-all ${
          isDark 
            ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <p className={`text-xs sm:text-sm font-bold uppercase font-mono tracking-wide ${isDark ? 'text-[#94A3B8]' : 'text-gray-600'}`}>
                Efetivo Filtrado
              </p>
              <InfoTooltip 
                theme={theme}
                content="Quantidade total de colaboradores filtrados pelos critérios atuais de sede e cargo."
              />
            </div>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Users className="w-5 h-5" />
            </div>
          </div>
          <h2 className={`text-3xl sm:text-4xl font-mono font-light ${isDark ? 'text-[#E2E8F0]' : 'text-gray-900'}`}>
            {filteredEmployees.length}
          </h2>
          <p className={`text-xs mt-2 font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
            {activeCount} ativos • {filteredEmployees.length - activeCount} outros
          </p>
        </div>

        {/* KPI 2: Dias Úteis no Período */}
        <div className={`p-5 xl:p-6 rounded-2xl border shadow-xs transition-all ${
          isDark 
            ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <p className={`text-xs sm:text-sm font-bold uppercase font-mono tracking-wide ${isDark ? 'text-[#94A3B8]' : 'text-gray-600'}`}>
                Dias Úteis no Período
              </p>
              <InfoTooltip 
                theme={theme}
                content="Quantidade de dias úteis (segunda a sexta-feira) na janela ou quinzena exibida."
              />
            </div>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-amber-950/40 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <h2 className={`text-3xl sm:text-4xl font-mono font-light ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>
            {periodStats.diasUteisPeriodo}
          </h2>
          <p className={`text-xs mt-2 font-mono ${isDark ? 'text-amber-500/80' : 'text-amber-700'}`}>
            de {visibleDays.length} dias ({currentPeriodLabel})
          </p>
        </div>

        {/* KPI 3: Dias Trabalhados (Período) */}
        <div className={`p-5 xl:p-6 rounded-2xl border shadow-xs transition-all ${
          isDark 
            ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <p className={`text-xs sm:text-sm font-bold uppercase font-mono tracking-wide ${isDark ? 'text-[#94A3B8]' : 'text-gray-600'}`}>
                Dias Trabalhados (Período)
              </p>
              <InfoTooltip 
                theme={theme}
                content="Total de apontamentos de atividades desempenhadas no período visível da grade."
              />
            </div>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-emerald-950/40 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <h2 className={`text-3xl sm:text-4xl font-mono font-light ${isDark ? 'text-green-400' : 'text-emerald-600'}`}>
            {periodStats.totalApontamentosPeriodo}
          </h2>
          <p className={`text-xs mt-2 font-mono ${isDark ? 'text-green-400/80' : 'text-emerald-700'}`}>
            {periodStats.totalApontamentosMes} no mês total • {visibleDays.length > 0 ? (periodStats.totalApontamentosPeriodo / visibleDays.length).toFixed(1) : '0.0'} méd/dia
          </p>
        </div>

        {/* KPI 4: Efetivo com Atividade */}
        <div className={`p-5 xl:p-6 rounded-2xl border shadow-xs transition-all ${
          isDark 
            ? 'bg-[#16243D] border-[#243756] hover:border-[#335075]' 
            : 'bg-white border-gray-200 hover:border-gray-300'
        }`}>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <p className={`text-xs sm:text-sm font-bold uppercase font-mono tracking-wide ${isDark ? 'text-[#94A3B8]' : 'text-gray-600'}`}>
                Efetivo com Atividade
              </p>
              <InfoTooltip 
                theme={theme}
                content="Quantidade de colaboradores distintos que possuem ao menos 1 dia trabalhado/apontado no período."
              />
            </div>
            <div className={`p-2 rounded-xl ${isDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
              <Users className="w-5 h-5" />
            </div>
          </div>
          <h2 className={`text-3xl sm:text-4xl font-mono font-light ${isDark ? 'text-[#3B82F6]' : 'text-blue-600'}`}>
            {periodStats.totalColaboradoresAtivosPeriodo}
          </h2>
          <p className={`text-xs mt-2 font-mono ${isDark ? 'text-[#94A3B8]' : 'text-gray-500'}`}>
            de {filteredEmployees.length} ({filteredEmployees.length > 0 ? Math.round((periodStats.totalColaboradoresAtivosPeriodo / filteredEmployees.length) * 100) : 0}% de adesão)
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. PAINEL PRINCIPAL: CONTROLES DE DATA, FILTROS E MATRIZ       */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-5 xl:p-6 rounded-2xl border shadow-xs transition-colors space-y-4 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
          {/* Seletor de Mês, Ano e Período */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Navegação e Seletor Interativo de Mês e Ano via Calendário */}
            <MonthYearPicker
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onChange={(newMonth, newYear) => {
                setSelectedMonth(newMonth);
                setSelectedYear(newYear);
              }}
              onPrevMonth={handlePrevMonth}
              onNextMonth={handleNextMonth}
              theme={theme}
              accentColor="amber"
            />

            {/* SELETORES DE MODO DE PERÍODO */}
            <div className={`flex items-center p-1 rounded-xl border ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-100 border-slate-200'
            }`}>
              <button
                type="button"
                onClick={() => handleSelectQuinzena('Q1')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                  periodViewMode === 'Q1'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1ª Quinzena (1-15)
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuinzena('Q2')}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                  periodViewMode === 'Q2'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2ª Quinzena (16-{daysInMonth})
              </button>
              <button
                type="button"
                onClick={handleSelectFullMonth}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all active:scale-[0.98] cursor-pointer ${
                  periodViewMode === 'FULL'
                    ? 'bg-amber-600 text-white shadow-xs font-black'
                    : isDark ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mês Completo (1-{daysInMonth})
              </button>
            </div>

          </div>

          {/* Busca + Filtros da Matriz */}
          <div className="flex items-center gap-2.5 ml-auto flex-wrap">
            {/* Botão Rápido: Apenas Com Insalubridade */}
            <button
              type="button"
              onClick={() => {
                setOnlyWithRecords(!onlyWithRecords);
                if (selectedDayFilter) setSelectedDayFilter(null);
              }}
              className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                onlyWithRecords
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-xs'
                  : isDark
                    ? 'border-[#243756] hover:bg-[#243756] text-[#94A3B8]'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              title="Alternar: Exibir apenas colaboradores que possuem insalubridade cadastrada"
            >
              <Users className="w-4 h-4 text-amber-500" />
              <span>{onlyWithRecords ? 'Com Insalubridade' : 'Todos Colaboradores'}</span>
            </button>

            {/* Busca Colaborador */}
            <div className="relative flex-1 md:w-52">
              <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isDark ? 'text-gray-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar col."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-3.5 py-2 rounded-xl border text-xs sm:text-sm outline-hidden ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20'
                }`}
              />
            </div>

            {/* Filtros Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFiltersDropdown(!showFiltersDropdown)}
                className={`px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${
                  isDark
                    ? 'border-[#243756] hover:bg-[#243756] text-[#E2E8F0]'
                    : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4 text-amber-500" />
                <span>Filtros</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFiltersDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFiltersDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFiltersDropdown(false)} />
                  <div className={`absolute right-0 top-full mt-1.5 z-50 w-72 p-3.5 rounded-xl border shadow-xl space-y-3 ${
                    isDark ? 'bg-[#16243D] border-[#335075]' : 'bg-white border-slate-200'
                  }`}>
                    {/* Sede / Canteiro */}
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Sede / Canteiro</label>
                      <select
                        value={selectedBranch}
                        onChange={(e) => setSelectedBranch(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-hidden font-medium ${
                          isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="TODAS">Todas as Sedes / Canteiros</option>
                        <option value="KO">KO - Coari</option>
                        <option value="BE">BE - Belém</option>
                        <option value="MN">MN - Manaus</option>
                        <option value="SP">SP - São Paulo</option>
                        <option value="RJ">RJ - Rio de Janeiro</option>
                        {constructionSites.map(cs => {
                          const code = cs.code || cs.codigo || cs.branch || cs.sede;
                          if (['KO', 'BE', 'MN', 'SP', 'RJ'].includes(code)) return null;
                          return (
                            <option key={cs.id} value={code}>
                              {cs.name || cs.nome} ({code})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Função */}
                    <div>
                      <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Função</label>
                      <select
                        value={selectedCargo}
                        onChange={(e) => setSelectedCargo(e.target.value)}
                        className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-hidden font-medium ${
                          isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                        }`}
                      >
                        <option value="TODOS">Todas as Funções</option>
                        {availableCargos.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Checkbox */}
                    <label className={`flex items-center gap-1.5 text-xs cursor-pointer font-medium select-none ${
                      isDark ? 'text-gray-300' : 'text-slate-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={onlyWithRecords}
                        onChange={(e) => setOnlyWithRecords(e.target.checked)}
                        className="rounded text-amber-500 focus:ring-0"
                      />
                      <span>Apenas com insalubridade cadastrada</span>
                    </label>

                    {/* Divisor */}
                    <div className={`border-t pt-2.5 ${isDark ? 'border-[#243756]' : 'border-slate-100'}`} />

                    {/* Atividade para Apontar */}
                    <div>
                      <label className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider mb-1.5 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                        <Briefcase className="w-3 h-3" />
                        Serviço / Atividade para Apontar
                      </label>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {DEFAULT_ACTIVITIES.slice(0, 6).map(act => (
                          <button
                            key={act}
                            type="button"
                            onClick={() => setActiveActivity(act)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-[0.98] cursor-pointer ${
                              activeActivity === act
                                ? 'bg-amber-500 text-black shadow-xs font-black ring-2 ring-amber-400/50'
                                : isDark
                                  ? 'bg-[#0F1B33] text-gray-300 border border-[#243756] hover:bg-[#1B2D4A]'
                                  : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {act}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setActiveActivity('OUTRA')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-[0.98] cursor-pointer ${
                            activeActivity === 'OUTRA'
                              ? 'bg-amber-500 text-black shadow-xs font-black ring-2 ring-amber-400/50'
                              : isDark
                                ? 'bg-[#0F1B33] text-gray-300 border border-[#243756] hover:bg-[#1B2D4A]'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          + Outra
                        </button>
                      </div>
                      {activeActivity === 'OUTRA' && (
                        <input
                          type="text"
                          placeholder="Digitar nome da atividade..."
                          value={customActivityInput}
                          onChange={(e) => setCustomActivityInput(e.target.value.toUpperCase())}
                          className={`mt-2 w-full px-2.5 py-1 rounded-lg text-xs uppercase font-bold border outline-hidden ${
                            isDark ? 'bg-[#0F1B33] border-amber-500 text-white' : 'bg-white border-amber-500 text-slate-900'
                          }`}
                          autoFocus
                        />
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* ------------------------------------------------------------- */}
      {/* 3. MATRIZ DE EFETIVO COM NAVEGAÇÃO DE DIAS & TOTAL FIXO       */}
      {/* ------------------------------------------------------------- */}
      <div className={`rounded-2xl border shadow-xs overflow-hidden ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <Layers className="w-4 h-4 text-amber-500" />
            <span className={isDark ? 'text-white' : 'text-slate-900'}>
              Grade de Serviços: {currentPeriodLabel} — {MONTH_NAMES[selectedMonth]} / {selectedYear}
            </span>
          </div>

          {/* Atalhos Rápidos para Movimentar Dias */}
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <div className="flex items-center gap-1 bg-black/10 dark:bg-white/5 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => handleShiftDays(-1)}
                className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors active:scale-[0.98] cursor-pointer text-xs ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700 bg-white'
                }`}
                title="Voltar 1 dia (Deslizar grade para esquerda)"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Voltar Dia</span>
              </button>

              <button
                type="button"
                onClick={() => handleShiftDays(1)}
                className={`px-2 py-1 rounded-lg font-bold flex items-center gap-1 border transition-colors active:scale-[0.98] cursor-pointer text-xs ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-200' : 'border-slate-300 hover:bg-slate-100 text-slate-700 bg-white'
                }`}
                title="Avançar 1 dia (Deslizar grade para direita)"
              >
                <span>Avançar Dia</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <span className={`italic hidden sm:inline ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
              * Clique no número do dia no cabeçalho para filtrar por aquela data
            </span>
          </div>
        </div>

        {/* Banner de Filtro Ativo por Dia */}
        {selectedDayFilter && (
          <div className="px-4 py-2.5 bg-amber-500/15 border-b border-amber-500/30 flex items-center justify-between gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2 text-amber-400 font-bold">
              <CalendarCheck className="w-4 h-4 text-amber-500" />
              <span>
                Filtrando colaboradores com lançamento no <strong>Dia {selectedDayFilter.split('-')[2]}/{selectedDayFilter.split('-')[1]}</strong> ({filteredEmployees.length} encontrados)
              </span>
            </div>
            <button
              onClick={() => setSelectedDayFilter(null)}
              className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs flex items-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Remover filtro de dia</span>
            </button>
          </div>
        )}

        <div className="overflow-x-auto max-h-[720px] 2xl:max-h-[820px] relative">
          <table className="w-full text-xs sm:text-sm border-collapse text-left">
            <thead className={`sticky top-0 z-30 ${
              isDark ? 'bg-[#243756] text-[#E2E8F0]' : 'bg-slate-100 text-slate-800'
            }`}>
              <tr>
                {/* Colunas Fixas de Identificação (Esquerda) */}
                <th className="py-3 px-3 font-mono font-bold w-12 min-w-[48px] text-center border-r border-b border-black/10 dark:border-white/10 sticky left-0 z-40 bg-[#243756] dark:bg-[#243756] light:bg-slate-100 text-xs sm:text-sm">
                  Nº
                </th>
                <th className="py-3 px-4 font-bold min-w-[240px] max-w-[320px] border-r border-b border-black/10 dark:border-white/10 sticky left-12 z-40 bg-[#243756] dark:bg-[#243756] light:bg-slate-100 text-xs sm:text-sm">
                  COLABORADOR / MATRÍCULA
                </th>

                {/* Colunas dos Dias Selecionados (Centro - que deslizam livremente e são clicáveis para filtrar) */}
                {visibleDays.map(d => {
                  const isDaySelected = selectedDayFilter === d.formattedDate;

                  return (
                    <th
                      key={d.dayNumber}
                      onClick={() => {
                        setSelectedDayFilter(prev => prev === d.formattedDate ? null : d.formattedDate);
                      }}
                      className={`py-2.5 px-1 font-mono text-center font-bold min-w-[50px] xl:min-w-[56px] border-r border-b border-black/10 dark:border-white/10 cursor-pointer select-none transition-all ${
                        isDaySelected
                          ? 'bg-amber-500 text-black shadow-inner ring-2 ring-amber-400 z-30 scale-[1.02]'
                          : d.isWeekend 
                            ? (isDark ? 'bg-[#16243D] text-red-400 hover:bg-amber-500/20' : 'bg-slate-200/70 text-red-600 hover:bg-amber-100/60')
                            : (isDark ? 'hover:bg-amber-500/20 text-gray-200' : 'hover:bg-amber-100/60 text-slate-700')
                      }`}
                      title={`Clique para filtrar lançamentos do dia ${d.dayNumber} (${isDaySelected ? 'Filtro Ativo - Clique para desativar' : 'Clique para filtrar'})`}
                    >
                      <div className="flex flex-col items-center justify-center">
                        <div className={`text-[13px] sm:text-[14px] font-black leading-tight ${isDaySelected ? 'text-black underline decoration-2' : ''}`}>
                          {d.dayNumber}
                        </div>
                        <div className={`text-[10px] sm:text-[11px] font-semibold ${
                          isDaySelected ? 'text-black font-black' : d.isWeekend ? 'text-red-400 font-bold' : isDark ? 'text-gray-400' : 'text-slate-500'
                        }`}>
                          {d.weekdayInitial}
                        </div>
                        {isDaySelected && (
                          <span className="inline-block w-1.5 h-1.5 bg-black rounded-full mt-0.5" />
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Colunas Finais: Total de Dias Trabalhados e Ações Rápidas (STICKY FIXO À DIREITA) */}
                <th className={`py-3 px-3 font-bold text-center w-[140px] min-w-[140px] border-l-2 border-r border-b border-amber-500/40 sticky right-[120px] z-40 text-xs sm:text-sm ${
                  isDark ? 'bg-[#243756] text-white shadow-[-6px_0_12px_rgba(0,0,0,0.35)]' : 'bg-slate-100 text-slate-900 shadow-[-6px_0_12px_rgba(0,0,0,0.08)]'
                }`}>
                  TOTAL DIAS
                </th>
                <th className={`py-3 px-3 font-bold text-center w-[120px] min-w-[120px] border-b border-black/10 dark:border-white/10 sticky right-0 z-40 text-xs sm:text-sm ${
                  isDark ? 'bg-[#243756] text-[#E2E8F0]' : 'bg-slate-100 text-slate-800'
                }`}>
                  AÇÕES RÁPIDAS
                </th>
              </tr>
            </thead>

            <tbody className={`divide-y font-mono ${
              isDark ? 'divide-[#243756] text-gray-300' : 'divide-slate-200 text-slate-700'
            }`}>
              {filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={visibleDays.length + 5} className="py-12 text-center text-xs sm:text-sm text-gray-500 font-sans">
                    Nenhum colaborador encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, index) => {
                  let employeeVisibleDaysCount = 0;
                  let employeeMonthDaysCount = 0;

                  // Calcula contagem do período visível e do mês inteiro
                  allMonthDays.forEach(d => {
                    const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
                    if (recordsMap.has(key)) {
                      employeeMonthDaysCount++;
                    }
                  });

                  return (
                    <tr
                      key={emp.id || emp.matricula}
                      className={`transition-colors group ${
                        isDark ? 'hover:bg-[#1B2D4A]' : 'hover:bg-slate-50'
                      }`}
                    >
                      {/* 1. Nº Sequencial */}
                      <td className={`py-2.5 px-2 text-center text-xs font-bold border-r border-black/5 dark:border-white/5 sticky left-0 z-20 ${
                        isDark ? 'bg-[#16243D] group-hover:bg-[#1B2D4A]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        {index + 1}
                      </td>

                      {/* 2. Nome e Matrícula */}
                      <td className={`py-2.5 px-4 border-r border-black/5 dark:border-white/5 sticky left-12 z-20 ${
                        isDark ? 'bg-[#16243D] group-hover:bg-[#1B2D4A]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        <div className="font-sans font-bold truncate max-w-[260px] xl:max-w-[300px] text-xs sm:text-sm" title={emp.nome}>
                          {emp.nome}
                        </div>
                        <div className="text-[11px] sm:text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                          <span>MAT: {emp.matricula}</span>
                          <span>•</span>
                          <span>{emp.sede_atual || emp.sede}</span>
                        </div>
                      </td>

                      {/* Células dos Dias Selecionados */}
                      {visibleDays.map(d => {
                        const key = `${emp.matricula.trim().toUpperCase()}_${d.formattedDate}`;
                        const record = recordsMap.get(key);

                        if (record) {
                          employeeVisibleDaysCount++;
                        }

                        const activityText = record?.atividadeDesempenhada || '';
                        // Abreviação para caber elegante no grid
                        const shortCode = activityText.length > 4 ? activityText.substring(0, 4) : activityText;

                        return (
                          <td
                            key={d.dayNumber}
                            onClick={() => handleCellClick(emp, d)}
                            className={`py-1.5 px-1 text-center cursor-pointer select-none transition-colors active:scale-[0.98] border-r border-black/5 dark:border-white/5 ${
                              d.isWeekend 
                                ? (isDark ? 'bg-black/20 hover:bg-amber-500/20' : 'bg-slate-100/60 hover:bg-amber-100/60') 
                                : isDark ? 'hover:bg-amber-500/20' : 'hover:bg-amber-100/60'
                            }`}
                            title={
                              record 
                                ? `Dia ${d.dayNumber}/${selectedMonth + 1}: ${record.atividadeDesempenhada} (Clique para editar/remover)` 
                                : `Dia ${d.dayNumber}/${selectedMonth + 1}: Vazio (Clique para marcar ${activeActivity})`
                            }
                          >
                            {record ? (
                              <div className="mx-auto min-w-[38px] px-1.5 py-1 rounded-md bg-amber-500 text-black text-[10px] sm:text-[11px] font-black tracking-tight leading-none truncate shadow-xs">
                                {shortCode || 'OK'}
                              </div>
                            ) : (
                              <div className="w-8 h-7 mx-auto rounded-md flex items-center justify-center text-transparent hover:text-gray-400 text-xs">
                                •
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* 5. Total de Dias Trabalhados (FIXO À DIREITA / STICKY) */}
                      <td className={`py-2.5 px-2 text-center font-bold border-l-2 border-r border-amber-500/40 sticky right-[120px] z-20 w-[140px] min-w-[140px] ${
                        isDark 
                          ? 'bg-[#16243D] group-hover:bg-[#1B2D4A] shadow-[-6px_0_12px_rgba(0,0,0,0.35)]' 
                          : 'bg-white group-hover:bg-slate-50 shadow-[-6px_0_12px_rgba(0,0,0,0.08)]'
                      }`}>
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs sm:text-sm font-black ${
                            employeeVisibleDaysCount > 0 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : isDark ? 'text-gray-500' : 'text-slate-400'
                          }`}>
                            {employeeVisibleDaysCount} {employeeVisibleDaysCount === 1 ? 'dia' : 'dias'}
                          </span>
                          {periodViewMode !== 'FULL' && (
                            <span className={`text-[10px] sm:text-[11px] font-mono ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                              Mês: <strong>{employeeMonthDaysCount}d</strong>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Ações Rápidas por Linha (FIXO À DIREITA / STICKY) */}
                      <td className={`py-2 px-2 text-center sticky right-0 z-20 w-[120px] min-w-[120px] border-b border-black/5 dark:border-white/5 ${
                        isDark ? 'bg-[#16243D] group-hover:bg-[#1B2D4A]' : 'bg-white group-hover:bg-slate-50'
                      }`}>
                        <div className="flex items-center justify-center gap-1.5 font-sans">
                          <button
                            onClick={() => handleFillWeekdaysForEmployee(emp)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors active:scale-[0.98] cursor-pointer ${
                              isDark 
                                ? 'bg-blue-950/40 text-blue-300 border-blue-800/50 hover:bg-blue-900/60' 
                                : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                            }`}
                            title="Preencher todos os dias úteis deste período"
                          >
                            + Úteis
                          </button>

                          {employeeMonthDaysCount > 0 && (
                            <button
                              onClick={() => handleClearQuinzenaForEmployee(emp)}
                              className={`p-1.5 rounded-lg text-xs border transition-colors active:scale-[0.98] cursor-pointer ${
                                isDark 
                                ? 'text-red-400 border-red-900/40 hover:bg-red-950/40' 
                                : 'text-red-600 border-red-200 hover:bg-red-50'
                              }`}
                              title="Limpar apontamentos deste período"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* ============================================================= */}
      {/* 4. MODAL DE EDIÇÃO/DETALHES DE UMA CÉLULA ESPECÍFICA          */}
      {/* ============================================================= */}
      {cellEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm">
                  Apontamento — Dia {cellEditTarget.dayMeta.dayNumber} de {MONTH_NAMES[selectedMonth]}
                </h3>
              </div>
              <button
                onClick={() => setCellEditTarget(null)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#243756] text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] text-gray-400 uppercase font-bold">Colaborador:</span>
                <div className="font-bold text-sm">{cellEditTarget.emp.nome}</div>
                <div className="text-gray-400 font-mono text-[11px]">MAT: {cellEditTarget.emp.matricula} • {cellEditTarget.emp.funcao || cellEditTarget.emp.cargo}</div>
              </div>

              <div>
                <label className="block font-bold mb-1 uppercase text-[10px] text-gray-400">
                  Serviço / Atividade Realizada:
                </label>
                <div className="grid grid-cols-2 gap-1.5 mb-2">
                  {DEFAULT_ACTIVITIES.slice(0, 6).map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => {
                        if (cellEditTarget.record) {
                          onSaveRecord({
                            ...cellEditTarget.record,
                            atividadeDesempenhada: act,
                          });
                        }
                        setCellEditTarget(null);
                      }}
                      className={`p-2 rounded-xl text-left font-bold text-xs border transition-colors active:scale-[0.98] cursor-pointer ${
                        cellEditTarget.record?.atividadeDesempenhada === act
                          ? 'bg-amber-500 text-black border-amber-400'
                          : isDark ? 'border-[#243756] hover:bg-[#243756] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-2">
              {cellEditTarget.record && (
                <button
                  type="button"
                  onClick={async () => {
                    if (cellEditTarget.record) {
                      await onDeleteRecord(cellEditTarget.record.id);
                    }
                    setCellEditTarget(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/50 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover Dia</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCellEditTarget(null)}
                className={`px-4 py-2 rounded-xl border font-bold text-xs ml-auto ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 5. MODAL DE LANÇAMENTO EM LOTE (SEM PORCENTAGEM)               */}
      {/* ============================================================= */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className={`w-full max-w-2xl p-6 rounded-2xl border shadow-2xl space-y-4 animate-in fade-in zoom-in-95 ${
            isDark ? 'bg-[#16243D] border-[#243756] text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base">Lançamento em Lote de Atividades (Modo Simples)</h3>
              </div>
              <button
                onClick={() => setIsBatchModalOpen(false)}
                className={`p-1.5 rounded-lg ${isDark ? 'hover:bg-[#243756] text-gray-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Data do Lançamento */}
              <div>
                <label className="block font-bold mb-1.5 uppercase text-[10px] text-gray-400">
                  1. Data do Lançamento:
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={batchLaunchDate}
                    onChange={(e) => setBatchLaunchDate(e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-xs font-mono font-bold outline-none cursor-pointer ${
                      isDark ? 'bg-[#0F1B33] border-[#243756] text-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-amber-600'
                    }`}
                  />
                  <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                    {batchLaunchDate ? new Date(batchLaunchDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : ''}
                  </span>
                </div>
              </div>

              {/* 2. Serviço / Atividade */}
              <div>
                <label className="block font-bold mb-1.5 uppercase text-[10px] text-gray-400">
                  2. Serviço / Atividade a ser atribuída:
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {DEFAULT_ACTIVITIES.map(act => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setBatchActivity(act)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer ${
                        batchActivity === act
                          ? 'bg-amber-500 text-black shadow-xs font-black'
                          : isDark ? 'bg-[#0F1B33] border border-[#243756] text-gray-300' : 'bg-slate-100 border border-slate-200 text-slate-700'
                      }`}
                    >
                      {act}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={batchActivity}
                  onChange={(e) => setBatchActivity(e.target.value.toUpperCase())}
                  placeholder="Ou digite o nome do serviço (ex: CANALETA, ASFALTO...)"
                  className={`w-full px-3 py-2 rounded-xl border text-xs outline-hidden uppercase font-bold ${
                    isDark ? 'bg-[#0F1B33] border-[#243756] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* 3. Seleção de Colaboradores com Busca Rápida */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold uppercase text-[10px] text-gray-400">
                    3. Colaboradores Alvo ({batchSelectedEmpIds.length} selecionados):
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const targetList = filteredEmployees.filter(e => {
                          const q = batchSearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return e.nome.toLowerCase().includes(q) || e.matricula.toLowerCase().includes(q);
                        });
                        const idsToAdd = targetList.map(e => e.matricula);
                        setBatchSelectedEmpIds(Array.from(new Set([...batchSelectedEmpIds, ...idsToAdd])));
                      }}
                      className="text-[11px] text-blue-400 hover:underline cursor-pointer font-bold"
                    >
                      Marcar Filtrados ({filteredEmployees.filter(e => {
                        const q = batchSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return e.nome.toLowerCase().includes(q) || e.matricula.toLowerCase().includes(q);
                      }).length})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedEmpIds(filteredEmployees.map(e => e.matricula))}
                      className="text-[11px] text-emerald-400 hover:underline cursor-pointer font-bold"
                    >
                      Marcar Todos ({filteredEmployees.length})
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setBatchSelectedEmpIds([])}
                      className="text-[11px] text-red-400 hover:underline cursor-pointer font-bold"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>

                {/* Campo de Busca Rápida no Modal */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={batchSearchQuery}
                    onChange={(e) => setBatchSearchQuery(e.target.value)}
                    placeholder="🔍 Buscar por nome ou matrícula..."
                    className={`w-full px-3 py-1.5 rounded-lg border text-xs outline-none ${
                      isDark 
                        ? 'bg-[#0F1B33] border-[#243756] text-white placeholder-gray-500 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20' 
                        : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:border-amber-600'
                    }`}
                  />
                </div>

                <div className={`max-h-48 overflow-y-auto p-2 rounded-xl border divide-y ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] divide-[#243756]' : 'bg-slate-50 border-slate-200 divide-slate-200'
                }`}>
                  {filteredEmployees
                    .filter(emp => {
                      const q = batchSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return emp.nome.toLowerCase().includes(q) || emp.matricula.toLowerCase().includes(q);
                    })
                    .map(emp => (
                      <label key={emp.matricula} className="flex items-center gap-2 py-1 px-1 cursor-pointer hover:bg-black/10 dark:hover:bg-white/5 rounded">
                        <input
                          type="checkbox"
                          checked={batchSelectedEmpIds.includes(emp.matricula)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBatchSelectedEmpIds([...batchSelectedEmpIds, emp.matricula]);
                            } else {
                              setBatchSelectedEmpIds(batchSelectedEmpIds.filter(m => m !== emp.matricula));
                            }
                          }}
                          className="rounded text-amber-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="font-mono text-[11px] text-amber-400 font-bold">{emp.matricula}</span>
                        <span className="font-sans font-bold text-xs truncate max-w-xs">{emp.nome}</span>
                        <span className="text-gray-400 text-[10px]">({emp.funcao || emp.cargo})</span>
                      </label>
                    ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-black/10 dark:border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsBatchModalOpen(false)}
                className={`px-4 py-2 rounded-xl border font-bold text-xs ${
                  isDark ? 'border-[#335075] hover:bg-[#243756] text-gray-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700'
                }`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteMultiBatch}
                disabled={isSavingBatch || batchSelectedEmpIds.length === 0}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-all shadow-md shadow-amber-600/20 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isSavingBatch ? 'Gravando no Firestore...' : `Gravar para ${batchSelectedEmpIds.length} Colaboradores`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 6. MODAL DE IMPRESSÃO QUINZENAL OFICIAL COMARA (PAISAGEM)     */}
      {/* ============================================================= */}
      <InsalubritySimplePrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        employees={filteredEmployees}
        insalubrityRecords={insalubrityRecords}
        recordsMap={recordsMap}
        currentQuinzenaDays={currentQuinzenaDays}
        currentPeriodLabel={currentPeriodLabel}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        selectedBranch={selectedBranch}
        monthNames={MONTH_NAMES}
        constructionSites={constructionSites}
        theme={theme}
      />
      {/* Modal de Importação de Matriz de Campo CSV */}
      <ImportInsalubrityMatrixModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        employees={employees}
        constructionSites={constructionSites}
        onImportInsalubrityBatch={handleImportMatrixBatch}
        theme={theme}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
