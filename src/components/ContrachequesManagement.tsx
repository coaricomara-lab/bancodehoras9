import React, { useState, useMemo } from 'react';
import { Employee, PaystubRecord, AdminRole, ConstructionSite } from '../types';
import { ContrachequeMirrorView } from './ContrachequeMirrorView';
import { ImportContrachequeModal } from './ImportContrachequeModal';
import { normalizeMatricula } from '../utils/pdfParser';
import { InfoTooltip } from './InfoTooltip';
import { 
  FileText, 
  UploadCloud, 
  Search, 
  Filter, 
  Printer, 
  Trash2, 
  Eye, 
  Calendar, 
  Building2, 
  User, 
  DollarSign, 
  CheckCircle2, 
  Download, 
  ShieldCheck, 
  ArrowLeft,
  Sparkles,
  Layers
} from 'lucide-react';

interface ContrachequesManagementProps {
  employees: Employee[];
  paystubs: PaystubRecord[];
  constructionSites?: ConstructionSite[];
  onSaveBatchPaystubs: (paystubs: PaystubRecord[]) => Promise<void>;
  onSaveEmployees?: (employees: Employee[]) => Promise<void>;
  onDeletePaystub: (id: string) => Promise<void>;
  theme?: 'dark' | 'light';
  currentUserEmail?: string;
  userRole?: AdminRole | string;
}

export const ContrachequesManagement: React.FC<ContrachequesManagementProps> = ({
  employees,
  paystubs,
  constructionSites = [],
  onSaveBatchPaystubs,
  onSaveEmployees,
  onDeletePaystub,
  theme = 'dark',
  currentUserEmail = 'coari.comara@gmail.com',
  userRole = 'SUPER_ADMIN',
}) => {
  const isDark = theme === 'dark';

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [selectedPaystubForView, setSelectedPaystubForView] = useState<PaystubRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMesAno, setSelectedMesAno] = useState<string>('TODOS');
  const [selectedSede, setSelectedSede] = useState<string>('TODAS');

  // Obter lista única de competências (mesAno) disponíveis
  const availableMesAnos = useMemo(() => {
    const set = new Set<string>();
    paystubs.forEach(p => {
      if (p.mesAno) set.add(p.mesAno);
      else if (p.periodo) set.add(p.periodo.replace('/', '-'));
    });
    return Array.from(set).sort().reverse();
  }, [paystubs]);

  // Filtros aplicados
  const filteredPaystubs = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    const normTerm = normalizeMatricula(term);

    return paystubs.filter((p) => {
      const matchSearch =
        !term ||
        p.nome.toLowerCase().includes(term) ||
        p.matricula.toLowerCase().includes(term) ||
        normalizeMatricula(p.matricula).includes(normTerm) ||
        p.cargo.toLowerCase().includes(term);

      const matchMes = selectedMesAno === 'TODOS' || p.mesAno === selectedMesAno;
      const matchSede = selectedSede === 'TODAS' || p.sede === selectedSede || (selectedSede === 'KO' && p.sede.startsWith('KO'));

      return matchSearch && matchMes && matchSede;
    });
  }, [paystubs, searchTerm, selectedMesAno, selectedSede]);

  // Estatísticas Consolidadas
  const totalBruto = useMemo(() => filteredPaystubs.reduce((acc, p) => acc + p.totalProventos, 0), [filteredPaystubs]);
  const totalDescontos = useMemo(() => filteredPaystubs.reduce((acc, p) => acc + p.totalDescontos, 0), [filteredPaystubs]);
  const totalLiquido = useMemo(() => filteredPaystubs.reduce((acc, p) => acc + p.valorLiquido, 0), [filteredPaystubs]);

  // Se o usuário estiver visualizando o espelho digital de um contracheque
  if (selectedPaystubForView) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPaystubForView(null)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors ${
              isDark ? 'bg-slate-800 hover:bg-slate-700 text-gray-200 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar para Lista de Contracheques</span>
          </button>
        </div>

        <ContrachequeMirrorView
          paystub={selectedPaystubForView}
          theme={theme}
          onClose={() => setSelectedPaystubForView(null)}
          showCloseButton
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
              <FileText className="w-4 h-4" />
            </div>
            <span>Contracheques Digitais da COMARA</span>
          </h2>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
                Folha de pagamento e espelhos <InfoTooltip theme={isDark ? 'dark' : 'light'} content="Gestão de Folha de Pagamento, importação de PDF concatenado e emissão de espelhos digitais" />
              </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Importar Folha (PDF)</span>
          </button>
        </div>
      </div>

      {/* Cards de Métricas da Folha */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fichas Cadastradas</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-500">{filteredPaystubs.length.toLocaleString('pt-BR')}</p>
          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            {availableMesAnos.length} competências importadas
          </span>
        </div>

        <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Bruto</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-500">
            R$ {totalBruto.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            Soma dos vencimentos
          </span>
        </div>

        <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Descontos</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-red-400">
            R$ {totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            INSS, IRRF e outros
          </span>
        </div>

        <div className={`p-4 rounded-2xl border transition-colors ${isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Líquido</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black font-mono text-blue-400">
            R$ {totalLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-slate-400'}`}>
            Valor efetivamente pago
          </span>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar matrícula, servidor, cargo..."
            className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs border ${
              isDark ? 'bg-slate-900 border-slate-700 text-white placeholder-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Filtro Competência */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium hidden sm:inline">Mês/Ano:</span>
            <select
              value={selectedMesAno}
              onChange={(e) => setSelectedMesAno(e.target.value)}
              className={`py-2 px-3 rounded-xl text-xs border font-mono ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="TODOS">Todas as Competências</option>
              {availableMesAnos.map((ma) => (
                <option key={ma} value={ma}>{ma.replace('-', '/')}</option>
              ))}
            </select>
          </div>

          {/* Filtro Sede */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium hidden sm:inline">Sede:</span>
            <select
              value={selectedSede}
              onChange={(e) => setSelectedSede(e.target.value)}
              className={`py-2 px-3 rounded-xl text-xs border font-mono ${
                isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              <option value="TODAS">Todas as Sedes</option>
              <option value="KO-DL">KO-DL (Coari)</option>
              <option value="BE">BE (Belém)</option>
              <option value="MN">MN (Manaus)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Contracheques */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm ${
        isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
      }`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${
                isDark ? 'bg-slate-900/60 text-gray-300 border-slate-800' : 'bg-slate-50 text-slate-700 border-slate-200'
              } font-bold uppercase text-[10px] tracking-wider`}>
                <th className="py-3 px-4">Matrícula</th>
                <th className="py-3 px-4">Nome do Servidor</th>
                <th className="py-3 px-4">Cargo / Função</th>
                <th className="py-3 px-4 text-center">Sede</th>
                <th className="py-3 px-4 text-center">Competência</th>
                <th className="py-3 px-4 text-right">Salário Base</th>
                <th className="py-3 px-4 text-right">Vencimentos</th>
                <th className="py-3 px-4 text-right">Descontos</th>
                <th className="py-3 px-4 text-right">Líquido a Receber</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredPaystubs.length > 0 ? (
                filteredPaystubs.map((p) => (
                  <tr 
                    key={p.id} 
                    className={`transition-colors ${
                      isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-blue-500">
                      {p.matricula}
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {p.nome}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {p.cargo}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px] border border-slate-700">
                        {p.sede}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-mono font-medium">
                      {p.periodo || p.mesAno}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-slate-300">
                      R$ {p.salarioBase ? p.salarioBase.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-500">
                      R$ {p.totalProventos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold text-red-400">
                      R$ {p.totalDescontos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-black text-blue-400">
                      R$ {p.valorLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setSelectedPaystubForView(p)}
                          className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors active:scale-[0.98] cursor-pointer"
                          title="Visualizar Espelho Digital"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPaystubForView(p);
                            setTimeout(() => window.print(), 300);
                          }}
                          className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors active:scale-[0.98] cursor-pointer"
                          title="Imprimir / Baixar PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeletePaystub(p.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors active:scale-[0.98] cursor-pointer"
                          title="Excluir Contracheque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-500 stroke-1" />
                      <p className="font-semibold text-sm">Nenhum contracheque encontrado com os filtros atuais.</p>
                      <p className="text-xs text-slate-500">Importe a folha oficial (PDF) para visualizar.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Importação de PDF */}
      <ImportContrachequeModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportBatch={onSaveBatchPaystubs}
        onSaveEmployees={onSaveEmployees}
        employees={employees}
        constructionSites={constructionSites}
        theme={theme}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
