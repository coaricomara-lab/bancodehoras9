import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share2, PlusSquare, X, CheckCircle2, Laptop } from 'lucide-react';

interface PWAInstallButtonProps {
  variant?: 'navbar' | 'floating' | 'card' | 'menu-item';
  theme?: 'dark' | 'light';
  className?: string;
  onInstalled?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'navbar',
  theme = 'dark',
  className = '',
  onInstalled,
}) => {
  const { isInstallable, isInstalled, isStandalone, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const isDark = theme === 'dark';

  // Se o app já está rodando instalado em modo standalone, oculta o botão
  if (isStandalone || isInstalled) {
    return null;
  }

  // Se o navegador não for compatível com instalação direta nem for iOS, não exibe
  if (!isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (isInstallable) {
      setIsInstalling(true);
      const success = await install();
      setIsInstalling(false);
      if (success && onInstalled) {
        onInstalled();
      }
    }
  };

  // Renderização do Modal de Instruções para iOS (Safari)
  const renderIOSModal = () => {
    if (!showIOSModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
        <div 
          className={`w-full max-w-md rounded-2xl p-6 shadow-2xl border transition-all ${
            isDark ? 'bg-[#16243D] border-[#243756] text-[#E2E8F0]' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-inherit">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold">Instalar App COMARA</h3>
                <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  No iPhone / iPad (Safari)
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'hover:bg-[#243756] text-[#94A3B8]' : 'hover:bg-slate-100 text-slate-500'
              }`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Passos */}
          <div className="my-5 space-y-3.5 text-sm">
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                1
              </div>
              <div className="flex-1">
                <p className="font-semibold text-xs flex items-center gap-1.5">
                  <span>Toque no botão Compartilhar</span>
                  <Share2 className="w-3.5 h-3.5 text-blue-400 inline" />
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Localizado na barra inferior do Safari (ícone de quadrado com seta para cima).
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                2
              </div>
              <div className="flex-1">
                <p className="font-semibold text-xs flex items-center gap-1.5">
                  <span>Selecione "Adicionar à Tela de Início"</span>
                  <PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" />
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Role as opções do menu do Safari até encontrar o item correspondente.
                </p>
              </div>
            </div>

            <div className={`flex items-start gap-3 p-3 rounded-xl border ${
              isDark ? 'bg-[#0F1B33] border-[#243756]' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                3
              </div>
              <div className="flex-1">
                <p className="font-semibold text-xs flex items-center gap-1.5">
                  <span>Confirme em "Adicionar"</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 inline" />
                </p>
                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  No canto superior direito para fixar o atalho em tela cheia.
                </p>
              </div>
            </div>
          </div>

          {/* Botão de Fechar */}
          <button
            onClick={() => setShowIOSModal(false)}
            className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md active:scale-[0.98] transition-all cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  };

  // Variante: Menu Item (Para dentro de dropdowns de configurações/perfil)
  if (variant === 'menu-item') {
    return (
      <>
        <button
          onClick={handleInstallClick}
          disabled={isInstalling}
          className={`w-full px-3.5 py-2.5 text-xs text-left flex items-center gap-2.5 transition-colors active:scale-[0.98] cursor-pointer ${
            isDark ? 'hover:bg-[#243756] text-[#E2E8F0]' : 'hover:bg-blue-50/70 text-slate-800'
          } ${className}`}
        >
          <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
            <Download className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold flex items-center justify-between">
              <span>Instalar Aplicativo</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20 text-blue-300">
                PWA
              </span>
            </div>
            <span className={`text-[10px] block ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Abrir em tela cheia na área de trabalho ou celular
            </span>
          </div>
        </button>
        {renderIOSModal()}
      </>
    );
  }

  // Variante: Card Informativo (Para Settings ou Landing View)
  if (variant === 'card') {
    return (
      <>
        <div className={`p-4 rounded-2xl border transition-all ${
          isDark ? 'bg-[#16243D] border-[#243756]' : 'bg-white border-slate-200'
        } ${className}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20 mt-0.5">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  Aplicativo Instalável (PWA)
                </h4>
                <p className={`text-xs mt-0.5 leading-relaxed ${isDark ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                  Instale o Sistema COMARA na sua Área de Trabalho ou Celular para inicialização instantânea e tela cheia.
                </p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              disabled={isInstalling}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 active:scale-[0.98] transition-all cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isInstalling ? 'Instalando...' : 'Instalar App'}</span>
            </button>
          </div>
        </div>
        {renderIOSModal()}
      </>
    );
  }

  // Variante Padrão: Navbar (Botão discreto no header)
  return (
    <>
      <button
        id="btn-pwa-install-navbar"
        onClick={handleInstallClick}
        disabled={isInstalling}
        title={isIOS ? 'Como instalar no iPhone/iPad' : 'Instalar Aplicativo COMARA na Área de Trabalho ou Celular'}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-[0.98] border cursor-pointer ${
          isDark
            ? 'bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 hover:text-blue-200 border-blue-700/50 shadow-xs'
            : 'bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 border-blue-200 shadow-xs'
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5 text-blue-400" />
        <span className="hidden sm:inline">Instalar App</span>
      </button>
      {renderIOSModal()}
    </>
  );
};
