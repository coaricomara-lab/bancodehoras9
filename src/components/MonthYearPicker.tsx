import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  ChevronDown, 
  Check, 
  RotateCcw,
  Sparkles,
  X
} from 'lucide-react';

export interface MonthYearPickerProps {
  selectedMonth: number; // 0-11
  selectedYear: number;
  onChange: (month: number, year: number) => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  theme?: 'dark' | 'light';
  accentColor?: 'amber' | 'blue' | 'emerald';
  minYear?: number;
  maxYear?: number;
  className?: string;
}

export const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

export const MonthYearPicker: React.FC<MonthYearPickerProps> = ({
  selectedMonth,
  selectedYear,
  onChange,
  onPrevMonth,
  onNextMonth,
  theme = 'dark',
  accentColor = 'amber',
  minYear = 2020,
  maxYear = 2032,
  className = '',
}) => {
  const isDark = theme === 'dark';
  const [isOpen, setIsOpen] = useState(false);
  
  // Year navigated within the picker (allows browsing other years before selecting a month)
  const [viewYear, setViewYear] = useState<number>(selectedYear);
  const [isYearListOpen, setIsYearListOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const currentRealMonth = today.getMonth();
  const currentRealYear = today.getFullYear();

  // Sync viewYear when selectedYear changes from props
  useEffect(() => {
    setViewYear(selectedYear);
  }, [selectedYear, isOpen]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsYearListOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsYearListOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePrevYear = () => {
    setViewYear((prev) => Math.max(minYear, prev - 1));
  };

  const handleNextYear = () => {
    setViewYear((prev) => Math.min(maxYear, prev + 1));
  };

  const handleSelectMonth = (monthIndex: number) => {
    onChange(monthIndex, viewYear);
    setIsOpen(false);
    setIsYearListOpen(false);
  };

  const handleJumpToCurrent = () => {
    setViewYear(currentRealYear);
    onChange(currentRealMonth, currentRealYear);
    setIsOpen(false);
    setIsYearListOpen(false);
  };

  const handleInternalPrevMonth = () => {
    if (onPrevMonth) {
      onPrevMonth();
    } else {
      if (selectedMonth === 0) {
        onChange(11, selectedYear - 1);
      } else {
        onChange(selectedMonth - 1, selectedYear);
      }
    }
  };

  const handleInternalNextMonth = () => {
    if (onNextMonth) {
      onNextMonth();
    } else {
      if (selectedMonth === 11) {
        onChange(0, selectedYear + 1);
      } else {
        onChange(selectedMonth + 1, selectedYear);
      }
    }
  };

  // Color theme classes
  const accentClasses = {
    amber: {
      icon: 'text-amber-500',
      activeBtn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20 font-bold',
      currentBadge: 'border-amber-500/50 text-amber-400 bg-amber-500/10',
      chipActive: 'bg-amber-500/20 border-amber-500/50 text-amber-400 font-bold',
      ring: 'focus:ring-amber-500/30',
      headerBg: isDark ? 'bg-amber-950/20 border-amber-800/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-800',
    },
    blue: {
      icon: 'text-blue-500',
      activeBtn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/20 font-bold',
      currentBadge: 'border-blue-500/50 text-blue-400 bg-blue-500/10',
      chipActive: 'bg-blue-500/20 border-blue-500/50 text-blue-400 font-bold',
      ring: 'focus:ring-blue-500/30',
      headerBg: isDark ? 'bg-blue-950/20 border-blue-800/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-800',
    },
    emerald: {
      icon: 'text-emerald-500',
      activeBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 font-bold',
      currentBadge: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10',
      chipActive: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-bold',
      ring: 'focus:ring-emerald-500/30',
      headerBg: isDark ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800',
    }
  }[accentColor];

  // List of years for fast switcher
  const yearList = [];
  for (let y = minYear; y <= maxYear; y++) {
    yearList.push(y);
  }

  // Surrounding 5 years for instant chip shortcuts
  const shortcutYears = [viewYear - 2, viewYear - 1, viewYear, viewYear + 1, viewYear + 2].filter(
    y => y >= minYear && y <= maxYear
  );

  return (
    <div className={`relative inline-flex items-center gap-1 ${className}`} ref={containerRef}>
      {/* Botão Anterior */}
      <button
        type="button"
        onClick={handleInternalPrevMonth}
        className={`p-2 rounded-xl border transition-all active:scale-[0.96] cursor-pointer ${
          isDark 
            ? 'border-[#243756] hover:bg-[#0F1B33] text-gray-300 hover:text-white hover:border-[#335075]' 
            : 'border-slate-200 hover:bg-slate-100 text-slate-700 hover:border-slate-300'
        }`}
        title="Mês Anterior"
        aria-label="Mês Anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Botão Principal do Calendário (Trigger) */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsYearListOpen(false);
        }}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`group px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono flex items-center gap-2 transition-all active:scale-[0.98] cursor-pointer select-none ${
          isOpen
            ? isDark
              ? 'bg-[#0F1B33] border-amber-500 text-white shadow-md shadow-amber-500/10 ring-2 ring-amber-500/20'
              : 'bg-amber-50 border-amber-400 text-amber-900 shadow-md ring-2 ring-amber-400/20'
            : isDark 
              ? 'bg-[#0F1B33] border-[#243756] text-white hover:border-[#3b537c] hover:bg-[#12203b]' 
              : 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100 hover:border-slate-300'
        }`}
        title="Clique para abrir o calendário e selecionar Mês e Ano"
      >
        <Calendar className={`w-4 h-4 transition-transform group-hover:scale-110 ${accentClasses.icon}`} />
        <span className="tracking-wide">
          {MONTH_NAMES_FULL[selectedMonth].toUpperCase()} / {selectedYear}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 opacity-70 group-hover:opacity-100 ${isOpen ? 'rotate-180 text-amber-400' : ''}`} />
      </button>

      {/* Botão Próximo */}
      <button
        type="button"
        onClick={handleInternalNextMonth}
        className={`p-2 rounded-xl border transition-all active:scale-[0.96] cursor-pointer ${
          isDark 
            ? 'border-[#243756] hover:bg-[#0F1B33] text-gray-300 hover:text-white hover:border-[#335075]' 
            : 'border-slate-200 hover:bg-slate-100 text-slate-700 hover:border-slate-300'
        }`}
        title="Próximo Mês"
        aria-label="Próximo Mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* POPOVER DO CALENDÁRIO (SELETOR MÊS / ANO) */}
      {isOpen && (
        <div 
          className={`absolute top-full mt-2 left-0 sm:left-auto z-50 w-80 sm:w-96 rounded-2xl border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
            isDark 
              ? 'bg-[#16243D] border-[#243756] text-white shadow-black/60' 
              : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}
          role="dialog"
          aria-label="Seletor de Mês e Ano"
        >
          {/* Cabeçalho do Popover: Navegador de Ano */}
          <div className={`px-4 py-3 border-b flex items-center justify-between gap-2 select-none ${
            isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewYear((prev) => Math.max(minYear, prev - 5))}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? 'border-[#243756] hover:bg-[#16243D] text-gray-400 hover:text-white' : 'border-slate-200 hover:bg-slate-200 text-slate-600'
                }`}
                title="Voltar 5 Anos"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePrevYear}
                disabled={viewYear <= minYear}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-[#243756] hover:bg-[#16243D] text-gray-300 hover:text-white' : 'border-slate-200 hover:bg-slate-200 text-slate-700'
                }`}
                title="Ano Anterior"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Seletor Rápido de Ano */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsYearListOpen(!isYearListOpen)}
                className={`px-3 py-1 rounded-xl text-sm font-bold font-mono border flex items-center gap-1.5 transition-all cursor-pointer ${
                  isDark 
                    ? 'bg-[#16243D] border-[#243756] text-white hover:border-amber-500/60' 
                    : 'bg-white border-slate-300 text-slate-900 hover:border-amber-500'
                }`}
                title="Clique para ver lista de anos"
              >
                <span>{viewYear}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-amber-500 transition-transform ${isYearListOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Lista flutuante de Anos */}
              {isYearListOpen && (
                <div className={`absolute top-full mt-1.5 left-1/2 -translate-x-1/2 z-60 w-32 max-h-48 overflow-y-auto rounded-xl border shadow-xl p-1 grid grid-cols-1 gap-1 text-center font-mono text-xs ${
                  isDark ? 'bg-[#0B1426] border-[#335075] text-white' : 'bg-white border-slate-300 text-slate-900'
                }`}>
                  {yearList.map((y) => {
                    const isCur = y === viewYear;
                    const isRealYear = y === currentRealYear;
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setViewYear(y);
                          setIsYearListOpen(false);
                        }}
                        className={`py-1 px-2 rounded-lg font-bold transition-colors cursor-pointer flex items-center justify-between ${
                          isCur
                            ? 'bg-amber-600 text-white'
                            : isDark
                              ? 'hover:bg-[#16243D] text-gray-300 hover:text-white'
                              : 'hover:bg-slate-100 text-slate-700'
                        }`}
                      >
                        <span>{y}</span>
                        {isRealYear && <span className="text-[9px] opacity-70 font-sans">Atual</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNextYear}
                disabled={viewYear >= maxYear}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                  isDark ? 'border-[#243756] hover:bg-[#16243D] text-gray-300 hover:text-white' : 'border-slate-200 hover:bg-slate-200 text-slate-700'
                }`}
                title="Próximo Ano"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewYear((prev) => Math.min(maxYear, prev + 5))}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? 'border-[#243756] hover:bg-[#16243D] text-gray-400 hover:text-white' : 'border-slate-200 hover:bg-slate-200 text-slate-600'
                }`}
                title="Avançar 5 Anos"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Atalhos rápidos de Anos Próximos */}
          <div className={`px-4 py-2 border-b flex items-center justify-center gap-1.5 overflow-x-auto ${
            isDark ? 'bg-[#0B1426]/50 border-[#243756]' : 'bg-slate-50/70 border-slate-200'
          }`}>
            <span className={`text-[10px] font-semibold uppercase tracking-wider mr-1 ${isDark ? 'text-gray-400' : 'text-slate-500'}`}>
              Ano:
            </span>
            {shortcutYears.map((y) => {
              const isSelected = y === viewYear;
              return (
                <button
                  key={y}
                  type="button"
                  onClick={() => setViewYear(y)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono transition-all cursor-pointer ${
                    isSelected
                      ? `${accentClasses.chipActive} font-bold shadow-xs`
                      : isDark
                        ? 'text-gray-400 hover:text-white hover:bg-[#16243D]'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  }`}
                >
                  {y}
                </button>
              );
            })}
          </div>

          {/* Grade dos 12 Meses (3 colunas x 4 linhas) */}
          <div className="p-3.5 grid grid-cols-3 gap-2">
            {MONTH_NAMES_FULL.map((name, index) => {
              const isSelected = selectedMonth === index && selectedYear === viewYear;
              const isCurrentRealMonth = index === currentRealMonth && viewYear === currentRealYear;
              const monthCode = String(index + 1).padStart(2, '0');

              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleSelectMonth(index)}
                  className={`group relative p-2.5 rounded-xl border text-left transition-all active:scale-[0.96] cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? accentClasses.activeBtn
                      : isDark
                        ? 'bg-[#0F1B33] border-[#243756] hover:border-amber-500/50 hover:bg-[#192b4a] text-[#E2E8F0]'
                        : 'bg-slate-50 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-[10px] font-mono font-bold ${
                      isSelected ? 'text-white/80' : isDark ? 'text-gray-400 group-hover:text-amber-400' : 'text-slate-400 group-hover:text-amber-600'
                    }`}>
                      {monthCode}
                    </span>
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-white" />
                    ) : isCurrentRealMonth ? (
                      <span className={`text-[9px] px-1 py-0.2 rounded-sm font-semibold border ${accentClasses.currentBadge}`}>
                        Atual
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1">
                    <div className="text-xs font-bold leading-tight truncate">
                      {name}
                    </div>
                    <div className={`text-[10px] font-mono ${
                      isSelected ? 'text-white/70' : isDark ? 'text-gray-400' : 'text-slate-500'
                    }`}>
                      {MONTH_NAMES_SHORT[index]} / {viewYear}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Rodapé: Ações Rápidas (Ir para Mês Atual & Fechar) */}
          <div className={`px-4 py-2.5 border-t flex items-center justify-between gap-2 select-none ${
            isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={handleJumpToCurrent}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.97] cursor-pointer border ${
                selectedMonth === currentRealMonth && selectedYear === currentRealYear
                  ? isDark
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-amber-100 text-amber-800 border-amber-300'
                  : isDark
                    ? 'bg-[#16243D] text-gray-300 hover:text-white border-[#243756] hover:bg-[#203456]'
                    : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-100'
              }`}
              title={`Ir para ${MONTH_NAMES_FULL[currentRealMonth]} de ${currentRealYear}`}
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
              <span>Hoje ({MONTH_NAMES_SHORT[currentRealMonth]}/{currentRealYear})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                setIsYearListOpen(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                isDark ? 'text-gray-400 hover:text-white hover:bg-[#16243D]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
              }`}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthYearPicker;
