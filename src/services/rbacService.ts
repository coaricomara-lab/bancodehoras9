import { AdminRole, Employee, TimeRecord, InsalubrityRecord, DispensaSptfRecord, Branch } from '../types';

export interface RBACUser {
  email: string;
  nome: string;
  role: AdminRole;
  cargo?: string;
  tituloImpressao?: string;
  sede?: string;
  canteiroCodigo?: string;
  canteiroId?: string;
}

/**
 * MATRIZ CONSOLIDADA DE 6 NÍVEIS DE ACESSO COMARA SPTF
 * Separando estritamente a "Regra de Acesso / Permissão" do "Título do Cargo Impresso".
 * 
 * 1. SUPER_ADMIN: TI (Acesso global, configurações e auditoria).
 * 2. RH_ADMIN: RH Sede (Acesso global a todos os canteiros, gestão de folha, contracheques e auditoria).
 * 3. GERENTE_CANTEIRO: Visualização e acompanhamento (Somente leitura das horas e relatórios do seu canteiro ativo).
 * 4. CHEFE_CANTEIRO: Operacional de Campo (Lançamentos, insalubridade e dispensas do seu canteiro ativo). *Nota: Serve para Chefe e Encarregado.*
 * 5. CHEFE_DA: Gestão Administrativa do Canteiro (Auditoria local, relatórios e gestão do canteiro ativo). *Nota: Serve para Chefe DA e Encarregado DA.*
 * 6. AUX_DA: Auxiliar de Campo (Tela restrita para lançamentos de horas e emissão de dispensas no canteiro ativo).
 */

export const CONSOLIDATED_ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'RH_ADMIN',
  'GERENTE_CANTEIRO',
  'CHEFE_CANTEIRO',
  'CHEFE_DA',
  'AUX_DA',
];

export const ROLE_INFO: Record<string, {
  label: string;
  shortLabel: string;
  scope: 'GLOBAL' | 'CANTEIRO_RESTRICTED';
  badgeColor: string;
  description: string;
}> = {
  SUPER_ADMIN: {
    label: 'Super Admin (TI)',
    shortLabel: 'Super Admin',
    scope: 'GLOBAL',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    description: 'TI: Acesso global irrestrito, configurações de sistema, trilha de auditoria e gestão de acessos.',
  },
  RH_ADMIN: {
    label: 'RH Admin (RH Sede)',
    shortLabel: 'RH Sede',
    scope: 'GLOBAL',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'RH Sede: Acesso global a todos os canteiros, gestão de folha, contracheques e auditoria.',
  },
  GERENTE_CANTEIRO: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Visualização e acompanhamento: Somente leitura das horas e relatórios do seu canteiro ativo.',
  },
  CHEFE_CANTEIRO: {
    label: 'Chefe / Encarregado de Canteiro',
    shortLabel: 'Chefe Cant.',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Operacional de Campo: Lançamentos de horas, laudos de insalubridade e emissão de dispensas no canteiro ativo.',
  },
  CHEFE_DA: {
    label: 'Chefe / Encarregado da DA',
    shortLabel: 'Chefe DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    description: 'Gestão Administrativa do Canteiro: Auditoria local, relatórios executivos e gestão do canteiro ativo.',
  },
  AUX_DA: {
    label: 'Auxiliar de Campo / DA',
    shortLabel: 'Aux. DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    description: 'Auxiliar de Campo: Tela restrita e ágil para lançamentos de horas e emissão de dispensas SPTF no canteiro ativo.',
  },

  // Aliases e Retrocompatibilidade de exibição
  GESTOR_RH: {
    label: 'RH Admin (RH Sede)',
    shortLabel: 'RH Sede',
    scope: 'GLOBAL',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    description: 'RH Sede: Gestão global e folha de pagamento.',
  },
  ENCARREGADO_CANTEIRO: {
    label: 'Chefe / Encarregado de Canteiro',
    shortLabel: 'Encarregado',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    description: 'Operacional de Campo do canteiro ativo.',
  },
  ENCARREGADO_DA: {
    label: 'Chefe / Encarregado da DA',
    shortLabel: 'Enc. DA',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    description: 'Gestão Administrativa do Canteiro.',
  },
  GERENTE: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Acompanhamento do canteiro ativo.',
  },
  GERENTE_CAMPO: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Acompanhamento do canteiro ativo.',
  },
  ROLE_GERENTE: {
    label: 'Gerente de Canteiro',
    shortLabel: 'Gerente',
    scope: 'CANTEIRO_RESTRICTED',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    description: 'Acompanhamento do canteiro ativo.',
  },
  AUDITOR: {
    label: 'Gerente / Visualização',
    shortLabel: 'Leitura',
    scope: 'GLOBAL',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    description: 'Acompanhamento e relatórios em modo somente leitura.',
  },
};

export const rbacService = {
  /**
   * Normaliza qualquer role string para uma das 6 roles canônicas
   */
  normalizeRole(role?: AdminRole | string): AdminRole {
    if (!role) return 'AUX_DA';
    const r = role.toString().toUpperCase().trim();
    switch (r) {
      case 'SUPER_ADMIN':
        return 'SUPER_ADMIN';
      case 'RH_ADMIN':
      case 'GESTOR_RH':
        return 'RH_ADMIN';
      case 'GERENTE_CANTEIRO':
      case 'GERENTE':
      case 'GERENTE_CAMPO':
      case 'ROLE_GERENTE':
      case 'AUDITOR':
        return 'GERENTE_CANTEIRO';
      case 'CHEFE_CANTEIRO':
      case 'ENCARREGADO_CANTEIRO':
        return 'CHEFE_CANTEIRO';
      case 'CHEFE_DA':
      case 'ENCARREGADO_DA':
        return 'CHEFE_DA';
      case 'AUX_DA':
      case 'AUXILIAR_DA':
        return 'AUX_DA';
      default:
        return 'AUX_DA';
    }
  },

  /**
   * Identifica se o usuário possui acesso global a todos os canteiros e sedes
   * (Apenas SUPER_ADMIN e RH_ADMIN)
   */
  hasGlobalAccess(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return r === 'SUPER_ADMIN' || r === 'RH_ADMIN';
  },

  isGlobalRole(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  /**
   * Identifica se o usuário opera na interface simplificada de campo
   * (CHEFE_CANTEIRO, CHEFE_DA, AUX_DA)
   */
  isFieldUser(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return r === 'CHEFE_CANTEIRO' || r === 'CHEFE_DA' || r === 'AUX_DA';
  },

  /**
   * Permissão para aprovar e homologar horas
   * (SUPER_ADMIN, RH_ADMIN, CHEFE_CANTEIRO, CHEFE_DA)
   */
  canApproveHours(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'CHEFE_DA'
    );
  },

  /**
   * Permissão para visualizar logs de auditoria e segurança
   * (Restrito a SUPER_ADMIN, RH_ADMIN e CHEFE_DA - auditoria local do canteiro)
   */
  canViewAuditLogs(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return r === 'SUPER_ADMIN' || r === 'RH_ADMIN' || r === 'CHEFE_DA';
  },

  /**
   * Permissão para excluir lançamentos ou colaboradores
   */
  canDeleteRecords(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return r === 'SUPER_ADMIN' || r === 'RH_ADMIN';
  },

  /**
   * Permissão para lançar horas (individual ou em lote)
   * (SUPER_ADMIN, RH_ADMIN, CHEFE_CANTEIRO, CHEFE_DA, AUX_DA)
   */
  canLaunchHours(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'CHEFE_DA' ||
      r === 'AUX_DA'
    );
  },

  /**
   * Permissão para lançar / validar insalubridade no canteiro
   * (SUPER_ADMIN, RH_ADMIN, CHEFE_CANTEIRO, CHEFE_DA)
   */
  canValidateInsalubrity(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'CHEFE_DA'
    );
  },

  canLaunchInsalubrity(role?: AdminRole | string): boolean {
    return this.canValidateInsalubrity(role);
  },

  /**
   * Checa se o usuário pode emitir Guia de Dispensa de SPTF em 2 vias
   * (SUPER_ADMIN, RH_ADMIN, CHEFE_CANTEIRO, CHEFE_DA, AUX_DA)
   */
  canEmitDispensa(role?: AdminRole | string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    return (
      r === 'SUPER_ADMIN' ||
      r === 'RH_ADMIN' ||
      r === 'CHEFE_CANTEIRO' ||
      r === 'CHEFE_DA' ||
      r === 'AUX_DA'
    );
  },

  canIssueDispensa(role?: AdminRole | string): boolean {
    return this.canEmitDispensa(role);
  },

  /**
   * Checa se o usuário pode gerenciar contracheques e importação da folha
   */
  canManagePaystubs(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canImportFolha(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  /**
   * Permissão para cadastrar, editar e gerenciar Canteiros de Obras
   */
  canManageCanteiros(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  canManageSystemConfig(role?: AdminRole | string): boolean {
    return this.hasGlobalAccess(role);
  },

  /**
   * Checa se o usuário pode gerenciar permissões administrativas (Exclusivo Super Admin TI)
   */
  canManageAdminPermissions(role?: AdminRole | string, email?: string): boolean {
    if (email) {
      const clean = email.trim().toLowerCase();
      if (
        clean === 'coari.comara@gmail.com' ||
        clean === 'comarafab@gmail.com' ||
        clean.startsWith('juliocesar') ||
        clean.includes('juliocesar') ||
        clean.endsWith('@comara.mil.br') ||
        clean.endsWith('@comara.aer.mil.br') ||
        clean.endsWith('@comara.gov.br')
      ) {
        return true;
      }
    }
    if (!role) return false;
    const r = this.normalizeRole(role);
    return r === 'SUPER_ADMIN';
  },

  canManageAdmins(role?: AdminRole | string, email?: string): boolean {
    return this.canManageAdminPermissions(role, email);
  },

  /**
   * Controle de acesso às abas principais da navegação
   */
  canAccessTab(tab: string, role?: AdminRole | string, email?: string): boolean {
    if (!role) return false;
    const r = this.normalizeRole(role);
    switch (tab) {
      case 'canteiros':
        return this.canManageCanteiros(r);
      case 'auditoria':
        return this.canViewAuditLogs(r);
      case 'permissoes_admin':
        return this.canManageAdminPermissions(r, email);
      case 'contracheques':
        return this.canManagePaystubs(r);
      case 'insalubridade':
        return this.canValidateInsalubrity(r) || r === 'GERENTE_CANTEIRO';
      case 'relatorios':
        return r !== 'AUX_DA';
      case 'dispensas_faltas':
        return true;
      case 'dashboard':
      case 'colaboradores':
      case 'extrato':
      case 'portal_colaborador':
      case 'arquitetura':
      default:
        return true;
    }
  },

  /**
   * Identifica se o perfil é restrito ao seu canteiro ativo
   */
  isCanteiroRestricted(role?: AdminRole | string): boolean {
    return !this.hasGlobalAccess(role);
  },

  /**
   * Obtém a sede/canteiro do usuário (ex: 'KO', 'BE', 'MN')
   */
  getUserCanteiroId(user?: RBACUser | null): string {
    if (!user) return 'KO';
    return (user.canteiroId || user.canteiroCodigo || user.sede || 'KO').toUpperCase();
  },

  /**
   * Checa se o usuário pode acessar dados de um determinado colaborador baseado no canteiro
   */
  canAccessEmployee(user: RBACUser | null, employee: Employee): boolean {
    if (!user) return false;
    if (this.hasGlobalAccess(user.role)) return true;
    
    const userCanteiro = this.getUserCanteiroId(user);
    const empSede = (employee.sede_atual || employee.sede || '').toUpperCase();
    const empOrigem = (employee.sede_origem || '').toUpperCase();
    
    return empSede === userCanteiro || empOrigem === userCanteiro;
  },

  /**
   * Filtro rigoroso de Colaboradores por Tenancy (Canteiro Ativo)
   */
  filterEmployeesByTenancy(employees: Employee[], user: RBACUser | null): Employee[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return employees;

    const userCanteiro = this.getUserCanteiroId(user);
    return employees.filter((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      const empOrigem = (emp.sede_origem || '').toUpperCase();
      return empSede === userCanteiro || empOrigem === userCanteiro;
    });
  },

  /**
   * Filtro rigoroso de Lançamentos de Horas por Tenancy (Canteiro Ativo)
   */
  filterRecordsByTenancy(records: TimeRecord[], employees: Employee[], user: RBACUser | null): TimeRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return records;

    const userCanteiro = this.getUserCanteiroId(user);
    
    // Mapeia matrículas que pertencem ao canteiro do usuário
    const allowedMatriculas = new Set<string>();
    employees.forEach((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      const empOrigem = (emp.sede_origem || '').toUpperCase();
      if (empSede === userCanteiro || empOrigem === userCanteiro) {
        allowedMatriculas.add(emp.matricula.trim().toUpperCase());
      }
    });

    return records.filter((rec) => {
      const mat = (rec.matricula || '').trim().toUpperCase();
      if (allowedMatriculas.has(mat)) return true;
      if (rec.employeeSede && rec.employeeSede.toUpperCase() === userCanteiro) return true;
      return false;
    });
  },

  /**
   * Filtro rigoroso de Lançamentos de Insalubridade por Tenancy (Canteiro Ativo)
   */
  filterInsalubrityByTenancy(records: InsalubrityRecord[], user: RBACUser | null): InsalubrityRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return records;

    const userCanteiro = this.getUserCanteiroId(user);
    return records.filter((rec) => {
      return (rec.sede || 'KO').toUpperCase() === userCanteiro;
    });
  },

  /**
   * Filtro rigoroso de Dispensas SPTF por Tenancy (Canteiro Ativo)
   */
  filterDispensasByTenancy(dispensas: DispensaSptfRecord[], employees: Employee[], user: RBACUser | null): DispensaSptfRecord[] {
    if (!user) return [];
    if (this.hasGlobalAccess(user.role)) return dispensas;

    const userCanteiro = this.getUserCanteiroId(user);
    
    const allowedMatriculas = new Set<string>();
    employees.forEach((emp) => {
      const empSede = (emp.sede_atual || emp.sede || '').toUpperCase();
      if (empSede === userCanteiro) {
        allowedMatriculas.add(emp.matricula.trim().toUpperCase());
      }
    });

    return dispensas.filter((d) => {
      const mat = (d.matricula || '').trim().toUpperCase();
      if (allowedMatriculas.has(mat)) return true;
      const secao = (d.secaoCanteiro || '').toUpperCase();
      return secao.includes(userCanteiro);
    });
  },
};
