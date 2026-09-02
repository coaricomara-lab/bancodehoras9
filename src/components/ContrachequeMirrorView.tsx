import React, { useRef } from 'react';
import { PaystubRecord } from '../types';
import { ComaraLogo } from './ComaraLogo';
import { useInstitution } from '../contexts/InstitutionContext';
import { 
  Printer, 
  ShieldCheck, 
  CheckCircle2,
  Lock,
  Building2
} from 'lucide-react';

interface ContrachequeMirrorViewProps {
  paystub: PaystubRecord;
  theme?: 'dark' | 'light';
  onClose?: () => void;
  showCloseButton?: boolean;
}

export const ContrachequeMirrorView: React.FC<ContrachequeMirrorViewProps> = ({
  paystub,
  theme = 'dark',
  onClose,
  showCloseButton = false,
}) => {
  const isDark = theme === 'dark';
  const printRef = useRef<HTMLDivElement>(null);

  // Carregar configurações da instituição (com fallback seguro)
  let instSettings: any = null;
  let instSedes: any[] = [];
  try {
    const inst = useInstitution();
    instSettings = inst?.settings;
    instSedes = inst?.sedes || [];
  } catch {
    // Fallback caso renderizado fora do provider
  }

  const formatCurrency = (val: number | undefined) => {
    return (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handlePrint = () => {
    window.print();
  };

  // Resolução do Nome Completo do Canteiro
  const getCanteiroNome = () => {
    const raw = (paystub.sede || '').trim().toUpperCase();
    if (!raw || raw === 'KO' || raw === 'KO-DL' || raw.includes('COARI')) {
      return 'Canteiro de Obras Coari (KO)';
    }
    const found = instSedes.find((s: any) => s.codigo?.toUpperCase() === raw || s.id?.toUpperCase() === raw);
    if (found) {
      return `${found.nome} (${found.codigo})`;
    }
    if (raw === 'MN' || raw.includes('MANAUS')) return 'Destacamento de Apoio Manaus (MN)';
    if (raw === 'BE' || raw.includes('BELÉM') || raw.includes('BELEM')) return 'Sede Belém (BE)';
    if (raw === 'SJ' || raw.includes('SÃO GABRIEL')) return 'Destacamento São Gabriel da Cachoeira (SJ)';
    if (raw === 'IA' || raw.includes('IAUARETÊ')) return 'Destacamento Iauaretê (IA)';
    return paystub.sede;
  };

  const canteiroFormatado = getCanteiroNome();
  const cnpjFormatado = instSettings?.cnpj || '00.394.429/0090-86';
  const enderecoFormatado = instSettings?.endereco || 'Av. Pedro Álvares Cabral, 7115 - Sacramenta, Belém - PA, 66610-020';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Barra de Ações Superior (Não sai na impressão) */}
      <div className="w-full max-w-4xl flex items-center justify-between gap-3 mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-xs font-bold border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Documento Oficial COMARA • Espelho Digital</span>
          </span>
          <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
            Competência: <strong className={isDark ? 'text-white' : 'text-slate-800'}>{paystub.periodo || paystub.mesAno}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/20 active:scale-98 cursor-pointer"
            title="Imprimir Contracheque ou Salvar em PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Baixar / Imprimir PDF</span>
          </button>

          {showCloseButton && onClose && (
            <button
              onClick={onClose}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors ${
                isDark ? 'bg-slate-800 hover:bg-slate-700 text-gray-300 border-slate-700' : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
              }`}
            >
              Fechar
            </button>
          )}
        </div>
      </div>

      {/* Folha do Contracheque (Layout Oficial COMARA) */}
      <div 
        ref={printRef}
        id={`contracheque-${paystub.matricula}-${paystub.mesAno}`}
        className={`w-full max-w-4xl rounded-2xl p-6 sm:p-8 border shadow-xl print:shadow-none print:border-slate-300 print:rounded-none print:p-4 print:max-w-none print:w-full print:bg-white print:text-black ${
          isDark ? 'bg-[#16243D] border-[#243756] text-gray-100' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* 1. Cabeçalho Oficial - Centralizado com os 4 itens */}
        <div className="border-b-2 border-slate-300/60 pb-5 mb-5">
          <div className="flex flex-col items-center justify-center text-center">
            {/* Brasão Oficial Centralizado */}
            <div className="flex items-center justify-center mb-2">
              <ComaraLogo size="md" />
            </div>

            {/* Os 4 itens centralizados rigorosamente estruturados */}
            <div className="space-y-0.5 text-center">
              <h1 className="text-sm sm:text-base font-bold uppercase tracking-wider text-slate-900 dark:text-white print:text-black">
                Comando da Aeronáutica
              </h1>
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-wide text-slate-900 dark:text-white print:text-black">
                COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA
              </h2>
              <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 print:text-blue-900">
                COMARA
              </h3>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 print:text-slate-700 pt-0.5">
                CANTEIRO: {canteiroFormatado}
              </p>
            </div>

            {/* Demonstrativo de Pagamento Mensal */}
            <div className="mt-3.5 bg-blue-500/10 dark:bg-blue-950/30 print:bg-slate-100 border border-blue-500/20 print:border-slate-300 px-5 py-2 rounded-xl text-center">
              <span className="text-[10px] font-bold tracking-wider uppercase text-blue-600 dark:text-blue-400 print:text-slate-700 block">
                DEMONSTRATIVO DE PAGAMENTO MENSAL
              </span>
              <span className="text-base sm:text-lg font-black font-mono tracking-tight text-blue-600 dark:text-blue-300 print:text-blue-950">
                {paystub.periodo || `${String(paystub.mes).padStart(2, '0')}/${paystub.ano}`}
              </span>
              {paystub.dataInicio && paystub.dataFim && (
                <span className={`block text-[10px] ${isDark ? 'text-gray-400' : 'text-slate-500'} print:text-slate-600`}>
                  {paystub.dataInicio} a {paystub.dataFim}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 2. Bloco de Identificação do Servidor / Colaborador */}
        <div className={`rounded-xl p-4 mb-5 border grid grid-cols-1 sm:grid-cols-12 gap-3 text-xs ${
          isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-200'
        } print:bg-white print:border-slate-300`}>
          <div className="sm:col-span-2">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Matrícula
            </span>
            <span className="font-mono font-black text-sm text-blue-500 print:text-black">
              {paystub.matricula}
            </span>
          </div>

          <div className="sm:col-span-6">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Nome do Servidor / Colaborador
            </span>
            <span className="font-bold text-sm tracking-wide">
              {paystub.nome}
            </span>
          </div>

          <div className="sm:col-span-4">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Cargo / Função
            </span>
            <span className="font-semibold text-xs text-amber-500 print:text-black">
              {paystub.cargo}
            </span>
          </div>

          {/* Segunda linha de detalhes */}
          <div className="sm:col-span-3">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Lotação / Canteiro
            </span>
            <span className="font-medium">
              {canteiroFormatado}
            </span>
          </div>

          <div className="sm:col-span-3">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              CPF
            </span>
            <span className="font-mono">
              {paystub.cpf || '***.***.***-**'}
            </span>
          </div>

          <div className="sm:col-span-6">
            <span className={`block text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Dados Bancários (Crédito em Conta)
            </span>
            <span className="font-mono text-[11px]">
              {paystub.banco || 'BANCO DO BRASIL'} • Ag: {paystub.agencia || '2345-6'} • CC: {paystub.conta || '******-*'}
            </span>
          </div>
        </div>

        {/* 3. Tabela de Vencimentos e Descontos */}
        <div className="overflow-x-auto mb-5 rounded-xl border border-slate-700/40 print:border-slate-300">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isDark ? 'bg-slate-800/80 text-gray-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-300'} print:bg-slate-100 print:text-black font-bold uppercase text-[10px] tracking-wider`}>
                <th className="py-2.5 px-3 w-16 text-center">Cód.</th>
                <th className="py-2.5 px-3">Descrição da Rubrica</th>
                <th className="py-2.5 px-3 w-20 text-center">Ref.</th>
                <th className="py-2.5 px-3 w-28 text-right text-emerald-600 print:text-black">Vencimentos (R$)</th>
                <th className="py-2.5 px-3 w-28 text-right text-red-500 print:text-black">Descontos (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40 print:divide-slate-200">
              {paystub.rubricas && paystub.rubricas.length > 0 ? (
                paystub.rubricas.map((rub, idx) => (
                  <tr 
                    key={`${rub.codigo}-${idx}`}
                    className={`transition-colors ${
                      idx % 2 === 0 
                        ? (isDark ? 'bg-transparent' : 'bg-white') 
                        : (isDark ? 'bg-slate-900/30' : 'bg-slate-50/50')
                    } print:bg-white`}
                  >
                    <td className="py-2 px-3 font-mono font-bold text-center text-slate-400 print:text-slate-600">
                      {rub.codigo}
                    </td>
                    <td className="py-2 px-3 font-medium">
                      {rub.descricao}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[11px] text-slate-400 print:text-slate-600">
                      {rub.referencia || '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-500 print:text-black">
                      {rub.provento > 0 ? formatCurrency(rub.provento) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-semibold text-red-400 print:text-black">
                      {rub.desconto > 0 ? formatCurrency(rub.desconto) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                    Nenhuma rubrica discriminada neste período.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Quadro de Totais e Valor Líquido (Destaque Verde / Azul) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          } print:bg-white print:border-slate-300 print:text-black`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 print:text-slate-600">
              Total de Vencimentos (Bruto)
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-emerald-400 print:text-black mt-1">
              R$ {formatCurrency(paystub.totalProventos)}
            </span>
          </div>

          <div className={`p-4 rounded-xl border flex flex-col justify-between ${
            isDark ? 'bg-red-950/20 border-red-800/40 text-red-300' : 'bg-red-50 border-red-200 text-red-900'
          } print:bg-white print:border-slate-300 print:text-black`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-red-400 print:text-slate-600">
              Total de Descontos
            </span>
            <span className="text-lg sm:text-xl font-mono font-black text-red-400 print:text-black mt-1">
              R$ {formatCurrency(paystub.totalDescontos)}
            </span>
          </div>

          <div className={`p-4 rounded-xl border-2 shadow-lg flex flex-col justify-between ${
            isDark 
              ? 'bg-gradient-to-br from-blue-900/40 via-blue-950/60 to-slate-900 border-blue-500/50 text-white' 
              : 'bg-gradient-to-br from-blue-50 via-blue-100 to-white border-blue-600 text-blue-950'
          } print:bg-slate-100 print:border-slate-400 print:text-black`}>
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 print:text-slate-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 print:text-slate-700" />
              VALOR LÍQUIDO A RECEBER
            </span>
            <span className="text-xl sm:text-2xl font-mono font-black text-blue-400 print:text-blue-950 mt-1">
              R$ {formatCurrency(paystub.valorLiquido)}
            </span>
          </div>
        </div>

        {/* 5. Bases de Cálculo da Previdência, FGTS e IRRF */}
        <div className={`rounded-xl p-3.5 border grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-center text-xs mb-5 ${
          isDark ? 'bg-slate-900/40 border-slate-800/80 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        } print:bg-white print:border-slate-300 print:text-black`}>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Salário Base</span>
            <span className="font-mono font-semibold text-[11px]">R$ {formatCurrency(paystub.salarioBase || paystub.totalProventos)}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Base Cálc. INSS</span>
            <span className="font-mono font-semibold text-[11px]">R$ {formatCurrency(paystub.baseInss || paystub.totalProventos)}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Base Cálc. FGTS</span>
            <span className="font-mono font-semibold text-[11px]">R$ {formatCurrency(paystub.baseFgts || paystub.totalProventos)}</span>
          </div>
          <div>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">FGTS do Mês (8%)</span>
            <span className="font-mono font-semibold text-[11px] text-amber-500 print:text-black">R$ {formatCurrency(paystub.fgtsMes || (paystub.totalProventos * 0.08))}</span>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400 print:text-slate-600">Base Cálc. IRRF</span>
            <span className="font-mono font-semibold text-[11px]">R$ {formatCurrency(paystub.baseIrrf || Math.max(0, paystub.totalProventos - 500))}</span>
          </div>
        </div>

        {/* 6. No lugar das assinaturas: Dados Institucionais Completos + CNPJ + Endereço */}
        <div className={`mt-5 pt-4 border-t-2 border-slate-300/60 rounded-xl p-4 border text-xs ${
          isDark ? 'bg-slate-900/50 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
        } print:bg-white print:border-slate-300 print:text-black`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            {/* Bloco Institucional Repetido com CNPJ e Endereço */}
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase text-slate-900 dark:text-white print:text-black">
                Comando da Aeronáutica
              </p>
              <p className="text-xs font-bold uppercase text-slate-900 dark:text-white print:text-black">
                COMISSÃO DE AEROPORTOS DA REGIÃO AMAZÔNICA
              </p>
              <p className="text-xs font-bold uppercase text-blue-600 dark:text-blue-400 print:text-blue-900">
                COMARA
              </p>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 print:text-slate-700">
                CANTEIRO: {canteiroFormatado}
              </p>
              <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 print:text-slate-700">
                CNPJ: {cnpjFormatado}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 print:text-slate-700">
                {enderecoFormatado}
              </p>
            </div>

            {/* Bloco de Autenticidade e Emissão Eletrônica */}
            <div className="flex flex-col sm:items-end justify-between h-full space-y-2 text-left sm:text-right">
              <div className="flex items-center gap-1.5 sm:justify-end text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                <Lock className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span>Documento emitido eletronicamente em conformidade com a LGPD (Lei nº 13.709/2018).</span>
              </div>
              <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                Chave de Autenticação: <span className="font-bold text-slate-900 dark:text-slate-200 print:text-black">{paystub.id}</span>
              </div>
              <div className="text-[10px] text-slate-400 print:text-slate-500">
                Emissão Oficial • Espelho Digital COMARA
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

