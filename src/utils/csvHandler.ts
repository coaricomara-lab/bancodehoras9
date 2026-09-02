import Papa from 'papaparse';
import { Employee, TimeRecord, Branch, EmployeeStatus, OccurrenceType, InsalubrityRecord } from '../types';
import { calculateSPTFBalance } from './calculations';
import { cleanCPF, maskCPF, formatCPF, isValidCPF } from './lgpdUtils';

export interface CSVImportResult<T> {
  success: boolean;
  data: T[];
  errors: string[];
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
}

export type DuplicateAction = 'update' | 'skip' | 'error';

/**
 * Higieniza células de CSV exportadas do Excel com a sintaxe ="valor" ou aspas duplas.
 */
export function sanitizeCsvCell(cellValue: any): string {
  if (cellValue === null || cellValue === undefined) return '';
  let str = String(cellValue).trim();
  
  // Desenrola repetidamente padrões do Excel: ="valor", "=""valor""", """valor""", "valor", etc.
  let previous = '';
  while (str !== previous) {
    previous = str;
    str = str.trim();
    if (str.startsWith('="') && str.endsWith('"')) {
      str = str.substring(2, str.length - 1);
    } else if (str.startsWith('=\\"') && str.endsWith('\\"')) {
      str = str.substring(3, str.length - 2);
    } else if (str.startsWith('"') && str.endsWith('"')) {
      str = str.substring(1, str.length - 1);
    } else if (str.startsWith("'") && str.endsWith("'")) {
      str = str.substring(1, str.length - 1);
    } else if (str.startsWith('=') && !str.startsWith('==')) {
      str = str.substring(1);
    }
  }
  return str.trim();
}

/**
 * Normaliza nomes de cabeçalhos de CSV removendo sintaxe do Excel, aspas, espaços e caracteres especiais.
 */
export function sanitizeHeaderKey(header: string): string {
  const clean = sanitizeCsvCell(header);
  return clean
    .replace(/^["'=]+|["'=]+$/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

/**
 * Busca o valor de uma coluna no objeto da linha através de múltiplos aliases possíveis.
 */
export function getRowValue(row: any, ...aliases: string[]): string {
  if (!row || typeof row !== 'object') return '';

  const normalizedAliases = aliases.map(a => sanitizeHeaderKey(a));

  // 1. Verificação direta nos campos do objeto
  for (const alias of normalizedAliases) {
    if (row[alias] !== undefined && row[alias] !== null) {
      const sanitized = sanitizeCsvCell(row[alias]);
      if (sanitized !== '') return sanitized;
    }
  }

  // 2. Verificação varrendo todas as chaves (fallback para cabeçalhos com caracteres residuais)
  for (const [key, val] of Object.entries(row)) {
    const cleanKey = sanitizeHeaderKey(key);
    if (normalizedAliases.includes(cleanKey)) {
      if (val !== undefined && val !== null) {
        const sanitized = sanitizeCsvCell(val);
        if (sanitized !== '') return sanitized;
      }
    }
  }

  return '';
}

/**
 * Converte datas em múltiplos formatos (DD/MM/YYYY, YYYY-MM-DD, D/M/YYYY) para YYYY-MM-DD
 */
export function parseDateCell(raw: any, defaultDate: string = '2024-01-01'): string {
  const clean = sanitizeCsvCell(raw);
  if (!clean) return defaultDate;

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('/');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split('-');
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return clean;
}

/**
 * Faz o parsing de um arquivo CSV de colaboradores e normaliza os campos com suporte a dados do Excel.
 */
export function parseEmployeesCSV(
  fileContent: string,
  existingEmployees: Employee[],
  duplicateAction: DuplicateAction = 'update'
): Promise<CSVImportResult<Employee>> {
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => sanitizeHeaderKey(header),
      complete: (results) => {
        const errors: string[] = [];
        const validEmployees: Employee[] = [];
        let duplicateCount = 0;
        let skippedCount = 0;

        const existingMap = new Map<string, Employee>();
        existingEmployees.forEach((emp) => {
          existingMap.set(sanitizeCsvCell(emp.matricula).toUpperCase(), emp);
        });

        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2; // +1 zero-indexed, +1 header row

          // 1. Mapeamento robusto com getRowValue (suporta Funcionarios DECO-KO.csv e outros formatos)
          const matriculaRaw = getRowValue(
            row,
            'matricula', 'matricula_numero', 'mat', 'id', 'codigo', 'codigoexterno', 'codigo_externo'
          );
          const nomeRaw = getRowValue(
            row,
            'nomecompleto', 'nome_completo', 'nome', 'colaborador', 'funcionario', 'name'
          );
          const departamentoRaw = getRowValue(
            row,
            'departamentonome', 'departamento_nome', 'departamento', 'depto', 'setor'
          );
          const cargoRaw = getRowValue(
            row,
            'cargonome', 'cargo_nome', 'cargo', 'funcao', 'função', 'cargo_cbo', 'role'
          );
          const dataAdmissaoRaw = getRowValue(
            row,
            'dataadmissao', 'data_admissao', 'admissao', 'hiredate'
          );
          const celularRaw = getRowValue(
            row,
            'celular', 'telefone', 'tel', 'phone'
          );
          const emailRaw = getRowValue(
            row,
            'email', 'e_mail'
          );
          const horarioRaw = getRowValue(
            row,
            'horarionome', 'horario_nome', 'horario', 'jornada', 'jornadadetrabalho', 'jornadatrabalho'
          );
          const sedeRaw = getRowValue(
            row,
            'sede', 'sedeorigem', 'sede_origem', 'filial', 'unidade', 'base'
          );
          const statusRaw = getRowValue(
            row,
            'status', 'situacao', 'situação'
          ) || 'Ativo';
          const senhaInicialRaw = getRowValue(
            row,
            'senhainicial', 'senha_inicial', 'senha', 'password', 'senhapadrao', 'senhaprovisoria'
          );
          const saldoInicialRaw = getRowValue(
            row,
            'saldoinicial', 'saldo_inicial', 'saldo'
          ) || '0';
          const fotoRaw = getRowValue(
            row,
            'urlfotoperfil', 'url_foto_perfil', 'foto', 'fotoperfil', 'avatar', 'avatarurl'
          );
          const cpfRaw = getRowValue(
            row,
            'cpf', 'num_cpf', 'numcpf', 'cpf_numero', 'cpfnumero', 'documento', 'doc_cpf', 'doc', 'cic', 'taxid'
          );

          if (!matriculaRaw || !nomeRaw) {
            // Se linha totalmente vazia, apenas ignora
            if (!matriculaRaw && !nomeRaw && !cargoRaw) return;
            errors.push(`Linha ${rowNum}: 'Matrícula' ou 'Nome' não identificados.`);
            return;
          }

          // Matrícula preservando zeros à esquerda (ex: "00123" permanece "00123")
          const matricula = matriculaRaw;
          const nome = nomeRaw;
          const cargo = cargoRaw || 'Colaborador';
          const funcao = cargo;

          // Determinação da Sede / Sede Origem
          let sedeNormalized: Branch = 'KO';
          const deptoLower = (departamentoRaw || '').toLowerCase();
          const sedeLower = (sedeRaw || '').toLowerCase();

          if (deptoLower.includes('ko') || deptoLower.includes('coari') || sedeLower.includes('ko') || sedeLower.includes('coari')) {
            sedeNormalized = 'KO';
          } else if (deptoLower.includes('be') || deptoLower.includes('bel') || sedeLower.includes('be') || sedeLower.includes('bel')) {
            sedeNormalized = 'BE';
          } else if (deptoLower.includes('mn') || deptoLower.includes('man') || sedeLower.includes('mn') || sedeLower.includes('man')) {
            sedeNormalized = 'MN';
          } else if (deptoLower.includes('sp') || sedeLower.includes('sp')) {
            sedeNormalized = 'SP';
          } else if (deptoLower.includes('rj') || sedeLower.includes('rj')) {
            sedeNormalized = 'RJ';
          }

          // Normalização de Status
          let statusNormalized: EmployeeStatus = 'Ativo';
          const stUpper = statusRaw.toUpperCase();
          if (stUpper.includes('INAT')) statusNormalized = 'Inativo';
          else if (stUpper.includes('AFAST')) statusNormalized = 'Afastado';
          else if (stUpper.includes('FERIA') || stUpper.includes('FÉRIA')) statusNormalized = 'Férias';

          // Tratamento de Datas
          const dataAdmissao = parseDateCell(dataAdmissaoRaw, '2024-01-01');

          const parsedSaldo = parseFloat(saldoInicialRaw.replace(',', '.')) || 0;
          const urlFoto = fotoRaw || undefined;

          // Se a senha inicial for fornecida no CSV (mínimo 4 caracteres)
          const hasSenhaInicial = Boolean(senhaInicialRaw && senhaInicialRaw.trim().length >= 4);

          const isDuplicate = existingMap.has(matricula.toUpperCase());

          if (isDuplicate) {
            duplicateCount++;
            if (duplicateAction === 'skip') {
              skippedCount++;
              return;
            }
          }

          const prevEmp = existingMap.get(matricula.toUpperCase());

          const primeiroAcesso = hasSenhaInicial
            ? false
            : (isDuplicate && prevEmp?.primeiroAcesso !== undefined ? prevEmp.primeiroAcesso : true);

          const senhaCadastrada = hasSenhaInicial
            ? true
            : (isDuplicate && prevEmp?.senhaCadastrada !== undefined ? prevEmp.senhaCadastrada : false);

          // Tratamento de CPF (LGPD: XXX.***.***-YY)
          let cpfValue: string | undefined = undefined;
          let cpfMascarado: string | undefined = undefined;
          if (cpfRaw) {
            const clean = cleanCPF(cpfRaw);
            if (clean.length === 11) {
              cpfValue = formatCPF(clean);
              cpfMascarado = maskCPF(clean);
            } else if (cpfRaw.includes('*')) {
              cpfMascarado = maskCPF(cpfRaw);
            }
          }

          const employeeObj: Employee = {
            id: isDuplicate && prevEmp ? prevEmp.id : `emp-${Date.now()}-${index}`,
            matricula, // Preservando zeros à esquerda
            nome,
            funcao,
            cargo,
            departamento: departamentoRaw || undefined,
            sede: sedeNormalized,
            sede_origem: sedeNormalized,
            cpf: cpfValue || prevEmp?.cpf,
            cpfMascarado: cpfMascarado || (cpfValue ? maskCPF(cpfValue) : prevEmp?.cpfMascarado),
            dataAdmissao,
            status: statusNormalized,
            email: emailRaw || undefined,
            telefone: celularRaw || undefined,
            jornadaTrabalho: horarioRaw || undefined,
            saldoInicialHoras: parsedSaldo,
            primeiroAcesso,
            senhaCadastrada,
            senhaInicial: hasSenhaInicial ? senhaInicialRaw.trim() : undefined,
            avatarUrl: urlFoto || prevEmp?.avatarUrl,
            url_foto_perfil: urlFoto || prevEmp?.url_foto_perfil,
            id_drive_foto: prevEmp?.id_drive_foto,
          };

          validEmployees.push(employeeObj);
        });

        resolve({
          success: errors.length === 0 || validEmployees.length > 0,
          data: validEmployees,
          errors,
          totalRows: results.data.length,
          importedCount: validEmployees.length,
          duplicateCount,
          skippedCount,
        });
      },
      error: (err) => {
        resolve({
          success: false,
          data: [],
          errors: [err.message],
          totalRows: 0,
          importedCount: 0,
          duplicateCount: 0,
          skippedCount: 0,
        });
      },
    });
  });
}

/**
 * Faz o parsing de um arquivo CSV de lançamentos / histórico de ponto com suporte a dados sanitizados do Excel.
 */
export function parseTimeRecordsCSV(
  fileContent: string,
  employees: Employee[]
): Promise<CSVImportResult<TimeRecord>> {
  return new Promise((resolve) => {
    Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => sanitizeHeaderKey(header),
      complete: (results) => {
        const errors: string[] = [];
        const validRecords: TimeRecord[] = [];
        const empMap = new Map(employees.map(e => [sanitizeCsvCell(e.matricula).toUpperCase(), e]));

        results.data.forEach((row: any, index: number) => {
          const rowNum = index + 2;

          const matriculaRaw = getRowValue(
            row,
            'matricula', 'matricula_numero', 'mat', 'id', 'colaborador', 'funcionario', 'codigo', 'codigoexterno'
          );
          const dataRaw = getRowValue(
            row,
            'data', 'dataregistro', 'data_registro', 'dia', 'date'
          );
          const horasRaw = getRowValue(
            row,
            'horas', 'horasbrutas', 'horas_brutas', 'quantidade', 'saldo'
          ) || '0';
          const tipoRaw = getRowValue(
            row,
            'tipo', 'tipoocorrencia', 'tipo_ocorrencia', 'ocorrencia', 'codigo_ocorrencia'
          ) || 'TRABALHO';
          const obsRaw = getRowValue(
            row,
            'observacao', 'observação', 'obs', 'motivo', 'justificativa'
          );
          const forcarFeriadoRaw = getRowValue(
            row,
            'feriado', 'eferiado', 'e_feriado', 'eferiado_manual'
          ) || 'NAO';

          if (!matriculaRaw || !dataRaw) {
            if (!matriculaRaw && !dataRaw) return;
            errors.push(`Linha ${rowNum}: 'Matrícula' e 'Data' são obrigatórios.`);
            return;
          }

          const matricula = matriculaRaw;
          const emp = empMap.get(matricula.toUpperCase());

          const dataRegistro = parseDateCell(dataRaw, new Date().toISOString().substring(0, 10));

          // Normalizar tipo de ocorrência
          let tipo: OccurrenceType = 'TRABALHO';
          const tUpper = tipoRaw.toUpperCase();
          if (tUpper.includes('FALT') || tUpper === 'F' || tUpper === 'D') tipo = 'FALTA_INJUSTIFICADA';
          else if (tUpper.includes('ATEST') || tUpper.includes('MED') || tUpper === 'AT') tipo = 'ATESTADO_MEDICO';
          else if (tUpper.includes('FOLG') || tUpper.includes('COMPENS') || tUpper === 'FOLGA') tipo = 'COMPENSACAO';
          else if (tUpper.includes('FERIA') || tUpper === 'FER') tipo = 'FERIAS';
          else if (tUpper.includes('LICEN') || tUpper === 'LIC') tipo = 'LICENCA';

          const horasBrutas = parseFloat(horasRaw.replace(',', '.')) || (tipo === 'FALTA_INJUSTIFICADA' ? 8 : 0);
          const forcarFeriado = ['SIM', 'TRUE', '1', 'S', 'YES'].includes(forcarFeriadoRaw.toUpperCase());

          const sptfCalc = calculateSPTFBalance(
            tipo,
            horasBrutas,
            dataRegistro,
            forcarFeriado,
            emp?.sede
          );

          const record: TimeRecord = {
            id: `rec-imp-${Date.now()}-${index}`,
            matricula,
            employeeName: emp?.nome || getRowValue(row, 'nome', 'nomecompleto', 'nome_completo') || 'Colaborador',
            employeeSede: emp?.sede || 'KO',
            employeeFuncao: emp?.funcao || emp?.cargo || 'Geral',
            dataRegistro,
            diaSemana: sptfCalc.diaSemana,
            diaSemanaNome: sptfCalc.diaSemanaNome,
            horasBrutas,
            tipoOcorrencia: tipo,
            codigoOcorrencia: tipo === 'FALTA_INJUSTIFICADA' 
              ? 'F' 
              : tipo === 'ATESTADO_MEDICO' 
                ? 'AT' 
                : tipo === 'COMPENSACAO' 
                  ? 'COMP' 
                  : tipo === 'FERIAS' 
                    ? 'FE' 
                    : tipo === 'LICENCA' 
                      ? 'LIC' 
                      : 'TRAB',
            eFeriado: sptfCalc.eFeriado,
            nomeFeriado: sptfCalc.nomeFeriado,
            multiplicador: sptfCalc.multiplicador,
            saldoCalculado: sptfCalc.saldoCalculado,
            observacao: obsRaw || undefined,
            criadoEm: new Date().toISOString()
          };

          validRecords.push(record);
        });

        resolve({
          success: errors.length === 0 || validRecords.length > 0,
          data: validRecords,
          errors,
          totalRows: results.data.length,
          importedCount: validRecords.length,
          duplicateCount: 0,
          skippedCount: 0
        });
      },
      error: (err) => {
        resolve({
          success: false,
          data: [],
          errors: [err.message],
          totalRows: 0,
          importedCount: 0,
          duplicateCount: 0,
          skippedCount: 0
        });
      }
    });
  });
}

/**
 * Gera um arquivo CSV modelo para cadastro de colaboradores no padrão oficial:
 * Matricula;Nome;Email;Funcao;Sede;Status;SenhaInicial
 */
export function generateEmployeesTemplateCSV(): string {
  const sampleData = [
    {
      Matricula: 'MAT-2001',
      Nome: 'Ana Carolina Peixoto',
      Email: 'ana.peixoto@comara.aer.mil.br',
      Funcao: 'Supervisora de Operações',
      Sede: 'KO',
      Status: 'Ativo',
      SenhaInicial: 'comara2025'
    },
    {
      Matricula: 'MAT-2002',
      Nome: 'Bruno Cesar Barreto',
      Email: 'bruno.barreto@comara.aer.mil.br',
      Funcao: 'Técnico de Manutenção',
      Sede: 'BE',
      Status: 'Ativo',
      SenhaInicial: ''
    },
    {
      Matricula: 'MAT-2003',
      Nome: 'Carla Vasconcelos Lima',
      Email: 'carla.lima@comara.aer.mil.br',
      Funcao: 'Engenheira de Segurança',
      Sede: 'MN',
      Status: 'Ativo',
      SenhaInicial: 'senha123'
    }
  ];

  return Papa.unparse(sampleData, { quotes: true, delimiter: ';' });
}

/**
 * Gera um arquivo CSV modelo para importação de lançamentos do Banco de Horas.
 */
export function generateTimeRecordsTemplateCSV(): string {
  const sampleData = [
    {
      Matricula: 'MAT-2001',
      Data: '2025-02-03',
      Horas: '2.5',
      Tipo: 'TRABALHO',
      Observacao: 'Horas extras na operação noturna',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2001',
      Data: '2025-02-08',
      Horas: '4.0',
      Tipo: 'TRABALHO',
      Observacao: 'Trabalho no sábado (1.5x)',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2002',
      Data: '2025-02-04',
      Horas: '8.0',
      Tipo: 'FALTA_INJUSTIFICADA',
      Observacao: 'Falta sem justificativa legal',
      Feriado: 'NAO'
    },
    {
      Matricula: 'MAT-2003',
      Data: '2025-02-05',
      Horas: '8.0',
      Tipo: 'ATESTADO_MEDICO',
      Observacao: 'Atestado médico de 1 dia (CID Z00.0)',
      Feriado: 'NAO'
    }
  ];

  return Papa.unparse(sampleData, { quotes: true, delimiter: ';' });
}

/**
 * Exporta colaboradores filtrados com seus respectivos saldos e status em formato CSV/Excel.
 */
export function exportFilteredBalancesCSV(
  employeesWithBalances: Array<Employee & { saldoTotalHoras: number; saldoTotalDias: number; totalAtestados: number; totalFaltas: number }>,
  titleScenario: string
): string {
  const rows = employeesWithBalances.map(emp => {
    let statusBanco = 'ZERADO';
    if (emp.saldoTotalHoras > 0.05) statusBanco = 'CREDOR';
    else if (emp.saldoTotalHoras < -0.05) statusBanco = 'DEVEDOR';

    return {
      'Cenario_Relatorio': titleScenario,
      'Matricula': emp.matricula,
      'Nome_Colaborador': emp.nome,
      'Cargo_Funcao': emp.funcao,
      'Sede_Origem': emp.sede,
      'Sede_Atual_Alocada': emp.sede_atual || emp.sede,
      'Status_Cadastral': emp.status,
      'Periodo_Status': emp.dataInicioStatus ? `${emp.dataInicioStatus} ate ${emp.dataFimStatus}` : 'N/A',
      'Saldo_Inicial_Horas': (emp.saldoInicialHoras || 0).toFixed(2),
      'Saldo_Total_Acumulado_Horas': emp.saldoTotalHoras.toFixed(2),
      'Saldo_Total_Acumulado_Dias': emp.saldoTotalDias.toFixed(2),
      'Status_Banco': statusBanco,
      'Total_Atestados_Medicos': emp.totalAtestados,
      'Total_Faltas_Injustificadas': emp.totalFaltas,
      'Data_Extracao': new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
  });

  return Papa.unparse(rows, { quotes: true, delimiter: ';' });
}

/**
 * Exporta lançamentos e dados consolidados em CSV pronto para Google Sheets e Looker Studio.
 */
export function exportTimeRecordsToLookerCSV(records: TimeRecord[], employees: Employee[]): string {
  const empMap = new Map(employees.map(e => [e.matricula, e]));

  const rows = records.map(r => {
    const emp = empMap.get(r.matricula);
    return {
      'ID_Registro': r.id,
      'Matricula': r.matricula,
      'Nome_Colaborador': r.employeeName || emp?.nome || 'N/D',
      'Sede': r.employeeSede || emp?.sede || 'KO',
      'Funcao_Cargo': r.employeeFuncao || emp?.funcao || 'N/D',
      'Data_Registro': r.dataRegistro,
      'Dia_Semana': r.diaSemanaNome,
      'Dia_Semana_Num': r.diaSemana,
      'E_Feriado': r.eFeriado ? 'SIM' : 'NAO',
      'Nome_Feriado': r.nomeFeriado || '',
      'Tipo_Ocorrencia': r.tipoOcorrencia,
      'Codigo_Ocorrencia': r.codigoOcorrencia || '',
      'Horas_Brutas': r.horasBrutas.toFixed(2),
      'Multiplicador_SPTF': r.multiplicador.toFixed(1),
      'Saldo_Calculado_Horas': r.saldoCalculado.toFixed(2),
      'Saldo_Calculado_Dias': (r.saldoCalculado / 8).toFixed(2),
      'Status_Lancamento': r.saldoCalculado > 0 ? 'CREDITO' : r.saldoCalculado < 0 ? 'DEBITO' : 'NEUTRO',
      'Tem_Comprovante': r.comprovante ? 'SIM' : 'NAO',
      'Link_Comprovante_Drive': r.comprovante?.driveViewUrl || '',
      'Observacao': r.observacao || '',
      'Data_Criacao': r.criadoEm,
    };
  });

  return Papa.unparse(rows, { quotes: true, delimiter: ';' });
}

/**
 * Dispara o download no navegador de um arquivo gerado.
 */
export function triggerFileDownload(content: string, fileName: string, mimeType: string = 'text/csv;charset=utf-8;') {
  const blob = new Blob(['\ufeff' + content], { type: mimeType }); // \ufeff para forçar UTF-8 BOM no Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface InsalubrityMatrixParsedWorker {
  itemNum: string;
  matricula: string;
  nome: string;
  cargo: string;
  activityDaysCount: number;
  isNewEmployee: boolean;
  employeeObj: Employee;
  sampleActivities: string[];
}

export interface InsalubrityMatrixImportResult {
  success: boolean;
  records: InsalubrityRecord[];
  workers: InsalubrityMatrixParsedWorker[];
  newEmployees: Employee[];
  uniqueActivities: Array<{ name: string; count: number }>;
  detectedPeriod: {
    year: number;
    month: number; // 0-11
    monthName: string;
    totalDays: number;
    startDate?: string;
    endDate?: string;
  };
  totalRecords: number;
  errors: string[];
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

/**
 * Determina o grau de insalubridade baseado na atividade informada na planilha de campo.
 */
export function inferGrauInsalubridade(activityName: string): '10%' | '20%' | '40%' {
  const norm = (activityName || '').toUpperCase().trim();
  if (
    norm.includes('ASFALT') ||
    norm.includes('ESGOTO') ||
    norm.includes('FOSSA') ||
    norm.includes('ALCATR') ||
    norm.includes('HIDROCARBONETO') ||
    norm.includes('LIXO')
  ) {
    return '40%';
  }
  if (
    norm.includes('CÂMARA') ||
    norm.includes('CAMARA') ||
    norm.includes('FRIO')
  ) {
    return '20%';
  }
  // Padrão de obras de canteiro COMARA (concreto, canaleta, rasga saco de cimento, britador, trilho, etc.)
  return '20%';
}

/**
 * Normaliza strings para cruzamento de nomes (sem acentos, minúsculo, sem pontuação duplicada)
 */
export function normalizeNameForMatching(name: string): string {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Faz o parsing de matriz de controle de campo (Folha Quinzenal / Mensal ou Tabela) para Insalubridades Simples
 */
export function parseInsalubrityMatrixCSV(
  fileContent: string,
  existingEmployees: Employee[],
  targetSede: Branch = 'KO',
  currentUserEmail: string = 'coari.comara@gmail.com'
): Promise<InsalubrityMatrixImportResult> {
  return new Promise((resolve) => {
    // 1. Parsing bruto de todas as linhas sem assumir cabeçalho fixo
    Papa.parse(fileContent, {
      skipEmptyLines: false,
      complete: (results) => {
        const rawRows = (results.data as any[][]) || [];
        const errors: string[] = [];

        if (rawRows.length === 0) {
          resolve({
            success: false,
            records: [],
            workers: [],
            newEmployees: [],
            uniqueActivities: [],
            detectedPeriod: { year: new Date().getFullYear(), month: new Date().getMonth(), monthName: MONTH_NAMES_PT[new Date().getMonth()], totalDays: 0 },
            totalRecords: 0,
            errors: ['O arquivo CSV está vazio ou em formato inválido.'],
          });
          return;
        }

        // 2. Cria mapas de busca com múltiplos critérios de matching
        const empByExactMatricula = new Map<string, Employee>();
        const empByDigitsMatricula = new Map<string, Employee>();
        const empByNormalizedName = new Map<string, Employee>();
        const empListWithNormalized = existingEmployees.map(emp => ({
          emp,
          cleanMat: sanitizeCsvCell(emp.matricula).toUpperCase(),
          digitsMat: sanitizeCsvCell(emp.matricula).replace(/\D/g, ''),
          normName: normalizeNameForMatching(emp.nome),
        }));

        empListWithNormalized.forEach(({ emp, cleanMat, digitsMat, normName }) => {
          if (cleanMat) empByExactMatricula.set(cleanMat, emp);
          if (digitsMat) empByDigitsMatricula.set(digitsMat, emp);
          if (normName) empByNormalizedName.set(normName, emp);
        });

        // Tenta detectar o ano e mês presentes em qualquer parte dos metadados superiores
        let globalDetectedYear = new Date().getFullYear();
        let globalDetectedMonth = new Date().getMonth();

        for (let r = 0; r < Math.min(rawRows.length, 10); r++) {
          const rowStr = (rawRows[r] || []).map(c => sanitizeCsvCell(c)).join(' ').toUpperCase();
          
          // Procura nomes dos meses em PT
          MONTH_NAMES_PT.forEach((mName, mIdx) => {
            if (rowStr.includes(mName.toUpperCase())) {
              globalDetectedMonth = mIdx;
            }
          });

          // Procura padrão de 4 dígitos para ano (ex: 2024, 2025, 2026, 2027)
          const yearMatch = rowStr.match(/\b(202\d)\b/);
          if (yearMatch) {
            globalDetectedYear = parseInt(yearMatch[1], 10);
          }
        }

        // 3. Localiza a linha com as datas
        let dateHeaderRowIndex = -1;
        interface DateColMeta {
          colIndex: number;
          dateStr: string; // YYYY-MM-DD
          dayNum: number;
        }
        let dateColumns: DateColMeta[] = [];
        let detectedYear = globalDetectedYear;
        let detectedMonth = globalDetectedMonth;

        for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
          const row = rawRows[r];
          if (!row || !Array.isArray(row)) continue;

          const tempDates: DateColMeta[] = [];
          for (let c = 0; c < row.length; c++) {
            const cell = sanitizeCsvCell(row[c]);
            if (!cell) continue;

            // 1. Padrão D/M/YYYY ou DD/MM/YYYY ou D/M/YY
            const dmyMatch = cell.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
            if (dmyMatch) {
              const day = parseInt(dmyMatch[1], 10);
              const month = parseInt(dmyMatch[2], 10); // 1-12
              let year = parseInt(dmyMatch[3], 10);
              if (year < 100) year += 2000;

              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                detectedYear = year;
                detectedMonth = month - 1;
                const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                tempDates.push({ colIndex: c, dateStr: formatted, dayNum: day });
              }
              continue;
            }

            // 2. Padrão YYYY-MM-DD
            const ymdMatch = cell.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
            if (ymdMatch) {
              const year = parseInt(ymdMatch[1], 10);
              const month = parseInt(ymdMatch[2], 10);
              const day = parseInt(ymdMatch[3], 10);
              detectedYear = year;
              detectedMonth = month - 1;
              const formatted = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              tempDates.push({ colIndex: c, dateStr: formatted, dayNum: day });
              continue;
            }

            // 3. Padrão D/M sem ano (ex: "1/8", "15/08")
            const dmMatch = cell.match(/^(\d{1,2})\/(\d{1,2})$/);
            if (dmMatch) {
              const day = parseInt(dmMatch[1], 10);
              const month = parseInt(dmMatch[2], 10);
              if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                detectedMonth = month - 1;
                const formatted = `${detectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                tempDates.push({ colIndex: c, dateStr: formatted, dayNum: day });
              }
              continue;
            }
          }

          // Se encontramos ao menos 3 colunas de datas completas nesta linha, é a linha de cabeçalho!
          if (tempDates.length >= 3) {
            dateHeaderRowIndex = r;
            dateColumns = tempDates;
            break;
          }
        }

        // Se não achou datas no formato D/M/Y, tenta detectar linha com números sequenciais de dias (1 a 31)
        if (dateHeaderRowIndex === -1) {
          for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
            const row = rawRows[r];
            if (!row || !Array.isArray(row)) continue;

            const tempDayCols: DateColMeta[] = [];
            for (let c = 0; c < row.length; c++) {
              const cell = sanitizeCsvCell(row[c]);
              if (!cell) continue;

              const num = parseInt(cell, 10);
              if (/^\d{1,2}$/.test(cell) && num >= 1 && num <= 31) {
                const formatted = `${detectedYear}-${String(detectedMonth + 1).padStart(2, '0')}-${String(num).padStart(2, '0')}`;
                tempDayCols.push({ colIndex: c, dateStr: formatted, dayNum: num });
              }
            }

            // Se encontrou ao menos 5 números de dias em sequência
            if (tempDayCols.length >= 5) {
              dateHeaderRowIndex = r;
              dateColumns = tempDayCols;
              break;
            }
          }
        }

        // Se não encontrou cabeçalho matricial, tenta formato tabular linear
        if (dateHeaderRowIndex === -1) {
          let headerRowIndex = -1;
          for (let r = 0; r < Math.min(rawRows.length, 5); r++) {
            const row = rawRows[r];
            const rowText = (row || []).map(c => sanitizeCsvCell(c).toLowerCase()).join(' ');
            if (rowText.includes('atividade') && (rowText.includes('data') || rowText.includes('nome') || rowText.includes('matricula'))) {
              headerRowIndex = r;
              break;
            }
          }

          if (headerRowIndex !== -1) {
            const headerRow = rawRows[headerRowIndex].map(c => sanitizeHeaderKey(c));
            const colMatricula = headerRow.findIndex(h => h.includes('mat') || h.includes('id') || h.includes('cod'));
            const colNome = headerRow.findIndex(h => h.includes('nom') || h.includes('colab') || h.includes('func'));
            const colData = headerRow.findIndex(h => h.includes('dat') || h.includes('dia'));
            const colAtiv = headerRow.findIndex(h => h.includes('ativ') || h.includes('serv') || h.includes('desc'));
            const colCargo = headerRow.findIndex(h => h.includes('carg') || h.includes('func') && !h.includes('colab'));

            const generatedRecords: InsalubrityRecord[] = [];
            const workersMap = new Map<string, InsalubrityMatrixParsedWorker>();
            const activityCounter = new Map<string, number>();

            for (let r = headerRowIndex + 1; r < rawRows.length; r++) {
              const row = rawRows[r];
              if (!row || row.length === 0) continue;

              const matriculaVal = colMatricula >= 0 ? sanitizeCsvCell(row[colMatricula]) : '';
              const nomeVal = colNome >= 0 ? sanitizeCsvCell(row[colNome]) : '';
              const dataVal = colData >= 0 ? sanitizeCsvCell(row[colData]) : '';
              const ativVal = colAtiv >= 0 ? sanitizeCsvCell(row[colAtiv]).toUpperCase() : '';
              const cargoVal = colCargo >= 0 ? sanitizeCsvCell(row[colCargo]) : 'Servente de Obras';

              if ((!matriculaVal && !nomeVal) || !dataVal || !ativVal) continue;

              const cleanDate = parseDateCell(dataVal);
              const cleanName = nomeVal || 'Colaborador';
              const cleanMatricula = matriculaVal || `MAT-${cleanName.substring(0, 3).toUpperCase()}-${r}`;

              const record: InsalubrityRecord = {
                id: `insalubre-${cleanMatricula.toUpperCase()}-${cleanDate}`,
                matricula: cleanMatricula.toUpperCase(),
                nomeColaborador: cleanName,
                funcao: cargoVal,
                sede: targetSede,
                dataEvento: cleanDate,
                atividadeDesempenhada: ativVal,
                grauExposicao: inferGrauInsalubridade(ativVal),
                quantidadeHorasDias: 1,
                unidade: 'DIAS',
                responsavelLancamento: 'Importação de Campo (CSV)',
                criadoEm: new Date().toISOString(),
                criadoPorEmail: currentUserEmail,
              };

              generatedRecords.push(record);
              activityCounter.set(ativVal, (activityCounter.get(ativVal) || 0) + 1);

              if (!workersMap.has(cleanMatricula.toUpperCase())) {
                workersMap.set(cleanMatricula.toUpperCase(), {
                  itemNum: String(r),
                  matricula: cleanMatricula.toUpperCase(),
                  nome: cleanName,
                  cargo: cargoVal,
                  activityDaysCount: 1,
                  isNewEmployee: !empByExactMatricula.has(cleanMatricula.toUpperCase()),
                  employeeObj: {
                    id: `emp-imp-${cleanMatricula}`,
                    matricula: cleanMatricula.toUpperCase(),
                    nome: cleanName,
                    funcao: cargoVal,
                    cargo: cargoVal,
                    sede: targetSede,
                    sede_origem: targetSede,
                    status: 'Ativo',
                    saldoInicialHoras: 0,
                    primeiroAcesso: true,
                    senhaCadastrada: false,
                    dataAdmissao: cleanDate,
                  },
                  sampleActivities: [ativVal],
                });
              } else {
                const w = workersMap.get(cleanMatricula.toUpperCase())!;
                w.activityDaysCount++;
                if (!w.sampleActivities.includes(ativVal)) {
                  w.sampleActivities.push(ativVal);
                }
              }
            }

            const workersList = Array.from(workersMap.values());
            const newEmps = workersList.filter(w => w.isNewEmployee).map(w => w.employeeObj);

            resolve({
              success: generatedRecords.length > 0,
              records: generatedRecords,
              workers: workersList,
              newEmployees: newEmps,
              uniqueActivities: Array.from(activityCounter.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
              detectedPeriod: {
                year: detectedYear,
                month: detectedMonth,
                monthName: MONTH_NAMES_PT[detectedMonth],
                totalDays: generatedRecords.length,
              },
              totalRecords: generatedRecords.length,
              errors,
            });
            return;
          }

          resolve({
            success: false,
            records: [],
            workers: [],
            newEmployees: [],
            uniqueActivities: [],
            detectedPeriod: { year: detectedYear, month: detectedMonth, monthName: MONTH_NAMES_PT[detectedMonth], totalDays: 0 },
            totalRecords: 0,
            errors: ['Não foi possível identificar o cabeçalho com as datas da matriz de campo ou colunas de atividade.'],
          });
          return;
        }

        // 4. Mapeamento das colunas de identificação do colaborador na linha do cabeçalho de datas
        const dateHeaderRow = rawRows[dateHeaderRowIndex];
        let colItem = 0;
        let colNome = 1;
        let colCargo = 2;

        const firstDateCol = dateColumns[0].colIndex;
        for (let c = 0; c < firstDateCol; c++) {
          const val = sanitizeCsvCell(dateHeaderRow[c]).toLowerCase();
          if (val.includes('item') || val.includes('nº') || val.includes('n°') || val.includes('num')) {
            colItem = c;
          } else if (val.includes('desc') || val.includes('nome') || val.includes('colab') || val.includes('func') || val.includes('serv')) {
            colNome = c;
          } else if (val.includes('carg') || val.includes('função') || val.includes('funcao') || val.includes('oficio')) {
            colCargo = c;
          }
        }

        // Se na linha do cabeçalho de data a coluna de cargo estava em branco, verifica na linha acima
        if (dateHeaderRowIndex > 0 && (!dateHeaderRow[colCargo] || sanitizeCsvCell(dateHeaderRow[colCargo]) === '')) {
          const prevRow = rawRows[dateHeaderRowIndex - 1];
          for (let c = 0; c < firstDateCol; c++) {
            const val = sanitizeCsvCell(prevRow[c]).toLowerCase();
            if (val.includes('carg') || val.includes('funç') || val.includes('serv')) {
              colCargo = c;
            }
          }
        }

        // 5. Itera pelas linhas de colaboradores (da linha posterior ao cabeçalho até o final)
        const generatedRecords: InsalubrityRecord[] = [];
        const workersList: InsalubrityMatrixParsedWorker[] = [];
        const newEmployeesList: Employee[] = [];
        const activityCounter = new Map<string, number>();

        for (let r = dateHeaderRowIndex + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || !Array.isArray(row) || row.length === 0) continue;

          const itemNumRaw = sanitizeCsvCell(row[colItem]);
          const nomeRaw = sanitizeCsvCell(row[colNome]);
          const cargoRaw = (colCargo < row.length ? sanitizeCsvCell(row[colCargo]) : '') || 'Servente de Obras';

          // Ignora linhas totalmente vazias ou de rodapé com totais gerais
          if (!nomeRaw && !itemNumRaw) continue;
          const nomeUpper = nomeRaw.toUpperCase();
          if (
            nomeUpper.includes('TOTAL') || 
            nomeUpper.includes('RESPONSÁVEL') || 
            nomeUpper.includes('ENCARREGADO') || 
            nomeUpper.includes('ASSINATURA') ||
            nomeUpper.includes('COMISSÃO DE') ||
            nomeUpper.includes('CHEFE DE')
          ) {
            continue;
          }
          if (nomeRaw.length < 2) continue;

          // Matching inteligente e robusto com a base existente
          const cleanNameNormalized = normalizeNameForMatching(nomeRaw);
          const itemDigits = itemNumRaw.replace(/\D/g, '');

          // 1. Busca por nome normalizado exato
          let matchedEmp = empByNormalizedName.get(cleanNameNormalized);

          // 2. Busca por matrícula exata ou numérica
          if (!matchedEmp && itemNumRaw) {
            matchedEmp = empByExactMatricula.get(itemNumRaw.toUpperCase()) ||
                         empByExactMatricula.get(`MAT-${itemNumRaw.padStart(4, '0')}`.toUpperCase());
          }
          if (!matchedEmp && itemDigits) {
            matchedEmp = empByDigitsMatricula.get(itemDigits) ||
                         empByDigitsMatricula.get(String(parseInt(itemDigits, 10)));
          }

          // 3. Busca por correspondência parcial de nome (se o nome do CSV está contido ou contém o nome do cadastro)
          if (!matchedEmp && cleanNameNormalized.length >= 6) {
            const foundPartial = empListWithNormalized.find(
              e => e.normName.includes(cleanNameNormalized) || cleanNameNormalized.includes(e.normName)
            );
            if (foundPartial) {
              matchedEmp = foundPartial.emp;
            }
          }

          let finalMatricula = '';
          let isNewEmp = false;
          let empObj: Employee;

          if (matchedEmp) {
            finalMatricula = matchedEmp.matricula.trim().toUpperCase();
            empObj = matchedEmp;
          } else {
            isNewEmp = true;
            finalMatricula = itemDigits 
              ? `MAT-${itemDigits.padStart(4, '0')}` 
              : `MAT-${cleanNameNormalized.split(' ')[0].substring(0, 3).toUpperCase()}-${String(r).padStart(3, '0')}`;

            empObj = {
              id: `emp-imp-${finalMatricula}`,
              matricula: finalMatricula,
              nome: nomeRaw,
              funcao: cargoRaw || 'Servente de Obras',
              cargo: cargoRaw || 'Servente de Obras',
              sede: targetSede,
              sede_origem: targetSede,
              status: 'Ativo',
              saldoInicialHoras: 0,
              primeiroAcesso: true,
              senhaCadastrada: false,
              dataAdmissao: dateColumns[0]?.dateStr || `${detectedYear}-01-01`,
            };
            newEmployeesList.push(empObj);
            
            // Registra nos maps para evitar duplicatas em linhas subsequentes
            empByExactMatricula.set(finalMatricula, empObj);
            if (itemDigits) empByDigitsMatricula.set(itemDigits, empObj);
            empByNormalizedName.set(cleanNameNormalized, empObj);
            empListWithNormalized.push({
              emp: empObj,
              cleanMat: finalMatricula,
              digitsMat: itemDigits,
              normName: cleanNameNormalized,
            });
          }

          // Lê as atividades em cada coluna de data
          let workerActivityCount = 0;
          const workerActivities: string[] = [];

          for (const dateCol of dateColumns) {
            if (dateCol.colIndex >= row.length) continue;
            const cellVal = sanitizeCsvCell(row[dateCol.colIndex]);

            // Se célula tem atividade informada
            if (cellVal && cellVal !== '0' && cellVal !== '-' && cellVal !== '.' && cellVal !== 'FALTA') {
              const atividadeNome = cellVal.toUpperCase().trim();
              workerActivityCount++;
              if (!workerActivities.includes(atividadeNome)) {
                workerActivities.push(atividadeNome);
              }

              activityCounter.set(atividadeNome, (activityCounter.get(atividadeNome) || 0) + 1);

              const record: InsalubrityRecord = {
                id: `insalubre-${finalMatricula}-${dateCol.dateStr}`,
                matricula: finalMatricula,
                nomeColaborador: empObj.nome,
                funcao: empObj.funcao || cargoRaw || 'Servente de Obras',
                sede: empObj.sede || targetSede,
                dataEvento: dateCol.dateStr,
                atividadeDesempenhada: atividadeNome,
                grauExposicao: inferGrauInsalubridade(atividadeNome),
                quantidadeHorasDias: 1,
                unidade: 'DIAS',
                responsavelLancamento: 'Folha de Campo de Obras (Importação CSV)',
                observacoes: `Apontamento importado da planilha de campo (Item ${itemNumRaw || r}).`,
                criadoEm: new Date().toISOString(),
                criadoPorEmail: currentUserEmail,
              };

              generatedRecords.push(record);
            }
          }

          workersList.push({
            itemNum: itemNumRaw || String(r - dateHeaderRowIndex),
            matricula: finalMatricula,
            nome: empObj.nome || nomeRaw,
            cargo: empObj.funcao || cargoRaw,
            activityDaysCount: workerActivityCount,
            isNewEmployee: isNewEmp,
            employeeObj: empObj,
            sampleActivities: workerActivities,
          });
        }

        const sortedActivities = Array.from(activityCounter.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        resolve({
          success: generatedRecords.length > 0 || workersList.length > 0,
          records: generatedRecords,
          workers: workersList,
          newEmployees: newEmployeesList,
          uniqueActivities: sortedActivities,
          detectedPeriod: {
            year: detectedYear,
            month: detectedMonth,
            monthName: MONTH_NAMES_PT[detectedMonth] || 'Mês Detectado',
            totalDays: dateColumns.length,
            startDate: dateColumns[0]?.dateStr,
            endDate: dateColumns[dateColumns.length - 1]?.dateStr,
          },
          totalRecords: generatedRecords.length,
          errors,
        });
      },
      error: (err) => {
        resolve({
          success: false,
          records: [],
          workers: [],
          newEmployees: [],
          uniqueActivities: [],
          detectedPeriod: { year: new Date().getFullYear(), month: new Date().getMonth(), monthName: MONTH_NAMES_PT[new Date().getMonth()], totalDays: 0 },
          totalRecords: 0,
          errors: [err.message || 'Erro ao processar CSV.'],
        });
      },
    });
  });
}

/**
 * Planilha de exemplo enviada pelo usuário (Agosto de 2026 - Obras COMARA)
 */
export const SAMPLE_INSALUBRITY_MATRIX_CSV = `,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
Inicio:,Inicio:,,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data, ,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,Data,TOTAL EM DIAS 
,,,7,1,2,3,4,5,6,7,1,2,3,4,5,6,7,1,2,3,4,5,6,7,1,2,3,4,5,6,7,1,2,
Item,Descrição,,1/8/2026,2/8/2026,3/8/2026,4/8/2026,5/8/2026,6/8/2026,7/8/2026,8/8/2026,9/8/2026,10/8/2026,11/8/2026,12/8/2026,13/8/2026,14/8/2026,15/8/2026,16/8/2026,17/8/2026,18/8/2026,19/8/2026,20/8/2026,21/8/2026,22/8/2026,23/8/2026,24/8/2026,25/8/2026,26/8/2026,27/8/2026,28/8/2026,29/8/2026,30/8/2026,31/8/2026,
1,ADEMAR GOMES DE CASTRO,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA/CONCRETO,,CANALETA,CANALETA,CANALETAS,,CANALETA,,,,,,,,10
2,AlDENILSON DE SOUZA LISBOA,SERV. OBRAS,,,,,,,,,,,TRILHO/CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,,,,,,,4
3,ADONEO FERNANDES DA SILVA,SERV. OBRAS,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
4,ADRIANO SILVA DE SENA,SERV. OBRAS ,,,,,,,,,,,,,,,,,CANALETA,CONCRETO,CONCRETO,CONCRETO,,CANALETAS,,,,,,,,,,5
5,ALCINEY MONTEIRO DA SILVA,SERV. OBRAS,,,,,,,,,,,RASGA SACO,RASGA SACO,RASGA SACO,CDC,,,,RASGA SACO/CONCRETO,CONCRETO,CONCRETO,,CANALETAS,,,,,,,,,,8
8,ARLISON NUNES DA SILVA,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,,,,,,,,,,,3
9,ATAIDE DA SILVA LIMA,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,CONCRETO,CONCRETO,,,,CANALETA,,,,,,,,6
10,BIBIANO CORDOVIL DA SILVA,SERV. OBRAS,,,,,,,,,,,TOPOGRAFIA,TOPOGRAFIA,TOPOGRAFIA,,,,,,,,,,,,,,,,,,,3
11,CARLOS ANTONIO SOMBRA,SERV. OBRAS,,,,,,,,,,,TOPOGRAFIA,TOPOGRAFIA,TOPOGRAFIA,,,,,,,CONCRETO,,,,,,,,,,,,4
12,CLAUDIO SANTOS DE SOUZA,SERV. OBRAS,,,,,,,,,,,RASGA SACO,RASGA SACO,RASGA SACO,RASGA SACO,,,,RASGA SACO/CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,7
13,COSMO DA SILVA AZEVEDO ,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,CANALETA,CANALETA,,,,CANALETAS,,,,,,,,,,6
14,CRISTOVAM DA SILVA CORREA ,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,CANALETAS,,CANALETA,,,,,,,,11
15,DAMIÃO DE ARAUJO MOURA,SERV. OBRAS,,,,,,,,,,,TRILHO/CDC,RASGA SACO,RASGA SACO,RASGA SACO,,,,,,,,,,,,,,,,,,4
16,DANIEL MOREIRA AUANARIO,SERV. OBRAS,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
17,DANIEL PINHEIRO PRAIA ,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,CONCRETO,,,,,,,,,,,,,,4
18,DIONES DA SILVA CAVALCANTE ,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,,,CANALETA,,,CANALETA,,,,,,,,8
19,EDIVAN ROCHA DA SLVA ,SERV. OBRAS,,,,,,,,,,,RASGA SACO,RASGA SACO,RASGA SACO,CDC,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,,,CANALETA,,,,,,,,10
20,EDILSON SEGUNDO NASCIMENTO,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,CONCRETO,CONCRETO,,,,CANALETA,,,,,,,,6
21,EDGAR DOS SANTOS ARAUJO,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,,,,,,,,,,,3
22,ELIZEU OLIVEIRA DE SOUZA,SERV. OBRAS,,,,,,,,,,,RASGA SACO,RASGA SACO,RASGA SACO,RASGA SACO,,,,,CONCRETO,,,,,CANALETA,,,,,,,,6
25,GEILSON MESQUITA PEREIRA,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CONCRETO,CANALETA,CANALETA,,CANALETA,,,,,,,,11
26,GIBSON ALMEIDA DA SILVA,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,,CONCRETO,,,,CANALETA,CANALETA,CANALETA,CANALETA,,,CANALETA,,,,,,,,8
27,GUIBSON OLIVEIRA BARBOSA,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,CANALETA,,,,,,,,,,4
30,ISMAEL GONÇALVES BARBOSA,SERV. OBRAS,,,,,,,,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,3
31,JANIO DO NASCIMENTO QUEIROZ ,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,,,,CANALETA,CANALETA,CANALETA,,CANALETA,,,,,,,,8
32,JANDER LIRA MACHADO,SERV. OBRAS,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
33,JEFERSON AZEVEDO DE CARVALHO,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,CONCRETO,CONCRETO,,,,CANALETA,,,,,,,,6
35,JONES SILVA DE MELO,SERV. OBRAS,,,,,,,,,,,,TRILHO,TRILHO,,,,,,CONCRETO,,,CANALETA,,CANALETA,,,,,,,,5
36,JOSE CARLOS MENDES DE CASTRO,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,,,,,,,,,,,3
38,JOSIAS DOS SANTOS CARVALHO,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,,,,,,,4
39,JUCIMAR FERREIRA DE FREITAS JUNIOR,SERV. OBRAS ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
40,LAILSON NASCIMENTO DOS SANTOS,SERV. OBRAS ,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,,,CANALETA,,,,,,,,10
41,LUCIANO DE SOUZA FERREIRA,SERV. OBRAS,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
42,LUIZ FERNANDO BERNARDO DE VASCONCELOS,SERV. OBRAS,,,,,,,,,,,CDC,RASGA SACO,CDC,CDC,,,,RASGA SACO/CONCRETO,CONCRETO,CONCRETO,,CANALETAS,,,,,,,,,,8
43,MATEUS MARQUES RIBEIRO,SERV. OBRAS,,,,,,,,,,,TRILHO,RASGA SACO,RASGA SACO,RASGA SACO,,,,CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,7
44,MEMESIO DOS SANTOS ATAIDE,SERV. OBRAS,,,,,,,,,,,RASGA SACO,RASGA SACO,RASGA SACO,RASGA SACO,,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETAS,,CANALETA,,,,,,,,10
45,MOISES CANDICO MARINHO,SERV. OBRAS ,,,,,,,,,,,CDC,RASGA SACO,CDC,CDC,,,,RASGA SACO/CONCRETO,CONCRETO,CONCRETO,,CANALETAS,,,,,,,,,,8
46,NEUBER MENDES COSTA,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,,,,,,,,,,,9
48,PAULO ALVEZ GOMES,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,,,,,,,,,,,3
49,RAFAEL DOS SANTOS GARCIA,SERV. OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,CONCRETO,CONCRETO,,,,CANALETA,,,,,,,,6
50,RAIMUNDO NONATO CARVALHO SOARES,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,,,,,,CANALETA,,CANALETA,,,,,,,,6
51,ROBERIO ALVES DA SILVA,SERV. OBRAS,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,,,,CANALETA,,,,,,,,9
52,RONEI FERREIRA DE ARAÚJO,SERV. OBRAS ,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,,,CANALETA,,,,,,,,10
53,SILZONEI COELHO DE SOUZA ,SERV. OBRAS ,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,CONCRETO,,,CANALETA,CANALETA,CANALETA,CANALETA,CANALETA,CANALETAS,,CANALETA,,,,,,,,11
54,WANDERLEY BERNARDO DE VASCONCELOS,SERV. OBRAS ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
55,OZAIAS PEREIRA DA SILVA,SERV. OBRAS,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
56,RAYMISSON LUCAS MAGALHÃES DE CASTRO,SERV. OBRAS,,,,,,,,,,,TOPOGRAFIA,TOPOGRAFIA,TOPOGRAFIA,,,,,,,,,,,,,,,,,,,3
58,JOSE RONIVON FERREIRA DE FREITAS,"MOTORISTA DE CAMINHÃO CAT ""D""",,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
62,RAIONILSON FIGUEIREDO DA SILVA,MOTORISTA OPERACIONAL DE GUINCHO,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,0
63,SAYMO LIMA DOS REIS,MOTORISTA CAT D,,,,,,,,,,,,,,,,,,,CONCRETO,,,,,,,,,,,,,
65,CLEYSON NASCIMENTO DE ARAUJO,SERVENTE DE OBRAS,,,,,,,,,,,TRILHO/RASGA SACO,RASGA SACO,RASGA SACO,RASGA SACO,,,,,,,,,,,,,,,,,,4
66,RUSIVALDO DA SILVA GUIMARAES,SERVENTE DE OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,,,,,,,,,,,,,,3
67,RONALDO MOTA ARAUJO,SERV.OBRAS,,,,,,,,,,,TRILHO,TRILHO,TRILHO,,,,,,CONCRETO,CONCRETO,,,,CANALETA,,,,,,,,6
68,FRANCISCO ASSIS DA SILVA CARDOSO,SERV. OBRAS,,,,,,,,,,,,,,,,,,CONCRETO,CONCRETO,CONCRETO,,,,,,,,,,,,3
69,ELMIR DA SILVA VASCONCELOS,MOTORISTA CAT D,,,,,,,,,,,,,,,,,,,CONCRETO,CONCRETO,,,,,,,,,,,,
69,JAILSON DE MACEDO,MOTORISTA CAT D,,,,,,,,,,,,,,RASGA SACO,,,,CONCRETO,MOT.ABV,MOT.ABV,,MOT.ABV,,,,,,,,,,`;

/**
 * Gera um modelo de planilha de campo em formato Matriz Quinzenal / Mensal
 */
export function generateInsalubrityMatrixTemplateCSV(): string {
  return SAMPLE_INSALUBRITY_MATRIX_CSV;
}

