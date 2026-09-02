import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  Search,
  Filter,
  RefreshCw,
  Clock,
  UserCheck,
  AlertTriangle,
  FileCheck,
  Building2,
  ExternalLink,
  PlusCircle,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Sparkles,
  Info,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Employee,
  TimeRecord,
  DispensaSptfRecord,
  ConstructionSite,
  AdminRole,
  Attachment,
} from '../types';
import { InstitutionSettings, DocumentosModeloInstituicao } from '../types/institutionConfig';
import { useInstitution } from '../contexts/InstitutionContext';
import { firestoreService } from '../services/firestoreService';
import { rbacService } from '../services/rbacService';
import { getSignaturesForCanteiro } from '../services/canteiroService';
import { Button, Card, CardHeader, CardBody, Badge, Input } from './ui';
import { SptfDispensaModal, generateSptfPrintHtml, DispensaPrintTemplate } from './SptfDispensaModal';

export interface DispensasFaltasManagementProps {
  employees: Employee[];
  constructionSites: ConstructionSite[];
  currentUserEmail?: string;
  userRole?: AdminRole | string;
  theme?: 'dark' | 'light';
  institutionSettings?: InstitutionSettings;
  institutionDocumentosModelo?: DocumentosModeloInstituicao;
  onViewEmployeeStatement?: (matricula: string) => void;
  onOpenNewEntry?: (matricula?: string) => void;
  onOpenNewDispensa?: (matricula?: string) => void;
  onDeleteDispensa?: (dispensaId: string, lancamentoId?: string) => Promise<void> | void;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

interface MonthCacheItem {
  dispensas: DispensaSptfRecord[];
  records: TimeRecord[];
  timestamp: number;
}

export const DispensasFaltasManagement: React.FC<DispensasFaltasManagementProps> = ({
  employees,
  constructionSites,
  currentUserEmail,
  userRole = 'SUPER_ADMIN',
  theme = 'dark',
  institutionSettings: propInstitutionSettings,
  institutionDocumentosModelo: propInstitutionDocumentosModelo,
  onViewEmployeeStatement,
  onOpenNewEntry,
  onOpenNewDispensa,
  onDeleteDispensa,
}) => {
  const isDark = theme === 'dark';
  let ctxSettings: InstitutionSettings | undefined;
  let ctxDocModelo: DocumentosModeloInstituicao | undefined;
  try {
    const ctx = useInstitution();
    ctxSettings = ctx.settings;
    ctxDocModelo = ctx.documentosModelo;
  } catch {
    // context optional
  }
  const institutionSettings = propInstitutionSettings || ctxSettings;
  const institutionDocumentosModelo = propInstitutionDocumentosModelo || ctxDocModelo;

  // 1. Controle de Período (Ano / Mês)
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultYearMonth);

  // 2. Abas: 'dispensas' | 'faltas'
  const [activeTab, setActiveTab] = useState<'dispensas' | 'faltas'>('dispensas');

  // 3. Controle de Canteiro / Sede
  const isRestrictedRole = rbacService.isCanteiroRestricted(userRole);
  const userCanteiro = rbacService.getUserCanteiroId({
    email: currentUserEmail || '',
    nome: '',
    role: userRole as AdminRole,
    sede: 'KO',
  });
  const [selectedCanteiro, setSelectedCanteiro] = useState<string>(
    isRestrictedRole ? userCanteiro : 'TODOS'
  );

  // 4. Estado de Dados e Cache
  const [dispensas, setDispensas] = useState<DispensaSptfRecord[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Cache em memória para evitar leituras repetidas do Firestore
  const cacheRef = useRef<Record<string, MonthCacheItem>>({});

  // 5. Filtros e Busca de Tabela
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [tipoFaltaFilter, setTipoFaltaFilter] = useState<string>('TODAS');

  // 6. Modal de Visualização de Guia
  const [viewingDispensa, setViewingDispensa] = useState<DispensaSptfRecord | null>(null);

  // Mapeamento rápido de colaboradores por matrícula para consulta O(1)
  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((emp) => {
      map.set(emp.matricula.toUpperCase(), emp);
      if (emp.saram) map.set(emp.saram.toUpperCase(), emp);
      if (emp.id) map.set(emp.id, emp);
    });
    return map;
  }, [employees]);

  // Função central de carregamento com Cache Inteligente (Otimização Máxima de Leitura)
  const loadPeriodData = useCallback(async (anoMes: string, canteiro: string, forceFresh = false) => {
    const cacheKey = `${anoMes}_${canteiro}`;
    const cached = cacheRef.current[cacheKey];

    // Se já estiver no cache e não for um refresh manual explícito, usa direto (0 leituras no Firestore)
    if (!forceFresh && cached && Date.now() - cached.timestamp < 1000 * 60 * 15) {
      setDispensas(cached.dispensas);
      setRecords(cached.records);
      setLastSyncTime(new Date(cached.timestamp));
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const canteiroParam = canteiro === 'TODOS' ? undefined : canteiro;
      
      // Exatamente 2 consultas controladas com filtros de data no Firestore
      const [fetchedDispensas, fetchedRecords] = await Promise.all([
        firestoreService.getDispensasByMonth(anoMes, canteiroParam),
        firestoreService.getTimeRecordsByMonth(anoMes, canteiroParam),
      ]);

      // Salva no cache
      cacheRef.current[cacheKey] = {
        dispensas: fetchedDispensas,
        records: fetchedRecords,
        timestamp: Date.now(),
      };

      setDispensas(fetchedDispensas);
      setRecords(fetchedRecords);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('Erro ao carregar dados do período:', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Recarrega quando muda o mês ou o canteiro
  useEffect(() => {
    loadPeriodData(selectedMonth, selectedCanteiro);
  }, [selectedMonth, selectedCanteiro, loadPeriodData]);

  // Navegação de Meses
  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month, 1);
    setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleCurrentMonth = () => {
    const d = new Date();
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadPeriodData(selectedMonth, selectedCanteiro, true);
  };

  // Extrai nome formatado do mês/ano
  const formattedMonthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    return `${MONTH_NAMES[month - 1]} de ${year}`;
  }, [selectedMonth]);

  // -------------------------------------------------------------
  // TRATAMENTO DOS DADOS: DISPENSAS
  // -------------------------------------------------------------
  const filteredDispensas = useMemo(() => {
    return dispensas.filter((d) => {
      // Filtro por Canteiro
      if (selectedCanteiro !== 'TODOS') {
        const dCanteiro = (d.secaoCanteiro || '').toUpperCase();
        if (!dCanteiro.includes(selectedCanteiro.toUpperCase())) {
          return false;
        }
      }

      // Filtro por Status
      if (statusFilter !== 'TODOS') {
        if ((d.status || 'EMITIDA') !== statusFilter) {
          return false;
        }
      }

      // Filtro por Busca (Nome / Matrícula / Guia / Motivo)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nomeMatch = (d.nome || '').toLowerCase().includes(term);
        const matMatch = (d.matricula || '').toLowerCase().includes(term);
        const guiaMatch = (d.numeroGuia || '').toLowerCase().includes(term);
        const motivoMatch = (d.motivo || '').toLowerCase().includes(term);
        if (!nomeMatch && !matMatch && !guiaMatch && !motivoMatch) {
          return false;
        }
      }

      return true;
    });
  }, [dispensas, selectedCanteiro, statusFilter, searchTerm]);

  // Estatísticas de Dispensas
  const dispensasStats = useMemo(() => {
    let totalGuias = 0;
    let totalHoras = 0;
    const colaboradoresSet = new Set<string>();
    const canteiroCount: Record<string, number> = {};

    filteredDispensas.forEach((d) => {
      if (d.status !== 'CANCELADA') {
        totalGuias++;
        totalHoras += typeof d.totalHoras === 'number' ? d.totalHoras : Number(d.totalHoras) || 0;
        colaboradoresSet.add(d.matricula.toUpperCase());

        const cant = (d.secaoCanteiro || 'DECO-KO').replace('DECO-', '');
        canteiroCount[cant] = (canteiroCount[cant] || 0) + 1;
      }
    });

    let topCanteiro = '—';
    let maxCanteiroCount = 0;
    Object.entries(canteiroCount).forEach(([cant, count]) => {
      if (count > maxCanteiroCount) {
        maxCanteiroCount = count;
        topCanteiro = cant;
      }
    });

    return {
      totalGuias,
      totalHoras: Number(totalHoras.toFixed(1)),
      colaboradoresCount: colaboradoresSet.size,
      topCanteiro,
    };
  }, [filteredDispensas]);

  // -------------------------------------------------------------
  // TRATAMENTO DOS DADOS: FALTAS & AUSÊNCIAS
  // -------------------------------------------------------------
  interface FaltaItem {
    id: string;
    matricula: string;
    nome: string;
    funcao: string;
    canteiro: string;
    data: string;
    diaSemanaNome: string;
    tipo: 'FALTA_INJUSTIFICADA' | 'FALTA_JUSTIFICADA' | 'ATESTADO_MEDICO';
    horasDescontadas: number;
    observacao: string;
    comprovante?: string | Attachment;
  }

  const faltasRecords = useMemo(() => {
    const list: FaltaItem[] = [];

    records.forEach((r) => {
      const tipo = r.tipoOcorrencia;
      if (
        tipo === 'FALTA_INJUSTIFICADA' ||
        tipo === 'FALTA_JUSTIFICADA' ||
        tipo === 'ATESTADO_MEDICO'
      ) {
        const emp = employeeMap.get(r.matricula.toUpperCase());
        const rawDate = r.dataRegistro || r.data_ocorrencia || '';

        list.push({
          id: r.id,
          matricula: r.matricula.toUpperCase(),
          nome: r.employeeName || emp?.nome || 'Colaborador',
          funcao: r.employeeFuncao || emp?.funcao || 'Técnico',
          canteiro: r.employeeSede || emp?.secaoLotacao || emp?.sede || 'KO',
          data: rawDate,
          diaSemanaNome: r.diaSemanaNome || '',
          tipo: tipo as 'FALTA_INJUSTIFICADA' | 'FALTA_JUSTIFICADA' | 'ATESTADO_MEDICO',
          horasDescontadas: tipo === 'FALTA_INJUSTIFICADA' ? 8.0 : 0.0,
          observacao: r.observacao || (tipo === 'FALTA_INJUSTIFICADA' ? 'Falta sem justificativa legal (Desconto em folha)' : 'Falta justificada'),
          comprovante: r.comprovante,
        });
      }
    });

    // Ordenar decrescente por data
    list.sort((a, b) => b.data.localeCompare(a.data));
    return list;
  }, [records, employeeMap]);

  const filteredFaltas = useMemo(() => {
    return faltasRecords.filter((f) => {
      // Filtro por Canteiro
      if (selectedCanteiro !== 'TODOS') {
        const cUpper = (f.canteiro || '').toUpperCase();
        if (!cUpper.includes(selectedCanteiro.toUpperCase())) {
          return false;
        }
      }

      // Filtro por Tipo de Falta
      if (tipoFaltaFilter !== 'TODAS') {
        if (f.tipo !== tipoFaltaFilter) {
          return false;
        }
      }

      // Filtro por Busca (Nome / Matrícula / Observação)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const nomeMatch = f.nome.toLowerCase().includes(term);
        const matMatch = f.matricula.toLowerCase().includes(term);
        const obsMatch = f.observacao.toLowerCase().includes(term);
        if (!nomeMatch && !matMatch && !obsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [faltasRecords, selectedCanteiro, tipoFaltaFilter, searchTerm]);

  // Estatísticas de Faltas
  const faltasStats = useMemo(() => {
    let faltasInjustificadas = 0;
    let faltasJustificadas = 0;
    let atestadosMedicos = 0;
    let totalHorasDesconto = 0;
    const colaboradoresSet = new Set<string>();

    filteredFaltas.forEach((f) => {
      colaboradoresSet.add(f.matricula);
      if (f.tipo === 'FALTA_INJUSTIFICADA') {
        faltasInjustificadas++;
        totalHorasDesconto += 8.0;
      } else if (f.tipo === 'ATESTADO_MEDICO') {
        atestadosMedicos++;
      } else {
        faltasJustificadas++;
      }
    });

    return {
      totalGeral: filteredFaltas.length,
      faltasInjustificadas,
      faltasJustificadas,
      atestadosMedicos,
      totalHorasDesconto,
      colaboradoresCount: colaboradoresSet.size,
    };
  }, [filteredFaltas]);

  // -------------------------------------------------------------
  // IMPRESSÃO OFICIAL INSTITUCIONAL (RELATÓRIO A4)
  // -------------------------------------------------------------
  const handlePrintRelatorio = () => {
    const isDispensa = activeTab === 'dispensas';
    const siglaInst = institutionSettings?.siglaInstituicao || 'COMARA';
    const nomeInst = (institutionSettings?.nomeInstituicao || 'COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA').toUpperCase();
    const subordinacaoInst = (institutionSettings?.subordinacao || 'Comando da Aeronáutica').toUpperCase();
    const docModelo = institutionSettings?.documentosModelo;

    // 1. Linha 1: Subordinação (busca nas configurações da organização)
    let linha1Subordinacao = 'Comando da Aeronáutica';
    if (institutionSettings?.subordinacao) {
      linha1Subordinacao = institutionSettings.subordinacao.includes('•')
        ? institutionSettings.subordinacao.split('•')[0].trim()
        : institutionSettings.subordinacao.trim();
    }

    // 2. Linha 2: Nome da Instituição (busca nas configurações da organização)
    const linha2Instituicao = (institutionSettings?.nomeInstituicao || 'COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA').toUpperCase();

    // 3. Linha 3: Nome do Sistema (busca nas configurações de modelo de documento da organização)
    let linha3Sistema = 'SISTEMA DE GESTÃO DO BANCO DE HORAS SPTF';
    if (docModelo?.cabecalhoRelatorio) {
      if (docModelo.cabecalhoRelatorio.includes('•')) {
        const parts = docModelo.cabecalhoRelatorio.split('•').map((p) => p.trim());
        linha3Sistema = parts[parts.length - 1].toUpperCase();
      } else {
        linha3Sistema = docModelo.cabecalhoRelatorio.toUpperCase();
      }
    }

    // 4. Linha 4: Título Oficial do Relatório (Fixo conforme solicitado)
    const linha4Titulo = isDispensa
      ? 'RELATÓRIO MENSAL DE DISPENSA DE SPTF PARA DESCONTO EM BANCO DE HORAS'
      : 'RELATÓRIO MENSAL DE FALTAS E AUSÊNCIAS PARA DESCONTO EM BANCO DE HORAS / FOLHA';

    const reportTitle = linha4Titulo;

    // Cabeçalho e textos institucionais complementares
    const rodapeTexto = docModelo?.rodapeRelatorio || 'Documento gerado eletronicamente em conformidade com as Normas Internas e a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).';

    // Detalhes da Sede / Canteiro Selecionado
    const sedeConfig = institutionSettings?.sedes?.find(
      (s) => s.codigo.toUpperCase() === selectedCanteiro.toUpperCase() || s.id.toUpperCase() === selectedCanteiro.toUpperCase()
    );
    const siteConfig = constructionSites.find(
      (s) => (s.code && s.code.toUpperCase() === selectedCanteiro.toUpperCase()) ||
             (s.codigo && s.codigo.toUpperCase() === selectedCanteiro.toUpperCase())
    );
    const canteiroDisplay = selectedCanteiro === 'TODOS'
      ? 'TODOS OS CANTEIROS E SEDES OPERACIONAIS (CONSOLIDADO)'
      : (sedeConfig ? `${sedeConfig.nome.toUpperCase()} (${sedeConfig.codigo})` : (siteConfig ? `${siteConfig.name || siteConfig.nome} (${siteConfig.code || siteConfig.codigo})` : `CANTEIRO DECO-${selectedCanteiro}`));

    const subtitle = `MÊS DE REFERÊNCIA: ${formattedMonthLabel.toUpperCase()} • CANTEIRO: ${canteiroDisplay}`;
    const printDate = new Date().toLocaleString('pt-BR');
    const logoUrl = institutionSettings?.logoUrl || '/comara-logo.png';

    // Assinaturas dinâmicas baseadas nos cargos e sedes das Configurações da Instituição
    const siteSignatures = getSignaturesForCanteiro(selectedCanteiro === 'TODOS' ? 'KO' : selectedCanteiro, constructionSites);
    const activeCargos = (institutionSettings?.cargos || [])
      .filter((c) => c.ativo !== false)
      .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

    // Bloco 1: Chefe do Canteiro / Responsável Operacional
    const cargo1Obj = activeCargos.find((c) => c.ordem === 1 || c.nome.toLowerCase().includes('canteiro') || c.tratamento === 'Chefe' || c.tratamento === 'Encarregado');
    const cargo1Titulo = cargo1Obj?.nome || 'Chefe do Canteiro de Obras';
    const cargo1Nome = (selectedCanteiro !== 'TODOS' && sedeConfig?.responsavel)
      ? sedeConfig.responsavel
      : (siteSignatures.assinatura1.nome || 'Responsável Operacional Local');
    const cargo1Sub = cargo1Obj?.departamento || (selectedCanteiro === 'TODOS' ? 'Operações de Campo' : canteiroDisplay);

    // Bloco 2: Chefe da DA / Homologação Local
    const cargo2Obj = activeCargos.find((c) => c.ordem === 2 || c.nome.toLowerCase().includes('administrativa') || c.nome.toLowerCase().includes('da'));
    const cargo2Titulo = cargo2Obj?.nome || 'Chefe da Divisão Administrativa (DA)';
    const cargo2Nome = siteSignatures.assinatura2.nome || 'Chefe da Divisão Administrativa';
    const cargo2Sub = cargo2Obj?.departamento || `Divisão Administrativa - ${siglaInst}`;

    // Bloco 3: Gestão de Pessoas / RH / Fiscalização
    const cargo3Obj = activeCargos.find((c) => c.ordem === 5 || c.ordem === 6 || c.nome.toLowerCase().includes('rh') || c.nome.toLowerCase().includes('pessoal') || c.nome.toLowerCase().includes('fiscal'));
    const cargo3Titulo = cargo3Obj?.nome || 'Gestão de Pessoas / RH Sede';
    const cargo3Nome = siteSignatures.assinatura3.nome || 'Gestão de Pessoas / RH';
    const cargo3Sub = cargo3Obj?.departamento || `${nomeInst} (${siglaInst})`;

    const contentHtml = isDispensa
      ? `
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Item</th>
              <th style="width: 110px;">Nº da Guia</th>
              <th>Colaborador</th>
              <th style="width: 90px; text-align: center;">Matrícula</th>
              <th style="width: 80px; text-align: center;">Canteiro</th>
              <th style="width: 85px; text-align: center;">Data</th>
              <th style="width: 100px; text-align: center;">Horário</th>
              <th style="width: 65px; text-align: center;">Horas</th>
              <th>Motivo da Dispensa</th>
              <th style="width: 85px; text-align: center;">Situação</th>
            </tr>
          </thead>
          <tbody>
            ${filteredDispensas.length === 0 ? `<tr><td colspan="10" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma dispensa registrada para os filtros selecionados.</td></tr>` : ''}
            ${filteredDispensas
              .map(
                (d, idx) => `
                <tr class="${d.status === 'CANCELADA' ? 'cancelled' : ''}">
                  <td style="text-align: center;">${idx + 1}</td>
                  <td><strong>${d.numeroGuia || '—'}</strong></td>
                  <td><strong>${d.nome}</strong></td>
                  <td style="text-align: center;">${d.matricula}</td>
                  <td style="text-align: center;">${d.secaoCanteiro || 'DECO-KO'}</td>
                  <td style="text-align: center;">${d.data ? d.data.split('-').reverse().join('/') : '—'}</td>
                  <td style="text-align: center;">${d.horarioInicio || '—'} às ${d.horarioFim || '—'}</td>
                  <td style="text-align: center;"><strong>${Number(d.totalHoras).toFixed(1)}h</strong></td>
                  <td>${d.motivo || docModelo?.textoPadraoMotivoDispensa || 'COMPENSAÇÃO BANCO DE HORAS'}</td>
                  <td style="text-align: center;">${d.status === 'CANCELADA' ? '<span style="color: #dc2626; font-weight: bold;">CANCELADA</span>' : '<span style="color: #16a34a; font-weight: bold;">EMITIDA</span>'}</td>
                </tr>
              `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="7" style="text-align: right; padding: 8px;">TOTAL GERAL:</td>
              <td style="text-align: center; padding: 8px;">${dispensasStats.totalHoras}h</td>
              <td colspan="2" style="padding: 8px;">${dispensasStats.totalGuias} Guias Ativas (${dispensasStats.colaboradoresCount} Colaboradores)</td>
            </tr>
          </tfoot>
        </table>
      `
      : `
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">Item</th>
              <th>Colaborador</th>
              <th style="width: 90px; text-align: center;">Matrícula</th>
              <th style="width: 80px; text-align: center;">Canteiro</th>
              <th style="width: 90px; text-align: center;">Data</th>
              <th style="width: 140px; text-align: center;">Tipo de Ocorrência</th>
              <th style="width: 80px; text-align: center;">Desconto</th>
              <th>Observação / Justificativa</th>
            </tr>
          </thead>
          <tbody>
            ${filteredFaltas.length === 0 ? `<tr><td colspan="8" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma falta ou ausência registrada para os filtros selecionados.</td></tr>` : ''}
            ${filteredFaltas
              .map(
                (f, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td><strong>${f.nome}</strong><br><span style="font-size: 10px; color: #64748b;">${f.funcao}</span></td>
                  <td style="text-align: center;">${f.matricula}</td>
                  <td style="text-align: center;">${f.canteiro}</td>
                  <td style="text-align: center;">${f.data ? f.data.split('-').reverse().join('/') : '—'}<br><span style="font-size: 10px; color: #64748b;">${f.diaSemanaNome}</span></td>
                  <td style="text-align: center;">
                    ${
                      f.tipo === 'FALTA_INJUSTIFICADA'
                        ? '<span style="color: #dc2626; font-weight: bold; background: #fee2e2; padding: 2px 6px; border-radius: 4px; font-size: 10px;">SEM JUSTIFICATIVA</span>'
                        : f.tipo === 'ATESTADO_MEDICO'
                        ? '<span style="color: #7c3aed; font-weight: bold; background: #f3e8ff; padding: 2px 6px; border-radius: 4px; font-size: 10px;">ATESTADO MÉDICO</span>'
                        : '<span style="color: #d97706; font-weight: bold; background: #fef3c7; padding: 2px 6px; border-radius: 4px; font-size: 10px;">FALTA JUSTIFICADA</span>'
                    }
                  </td>
                  <td style="text-align: center;"><strong>${f.tipo === 'FALTA_INJUSTIFICADA' ? '8.0h (Folha)' : '0.0h (Neutro)'}</strong></td>
                  <td>${f.observacao || '—'}</td>
                </tr>
              `
              )
              .join('')}
          </tbody>
          <tfoot>
            <tr style="background-color: #f8fafc; font-weight: bold;">
              <td colspan="6" style="text-align: right; padding: 8px;">TOTAL DE HORAS DE DESCONTO EM FOLHA:</td>
              <td style="text-align: center; padding: 8px; color: #dc2626;">${faltasStats.totalHorasDesconto}h</td>
              <td style="padding: 8px;">${faltasStats.faltasInjustificadas} Injustificadas • ${faltasStats.faltasJustificadas + faltasStats.atestadosMedicos} Justificadas / Atestados</td>
            </tr>
          </tfoot>
        </table>
      `;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups para visualizar a impressão.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${reportTitle} - ${formattedMonthLabel} (${siglaInst})</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm 12mm 15mm 12mm;
          }
          * {
            box-sizing: border-box;
            font-family: Arial, Helvetica, sans-serif;
            color: #0f172a;
          }
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            font-size: 11px;
            line-height: 1.3;
          }
          .header-container {
            border-bottom: 2px solid #0f172a;
            padding-bottom: 8px;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 14px;
          }
          .header-logo {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }
          .header-text {
            flex: 1;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .header-line-1 {
            font-size: 11.5px;
            font-weight: 700;
            color: #1e293b;
            letter-spacing: 0.3px;
            line-height: 1.3;
            margin: 0;
          }
          .header-line-2 {
            font-size: 12.5px;
            font-weight: 800;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.3;
            margin: 2px 0 0 0;
          }
          .header-line-3 {
            font-size: 11px;
            font-weight: 700;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.3;
            margin: 2px 0 0 0;
          }
          .header-line-4 {
            font-size: 12px;
            font-weight: 900;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.3;
            margin: 4px 0 0 0;
          }
          .meta-box {
            display: flex;
            justify-content: space-between;
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 10px;
            border-radius: 4px;
            margin-bottom: 12px;
            font-size: 10px;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
            margin-bottom: 15px;
          }
          .report-table th {
            background-color: #1e293b;
            color: #ffffff;
            font-weight: bold;
            padding: 6px 4px;
            border: 1px solid #0f172a;
            text-transform: uppercase;
            font-size: 9.5px;
          }
          .report-table td {
            padding: 5px 4px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
          }
          .report-table tr:nth-child(even) {
            background-color: #f8fafc;
          }
          .report-table tr.cancelled td {
            background-color: #fee2e2;
            text-decoration: line-through;
            color: #991b1b;
          }
          .signatures-container {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            gap: 15px;
            page-break-inside: avoid;
          }
          .sig-box {
            flex: 1;
            text-align: center;
            border-top: 1px solid #475569;
            padding-top: 5px;
            font-size: 9.5px;
          }
          .sig-box .name {
            font-weight: bold;
            font-size: 10px;
            color: #0f172a;
            text-transform: uppercase;
          }
          .sig-box .cargo {
            color: #1e293b;
            font-weight: 600;
            font-size: 9px;
            text-transform: uppercase;
            margin-top: 1px;
          }
          .sig-box .dept {
            color: #64748b;
            font-size: 8.5px;
            margin-top: 1px;
          }
          .footer-note {
            margin-top: 20px;
            font-size: 8.5px;
            color: #64748b;
            text-align: center;
            border-top: 1px dashed #cbd5e1;
            padding-top: 6px;
            line-height: 1.4;
          }
        </style>
      </head>
      <body>
        <div class="header-container">
          ${logoUrl ? `<img src="${logoUrl}" class="header-logo" alt="Logo ${siglaInst}" onerror="this.style.display='none';" />` : ''}
          <div class="header-text">
            <div class="header-line-1">${linha1Subordinacao}</div>
            <div class="header-line-2">${linha2Instituicao}</div>
            <div class="header-line-3">${linha3Sistema}</div>
            <div class="header-line-4">${linha4Titulo}</div>
          </div>
        </div>

        <div class="meta-box">
          <div><strong>${subtitle}</strong></div>
          <div>Emitido em: ${printDate} por: <strong>${currentUserEmail || 'Sistema SPTF'}</strong></div>
        </div>

        ${contentHtml}

        <div class="signatures-container">
          <div class="sig-box">
            <div class="name">${cargo1Nome}</div>
            <div class="cargo">${cargo1Titulo}</div>
            <div class="dept">${cargo1Sub}</div>
          </div>
          <div class="sig-box">
            <div class="name">${cargo2Nome}</div>
            <div class="cargo">${cargo2Titulo}</div>
            <div class="dept">${cargo2Sub}</div>
          </div>
          <div class="sig-box">
            <div class="name">${cargo3Nome}</div>
            <div class="cargo">${cargo3Titulo}</div>
            <div class="dept">${cargo3Sub}</div>
          </div>
        </div>

        <div class="footer-note">
          <div>${rodapeTexto}</div>
          <div style="margin-top: 3px; font-size: 8px; color: #94a3b8;">
            ${nomeInst} (${siglaInst}) ${institutionSettings?.endereco ? `• ${institutionSettings.endereco}` : ''} ${institutionSettings?.telefone ? `• Tel: ${institutionSettings.telefone}` : ''} ${institutionSettings?.email ? `• ${institutionSettings.email}` : ''}
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // -------------------------------------------------------------
  // EXPORTAÇÃO CSV
  // -------------------------------------------------------------
  const handleExportCSV = () => {
    const isDispensa = activeTab === 'dispensas';
    let csvContent = '\uFEFF'; // BOM para Excel PT-BR

    if (isDispensa) {
      csvContent += 'Nº Guia;Colaborador;Matrícula;Canteiro;Data;Horário Início;Horário Fim;Total Horas;Motivo;Emitido Por;Situação\n';
      filteredDispensas.forEach((d) => {
        csvContent += `"${d.numeroGuia || ''}";"${d.nome}";"${d.matricula}";"${d.secaoCanteiro || ''}";"${d.data}";"${d.horarioInicio}";"${d.horarioFim}";"${d.totalHoras}";"${d.motivo || ''}";"${d.emitidoPorNome || d.emitidoPorEmail || ''}";"${d.status || 'EMITIDA'}"\n`;
      });
    } else {
      csvContent += 'Colaborador;Matrícula;Função;Canteiro;Data;Dia da Semana;Tipo de Ausência;Horas Descontadas;Observação\n';
      filteredFaltas.forEach((f) => {
        csvContent += `"${f.nome}";"${f.matricula}";"${f.funcao}";"${f.canteiro}";"${f.data}";"${f.diaSemanaNome}";"${f.tipo}";"${f.horasDescontadas}";"${f.observacao || ''}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `COMARA_${activeTab.toUpperCase()}_${selectedMonth}_${selectedCanteiro}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Impressão individual direta da Guia de Dispensa (2 vias A4)
  const handlePrintIndividualDispensa = (dispensa: DispensaSptfRecord) => {
    const html = generateSptfPrintHtml(
      dispensa,
      constructionSites,
      institutionSettings?.logoUrl,
      institutionSettings
    );
    const w = window.open('', '_blank');
    if (!w) {
      alert('Por favor, permita popups no navegador para emitir a Guia.');
      return;
    }
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* 1. CABEÇALHO DO MÓDULO E CONTROLES DE PERÍODO */}
      <div className={`p-4 sm:p-6 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'} shadow-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <FileCheck className="w-5 h-5" />
              </div>
              <div>
                <h1 className={`text-lg sm:text-xl font-bold ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  Consulta de Dispensas & Faltas
                </h1>
                <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  Acompanhamento consolidado de guias emitidas e ausências com otimização de consultas
                </p>
              </div>
            </div>
          </div>

          {/* Controles de Período e Canteiro */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Seletor de Canteiro */}
            <div className="flex items-center gap-1.5">
              <Building2 className={`w-4 h-4 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
              <select
                aria-label="Selecionar Canteiro ou Sede"
                value={selectedCanteiro}
                onChange={(e) => setSelectedCanteiro(e.target.value)}
                disabled={isRestrictedRole}
                className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] focus:border-blue-500'
                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-blue-500'
                } ${isRestrictedRole ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {!isRestrictedRole && <option value="TODOS">Todos os Canteiros / Sedes</option>}
                <option value="KO">DECO-KO (Canteiro Belém)</option>
                <option value="MN">DECO-MN (Canteiro Manaus)</option>
                <option value="BE">DECO-BE (Canteiro Boa Vista)</option>
                <option value="SP">DECO-SP (Canteiro São Paulo)</option>
                <option value="RJ">DECO-RJ (Canteiro Rio de Janeiro)</option>
                {constructionSites
                  .filter((cs) => !['KO', 'MN', 'BE', 'SP', 'RJ'].includes(cs.codigo))
                  .map((cs) => (
                    <option key={cs.id} value={cs.codigo}>
                      DECO-{cs.codigo} ({cs.nome})
                    </option>
                  ))}
              </select>
            </div>

            {/* Navegador de Mês */}
            <div className={`flex items-center rounded-lg border p-1 ${isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'}`}>
              <button
                onClick={handlePrevMonth}
                title="Mês Anterior"
                className={`p-1 rounded hover:bg-blue-500/10 transition-colors ${isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="px-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-500" />
                <span className={`text-xs font-bold tracking-tight ${isDark ? 'text-[#E2E8F0]' : 'text-slate-800'}`}>
                  {formattedMonthLabel}
                </span>
              </div>

              <button
                onClick={handleNextMonth}
                title="Próximo Mês"
                className={`p-1 rounded hover:bg-blue-500/10 transition-colors ${isDark ? 'text-[#94A3B8] hover:text-[#E2E8F0]' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Botão Mês Atual */}
            <button
              onClick={handleCurrentMonth}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${
                selectedMonth === defaultYearMonth
                  ? isDark ? 'bg-blue-600/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
                  : isDark ? 'bg-[#0F1B33] text-[#94A3B8] border-[#243756] hover:text-[#E2E8F0]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              Mês Atual
            </button>

            {/* Botão Recarregar Cache */}
            <button
              onClick={handleRefresh}
              disabled={loading || isRefreshing}
              title="Forçar recarga atualizada do Firestore"
              className={`p-1.5 rounded-lg border transition-all ${
                isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8] hover:text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>
        </div>

        {/* Barra de Status e Ações Rápidas */}
        <div className={`mt-4 pt-3 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isDark ? 'border-[#243756]/60 text-[#94A3B8]' : 'border-slate-100 text-slate-500'} text-xs`}>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>
              {loading ? 'Carregando dados do período...' : `Consulta indexada sob demanda (${filteredDispensas.length} dispensas, ${filteredFaltas.length} faltas)`}
            </span>
            {lastSyncTime && (
              <span className="hidden md:inline text-[11px] opacity-70">
                • Atualizado às {lastSyncTime.toLocaleTimeString('pt-BR')}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenNewDispensa && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => onOpenNewDispensa()}
                className="gap-1.5 text-xs shadow-md shadow-blue-500/20"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Nova Dispensa SPTF</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintRelatorio}
              className="gap-1.5 text-xs"
            >
              <Printer className="w-3.5 h-3.5 text-blue-500" />
              <span>Imprimir Relatório</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleExportCSV}
              className="gap-1.5 text-xs"
              title="Exportar dados para planilha Excel / CSV"
            >
              <Download className="w-3.5 h-3.5 text-emerald-500" />
              <span>CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. ABAS DE NAVEGAÇÃO PRINCIPAL */}
      <div className="flex items-center gap-2 border-b border-slate-700/40 pb-0.5">
        <button
          onClick={() => setActiveTab('dispensas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === 'dispensas'
              ? isDark
                ? 'bg-[#16243D] text-blue-400 border-blue-500'
                : 'bg-white text-blue-600 border-blue-600 shadow-sm'
              : isDark
              ? 'text-[#94A3B8] border-transparent hover:text-[#E2E8F0] hover:bg-[#16243D]/50'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Dispensas Emitidas (SPTF)</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'dispensas'
                ? 'bg-blue-500/20 text-blue-300'
                : isDark ? 'bg-[#0F1B33] text-[#94A3B8]' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredDispensas.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('faltas')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg transition-all border-b-2 cursor-pointer ${
            activeTab === 'faltas'
              ? isDark
                ? 'bg-[#16243D] text-rose-400 border-rose-500'
                : 'bg-white text-rose-600 border-rose-600 shadow-sm'
              : isDark
              ? 'text-[#94A3B8] border-transparent hover:text-[#E2E8F0] hover:bg-[#16243D]/50'
              : 'text-slate-600 border-transparent hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Faltas & Ausências</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
              activeTab === 'faltas'
                ? 'bg-rose-500/20 text-rose-300'
                : isDark ? 'bg-[#0F1B33] text-[#94A3B8]' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredFaltas.length}
          </span>
        </button>
      </div>

      {/* 3. CONTEÚDO DA ABA SELECIONADA */}
      {activeTab === 'dispensas' ? (
        <div className="space-y-4">
          {/* Cards de Resumo de Dispensas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Total de Guias</span>
                <FileCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  {dispensasStats.totalGuias}
                </span>
                <span className="text-xs text-blue-400 font-semibold">emitidas</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Horas Dispensadas</span>
                <Clock className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  {dispensasStats.totalHoras}h
                </span>
                <span className="text-xs text-emerald-400 font-semibold">debitadas</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Colaboradores</span>
                <UserCheck className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  {dispensasStats.colaboradoresCount}
                </span>
                <span className="text-xs text-purple-400 font-semibold">atendidos</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Canteiro Principal</span>
                <Building2 className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-lg sm:text-xl font-bold truncate ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  {dispensasStats.topCanteiro !== '—' ? `DECO-${dispensasStats.topCanteiro}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Filtros da Tabela de Dispensas */}
          <div className={`p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-center justify-between ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
            <div className="relative w-full sm:w-72">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar por colaborador, matrícula ou guia..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] placeholder-[#64748B]'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                aria-label="Filtrar por Situação"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="TODOS">Todas as Situações</option>
                <option value="EMITIDA">Emitidas (Ativas)</option>
                <option value="CANCELADA">Canceladas</option>
              </select>

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-blue-400 hover:underline px-2 py-1"
                >
                  Limpar Busca
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Dispensas */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <tr>
                    <th className="py-3 px-4">Guia Nº</th>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Canteiro / Seção</th>
                    <th className="py-3 px-4 text-center">Data</th>
                    <th className="py-3 px-4 text-center">Período / Horário</th>
                    <th className="py-3 px-4 text-center">Horas</th>
                    <th className="py-3 px-4">Motivo</th>
                    <th className="py-3 px-4 text-center">Situação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#243756]/60' : 'divide-slate-100'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                        <span className={isDark ? 'text-[#94A3B8]' : 'text-slate-500'}>
                          Carregando dispensas do período...
                        </span>
                      </td>
                    </tr>
                  ) : filteredDispensas.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center">
                        <FileCheck className={`w-8 h-8 mx-auto mb-2 opacity-40 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
                        <p className={`font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-slate-800'}`}>
                          Nenhuma dispensa encontrada
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Não constam registros de dispensa para o mês e filtros selecionados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredDispensas.map((d) => {
                      const emp = employeeMap.get(d.matricula.toUpperCase());
                      const isCancelled = d.status === 'CANCELADA';

                      return (
                        <tr
                          key={d.id}
                          className={`transition-colors ${
                            isCancelled
                              ? isDark ? 'bg-rose-950/20 opacity-70' : 'bg-rose-50/50 opacity-70'
                              : isDark ? 'hover:bg-[#1E3252]/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 text-[11px]">
                              {d.numeroGuia || 'SPTF-S/N'}
                            </span>
                          </td>

                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm leading-tight text-slate-100">
                              {d.nome}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                              <span>Mat: {d.matricula}</span>
                              {emp?.funcao && <span>• {emp.funcao}</span>}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              {d.secaoCanteiro || 'DECO-KO'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-semibold text-slate-200">
                              {d.data ? d.data.split('-').reverse().join('/') : '—'}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="text-slate-300 font-mono text-[11px]">
                              {d.horarioInicio} às {d.horarioFim}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <span className="font-bold text-emerald-400 text-sm">
                              {Number(d.totalHoras).toFixed(1)}h
                            </span>
                          </td>

                          <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                            {d.motivo || 'COMPENSAÇÃO BANCO DE HORAS'}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isCancelled ? (
                              <Badge variant="danger" className="font-bold">
                                CANCELADA
                              </Badge>
                            ) : (
                              <Badge variant="success" className="font-bold">
                                EMITIDA
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botão Ver / Reimprimir Guia Oficial */}
                              <button
                                onClick={() => handlePrintIndividualDispensa(d)}
                                title="Imprimir Guia Oficial em 2 Vias A4"
                                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Extrato do Colaborador */}
                              {onViewEmployeeStatement && (
                                <button
                                  onClick={() => onViewEmployeeStatement(d.matricula)}
                                  title="Ver Extrato do Colaborador"
                                  className="p-1.5 rounded-lg bg-slate-500/10 text-slate-300 hover:bg-slate-500/20 border border-slate-500/20 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Cancelar Guia (se aplicável) */}
                              {!isCancelled && onDeleteDispensa && (
                                <button
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        `Deseja realmente cancelar a Guia ${d.numeroGuia} de ${d.nome}? O débito vinculado no Banco de Horas também será estornado.`
                                      )
                                    ) {
                                      onDeleteDispensa(d.id, d.lancamentoId);
                                      // Atualiza a lista localmente
                                      setDispensas((prev) =>
                                        prev.map((item) =>
                                          item.id === d.id
                                            ? { ...item, status: 'CANCELADA' }
                                            : item
                                        )
                                      );
                                    }
                                  }}
                                  title="Cancelar Guia e Estornar Débito"
                                  className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 transition-colors"
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
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /* ABA DE FALTAS & AUSÊNCIAS */
        /* ------------------------------------------------------------- */
        <div className="space-y-4">
          {/* Cards de Resumo de Faltas */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Faltas Injustificadas</span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-rose-400">
                  {faltasStats.faltasInjustificadas}
                </span>
                <span className="text-xs text-rose-400/80 font-semibold">desconto folha</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Horas a Descontar</span>
                <Clock className="w-4 h-4 text-rose-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-rose-400">
                  {faltasStats.totalHorasDesconto}h
                </span>
                <span className="text-xs text-rose-400/80 font-semibold">em folha</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Atestados / Justificadas</span>
                <Stethoscope className="w-4 h-4 text-purple-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl sm:text-2xl font-black text-purple-400">
                  {faltasStats.atestadosMedicos + faltasStats.faltasJustificadas}
                </span>
                <span className="text-xs text-purple-400/80 font-semibold">neutros</span>
              </div>
            </div>

            <div className={`p-4 rounded-xl border ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Colaboradores com Falta</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-[#E2E8F0]' : 'text-slate-900'}`}>
                  {faltasStats.colaboradoresCount}
                </span>
                <span className="text-xs text-amber-400 font-semibold">no período</span>
              </div>
            </div>
          </div>

          {/* Filtros da Tabela de Faltas */}
          <div className={`p-3 sm:p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-center justify-between ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
            <div className="relative w-full sm:w-72">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar colaborador, matrícula ou motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border transition-colors ${
                  isDark
                    ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0] placeholder-[#64748B]'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                aria-label="Filtrar por Tipo de Falta"
                value={tipoFaltaFilter}
                onChange={(e) => setTipoFaltaFilter(e.target.value)}
                className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium ${
                  isDark ? 'bg-[#0F1B33] border-[#243756] text-[#E2E8F0]' : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <option value="TODAS">Todos os Tipos de Ausência</option>
                <option value="FALTA_INJUSTIFICADA">1. Falta sem Justificativa (Desconto Folha)</option>
                <option value="ATESTADO_MEDICO">2. Atestado Médico (Neutro)</option>
                <option value="FALTA_JUSTIFICADA">3. Falta Justificada (Gala/Luto/Judicial)</option>
              </select>

              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-blue-400 hover:underline px-2 py-1"
                >
                  Limpar Busca
                </button>
              )}
            </div>
          </div>

          {/* Tabela de Faltas */}
          <div className={`rounded-xl border overflow-hidden ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[11px] uppercase tracking-wider font-semibold ${isDark ? 'bg-[#0F1B33] border-[#243756] text-[#94A3B8]' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                  <tr>
                    <th className="py-3 px-4">Colaborador</th>
                    <th className="py-3 px-4">Canteiro / Sede</th>
                    <th className="py-3 px-4 text-center">Data da Falta</th>
                    <th className="py-3 px-4 text-center">Tipo de Ocorrência</th>
                    <th className="py-3 px-4 text-center">Impacto em Folha</th>
                    <th className="py-3 px-4">Justificativa / Observação</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-[#243756]/60' : 'divide-slate-100'}`}>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <RefreshCw className="w-6 h-6 animate-spin text-rose-500 mx-auto mb-2" />
                        <span className={isDark ? 'text-[#94A3B8]' : 'text-slate-500'}>
                          Carregando faltas do período...
                        </span>
                      </td>
                    </tr>
                  ) : filteredFaltas.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                        <p className={`font-semibold ${isDark ? 'text-[#E2E8F0]' : 'text-slate-800'}`}>
                          Nenhuma falta ou ausência registrada
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                          Parabéns! 100% de assiduidade no período e canteiro selecionados.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredFaltas.map((f) => {
                      const isDesconto = f.tipo === 'FALTA_INJUSTIFICADA';
                      const isAtestado = f.tipo === 'ATESTADO_MEDICO';

                      return (
                        <tr
                          key={f.id}
                          className={`transition-colors ${
                            isDark ? 'hover:bg-[#1E3252]/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-4">
                            <div className="font-semibold text-sm leading-tight text-slate-100">
                              {f.nome}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                              <span>Mat: {f.matricula}</span>
                              {f.funcao && <span>• {f.funcao}</span>}
                            </div>
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-medium text-slate-300">
                              <Building2 className="w-3 h-3 text-slate-400" />
                              DECO-{f.canteiro}
                            </span>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <div className="font-semibold text-slate-200">
                              {f.data ? f.data.split('-').reverse().join('/') : '—'}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              {f.diaSemanaNome}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isDesconto ? (
                              <Badge variant="danger" className="font-bold gap-1">
                                <XCircle className="w-3 h-3" />
                                FALTA INJUSTIFICADA
                              </Badge>
                            ) : isAtestado ? (
                              <Badge variant="purple" className="font-bold gap-1">
                                <Stethoscope className="w-3 h-3" />
                                ATESTADO MÉDICO
                              </Badge>
                            ) : (
                              <Badge variant="warning" className="font-bold gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                FALTA JUSTIFICADA
                              </Badge>
                            )}
                          </td>

                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isDesconto ? (
                              <span className="font-bold text-rose-400 text-sm">
                                -8.0h (Folha)
                              </span>
                            ) : (
                              <span className="font-medium text-slate-400 text-xs">
                                0.0h (Neutro)
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                            {f.observacao}
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Extrato do Colaborador */}
                              {onViewEmployeeStatement && (
                                <button
                                  onClick={() => onViewEmployeeStatement(f.matricula)}
                                  title="Abrir Extrato Completo do Colaborador"
                                  className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Lançar Justificativa */}
                              {onOpenNewEntry && (
                                <button
                                  onClick={() => onOpenNewEntry(f.matricula)}
                                  title="Lançar Nova Ocorrência / Regularizar"
                                  className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
                                >
                                  <PlusCircle className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
};
