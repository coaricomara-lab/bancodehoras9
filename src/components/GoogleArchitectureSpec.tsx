import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Database, 
  Layers, 
  FileCode2, 
  Copy, 
  Check, 
  Sparkles, 
  Server, 
  HardDrive,
  Workflow, 
  Calendar, 
  ShieldCheck, 
  TableProperties, 
  ArrowRightLeft, 
  UploadCloud, 
  FileSpreadsheet, 
  FolderTree, 
  FileCheck2, 
  Code2, 
  AlertTriangle, 
  BookOpen, 
  ShieldAlert, 
  Users, 
  Clock, 
  FileText, 
  CheckCircle2, 
  BarChart3, 
  Rocket, 
  Award,
  Shield,
  UserCheck,
  RefreshCw,
  Lock,
  History,
  Info,
  ChevronRight,
  ChevronLeft,
  Sparkle
} from 'lucide-react';

interface GoogleArchitectureSpecProps {
  theme?: 'dark' | 'light';
}

type TabType = 
  | 'manual_perfis' 
  | 'insalubridade_sptf' 
  | 'seguranca_backups' 
  | 'etapa5_golive' 
  | 'etapa4_auditoria' 
  | 'etapa2_csv_drive' 
  | 'code_gs' 
  | 'html_modal' 
  | 'looker_sql';

interface ManualTabConfig {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badge: string;
}

const MANUAL_TABS: ManualTabConfig[] = [
  { id: 'manual_perfis', label: '1. Perfis de Acesso & Fluxos', icon: Users, color: 'text-blue-500', badge: 'border-blue-500 text-blue-400 bg-blue-500/10' },
  { id: 'insalubridade_sptf', label: '2. Insalubridade & Fórmulas SPTF', icon: TableProperties, color: 'text-amber-500', badge: 'border-amber-500 text-amber-400 bg-amber-500/10' },
  { id: 'seguranca_backups', label: '3. Segurança & Pontos de Restauração', icon: Shield, color: 'text-rose-500', badge: 'border-rose-500 text-rose-400 bg-rose-500/10' },
  { id: 'etapa5_golive', label: '4. Go-Live & Looker Studio', icon: Rocket, color: 'text-emerald-500', badge: 'border-emerald-500 text-emerald-400 bg-emerald-500/10' },
  { id: 'etapa4_auditoria', label: '5. Auditoria & Alertas RH', icon: ShieldAlert, color: 'text-purple-500', badge: 'border-purple-500 text-purple-400 bg-purple-500/10' },
  { id: 'etapa2_csv_drive', label: '6. CSV UPSERT & Drive', icon: UploadCloud, color: 'text-cyan-500', badge: 'border-cyan-500 text-cyan-400 bg-cyan-500/10' },
  { id: 'code_gs', label: '7. Code.gs Script', icon: FileCode2, color: 'text-amber-500', badge: 'border-amber-500 text-amber-400 bg-amber-500/10' },
  { id: 'html_modal', label: '8. HTML Modal', icon: Code2, color: 'text-indigo-500', badge: 'border-indigo-500 text-indigo-400 bg-indigo-500/10' },
  { id: 'looker_sql', label: '9. Fórmulas Looker', icon: Sparkles, color: 'text-teal-500', badge: 'border-teal-500 text-teal-400 bg-teal-500/10' },
];

export const GoogleArchitectureSpec: React.FC<GoogleArchitectureSpecProps> = ({
  theme = 'dark',
}) => {
  const isDark = theme === 'dark';
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('manual_perfis');

  // Carousel & Smooth Scroll State
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Drag-to-scroll State
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);
  const hasDragged = useRef(false);

  // Check scroll position to toggle arrows & gradients
  const updateScrollButtons = useCallback(() => {
    const el = tabsContainerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateScrollButtons();
    const el = tabsContainerRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollButtons, { passive: true });
    window.addEventListener('resize', updateScrollButtons);

    return () => {
      el.removeEventListener('scroll', updateScrollButtons);
      window.removeEventListener('resize', updateScrollButtons);
    };
  }, [updateScrollButtons]);

  // Auto-scroll active tab into view
  useEffect(() => {
    const activeEl = tabButtonRefs.current[activeTab];
    const container = tabsContainerRef.current;
    if (activeEl && container) {
      const containerRect = container.getBoundingClientRect();
      const tabRect = activeEl.getBoundingClientRect();

      if (tabRect.left < containerRect.left + 48 || tabRect.right > containerRect.right - 48) {
        activeEl.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center',
        });
      }
    }
  }, [activeTab]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!tabsContainerRef.current) return;
    const amount = Math.max(200, tabsContainerRef.current.clientWidth * 0.55);
    tabsContainerRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  // Drag-to-scroll Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - tabsContainerRef.current.offsetLeft;
    scrollLeftStart.current = tabsContainerRef.current.scrollLeft;
    hasDragged.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !tabsContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - tabsContainerRef.current.offsetLeft;
    const walk = x - startX.current;
    if (Math.abs(walk) > 4) {
      hasDragged.current = true;
    }
    tabsContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    setTimeout(() => {
      hasDragged.current = false;
    }, 50);
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    hasDragged.current = false;
  };

  const handleTabClick = (tabId: TabType) => {
    if (hasDragged.current) return;
    setActiveTab(tabId);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const completeAppsScriptCode = `/**
 * ============================================================================
 * PROJETO: SISTEMA DE GESTÃO DE BANCO DE HORAS SPTF & GOOGLE WORKSPACE
 * ARQUITETURA: Google Apps Script + Google Sheets + Google Drive + Looker Studio
 * AUTOR: Engenharia de Dados & RH Corporativo COMARA
 * VERSÃO: 5.2.0 (Produção • Gestão de Sedes KO, BE, MN + Insalubridade)
 * ============================================================================
 */

const CONFIG = {
  DRIVE_ROOT_FOLDER_NAME: 'Banco_de_Horas',
  DRIVE_COMPROVANTES_SUBFOLDER: 'Comprovantes',
  DRIVE_FOTOS_SUBFOLDER: 'Fotos_Colaboradores',
  SHEET_COLABORADORES: 'tb_colaboradores',
  SHEET_LANCAMENTOS: 'tb_lancamentos_diarios',
  SHEET_RESUMO_MENSAL: 'tb_resumo_mensal',
  SHEET_INSALUBRIDADE: 'tb_insalubridade_mensal',
  SHEET_PARAMETROS: 'parametros_sistema',
  EMAIL_NOTIFICACAO_RH: 'rh.coari@empresa.com.br,coari.comara@gmail.com',
  LIMITE_HORAS_POSITIVAS_ALERTA: 40.0, // Risco de passivo trabalhista
  LIMITE_HORAS_NEGATIVAS_ALERTA: -20.0, // Déficit severo
  SEDES: ['KO', 'BE', 'MN'],
  TIPOS_OCORRENCIA: [
    'TRABALHO',
    'FALTA_INJUSTIFICADA',
    'ATESTADO_MEDICO',
    'COMPENSACAO',
    'FERIAS',
    'LICENCA'
  ],
  GRAUS_INSALUBRIDADE: ['MINIMO_10', 'MEDIO_20', 'MAXIMO_40']
};

/**
 * MENU PERSONALIZADO NO GOOGLE SHEETS
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚡ COMARA SPTF')
    .addItem('📥 Importar Colaboradores (CSV UPSERT)', 'abrirModalImportacaoCSV')
    .addItem('🔍 Executar Auditoria de Inconsistências', 'gerarRelatorioAuditoria')
    .addSeparator()
    .addItem('📅 Consolidar Fechamento do Mês', 'executarFechamentoMensalManual')
    .addItem('🛡️ Gerar Ponto de Restauração / Backup', 'gerarSnapshotSeguranca')
    .addItem('🚀 Provisionar/Resetar Estrutura das Tabelas', 'setupBancoDeHorasSPTF')
    .addToUi();
}

/**
 * ============================================================================
 * ETAPA 4.1: ROTINA DE AUDITORIA E MENSAGENS DE ALERTA PARA O RH
 * ============================================================================
 */
function gerarRelatorioAuditoria() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const colabSheet = ss.getSheetByName(CONFIG.SHEET_COLABORADORES);
    const lancSheet = ss.getSheetByName(CONFIG.SHEET_LANCAMENTOS);

    if (!colabSheet || !lancSheet) {
      throw new Error('Tabelas tb_colaboradores ou tb_lancamentos_diarios não encontradas.');
    }

    const colaboradoresData = colabSheet.getDataRange().getValues();
    const lancamentosData = lancSheet.getDataRange().getValues();

    const colabMap = new Map();
    for (let r = 1; r < colaboradoresData.length; r++) {
      const mat = String(colaboradoresData[r][1] || '').trim();
      const nome = String(colaboradoresData[r][2] || '').trim();
      const sede = String(colaboradoresData[r][4] || 'KO').trim();
      const saldoInicial = parseFloat(colaboradoresData[r][7]) || 0.0;
      if (mat) {
        colabMap.set(mat, {
          matricula: mat,
          nome: nome,
          sede: sede,
          saldoInicial: saldoInicial,
          saldoAcumulado: saldoInicial,
          totalLancamentos: 0
        });
      }
    }

    const alertasAtestadosSemLink = [];
    const alertasDuplicidades = [];
    const registrosUnicosMap = new Map();

    for (let i = 1; i < lancamentosData.length; i++) {
      const row = lancamentosData[i];
      const idLancamento = String(row[0] || '').trim();
      const mat = String(row[1] || '').trim();
      const nome = String(row[2] || '').trim();
      const dataReg = sanitizeDate(row[3]);
      const tipoOcorrencia = String(row[7] || '').trim().toUpperCase();
      const saldoLancamento = parseFloat(row[10]) || 0.0;
      const fileUrl = String(row[13] || '').trim();

      if (!mat || !dataReg) continue;

      if (colabMap.has(mat)) {
        const emp = colabMap.get(mat);
        emp.saldoAcumulado += saldoLancamento;
        emp.totalLancamentos++;
      }

      if (tipoOcorrencia === 'ATESTADO_MEDICO' || tipoOcorrencia === 'AT') {
        if (!fileUrl || fileUrl.indexOf('http') === -1) {
          alertasAtestadosSemLink.push({
            linha: i + 1,
            id: idLancamento,
            matricula: mat,
            nome: nome,
            data: dataReg
          });
        }
      }

      const chaveUnica = mat + '_' + dataReg;
      if (registrosUnicosMap.has(chaveUnica)) {
        alertasDuplicidades.push({
          linha: i + 1,
          matricula: mat,
          nome: nome,
          data: dataReg,
          primeiroId: registrosUnicosMap.get(chaveUnica)
        });
      } else {
        registrosUnicosMap.set(chaveUnica, idLancamento);
      }
    }

    const alertasPassivoAlto = [];
    const alertasDeficitAlto = [];

    colabMap.forEach((emp) => {
      if (emp.saldoAcumulado > CONFIG.LIMITE_HORAS_POSITIVAS_ALERTA) {
        alertasPassivoAlto.push({
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede,
          saldo: emp.saldoAcumulado.toFixed(1)
        });
      } else if (emp.saldoAcumulado < CONFIG.LIMITE_HORAS_NEGATIVAS_ALERTA) {
        alertasDeficitAlto.push({
          matricula: emp.matricula,
          nome: emp.nome,
          sede: emp.sede,
          saldo: emp.saldoAcumulado.toFixed(1)
        });
      }
    });

    const totalInconsistencias = alertasAtestadosSemLink.length + 
                                alertasDuplicidades.length + 
                                alertasPassivoAlto.length + 
                                alertasDeficitAlto.length;

    const relatorioHtml = montarCorpoEmailAuditoria({
      dataAuditoria: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss'),
      totalInconsistencias: totalInconsistencias,
      alertasAtestados: alertasAtestadosSemLink,
      alertasDuplicidades: alertasDuplicidades,
      alertasPassivo: alertasPassivoAlto,
      alertasDeficit: alertasDeficitAlto
    });

    if (CONFIG.EMAIL_NOTIFICACAO_RH && totalInconsistencias > 0) {
      MailApp.sendEmail({
        to: CONFIG.EMAIL_NOTIFICACAO_RH,
        subject: '⚠️ [COMARA ALERTA] Relatório de Auditoria SPTF (' + totalInconsistencias + ' inconsistências)',
        htmlBody: relatorioHtml
      });
    }

    const ui = SpreadsheetApp.getUi();
    const mensagemResumo = 'Auditoria COMARA Concluída!\\n\\n' +
      '• Atestados sem Anexo: ' + alertasAtestadosSemLink.length + '\\n' +
      '• Lançamentos Duplicados: ' + alertasDuplicidades.length + '\\n' +
      '• Passivo Alto (>+' + CONFIG.LIMITE_HORAS_POSITIVAS_ALERTA + 'h): ' + alertasPassivoAlto.length + '\\n' +
      '• Déficit Crítico (<' + CONFIG.LIMITE_HORAS_NEGATIVAS_ALERTA + 'h): ' + alertasDeficitAlto.length + '\\n\\n' +
      (totalInconsistencias > 0 
        ? 'Um e-mail detalhado foi enviado para: ' + CONFIG.EMAIL_NOTIFICACAO_RH 
        : 'Parabéns! Nenhuma inconsistência encontrada.');

    ui.alert('🔍 Relatório de Auditoria SPTF', mensagemResumo, ui.ButtonSet.OK);

    return { success: true, totalInconsistencias: totalInconsistencias };

  } catch (error) {
    Logger.log('Erro na rotina de auditoria: ' + error.message);
    if (typeof SpreadsheetApp !== 'undefined' && SpreadsheetApp.getUi) {
      SpreadsheetApp.getUi().alert('Erro na Auditoria', error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return { success: false, message: error.message };
  }
}

function montarCorpoEmailAuditoria(dados) {
  let html = '<div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">';
  html += '<div style="max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">';
  html += '<div style="background-color: #0B1426; padding: 20px; text-align: center; border-bottom: 3px solid #3B82F6;">';
  html += '<h2 style="color: #ffffff; margin: 0; font-size: 18px;">COMARA SPTF • Relatório de Auditoria</h2>';
  html += '<p style="color: #9CA3AF; margin: 5px 0 0 0; font-size: 12px;">Data da Varredura: ' + dados.dataAuditoria + '</p>';
  html += '</div>';
  html += '<div style="padding: 24px;">';
  
  if (dados.totalInconsistencias === 0) {
    html += '<p style="color: #10B981; font-weight: bold; font-size: 14px;">✅ Base 100% íntegra. Nenhuma irregularidade identificada.</p>';
  } else {
    html += '<p style="color: #EF4444; font-weight: bold; font-size: 14px; margin-top: 0;">⚠️ Foram detectadas ' + dados.totalInconsistencias + ' ocorrências que exigem atenção:</p>';
  }
  html += '</div></div></div>';
  return html;
}

function sanitizeDate(dateStr) {
  if (!dateStr) return '2026-01-01';
  dateStr = String(dateStr).trim();
  if (dateStr.indexOf('/') !== -1) {
    const p = dateStr.split('/');
    if (p.length === 3) {
      const dia = p[0].padStart(2, '0');
      const mes = p[1].padStart(2, '0');
      const ano = p[2].length === 2 ? '20' + p[2] : p[2];
      return ano + '-' + mes + '-' + dia;
    }
  }
  return dateStr.substring(0, 10);
}`;

  const htmlModalCode = `<!DOCTYPE html>
<html>
  <head>
    <base target="_top">
    <meta charset="utf-8">
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        background-color: #0F172A;
        color: #F1F5F9;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 13px;
        padding: 20px;
      }
      .card {
        background: #16243D;
        border: 1px solid #334155;
        border-radius: 12px;
        padding: 20px;
      }
      h2 {
        font-size: 16px;
        font-weight: 700;
        color: #FFFFFF;
        margin-bottom: 8px;
      }
      p.subtitle {
        color: #94A3B8;
        font-size: 12px;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .dropzone {
        border: 2px dashed #475569;
        background: #0F172A;
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }
      .dropzone:hover {
        border-color: #3B82F6;
        background: rgba(59, 130, 246, 0.08);
      }
      .btn {
        width: 100%;
        background: #2563EB;
        color: #FFFFFF;
        border: none;
        padding: 12px;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        margin-top: 14px;
      }
      .btn:hover { background: #1D4ED8; }
      .btn:disabled { background: #334155; color: #64748B; cursor: not-allowed; }
    </style>
  </head>
  <body>
    <div class="card">
      <h2>📥 Importação de Colaboradores (UPSERT)</h2>
      <p class="subtitle">
        Carregue o arquivo CSV com cabeçalhos: Matricula, Nome, Funcao, Sede, Status, Saldo_Inicial.
      </p>
      <div class="dropzone" onclick="document.getElementById('fileInput').click()">
        <p>Arraste seu arquivo CSV ou clique para selecionar</p>
      </div>
      <input type="file" id="fileInput" accept=".csv" style="display:none">
      <button class="btn" id="btnUpload" disabled>Processar Carga no Sheets</button>
    </div>
  </body>
</html>`;

  return (
    <div className={`space-y-6 text-xs transition-colors ${
      isDark ? 'text-slate-200' : 'text-slate-800'
    }`}>
      {/* ------------------------------------------------------------- */}
      {/* HEADER DO MANUAL COM IDENTIDADE COMARA                         */}
      {/* ------------------------------------------------------------- */}
      <div className={`p-6 rounded-2xl border shadow-md transition-colors ${
        isDark 
          ? 'bg-[#16243D] border-[#243756]' 
          : 'bg-white border-slate-200 shadow-slate-200/50'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className={`px-2.5 py-0.5 border text-[11px] font-bold rounded-full flex items-center gap-1.5 font-mono ${
                isDark 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' 
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                <BookOpen className="w-3.5 h-3.5" />
                Manual Operacional & Governança • COMARA SPTF
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
              }`}>
                v5.2.0 Produção
              </span>
            </div>
            <h2 className={`text-xl font-bold mt-2 font-sans tracking-tight ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}>
              Guia Completo de Operação, Perfis de Acesso & Normas Técnicas
            </h2>
            <p className={`text-xs max-w-3xl mt-1 leading-relaxed ${
              isDark ? 'text-[#94A3B8]' : 'text-slate-600'
            }`}>
              Documentação oficial para Supervisores de Sede, Analistas de RH, Auxiliares de DA e Auditores, abrangendo regras da jornada SPTF, gestão de insalubridade quinzenal, travas de segurança e integração com Cloud Firestore e Looker Studio.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('manual_perfis')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'manual_perfis'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : isDark ? 'bg-[#243756] text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Ver Perfis</span>
            </button>
            <button
              onClick={() => setActiveTab('insalubridade_sptf')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'insalubridade_sptf'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : isDark ? 'bg-[#243756] text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Insalubridade</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* NAVEGAÇÃO DE ABAS DO MANUAL                                    */}
      {/* ------------------------------------------------------------- */}
      <div className={`rounded-2xl border shadow-md overflow-hidden transition-colors ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className={`relative border-b ${
          isDark ? 'border-[#243756] bg-[#0F1B33]' : 'border-slate-200 bg-slate-50/90'
        }`}>
          {/* Botão de Navegação Esquerda */}
          <button
            type="button"
            onClick={() => handleScroll('left')}
            aria-label="Rolar abas para a esquerda"
            className={`absolute left-1.5 top-1/2 -translate-y-1/2 z-20 p-2 rounded-xl border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              canScrollLeft 
                ? 'opacity-100 scale-100 pointer-events-auto' 
                : 'opacity-0 scale-95 pointer-events-none'
            } ${
              isDark 
                ? 'bg-[#16243D]/95 border-[#243756] text-slate-200 hover:text-white hover:bg-[#1E3252] shadow-black/40' 
                : 'bg-white/95 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-slate-300/50'
            }`}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Fade Gradient Indicador Esquerda */}
          <div 
            className={`absolute left-0 top-0 bottom-0 w-12 pointer-events-none z-10 transition-opacity duration-300 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0'
            } ${
              isDark 
                ? 'bg-gradient-to-r from-[#0F1B33] via-[#0F1B33]/80 to-transparent' 
                : 'bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent'
            }`}
          />

          {/* Container Carrossel de Abas com Drag-to-Scroll e sem barra de rolagem */}
          <div
            ref={tabsContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            className="flex items-center px-4 pt-2.5 pb-2.5 overflow-x-auto gap-2 no-scrollbar scroll-smooth cursor-grab active:cursor-grabbing select-none"
          >
            {MANUAL_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabButtonRefs.current[tab.id] = el; }}
                  onClick={() => handleTabClick(tab.id)}
                  type="button"
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all duration-200 active:scale-[0.98] flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? isDark
                        ? 'bg-[#1E3252] border-blue-500/80 text-white shadow-md shadow-blue-500/10 ring-1 ring-blue-500/40'
                        : 'bg-white border-blue-600 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
                      : isDark
                        ? 'bg-[#0F1B33]/60 border-[#243756]/80 text-[#94A3B8] hover:text-[#E2E8F0] hover:bg-[#16243D] hover:border-[#335075]'
                        : 'bg-slate-100/80 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition-transform duration-200 ${isActive ? 'scale-110' : ''} ${tab.color}`} />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isDark ? 'bg-blue-400 animate-pulse' : 'bg-blue-600'
                    }`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Fade Gradient Indicador Direita */}
          <div 
            className={`absolute right-0 top-0 bottom-0 w-12 pointer-events-none z-10 transition-opacity duration-300 ${
              canScrollRight ? 'opacity-100' : 'opacity-0'
            } ${
              isDark 
                ? 'bg-gradient-to-l from-[#0F1B33] via-[#0F1B33]/80 to-transparent' 
                : 'bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent'
            }`}
          />

          {/* Botão de Navegação Direita */}
          <button
            type="button"
            onClick={() => handleScroll('right')}
            aria-label="Rolar abas para a direita"
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-2 rounded-xl border shadow-lg backdrop-blur-md transition-all cursor-pointer ${
              canScrollRight 
                ? 'opacity-100 scale-100 pointer-events-auto' 
                : 'opacity-0 scale-95 pointer-events-none'
            } ${
              isDark 
                ? 'bg-[#16243D]/95 border-[#243756] text-slate-200 hover:text-white hover:bg-[#1E3252] shadow-black/40' 
                : 'bg-white/95 border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-slate-300/50'
            }`}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* ----------------------------------------------------------- */}
        {/* ABA 1: PERFIS DE ACESSO & WORKFLOWS                          */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'manual_perfis' && (
          <div className="p-6 space-y-6">
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Matriz de Perfis de Acesso e Responsabilidades Operacionais
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${
                  isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                }`}>
                  HIERARQUIA RH / COMARA
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                O sistema é estruturado em níveis de privilégio para garantir a integridade dos cálculos SPTF, a precisão das apontações em campo e a confidencialidade das informações de folha de pagamento.
              </p>
            </div>

            {/* Grid dos 4 Perfis */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Perfil 1: Super Admin & RH */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800'
                    }`}>TOTAL</span>
                  </div>
                  <h4 className={`font-bold text-xs font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Super Admin / Chefe de RH
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Acesso irrestrito a todos os canteiros (KO, BE, MN), parametrização do sistema, gestão de acessos, fechamento mensal da folha e auditorias completas.
                  </p>
                </div>
                <div className={`pt-2 border-t text-[10px] space-y-1 ${
                  isDark ? 'border-[#243756] text-purple-400' : 'border-slate-100 text-purple-700'
                }`}>
                  <div>✓ Configuração Geral</div>
                  <div>✓ Limpeza com Snapshot</div>
                  <div>✓ Exportação de Relatórios</div>
                </div>
              </div>

              {/* Perfil 2: Supervisor de Campo / Gestor */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                    }`}>OPERACIONAL</span>
                  </div>
                  <h4 className={`font-bold text-xs font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Gestor / Supervisor de Sede
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Gestão diária de lançamentos, consulta do extrato dos subordinados, acompanhamento de faltas e atestados com anexo e aprovação prévia de compensações.
                  </p>
                </div>
                <div className={`pt-2 border-t text-[10px] space-y-1 ${
                  isDark ? 'border-[#243756] text-blue-400' : 'border-slate-100 text-blue-700'
                }`}>
                  <div>✓ Lançamentos Rápidos</div>
                  <div>✓ Grade Diária</div>
                  <div>✓ Extratos Individuais</div>
                </div>
              </div>

              {/* Perfil 3: Auxiliar de DA (Enxuto) */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 relative overflow-hidden ${
                isDark 
                  ? 'bg-gradient-to-b from-[#1B2D4A] to-[#16243D] border-blue-500/40' 
                  : 'bg-gradient-to-b from-blue-50/50 to-white border-blue-300 shadow-xs'
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                    }`}>ENXUTO</span>
                  </div>
                  <h4 className={`font-bold text-xs font-sans flex items-center gap-1.5 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}>
                    <span>Auxiliar de DA</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/10 text-blue-400">Aux DA</span>
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Interface simplificada sem poluição visual. Foco em apontamento por equipe/canteiro e conferência da Matriz Quinzenal de Insalubridade.
                  </p>
                </div>
                <div className={`pt-2 border-t text-[10px] space-y-1 ${
                  isDark ? 'border-[#243756] text-emerald-400' : 'border-slate-100 text-emerald-700'
                }`}>
                  <div>✓ Lote por Seleção</div>
                  <div>✓ Matriz Quinzenal Direta</div>
                  <div>✗ Painel sem KPIs pesados</div>
                </div>
              </div>

              {/* Perfil 4: Auditor & Fiscal */}
              <div className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'
                    }`}>LEITURA</span>
                  </div>
                  <h4 className={`font-bold text-xs font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Auditor / Órgão de Controle
                  </h4>
                  <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Acesso somente-leitura (Read-Only) para fiscalização de conformidade trabalhista, validação de comprovantes no Drive e laudos de insalubridade.
                  </p>
                </div>
                <div className={`pt-2 border-t text-[10px] space-y-1 ${
                  isDark ? 'border-[#243756] text-amber-400' : 'border-slate-100 text-amber-700'
                }`}>
                  <div>✓ Extratos e Espelhos</div>
                  <div>✓ Relatórios Executivos</div>
                  <div>✗ Bloqueio de Edição</div>
                </div>
              </div>
            </div>

            {/* Destaque do Perfil Auxiliar de DA */}
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-blue-50/60 border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h4 className={`font-bold text-xs font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Especificação do Modo Simplificado: Auxiliar de DA (Aux de DA)
                </h4>
              </div>
              <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] ${
                isDark ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <strong className={isDark ? 'text-white' : 'text-slate-900'}>1. Dashboard Operacional</strong>
                  <p className="mt-1">Oculta os cards de estatísticas globais e as abas secundárias, mantendo a listagem ágil de colaboradores, saldo e busca por canteiro.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <strong className={isDark ? 'text-white' : 'text-slate-900'}>2. Lançamento Rápido em Lote</strong>
                  <p className="mt-1">Fixa o modal no modo <em>Seleção de Equipe / Canteiro</em>, permitindo lançar múltiplos colaboradores simultaneamente com apenas 1 clique.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <strong className={isDark ? 'text-white' : 'text-slate-900'}>3. Insalubridade Direta</strong>
                  <p className="mt-1">Abre diretamente a <em>Matriz Quinzenal de Efetivo</em>, ocultando telas de fichas fixas e auditorias complexas da NR-15.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 2: INSALUBRIDADE & FÓRMULAS SPTF                         */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'insalubridade_sptf' && (
          <div className="p-6 space-y-6">
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TableProperties className="w-5 h-5 text-amber-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Matriz Dinâmica Quinzenal de Insalubridade & Fórmulas da Jornada SPTF
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${
                  isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-800'
                }`}>
                  NORMAS NR-15 / SPTF
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                A Matriz de Insalubridade oferece controle visual diário de presença, faltas, folgas e atestados, com janela deslizante de dias e coluna totalizadora fixa para conferência instantânea.
              </p>
            </div>

            {/* Matriz Quinzenal - Como Funciona */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <h4 className={`font-bold text-xs font-sans flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Navegação de Janela Temporal Deslizante
                </h4>
                <div className={`space-y-2 text-[11px] leading-relaxed ${
                  isDark ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}>
                  <p>
                    <strong>• Botões Quinzenais:</strong> Alterne rapidamente entre a <em>1ª Quinzena (Dias 01 a 15)</em> e a <em>2ª Quinzena (Dias 16 a 31)</em> do mês selecionado.
                  </p>
                  <p>
                    <strong>• Deslocamento Dia a Dia:</strong> Utilize as setas <em>◀ Anterior</em> e <em>Próximo ▶</em> para avançar ou recuar a janela de 15 dias gradualmente.
                  </p>
                  <p>
                    <strong>• Totalizador Fixo à Direita:</strong> A coluna de <em>Total de Dias Trabalhados</em> permanece sempre visível e congelada à direita durante qualquer rolagem horizontal da tabela.
                  </p>
                </div>
              </div>

              <div className={`p-4 rounded-xl border space-y-3 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <h4 className={`font-bold text-xs font-sans flex items-center gap-2 ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}>
                  <Award className="w-4 h-4 text-amber-500" />
                  Legenda de Códigos de Frequência
                </h4>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className={`p-2 rounded border flex items-center gap-2 ${
                    isDark ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}>
                    <span className="font-bold font-mono">T</span>
                    <span>Trabalho / Insalubre (+1 dia)</span>
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${
                    isDark ? 'bg-rose-950/30 border-rose-800/50 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}>
                    <span className="font-bold font-mono">F</span>
                    <span>Falta Injustificada (0 dia)</span>
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${
                    isDark ? 'bg-blue-950/30 border-blue-800/50 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-800'
                  }`}>
                    <span className="font-bold font-mono">A</span>
                    <span>Atestado Médico (0 dia)</span>
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${
                    isDark ? 'bg-purple-950/30 border-purple-800/50 text-purple-300' : 'bg-purple-50 border-purple-200 text-purple-800'
                  }`}>
                    <span className="font-bold font-mono">FOL / D</span>
                    <span>Folga / Descanso (0 dia)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Regras de Cálculo SPTF */}
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <h4 className={`font-bold text-xs font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Tabela de Multiplicadores da Jornada de Trabalho SPTF
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px]">
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-blue-500 font-bold uppercase">Segunda a Sexta</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.0x (Normal)</div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>1 hora trabalhada = 1 hora no saldo.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-amber-500 font-bold uppercase">Sábados</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>1.5x (Adicional)</div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>8 horas = 12 horas apuradas no banco.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-rose-500 font-bold uppercase">Domingos e Feriados</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>2.0x (Dobro)</div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>8 horas = 16 horas apuradas no banco.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-purple-500 font-bold uppercase">Falta Injustificada</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>-8.0h (Débito)</div>
                  <p className={`text-[10px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Desconto integral da jornada diária.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 3: SEGURANÇA, BACKUPS & PONTOS DE RESTAURAÇÃO            */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'seguranca_backups' && (
          <div className="p-6 space-y-6">
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-rose-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Segurança de Dados, Travas Preventivas & Pontos de Restauração
                  </h3>
                </div>
                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg ${
                  isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-800'
                }`}>
                  PROTEÇÃO ATIVA
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Para prevenir perdas acidentais de registros reais de colaboradores e lançamentos de ponto, o sistema implementa camadas estritas de verificação e criação automática de backups.
              </p>
            </div>

            {/* Grid dos 3 Mecanismos de Proteção */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-2 text-rose-500 font-bold text-xs">
                  <Lock className="w-4 h-4" /> 1. Confirmação por Digitação
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Ações críticas como <strong>Limpar Base Central</strong> ou <strong>Carregar Exemplos Mocks</strong> exigem a digitação exata de frases de segurança (ex: <code>LIMPAR BASE</code>).
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-2 text-blue-500 font-bold text-xs">
                  <UploadCloud className="w-4 h-4" /> 2. Backup JSON Automático
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Antes de qualquer exclusão em lote, o usuário pode baixar o arquivo <code>backup_comara_sptf.json</code> contendo colaboradores, lançamentos, canteiros e insalubridade.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2.5 ${
                isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200 shadow-xs'
              }`}>
                <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs">
                  <History className="w-4 h-4" /> 3. Snapshots com 1-Clique
                </div>
                <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  O sistema salva pontos de restauração históricos numerados. Caso uma operação indevida ocorra, basta clicar em <em>Restaurar Este Ponto</em> para recuperar o banco intacto.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 4: ETAPA 5 - GO-LIVE & LOOKER STUDIO                     */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'etapa5_golive' && (
          <div className="p-6 space-y-6">
            <div className={`p-6 rounded-xl border space-y-4 ${
              isDark 
                ? 'bg-gradient-to-r from-blue-950/40 via-[#1E3252] to-[#1E3252] border-blue-500/30' 
                : 'bg-gradient-to-r from-blue-50/80 via-white to-white border-blue-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-emerald-500" />
                  <h3 className={`font-bold text-base font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Resumo Executivo do Projeto • Diretoria COMARA & Gestão
                  </h3>
                </div>
                <span className={`px-2.5 py-1 text-xs font-bold rounded-lg flex items-center gap-1 ${
                  isDark ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  PRONTO PARA PRODUÇÃO
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#E2E8F0]' : 'text-slate-700'}`}>
                O <strong>Sistema Corporativo de Gestão de Banco de Horas SPTF</strong> centraliza e automatiza com rigor legal a apuração da jornada de trabalho para as bases operacionais de <strong>Coari (KO), Belém (BE) e Manaus (MN)</strong>. Desenvolvido nativamente sobre <strong>Cloud Firestore, Google Workspace e Looker Studio</strong>, o sistema elimina 100% dos custos recorrentes de licenças de terceiros.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2">
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Passivo Zero</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Controle SPTF Rígido</div>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Multiplicadores automáticos (1.0x, 1.5x, 2.0x) e limite de +40h.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">Drive Seguro</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Pastas Hierárquicas</div>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Organização automática por Ano e Sede com link auditável.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Auditoria Ativa</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Alertas no E-mail</div>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Notificação imediata ao RH de atestados sem anexo e duplicidades.</p>
                </div>
                <div className={`p-3 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <span className="text-[10px] text-purple-500 font-bold uppercase tracking-wider">BI Executivo</span>
                  <div className={`text-sm font-bold mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>Looker Studio 24/7</div>
                  <p className={`text-[11px] mt-1 ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Dashboards em tempo real com extrato individual e distribuição por bases.</p>
                </div>
              </div>
            </div>

            {/* Checklist de 5 Passos */}
            <div className={`p-6 rounded-xl border space-y-4 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-blue-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Checklist Oficial de Entrada em Produção (Go-Live em 5 Passos)
                  </h3>
                </div>
                <span className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Roteiro RH & TI</span>
              </div>

              <div className="space-y-3">
                {[
                  {
                    step: 1,
                    title: 'Configuração de Permissões da Pasta no Google Drive',
                    desc: 'Crie a pasta raiz Banco_de_Horas ou permita que o script a gere automaticamente. Conceda permissão de Editor apenas aos membros autorizados do RH e permissão de Leitor aos demais.'
                  },
                  {
                    step: 2,
                    title: 'Ativação dos Gatilhos Temporais (Triggers) no Google Apps Script',
                    desc: 'No Editor do Apps Script, acesse Acionadores e agende gerarRelatorioAuditoria semanalmente e executarFechamentoMensalManual no último dia do mês.'
                  },
                  {
                    step: 3,
                    title: 'Validação da Lista de E-mails de Notificação',
                    desc: 'Verifique se a constante CONFIG.EMAIL_NOTIFICACAO_RH contém os e-mails oficiais (rh.coari@empresa.com.br, coari.comara@gmail.com).'
                  },
                  {
                    step: 4,
                    title: 'Homologação do 1º Lote de Colaboradores via CSV',
                    desc: 'Utilize o modal de importação (menu Banco de Horas SPTF > Importar Colaboradores) para carregar o arquivo CSV das bases KO, BE e MN, validando o UPSERT.'
                  },
                  {
                    step: 5,
                    title: 'Backup Inicial & Ponto de Restauração',
                    desc: 'Gere um snapshot de segurança com a versão inicial homologada para garantia de integridade total.'
                  }
                ].map((item) => (
                  <div key={item.step} className={`flex items-start gap-3 p-3.5 rounded-lg border ${
                    isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                  }`}>
                    <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      {item.step}
                    </div>
                    <div className="space-y-1">
                      <h4 className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</h4>
                      <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 5: AUDITORIA & ALERTAS RH                                */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'etapa4_auditoria' && (
          <div className="p-6 space-y-6">
            <div className={`p-5 rounded-xl border space-y-3 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    Rotina de Auditoria de Riscos e Notificações por E-mail (Apps Script)
                  </h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                }`}>
                  COMPLIANCE SPTF
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                A função <code>gerarRelatorioAuditoria()</code> executa uma varredura automatizada nas tabelas e envia um relatório HTML por e-mail para o RH detectando 4 condições críticas:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className={`p-4 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 text-amber-500 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" /> 1. Atestado sem Link
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Lançamento ATESTADO_MEDICO sem URL do Google Drive gravada.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 text-red-500 font-bold text-xs">
                  <Clock className="w-4 h-4" /> 2. Passivo &gt; +40h
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Colaborador acumulando mais de 40h positivas. Risco de passivo trabalhista.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 text-purple-500 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" /> 3. Déficit &lt; -20h
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Saldo acumulado negativo abaixo de 20h. Requer intervenção do gestor.
                </p>
              </div>

              <div className={`p-4 rounded-xl border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex items-center gap-1.5 text-blue-500 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> 4. Duplicidades
                </div>
                <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Mais de um registro de ocorrência para o mesmo colaborador na mesma data.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 6: CSV UPSERT & GOOGLE DRIVE                             */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'etapa2_csv_drive' && (
          <div className="p-6 space-y-6">
            <div className={`p-5 rounded-xl border space-y-4 ${
              isDark ? 'bg-[#1E3252] border-[#335075]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    1. Módulo de Importação CSV com UPSERT em tb_colaboradores
                  </h3>
                </div>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  UPSERT AUTOMÁTICO
                </span>
              </div>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                O script lê qualquer arquivo <code>.csv</code> enviado pelo usuário no modal do Google Sheets, mapeia dinamicamente os cabeçalhos e aplica a regra de negócio do RH:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className={`p-3.5 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 text-blue-500 font-bold text-xs mb-1">
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Se a Matrícula JÁ EXISTIR (UPDATE)
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Atualiza Nome, Função, Sede, Status, Saldo Inicial, Email e Telefone preservando o ID original.
                  </p>
                </div>
                <div className={`p-3.5 rounded-lg border ${
                  isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
                }`}>
                  <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs mb-1">
                    <FileCheck2 className="w-3.5 h-3.5" /> Se a Matrícula NÃO EXISTIR (INSERT)
                  </div>
                  <p className={`text-[11px] ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                    Gera um novo ID único (ex: <code>COL_1094</code>), aplica o carimbo de data/hora atual e adiciona a nova linha.
                  </p>
                </div>
              </div>

              {/* Template CSV */}
              <div className={`p-4 rounded-lg border space-y-2 ${
                isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-white border-slate-200'
              }`}>
                <div className="flex justify-between items-center text-[11px]">
                  <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Formato Padrão do CSV de Entrada:</span>
                  <button
                    onClick={() => copyToClipboard(`Matricula,Nome,Funcao,Sede,Data_Admissao,Status,Saldo_Inicial,Email,Telefone
MAT-1091,Carlos Eduardo Silva,Técnico de Manutenção,KO,2022-03-15,Ativo,4.0,carlos.silva@empresa.com.br,(92) 98111-2233
MAT-1092,Ana Paula Medeiros,Engenheiro de Operações,BE,2021-08-01,Ativo,-2.0,ana.medeiros@empresa.com.br,(91) 98222-3344
MAT-1093,Roberto Santos,Operador de Produção,MN,2023-01-10,Ativo,0.0,roberto.santos@empresa.com.br,(92) 98333-4455`, 'csv_template')}
                    className="text-blue-500 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                  >
                    {copiedKey === 'csv_template' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'csv_template' ? 'Copiado!' : 'Copiar Modelo CSV'}
                  </button>
                </div>
                <pre className={`text-[11px] overflow-x-auto p-2.5 rounded border font-mono ${
                  isDark ? 'bg-[#16243D] text-emerald-400 border-[#243756]' : 'bg-slate-900 text-emerald-300 border-slate-700'
                }`}>
{`Matricula,Nome,Funcao,Sede,Data_Admissao,Status,Saldo_Inicial,Email,Telefone
MAT-1091,Carlos Eduardo Silva,Técnico de Manutenção,KO,2022-03-15,Ativo,4.0,carlos.silva@empresa.com.br,(92) 98111-2233
MAT-1092,Ana Paula Medeiros,Engenheiro de Operações,BE,2021-08-01,Ativo,-2.0,ana.medeiros@empresa.com.br,(91) 98222-3344
MAT-1093,Roberto Santos,Operador de Produção,MN,2023-01-10,Ativo,0.0,roberto.santos@empresa.com.br,(92) 98333-4455`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 7: CODE.GS                                               */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'code_gs' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Código Google Apps Script Completo (Code.gs)
                </h3>
                <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Rotinas de criação das tabelas, menu personalizado, UPSERT de CSV e auditoria.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(completeAppsScriptCode, 'codegs')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer"
              >
                {copiedKey === 'codegs' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'codegs' ? 'Copiado!' : 'Copiar Code.gs'}
              </button>
            </div>

            <div className={`p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed border ${
              isDark ? 'bg-[#0F1B33] text-emerald-400 border-[#243756]' : 'bg-slate-900 text-emerald-300 border-slate-800'
            }`}>
              <pre>{completeAppsScriptCode}</pre>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 8: HTML MODAL                                            */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'html_modal' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Arquivo HTML do Modal de Importação (ImportModal.html)
                </h3>
                <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  No Editor do Apps Script, crie o arquivo HTML com o nome <code>ImportModal</code>.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(htmlModalCode, 'modalhtml')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer"
              >
                {copiedKey === 'modalhtml' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'modalhtml' ? 'Copiado!' : 'Copiar HTML'}
              </button>
            </div>

            <div className={`p-4 rounded-xl font-mono text-xs overflow-x-auto max-h-[600px] leading-relaxed border ${
              isDark ? 'bg-[#0F1B33] text-indigo-300 border-[#243756]' : 'bg-slate-900 text-indigo-200 border-slate-800'
            }`}>
              <pre>{htmlModalCode}</pre>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* ABA 9: LOOKER SQL & BIGQUERY                                 */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'looker_sql' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className={`font-bold text-sm font-sans ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Fórmulas de Campos Calculados para o Looker Studio
                </h3>
                <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Copie e cole nos campos calculados da sua fonte conectada à <code>tb_lancamentos_diarios</code>.
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(`/* CAMPO 1: Horas_Ponderadas_SPTF */
CASE 
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) IN (0,1,2,3,4) THEN horas_brutas * 1.0
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) = 5 THEN horas_brutas * 1.5
  WHEN tipo_ocorrencia = 'TRABALHO' AND (WEEKDAY(data_registro) = 6 OR e_feriado = TRUE) THEN horas_brutas * 2.0
  WHEN tipo_ocorrencia IN ('F', 'D', 'FALTA_INJUSTIFICADA') THEN -8.0
  WHEN tipo_ocorrencia = 'COMPENSACAO' THEN -1.0 * horas_brutas
  ELSE 0.0
END

/* CAMPO 2: Saldo_Em_Dias_SPTF */
Horas_Ponderadas_SPTF / 8.0`, 'looker')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-bold transition-colors active:scale-[0.98] cursor-pointer"
              >
                {copiedKey === 'looker' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedKey === 'looker' ? 'Copiado!' : 'Copiar Fórmulas'}
              </button>
            </div>

            <div className={`p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed border ${
              isDark ? 'bg-[#0F1B33] text-teal-300 border-[#243756]' : 'bg-slate-900 text-teal-200 border-slate-800'
            }`}>
              <pre>{`/* CAMPO 1: Horas_Ponderadas_SPTF (Looker Studio) */
CASE 
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) IN (0,1,2,3,4) THEN horas_brutas * 1.0
  WHEN tipo_ocorrencia = 'TRABALHO' AND WEEKDAY(data_registro) = 5 THEN horas_brutas * 1.5
  WHEN tipo_ocorrencia = 'TRABALHO' AND (WEEKDAY(data_registro) = 6 OR e_feriado = TRUE) THEN horas_brutas * 2.0
  WHEN tipo_ocorrencia IN ('F', 'D', 'FALTA_INJUSTIFICADA') THEN -8.0
  WHEN tipo_ocorrencia = 'COMPENSACAO' THEN -1.0 * horas_brutas
  WHEN tipo_ocorrencia IN ('AT', 'ATESTADO_MEDICO', 'FE', 'FERIAS', 'LIC', 'LICENCA') THEN 0.0
  ELSE 0.0
END

/* CAMPO 2: Saldo_Em_Dias_SPTF */
Horas_Ponderadas_SPTF / 8.0`}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
