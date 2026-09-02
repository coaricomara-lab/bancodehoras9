import React, { useRef, useState } from 'react';
import { InstitutionSettings } from '../../types/institutionConfig';
import { CardSection, FormInput } from './FormControls';
import { PWAInstallButton } from '../PWAInstallButton';
import { 
  Building, 
  Tag, 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  UploadCloud, 
  Trash2, 
  Image as ImageIcon,
  AlertCircle,
  FileCheck,
  Smartphone
} from 'lucide-react';

interface IdentificacaoTabProps {
  settings: InstitutionSettings;
  onChange: (updated: Partial<InstitutionSettings>) => void;
  errors: Record<string, string>;
  isDark: boolean;
}

export const IdentificacaoTab: React.FC<IdentificacaoTabProps> = ({
  settings,
  onChange,
  errors,
  isDark,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreviewError, setLogoPreviewError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validações de arquivo
    if (!file.type.startsWith('image/')) {
      setLogoPreviewError('Selecione um arquivo de imagem válido (PNG, JPG, WEBP ou SVG).');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setLogoPreviewError('A imagem deve ter no máximo 2MB para garantir alta performance.');
      return;
    }

    setLogoPreviewError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      onChange({ logoUrl: base64 });
    };
    reader.onerror = () => {
      setLogoPreviewError('Falha ao processar o arquivo de imagem selecionado.');
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    onChange({ logoUrl: '/comara-logo.png' });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setLogoPreviewError(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. SEÇÃO: IDENTIFICAÇÃO INSTITUCIONAL */}
      <CardSection
        title="Dados Principais da Organização Militar / Instituição"
        description="Essas informações serão exibidas nos cabeçalhos oficiais, dispensas de SPTF, relatórios e espelhos de banco de horas."
        icon={Building}
        isDark={isDark}
        badge="Oficial"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nome Completo da Instituição / OM"
            value={settings.nomeInstituicao}
            onChange={(e) => onChange({ nomeInstituicao: e.target.value })}
            placeholder="Ex: Comissão de Aeroportos da Região Amazônica"
            error={errors.nomeInstituicao}
            required
            icon={Building}
            isDark={isDark}
          />

          <FormInput
            label="Sigla Oficial da OM"
            value={settings.siglaInstituicao}
            onChange={(e) => onChange({ siglaInstituicao: e.target.value.toUpperCase() })}
            placeholder="Ex: COMARA, CLA, BACG, EPCAR..."
            error={errors.siglaInstituicao}
            required
            icon={Tag}
            isDark={isDark}
          />

          <FormInput
            label="Subordinação / Comando Superior"
            value={settings.subordinacao || ''}
            onChange={(e) => onChange({ subordinacao: e.target.value })}
            placeholder="Ex: Comando da Aeronáutica • Força Aérea Brasileira"
            isDark={isDark}
            helperText="Exibido no subtítulo dos cabeçalhos timbrados de impressão."
          />

          <FormInput
            label="CNPJ Institucional (Opcional)"
            value={settings.cnpj || ''}
            onChange={(e) => onChange({ cnpj: e.target.value })}
            placeholder="00.000.000/0000-00"
            isDark={isDark}
          />
        </div>
      </CardSection>

      {/* 2. SEÇÃO: LOGOTIPO & IDENTIDADE VISUAL */}
      <CardSection
        title="Logotipo e Brasão Oficial"
        description="Faça upload do brasão/logo da OM. Recomendado formato PNG com fundo transparente ou JPG nítido."
        icon={ImageIcon}
        isDark={isDark}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Box de Preview */}
          <div className="relative group shrink-0">
            <div className={`w-32 h-32 rounded-2xl border-2 flex items-center justify-center p-3 transition-all ${
              isDark
                ? 'bg-[#0F1B33] border-[#335075] shadow-inner'
                : 'bg-slate-50 border-slate-200 shadow-xs'
            }`}>
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Logotipo da Instituição"
                  className="max-w-full max-h-full object-contain filter drop-shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/comara-logo.png';
                  }}
                />
              ) : (
                <div className={`text-center p-2 ${isDark ? 'text-[#94A3B8]' : 'text-slate-400'}`}>
                  <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                  <span className="text-[10px] block font-mono">Sem Logo</span>
                </div>
              )}
            </div>
            {settings.logoUrl && (
              <span className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white bg-blue-600 shadow-md ${
                isDark ? 'border-[#16243D]' : 'border-white'
              } border-2`}>
                <FileCheck className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          {/* Ações de Upload */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png, image/jpeg, image/webp, image/svg+xml"
                onChange={handleFileUpload}
                className="hidden"
                id="institution-logo-upload"
              />
              <label
                htmlFor="institution-logo-upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Escolher Nova Imagem...</span>
              </label>

              {settings.logoUrl && settings.logoUrl !== '/comara-logo.png' && (
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                    isDark
                      ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20'
                      : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Restaurar Brasão Padrão</span>
                </button>
              )}
            </div>

            <p className={`text-xs ${isDark ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              Formatos aceitos: PNG, JPG, SVG ou WEBP (Max 2MB). A imagem é processada localmente em base64 e sincronizada com o banco central.
            </p>

            {logoPreviewError && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{logoPreviewError}</span>
              </div>
            )}
          </div>
        </div>
      </CardSection>

      {/* 3. SEÇÃO: ENDEREÇO & CONTATOS OFICIAIS */}
      <CardSection
        title="Localização e Contatos Oficiais"
        description="Endereço da sede geral e canais oficiais de comunicação para atendimento ao efetivo e auditoria."
        icon={MapPin}
        isDark={isDark}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <FormInput
              label="Endereço Completo da Sede / Quartel-General"
              value={settings.endereco}
              onChange={(e) => onChange({ endereco: e.target.value })}
              placeholder="Ex: Av. Pedro Álvares Cabral, 7115 - Sacramenta, Belém - PA, CEP: 66610-020"
              error={errors.endereco}
              required
              icon={MapPin}
              isDark={isDark}
            />
          </div>

          <FormInput
            label="Telefone Institucional"
            value={settings.telefone}
            onChange={(e) => onChange({ telefone: e.target.value })}
            placeholder="Ex: (91) 3214-5000"
            icon={Phone}
            isDark={isDark}
          />

          <FormInput
            label="E-mail Oficial da Seção de RH / OM"
            value={settings.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="Ex: rh.comara@fab.mil.br"
            error={errors.email}
            required
            icon={Mail}
            type="email"
            isDark={isDark}
          />

          <div className="md:col-span-2">
            <FormInput
              label="Portal Web / Intranet da OM (Opcional)"
              value={settings.website || ''}
              onChange={(e) => onChange({ website: e.target.value })}
              placeholder="Ex: https://www.fab.mil.br/comara"
              icon={Globe}
              isDark={isDark}
            />
          </div>
        </div>
      </CardSection>

      {/* 4. SEÇÃO: APLICATIVO INSTALÁVEL (PWA) */}
      <CardSection
        title="Instalação do Aplicativo (PWA)"
        description="Capacidade de instalação do sistema como Progressive Web App em celulares, tablets e computadores com acesso rápido e tela cheia."
        icon={Smartphone}
        isDark={isDark}
      >
        <PWAInstallButton variant="card" theme={isDark ? 'dark' : 'light'} />
      </CardSection>
    </div>
  );
};
