export type Branch = 'KO' | 'BE' | 'MN' | 'SP' | 'RJ';

export type EmployeeStatus = 'Ativo' | 'Inativo' | 'Afastado' | 'Férias';

export type GrauInsalubridade = 'ISENTO' | '10%' | '20%' | '40%';

export type OccurrenceType = 
  | 'TRABALHO'                  // Horas Trabalhadas Normais/Extras (+ Crédito no Banco de Horas)
  | 'ACABOU_BANHOU'             // Acabou Banhou: Conclusão de Missão (Neutro: 0h Banco, 0h Folha, sem desconto)
  | 'FALTA_INJUSTIFICADA'       // 'F' ou 'D' (Desconto em Folha / Contracheque - 0h no Banco)
  | 'FALTA_JUSTIFICADA'         // Atestado, Licença Gala/Luto, Ordem Judicial (Neutro: 0h Banco, 0h Folha)
  | 'DISPENSA_SPTF'             // Guia Oficial de Dispensa de SPTF / Compensação em Banco (- Débito no Banco)
  | 'DISPENSA_OPERACIONAL'      // Dispensa / Saída Antecipada / Horas Negativas Operacionais (Débito no Banco)
  | 'COMPENSACAO'               // Folga Compensatória / Débito em Banco (Débito no Banco)
  | 'COMPENSACAO_DISPENSA'      // Dispensa de SPTF com Emissão de Guia 2 Vias (Débito no Banco)
  | 'ATESTADO_MEDICO'           // 'AT' (Falta Justificada Médica - Neutro: 0h Banco, 0h Folha)
  | 'FERIAS'                    // 'FE' (Descanso Anual - Neutro: 0h Banco, 0h Folha)
  | 'LICENCA';                  // 'LIC' (Licença Legal/Gala/Luto - Neutro: 0h Banco, 0h Folha)

export type CompensationStatus = 'ABERTO' | 'PARCIALMENTE_COMPENSADO' | 'TOTALMENTE_COMPENSADO';

export interface LiquidationLink {
  id_origem: string;
  id_baixa: string;
  data_origem: string;
  data_baixa: string;
  horas_liquidadas: number;
  tipo_baixa: OccurrenceType;
  observacao?: string;
}

export type AdminRole = 
  | 'SUPER_ADMIN' 
  | 'RH_ADMIN' 
  | 'GERENTE_CANTEIRO' 
  | 'CHEFE_CANTEIRO' 
  | 'CHEFE_DA' 
  | 'AUX_DA'
  | 'NENHUM'
  // Retrocompatibilidade temporária com registros legados
  | 'GESTOR_RH' 
  | 'GERENTE' 
  | 'ROLE_GERENTE' 
  | 'GERENTE_CAMPO'
  | 'ENCARREGADO_CANTEIRO' 
  | 'ENCARREGADO_DA' 
  | 'AUDITOR';

export type CanteiroRole = 
  | 'GERENTE' 
  | 'CHEFE_CANTEIRO' 
  | 'ENCARREGADO_CANTEIRO' 
  | 'CHEFE_DA' 
  | 'ENCARREGADO_DA' 
  | 'AUX_DA';

export type TratamentoTitulo = 'Chefe' | 'Encarregado';

export interface CanteiroResponsavel {
  id?: string;
  papel: CanteiroRole;
  tratamento: TratamentoTitulo;
  nome: string;
  email?: string;
  contato?: string;
  ativo: boolean;
  designadoEm: string;
  desativacaoAgendada?: string; // Carência 48h para revogação automática
}

export interface CanteiroTransicao {
  id: string;
  papel: CanteiroRole;
  tratamento: TratamentoTitulo;
  responsavelAnterior: string;
  responsavelAnteriorEmail?: string;
  novoResponsavel: string;
  novoResponsavelEmail?: string;
  dataTransicao: string; // ISO
  agendadoParaDesativacao: string; // ISO (+48h)
  status: 'EM_ANDAMENTO' | 'CONCLUIDO';
}

export interface CanteiroSignatures {
  assinatura1: {
    titulo: string; // Ex: "Chefe do Canteiro" ou "Encarregado do Canteiro"
    nome: string;
    subtitulo: string;
  };
  assinatura2: {
    titulo: string; // Ex: "Chefe da Divisão Administrativa" ou "Encarregado da DA"
    nome: string;
    subtitulo: string;
  };
  assinatura3: {
    titulo: string; // Ex: "Engenheiro Fiscal / Gestor de RH"
    nome: string;
    subtitulo: string;
  };
}

export type AccessLogType = 
  | 'LOGIN_COLABORADOR' 
  | 'CONSULTA_SALDO' 
  | 'PRIMEIRO_ACESSO' 
  | 'DEFINICAO_SENHA' 
  | 'LOGIN_GESTAO_RH' 
  | 'RESET_SENHA_RH' 
  | 'TENTATIVA_INVALIDA';

export interface EmployeeAuth {
  matricula: string;
  passwordHash?: string;
  senhaDefinida: boolean;
  email?: string;
  tokenRecuperacao?: string;
  tokenExpiracao?: string;
  ultimoAcesso?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface AccessLog {
  id: string;
  timestamp: string;
  matricula: string;
  nome: string;
  tipoAcao: AccessLogType;
  sucesso: boolean;
  detalhes: string;
  ipOrigem?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  nome: string;
  cargo: string;
  tituloImpressao?: string; // Título do cargo impresso para assinaturas e relatórios (ex: Capitão Encarregado de Obras)
  nivelAcesso: AdminRole;
  role?: AdminRole;
  status?: 'pendente' | 'ativo' | 'inativo' | 'bloqueado';
  perfil?: string;
  foto?: string | null;
  sede?: string;
  saram?: string;
  nomeGuerra?: string;
  postoGraduacao?: string;
  funcao?: string;
  canteiroSede?: string;
  ativo: boolean;
  passwordHash?: string;
  senha?: string;
  desativacaoAgendada?: string; // Data ISO (+48h) de revogação automática após passagem de bastão
  transicaoStatus?: 'PENDENTE_48H' | 'EXPIRADO' | 'ATIVO';
  canteiroCodigo?: string;
  tratamentoTitulo?: TratamentoTitulo;
  criadoEm: string;
  atualizadoEm?: string;
}

export interface AuthSession {
  email: string;
  nome: string;
  matricula?: string;
  saram?: string;
  nomeGuerra?: string;
  postoGraduacao?: string;
  funcao?: string;
  canteiroSede?: string;
  role: AdminRole;
  cargo?: string;
  tituloImpressao?: string;
  loginTime: string;
  sede?: string;
  canteiroCodigo?: string;
  canteiroId?: string;
  tratamentoTitulo?: TratamentoTitulo;
}

export interface Employee {
  id: string;
  matricula: string;
  saram?: string;
  nome: string;
  funcao: string;
  sede: Branch; // Sede padrão/fixa
  sede_origem?: Branch; // Sede contratual / fixa
  sede_atual?: Branch; // Canteiro / sede temporária
  secaoLotacao?: string;
  canteiroId?: string; // ID do canteiro/construção site (FK para ConstructionSite.id)
  dataInicioAlocacao?: string; // Início da missão
  dataFimAlocacao?: string; // Fim da missão
  dataAdmissao: string;
  status: EmployeeStatus;
  dataInicioStatus?: string; // Início de Férias ou Afastamento
  dataFimStatus?: string; // Término de Férias ou Afastamento
  data_inicio_status?: string;
  data_fim_status?: string;
  motivoStatus?: string;
  observacao_status?: string;
  cargo?: string;
  departamento?: string;
  jornadaTrabalho?: string;
  horarioTrabalho?: string;
  email?: string;
  telefone?: string;
  cpf?: string; // CPF em texto plano (retirado em futuras versões para LGPD)
  cpfHash?: string; // Hash SHA-256 do CPF limpo (para desduplicação segura)
  cpfMascarado?: string; // CPF mascarado (ex: ***.XXX.XXX-**)
  saldoInicialHoras?: number;
  grauInsalubridadeFixa?: GrauInsalubridade;
  primeiroAcesso?: boolean;
  senhaCadastrada?: boolean;
  senhaInicial?: string;
  avatarUrl?: string;
  url_foto_perfil?: string;
  id_drive_foto?: string;
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  dataUrl?: string;
  driveFileId: string;
  driveViewUrl: string;
  uploadTimestamp: string;
}

export interface TimeRecord {
  id: string;
  matricula: string;
  employeeName?: string;
  employeeSede?: Branch;
  employeeFuncao?: string;
  employeeAvatarUrl?: string;
  dataRegistro: string; // YYYY-MM-DD
  data_ocorrencia?: string; // Data exata em que a hora positiva ou negativa ocorreu
  tipoOcorrencia: OccurrenceType;
  codigoOcorrencia?: 'TRAB' | 'F' | 'D' | 'AT' | 'FE' | 'LIC' | 'COMP';
  horasBrutas: number; // Ex: 8.0 ou 2.5
  multiplicador: number; // 1.0, 1.5, 2.0, ou 0.0
  saldoCalculado: number; // Em horas decimais (ex: +3.75, -8.0, 0.0)
  horasDescontoFolha?: number; // Horas destinadas a Desconto em Folha (para Falta Injustificada)
  destinoLancamento?: 'FOLHA_PAGAMENTO' | 'BANCO_HORAS' | 'NEUTRO_AUDITORIA';
  saldo_remanescente?: number; // Quantidade de horas daquela data que ainda não foram abatidas
  status_compensacao?: CompensationStatus; // ABERTO, PARCIALMENTE_COMPENSADO, TOTALMENTE_COMPENSADO
  liquidacoes?: LiquidationLink[]; // Detalhes de baixas/compensações atreladas a este lançamento
  eFeriado: boolean;
  nomeFeriado?: string;
  diaSemana: number; // 0=Dom, 1=Seg, ..., 6=Sab
  diaSemanaNome: string;
  observacao?: string;
  comprovante?: Attachment;
  criadoPorEmail?: string;
  criadoEm: string;
  atualizadoEm?: string;
  editadoPor?: string;
  editadoEm?: string;
}

export interface Holiday {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: 'Nacional' | 'Estadual' | 'Municipal';
  sedeAtingida?: Branch | 'TODAS';
}

export interface DashboardFilter {
  dataInicio: string;
  dataFim: string;
  sede: string; // 'TODAS' | Branch
  funcao: string; // 'TODAS' | string
  matriculaOrNome: string;
  statusBanco: 'TODOS' | 'CREDOR' | 'DEVEDOR' | 'ZERADO';
  tipoOcorrencia: string; // 'TODOS' | OccurrenceType
}

export interface MonthlyEmployeeSummary {
  matricula: string;
  nome: string;
  funcao: string;
  sede: Branch;
  anoMes: string; // YYYY-MM
  saldoAnteriorHoras: number;
  creditoHorasMes: number;
  debitoHorasMes: number;
  saldoFinalHoras: number;
  saldoFinalDias: number; // saldoFinalHoras / 8
  totalAtestados: number;
  totalFaltas: number;
  totalHorasExtras50: number;
  totalHorasExtras100: number;
}

export interface InsalubrityRecord {
  id: string;
  matricula: string;
  nomeColaborador: string;
  sede: Branch;
  funcao: string;
  dataEvento: string; // YYYY-MM-DD
  atividadeDesempenhada: string;
  grauExposicao: '10%' | '20%' | '40%';
  quantidadeHorasDias: number;
  unidade: 'HORAS' | 'DIAS';
  responsavelLancamento: string; // Encarregado / RH
  observacoes?: string;
  criadoEm: string;
  criadoPorEmail?: string;
  atualizadoEm?: string;
  editadoPor?: string;
  editadoEm?: string;
}

export interface ConstructionSite {
  id: string;
  codigo: string; // Ex: KO-01, BE-01, MN-01
  nome: string; // Ex: Canteiro Aeroporto Coari
  endereco?: string;
  sede?: Branch;
  bigramasImportacao?: string[]; // Bigramas/siglas para matching em importações (ex: ["KO", "DECO-KO"], ["MN", "DACO-MN"])
  chefeCanteiro?: string; // Encarregado / Chefe de Canteiro
  tratamentoChefeCanteiro?: TratamentoTitulo; // [ Chefe | Encarregado ]
  chefeContato?: string; // Telefone / Contato do Chefe de Canteiro
  chiefContact?: string;
  chefeDa?: string; // Chefe / Encarregado da Divisão de Administração (DA)
  tratamentoChefeDa?: TratamentoTitulo; // [ Chefe | Encarregado ]
  gerente?: string; // Fiscal / Engenheiro Fiscal / Gerente
  auxDa?: string; // Auxiliar da DA
  responsaveis?: CanteiroResponsavel[];
  historicoTransicao?: CanteiroTransicao[];
  status: 'Ativo' | 'Em Desmobilização' | 'Encerrado' | 'ACTIVE' | 'INACTIVE' | 'PLANNED';
  grauInsalubridade?: GrauInsalubridade;
  insalubrityLevel?: GrauInsalubridade;
  dataInicio?: string;
  dataPrevisaoFim?: string;
  startDate?: string;
  expectedEndDate?: string;
  observacoes?: string;
  notes?: string;
  workerCount?: number;
  chief?: string;
  manager?: string;
  branch?: Branch;
  name?: string;
  code?: string;
  address?: string;
  createdAt?: string;
  criadoEm?: string;
  updatedAt?: string;
  atualizadoEm?: string;
}

export interface SystemConfig {
  logoUrl?: string;
  companyName?: string;
  subtitle?: string;
  insalubrityMode?: 'COMPLETA' | 'SIMPLES';
  atualizadoEm?: string;
  atualizadoPor?: string;
}

export interface PaystubRubrica {
  codigo: string; // Ex: "001", "032", "600", "611", "722", "903"
  descricao: string; // Ex: "Salário Base", "Aux Transporte", "Auxílio Alimentação", "INSS Folha"
  referencia?: string; // Ex: "30D", "220:00", "14.00%", "6.00%"
  provento: number; // Valor R$
  desconto: number; // Valor R$
  tipo: 'PROVENTO' | 'DESCONTO';
}

export interface PaystubRecord {
  id: string; // Document ID: `${matricula}_${mesAno}` (ex: "013853_07-2026")
  matricula: string; // Ex: "013853"
  nome: string; // Ex: "CLESIO DE SOUZA FARO LOPES"
  cargo: string; // Ex: "OPERADOR DE MOTONIVEL"
  sede: string; // Ex: "KO-DL", "KO", "BE", "MN"
  periodo: string; // Ex: "07/2026" ou "01/07/2026 a 31/07/2026"
  mesAno: string; // Ex: "07-2026"
  ano: number; // Ex: 2026
  mes: number; // Ex: 7
  dataInicio?: string; // Ex: "01/07/2026"
  dataFim?: string; // Ex: "31/07/2026"
  cpf?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  rubricas: PaystubRubrica[];
  totalProventos: number;
  totalDescontos: number;
  valorLiquido: number;
  salarioBase?: number;
  baseInss?: number;
  baseFgts?: number;
  fgtsMes?: number;
  baseIrrf?: number;
  importadoEm: string;
  importadoPorEmail?: string;
  observacoes?: string;
}

export interface DispensaSptfRecord {
  id: string; // Document ID: `dispensa_${Date.now()}_${matricula}`
  numeroGuia?: string; // Ex: "SPTF-2026/001"
  matricula: string;
  nome: string;
  saram?: string;
  secaoCanteiro: string; // Ex: "DECO-KO", "CANTEIRO COARI"
  data: string; // YYYY-MM-DD
  horarioInicio: string; // HH:mm (Ex: "13:00")
  horarioFim: string; // HH:mm (Ex: "16:00")
  totalHoras: number; // Ex: 3.0
  motivo: string; // Padrão "COMPENSAÇÃO BANCO DE HORAS"
  observacoes?: string;
  emitidoPorNome?: string;
  emitidoPorEmail?: string;
  emitidoEm: string; // ISO String
  lancamentoId?: string; // ID do lançamento no Banco de Horas
  status?: 'EMITIDA' | 'CANCELADA';
}

export type AuditActionType =
  | 'LANCAMENTO_HORAS'
  | 'EDICAO_LANCAMENTO'
  | 'EXCLUSAO_REGISTRO'
  | 'EMISSAO_DISPENSA'
  | 'CANCELAMENTO_DISPENSA'
  | 'ALTERACAO_FUNCAO'
  | 'PASSAGEM_BASTAO'
  | 'IMPORTACAO_FOLHA'
  | 'CRIACAO_LANCAMENTO'
  | 'EXCLUSAO_LANCAMENTO'
  | 'IMPORTACAO_LANCAMENTOS_LOTE'
  | 'DESIGNACAO_CHEFE_CANTEIRO'
  | 'TRANSICAO_RESPONSAVEL_CANTEIRO'
  | 'ALTERACAO_CANTEIRO'
  | 'EXCLUSAO_CANTEIRO'
  | 'EMISSAO_DISPENSA_SPTF'
  | 'CANCELAMENTO_DISPENSA_SPTF'
  | 'LANCAMENTO_INSALUBRIDADE'
  | 'ALTERACAO_GRAU_INSALUBRIDADE'
  | 'EXCLUSAO_INSALUBRIDADE'
  | 'IMPORTACAO_INSALUBRIDADE_LOTE'
  | 'IMPORTACAO_CONTRACHEQUES_LOTE'
  | 'EXCLUSAO_CONTRACHEQUE'
  | 'ALTERACAO_CONFIG_SISTEMA'
  | 'ALTERACAO_PERMISSAO_ADMIN'
  | 'LIMPEZA_BASE_DADOS'
  | 'RESTAURACAO_MOCK_DADOS';

export interface AuditLog {
  id: string; // Document ID: `audit_${Date.now()}_${random}`
  usuarioId: string; // ID/Email do usuário que executou a ação
  usuarioNome: string; // Nome do usuário conectado
  nomeUsuario?: string; // Alias retrocompatível
  usuarioPerfil?: string; // Perfil ativo (ex: CHEFE_DA, AUX_DA, RH_ADMIN, SUPER_ADMIN)
  tipoAcao: AuditActionType | string; // Categoria da ação
  acao?: string; // Alias retrocompatível
  detalhes: string; // Descrição textual detalhada da alteração
  detalhesJson?: Record<string, any>; // Metadados adicionais em JSON
  canteiroId: string; // Sede ou canteiro afetado (ex: 'DECO-KO', 'KO', 'KO-DL', 'BE', 'MN', 'TODOS')
  timestamp: string; // Data ISO String ou formatada
  ipOrigem?: string;
  recursoId?: string;
  dadosAnteriores?: Record<string, any>;
  dadosNovos?: Record<string, any>;
}

