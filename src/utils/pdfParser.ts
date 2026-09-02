import * as pdfjsLib from 'pdfjs-dist';
import { PaystubRecord, PaystubRubrica, Employee, Branch } from '../types';
import { maskCPF, cleanCPF, isValidCPF } from './lgpdUtils';

// Configure worker safely for browser environments (Vite)
if (typeof window !== 'undefined') {
  try {
    const workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  } catch (err) {
    console.warn('PDF.js worker setup notice:', err);
  }
}

/**
 * Normaliza matrícula removendo zeros à esquerda e espaços (ex: "013974" -> "13974")
 */
export function normalizeMatricula(mat: string | undefined | null): string {
  if (!mat) return '';
  const clean = mat.toString().trim().toUpperCase().replace(/^0+/, '');
  return clean || '0';
}

/**
 * Formata matrícula visualmente com 6 dígitos se for número puro (ex: "13974" -> "013974")
 */
export function formatMatriculaVisual(mat: string | undefined | null): string {
  if (!mat) return '';
  const clean = normalizeMatricula(mat);
  if (/^\d+$/.test(clean) && clean.length < 6) {
    return clean.padStart(6, '0');
  }
  return clean;
}

export interface ParsePaystubResult {
  paystubs: PaystubRecord[];
  totalPages: number;
  totalExtracted: number;
  unregisteredEmployees: {
    matricula: string;
    nome: string;
    cargo: string;
    sede: string;
  }[];
  warnings: string[];
}

/**
 * Converte string de moeda brasileira (ex: "2.830,38", "560,53", "1.192,00", "354,95") para número float
 */
export function parseCurrencyBR(valStr: string | undefined | null): number {
  if (!valStr) return 0;
  let clean = valStr.trim().replace(/[R$\s]/g, '');
  if (!clean) return 0;

  // Remove caracteres percentuais ou sufixos se houver
  clean = clean.replace(/[%]/g, '').trim();

  // Se tiver vírgula e ponto (ex: 2.830,38)
  if (clean.includes(',') && clean.includes('.')) {
    const normalized = clean.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  // Se tiver apenas vírgula (ex: 560,53 ou 124,54)
  if (clean.includes(',')) {
    const normalized = clean.replace(',', '.');
    const n = parseFloat(normalized);
    return isNaN(n) ? 0 : n;
  }
  // Se for float puro
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}

/**
 * Extrai texto posicional ordenado de uma página do PDF com tolerância adaptativa
 */
async function extractLinesFromPdfPage(page: any): Promise<string[]> {
  const textContent = await page.getTextContent({ normalizeWhitespace: true });
  const items = textContent.items as Array<{
    str: string;
    transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
    width: number;
    height: number;
  }>;

  if (!items || items.length === 0) return [];

  // Agrupa itens por coordenada Y (linhas visuais) com tolerância de 4.5px
  const linesMap: { y: number; items: typeof items }[] = [];

  for (const item of items) {
    const text = item.str.trim();
    if (!text) continue;

    const y = item.transform[5];

    // Procura linha próxima
    let existingLine = linesMap.find((l) => Math.abs(l.y - y) <= 4.5);
    if (!existingLine) {
      existingLine = { y, items: [] };
      linesMap.push(existingLine);
    }
    existingLine.items.push(item);
  }

  // Ordena linhas de cima para baixo (Y decrescente)
  linesMap.sort((a, b) => b.y - a.y);

  // Para cada linha, ordena itens da esquerda para a direita (X crescente) e junta o texto
  const lines: string[] = [];
  for (const line of linesMap) {
    line.items.sort((a, b) => a.transform[4] - b.transform[4]);
    const lineText = line.items.map((it) => it.str).join(' ').replace(/\s+/g, ' ').trim();
    if (lineText) {
      lines.push(lineText);
    }
  }

  return lines;
}

/**
 * Identifica se uma rubrica é um desconto conhecido
 */
export function isRubricaDesconto(codigo: string, descricao: string): boolean {
  const descUpper = descricao.toUpperCase();
  const codNum = parseInt(codigo, 10);

  // Códigos típicos de descontos da COMARA / Aeronáutica
  if ([611, 612, 613, 614, 615, 620, 630, 901, 902, 903, 904, 905, 908, 910, 911, 915, 920, 925, 930, 940, 950, 999].includes(codNum)) {
    return true;
  }

  if (
    descUpper.includes('DESC') ||
    descUpper.includes('DESCONTO') ||
    descUpper.includes('INSS') ||
    descUpper.includes('IRRF') ||
    descUpper.includes('IMPOSTO DE RENDA') ||
    descUpper.includes('FALTA') ||
    descUpper.includes('ATRASO') ||
    descUpper.includes('PENSAO') ||
    descUpper.includes('PENSÃO') ||
    descUpper.includes('SINDICATO') ||
    descUpper.includes('VALE') ||
    descUpper.includes('ADIANTAMENTO') ||
    descUpper.includes('CONSIG')
  ) {
    return true;
  }

  return false;
}

/**
 * Tenta separar Nome de Servidor e Cargo quando aparecem na mesma linha
 * Ex: "013974 OTNIEL DA ROCHA CABRAL MECANICO DE MANUTENCAO DE MAQUINAS DE CONSTRUCAO E"
 */
export function extractNomeAndCargo(rawText: string): { nome: string; cargo: string } {
  let clean = rawText.trim();

  // Lista de palavras-chave que marcam o início da função/cargo na COMARA
  const cargoKeywords = [
    'MECANICO',
    'MECÂNICO',
    'OPERADOR',
    'MOTORISTA',
    'ELETRICISTA',
    'PEDREIRO',
    'SERVENTE',
    'CARPINTEIRO',
    'ARMADOR',
    'APONTADOR',
    'ENCARREGADO',
    'SOLDADOR',
    'TECNICO',
    'TÉCNICO',
    'AUXILIAR',
    'ENGENHEIRO',
    'TOPOGRAFO',
    'TOPÓGRAFO',
    'ANALISTA',
    'ALMOXARIFE',
    'BORRACHEIRO',
    'LUBRIFICADOR',
    'FEITOR',
    'VIGIA',
    'AGENTE',
    'ASSISTENTE'
  ];

  const words = clean.split(/\s+/);
  let splitIndex = -1;

  for (let i = 1; i < words.length; i++) {
    const wordUpper = words[i].toUpperCase();
    if (cargoKeywords.some(k => wordUpper === k || wordUpper.startsWith(k))) {
      splitIndex = i;
      break;
    }
  }

  if (splitIndex !== -1) {
    const nome = words.slice(0, splitIndex).join(' ').trim();
    const cargo = words.slice(splitIndex).join(' ').trim();
    return {
      nome: nome || clean,
      cargo: cargo || 'COLABORADOR DA CONSTRUÇÃO'
    };
  }

  // Fallback: se não encontrar palavra-chave de cargo, considera as 3 ou 4 primeiras palavras como nome
  if (words.length > 4) {
    return {
      nome: words.slice(0, 4).join(' ').trim(),
      cargo: words.slice(4).join(' ').trim()
    };
  }

  return {
    nome: clean,
    cargo: 'COLABORADOR DA CONSTRUÇÃO'
  };
}

/**
 * Parser de texto de um contracheque individual da COMARA
 */
export function parseSingleContrachequeText(
  lines: string[], 
  currentUserEmail?: string, 
  pageNumber?: number
): PaystubRecord | null {
  if (!lines || lines.length === 0) return null;

  let rawMatricula = '';
  let matricula = '';
  let nome = '';
  let cargo = '';
  let sede = 'KO-DL';
  let periodo = '';
  let mesAno = '';
  let mes = 7;
  let ano = 2026;
  let dataInicio = '';
  let dataFim = '';
  let cpf = '';
  let banco = '';
  let agencia = '';
  let conta = '';

  let totalProventos = 0;
  let totalDescontos = 0;
  let valorLiquido = 0;
  let salarioBase = 0;
  let baseInss = 0;
  let baseFgts = 0;
  let fgtsMes = 0;
  let baseIrrf = 0;

  const rubricas: PaystubRubrica[] = [];

  // Percorre as linhas do contracheque
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Extração de Matrícula, Nome e Cargo
    // Ex: "013974 OTNIEL DA ROCHA CABRAL MECANICO DE MANUTENCAO DE MAQUINAS DE CONSTRUCAO E"
    // Ex: "013974 OTNIEL DA ROCHA CABRAL"
    if (!matricula) {
      const matLineMatch = line.match(/^(\d{5,7})\s+([A-ZÀ-Ú\s\.\'\-]{3,})/i);
      if (matLineMatch) {
        rawMatricula = matLineMatch[1].trim();
        matricula = normalizeMatricula(rawMatricula); // "013974" -> "13974"
        const restOfLine = matLineMatch[2].trim();
        const extracted = extractNomeAndCargo(restOfLine);
        nome = extracted.nome;
        if (!cargo || cargo === 'COLABORADOR DA CONSTRUÇÃO') {
          cargo = extracted.cargo;
        }
      } else {
        const matExplicitMatch = line.match(/(?:MATR[ÍI]CULA|MATR?\.?|SERV\.?)?[:\s]*(\d{5,7})\s+([A-ZÀ-Ú\s\.\'\-]{3,})/i);
        if (matExplicitMatch) {
          rawMatricula = matExplicitMatch[1].trim();
          matricula = normalizeMatricula(rawMatricula);
          const restOfLine = matExplicitMatch[2].trim();
          const extracted = extractNomeAndCargo(restOfLine);
          nome = extracted.nome;
          if (!cargo) cargo = extracted.cargo;
        }
      }
    }

    // 2. Extração de Sede e Período
    // Ex: "01/07/2026a31/07/2026 KO-DL 00394429009086"
    // Ex: "01/07/2026 a 31/07/2026 KO-DL"
    const dateRangeMatch = line.match(/(\d{2}\/\d{2}\/\d{4})\s*(?:a|A|à|À|-)\s*(\d{2}\/\d{2}\/\d{4})/);
    if (dateRangeMatch) {
      dataInicio = dateRangeMatch[1];
      dataFim = dateRangeMatch[2];
      const parts = dataFim.split('/');
      if (parts.length === 3) {
        mes = parseInt(parts[1], 10);
        ano = parseInt(parts[2], 10);
        mesAno = `${String(mes).padStart(2, '0')}-${ano}`;
        periodo = `${String(mes).padStart(2, '0')}/${ano}`;
      }
    }

    if (line.match(/\b(KO-DL|KO|BE|MN|MN-AM|BE-PA|COARI|BEL[EÉ]M|MANAUS)\b/i)) {
      const matchSede = line.match(/\b(KO-DL|KO|BE|MN|MN-AM|BE-PA|COARI|BEL[EÉ]M|MANAUS)\b/i);
      if (matchSede) {
        const raw = matchSede[1].toUpperCase();
        sede = raw === 'COARI' ? 'KO-DL' : raw === 'BELÉM' || raw === 'BELEM' ? 'BE' : raw === 'MANAUS' ? 'MN' : raw;
      }
    }

    // 2.1 Extração de CPF do Colaborador
    if (!cpf) {
      // a) Rótulo explícito "CPF: 123.456.789-01" ou "CPF 12345678901" ou "DOC: 123.***.***-01"
      const explicitCpfMatch = line.match(/(?:CPF|CIC|DOC(?:UMENTO)?)\s*[:\s]*([0-9\.\-\*]{11,18})/i);
      if (explicitCpfMatch) {
        cpf = maskCPF(explicitCpfMatch[1]);
      } else {
        // b) Formato formatado completo: 123.456.789-01
        const formattedCpfMatch = line.match(/\b(\d{3}\.\d{3}\.\d{3}-\d{2})\b/);
        if (formattedCpfMatch) {
          cpf = maskCPF(formattedCpfMatch[1]);
        } else {
          // c) Formato mascarado com asteriscos (123.***.***-01 ou ***.456.789-**)
          const maskedCpfMatch = line.match(/\b(\d{3}\.\*{3}\.\*{3}-\d{2}|\*{3}\.\d{3}\.\d{3}-\*{2})\b/);
          if (maskedCpfMatch) {
            cpf = maskCPF(maskedCpfMatch[1]);
          } else if (!line.includes('BANCO') && !line.includes('AGENCIA') && !line.includes('CONTA')) {
            // d) Sequência de 11 a 14 dígitos (ex: "01/07/2026a31/07/2026 KO-DL 00394429009086" -> 00394429009)
            const longDigitsMatch = line.match(/\b(\d{11,14})\b/);
            if (longDigitsMatch) {
              const candidate = longDigitsMatch[1].substring(0, 11);
              if (isValidCPF(candidate)) {
                cpf = maskCPF(candidate);
              }
            }
          }
        }
      }
    }

    // 3. Extração de Rubricas com Suporte a Todos os Formatos da COMARA
    // Exemplos reais do PDF:
    // "001 Salário Base 2.830,38"
    // "060 Auxilio Transporte ATS JUL e AGO/26 560,53"
    // "600 Auxílio Alimentação 1.192,00"
    // "722 Auxilio Alimentacao Atrasado JUL 1.192,00"
    // "611 Desc. auxilio transporte 124,54"
    // "903 INSS Folha 230,41"
    const rubricaMatch = line.match(/^(\d{3,4})\s+(.+)$/);
    if (rubricaMatch) {
      const cod = rubricaMatch[1].trim();
      const rest = rubricaMatch[2].trim();

      // Procura todos os valores monetários no final da linha (ex: "2.830,38" ou "560,53" ou "1.192,00" ou "5.774,91 354,95")
      // Expressão que localiza números formatados em moeda BR no final da string
      const valuesMatches = rest.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);

      if (valuesMatches && valuesMatches.length > 0) {
        // Encontra onde começam os valores numéricos no final para extrair a descrição
        const lastValueStr = valuesMatches[valuesMatches.length - 1];
        const firstValueStr = valuesMatches[0];
        
        let desc = rest;
        // Corta a descrição antes do primeiro valor monetário
        const firstValIdx = rest.indexOf(firstValueStr);
        if (firstValIdx > 0) {
          desc = rest.substring(0, firstValIdx).trim();
        }

        // Extrai referência opcional da descrição se houver (ex: "30D", "22D", "14.00%", "6.00%", "12:00")
        let referencia = '';
        const refMatch = desc.match(/\b(\d+(?:[\:\,\.]\d+)?(?:%|D|H))\b/i);
        if (refMatch) {
          referencia = refMatch[1];
          desc = desc.replace(refMatch[0], '').trim();
        }

        // Descarta se for linha de totais
        const descUpper = desc.toUpperCase();
        if (
          !descUpper.includes('TOTAL') && 
          !descUpper.includes('LÍQUIDO') && 
          !descUpper.includes('LIQUIDO') &&
          !descUpper.includes('BASE DE')
        ) {
          let provento = 0;
          let desconto = 0;

          if (valuesMatches.length >= 2) {
            // Dois valores no final: 1º Provento, 2º Desconto
            provento = parseCurrencyBR(valuesMatches[valuesMatches.length - 2]);
            desconto = parseCurrencyBR(valuesMatches[valuesMatches.length - 1]);
          } else {
            // Um único valor: classifica pela natureza da rubrica
            const val = parseCurrencyBR(valuesMatches[0]);
            const isDesc = isRubricaDesconto(cod, desc);
            if (isDesc) {
              desconto = val;
            } else {
              provento = val;
            }
          }

          if (provento > 0 || desconto > 0) {
            // Se for rubrica 001 (Salário Base), armazena
            if (cod === '001' && provento > 0) {
              salarioBase = provento;
            }

            rubricas.push({
              codigo: cod,
              descricao: desc || `Rubrica ${cod}`,
              referencia,
              provento,
              desconto,
              tipo: desconto > 0 ? 'DESCONTO' : 'PROVENTO'
            });
          }
        }
      }
    }

    // 4. Extração de Totais e Rodapé (Valores Isolados)
    // No PDF da Aeronáutica/COMARA:
    // Linha de Totais: "5.774,91 354,95" (Proventos / Descontos)
    // Linha de Líquido: "5.419,96"
    // Linha de Bases: "2.830,38 2.830,38 0,00 0,00 2.223,18 0,00 %"
    const isPureNumbersLine = /^[\d\.\,\s\%\-]+$/.test(line);
    if (isPureNumbersLine) {
      const numbers = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/g);
      if (numbers) {
        if (numbers.length === 2 && !line.startsWith('00') && !line.startsWith('01')) {
          // Ex: "5.774,91 354,95"
          const v1 = parseCurrencyBR(numbers[0]);
          const v2 = parseCurrencyBR(numbers[1]);
          if (v1 > 100 && v2 >= 0) {
            totalProventos = v1;
            totalDescontos = v2;
          }
        } else if (numbers.length === 1 && !line.startsWith('00')) {
          // Ex: "5.419,96" (Valor Líquido)
          const v = parseCurrencyBR(numbers[0]);
          if (v > 100) {
            valorLiquido = v;
          }
        } else if (numbers.length >= 4) {
          // Ex: "2.830,38 2.830,38 0,00 0,00 2.223,18 0,00 %" (Bases de Cálculo)
          if (!salarioBase) salarioBase = parseCurrencyBR(numbers[0]);
          baseInss = parseCurrencyBR(numbers[1]);
          baseFgts = parseCurrencyBR(numbers[2]);
          fgtsMes = parseCurrencyBR(numbers[3]);
          if (numbers.length >= 5) {
            baseIrrf = parseCurrencyBR(numbers[4]);
          }
        }
      }
    }

    // Fallbacks para rótulos explícitos
    if (line.match(/TOTAL\s+(?:DE\s+)?(?:VENCIMENTOS|PROVENTOS)/i)) {
      const matchTot = line.match(/TOTAL\s+(?:DE\s+)?(?:VENCIMENTOS|PROVENTOS)[:\s]*([\d\.\,]+)/i);
      if (matchTot) totalProventos = parseCurrencyBR(matchTot[1]);
    }
    if (line.match(/TOTAL\s+(?:DE\s+)?DESCONTOS/i)) {
      const matchTot = line.match(/TOTAL\s+(?:DE\s+)?DESCONTOS[:\s]*([\d\.\,]+)/i);
      if (matchTot) totalDescontos = parseCurrencyBR(matchTot[1]);
    }
    if (line.match(/(?:VALOR\s+)?L[ÍI]QUIDO(?:\s+A\s+RECEBER)?/i)) {
      const matchLiq = line.match(/(?:VALOR\s+)?L[ÍI]QUIDO(?:\s+A\s+RECEBER)?[:\s]*([\d\.\,]+)/i);
      if (matchLiq) valorLiquido = parseCurrencyBR(matchLiq[1]);
    }
  }

  // Validação mínima: precisa ter matrícula ou nome para ser um contracheque válido
  if (!matricula && !nome) {
    return null;
  }

  if (!matricula && nome) {
    matricula = `10${String(pageNumber || 1).padStart(4, '0')}`;
  }

  if (!mesAno) {
    mesAno = '07-2026';
    periodo = '07/2026';
    ano = 2026;
    mes = 7;
  }

  // Cálculo e reconciliação dos totais através das rubricas
  const sumProventos = rubricas.reduce((acc, r) => acc + r.provento, 0);
  const sumDescontos = rubricas.reduce((acc, r) => acc + r.desconto, 0);

  if (totalProventos === 0 && sumProventos > 0) {
    totalProventos = sumProventos;
  }
  if (totalDescontos === 0 && sumDescontos > 0) {
    totalDescontos = sumDescontos;
  }
  if (valorLiquido === 0) {
    valorLiquido = Math.max(0, totalProventos - totalDescontos);
  }

  // Garante salário base se houver rubrica 001
  if (!salarioBase) {
    const rub001 = rubricas.find(r => r.codigo === '001');
    if (rub001 && rub001.provento > 0) {
      salarioBase = rub001.provento;
    } else {
      salarioBase = totalProventos;
    }
  }

  // Document ID unificado no Firestore: `${matricula}_${mesAno}` (ex: "13974_07-2026")
  const docId = `${matricula}_${mesAno}`;

  return {
    id: docId,
    matricula, // "13974" (sem zero à esquerda)
    nome: nome || 'COLABORADOR COMARA',
    cargo: cargo || 'COLABORADOR DA CONSTRUÇÃO',
    sede: sede || 'KO-DL',
    periodo: periodo || `${mesAno.replace('-', '/')}`,
    mesAno,
    ano,
    mes,
    dataInicio,
    dataFim,
    cpf,
    banco,
    agencia,
    conta,
    rubricas,
    totalProventos,
    totalDescontos,
    valorLiquido,
    salarioBase,
    baseInss: baseInss || totalProventos,
    baseFgts: baseFgts || totalProventos,
    fgtsMes: fgtsMes || (baseFgts ? baseFgts * 0.08 : totalProventos * 0.08),
    baseIrrf: baseIrrf || Math.max(0, totalProventos - ((baseInss || totalProventos) * 0.14)),
    importadoEm: new Date().toISOString(),
    importadoPorEmail: currentUserEmail || 'coari.comara@gmail.com',
    observacoes: `Ficha Financeira Oficial extraída via Leitor PDF COMARA (Página ${pageNumber || 1})`
  };
}

/**
 * Processa um arquivo PDF completo no navegador (podendo ter múltiplos contracheques concatenados)
 * e compara com a lista existente de colaboradores para identificar servidores não cadastrados.
 */
export async function parseComaraPdfContracheques(
  pdfArrayBuffer: ArrayBuffer,
  existingEmployees: Employee[] = [],
  currentUserEmail?: string,
  onProgress?: (current: number, total: number) => void
): Promise<ParsePaystubResult> {
  const warnings: string[] = [];
  const paystubsMap = new Map<string, PaystubRecord>();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: pdfArrayBuffer,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      if (onProgress) {
        onProgress(pageNum, totalPages);
      }

      try {
        const page = await pdfDoc.getPage(pageNum);
        const lines = await extractLinesFromPdfPage(page);

        if (lines.length > 0) {
          const parsed = parseSingleContrachequeText(lines, currentUserEmail, pageNum);
          if (parsed && parsed.matricula) {
            const existing = paystubsMap.get(parsed.id);
            if (existing) {
              // Se já existir a mesma matrícula no mesmo mês (página de continuação):
              // Preserva rubricas mais completas e unifica
              if (parsed.rubricas.length > 0) {
                if (existing.rubricas.length === 0) {
                  paystubsMap.set(parsed.id, parsed);
                } else {
                  // Adiciona rubricas que ainda não constem
                  parsed.rubricas.forEach(r => {
                    const hasRub = existing.rubricas.some(er => er.codigo === r.codigo && er.descricao === r.descricao);
                    if (!hasRub) {
                      existing.rubricas.push(r);
                    }
                  });
                  existing.totalProventos = Math.max(existing.totalProventos, parsed.totalProventos);
                  existing.totalDescontos = Math.max(existing.totalDescontos, parsed.totalDescontos);
                  existing.valorLiquido = Math.max(existing.valorLiquido, parsed.valorLiquido);
                  if (parsed.salarioBase && !existing.salarioBase) existing.salarioBase = parsed.salarioBase;
                }
              }
            } else {
              paystubsMap.set(parsed.id, parsed);
            }
          }
        }
      } catch (pageErr: any) {
        warnings.push(`Erro ao processar página ${pageNum}: ${pageErr?.message || pageErr}`);
      }
    }

    const paystubs = Array.from(paystubsMap.values());

    // Identifica servidores não cadastrados no banco de colaboradores
    const existingMatriculasSet = new Set(
      existingEmployees.map(e => normalizeMatricula(e.matricula))
    );

    const unregisteredMap = new Map<string, { matricula: string; nome: string; cargo: string; sede: string; cpf?: string }>();

    for (const p of paystubs) {
      const normMat = normalizeMatricula(p.matricula);
      if (!existingMatriculasSet.has(normMat) && !unregisteredMap.has(normMat)) {
        unregisteredMap.set(normMat, {
          matricula: normMat,
          nome: p.nome,
          cargo: p.cargo,
          sede: p.sede || 'KO-DL',
          cpf: p.cpf
        });
      }
    }

    const unregisteredEmployees = Array.from(unregisteredMap.values());

    return {
      paystubs,
      totalPages,
      totalExtracted: paystubs.length,
      unregisteredEmployees,
      warnings
    };
  } catch (err: any) {
    throw new Error(`Falha ao ler o arquivo PDF: ${err.message || err}`);
  }
}

export interface MultiPdfProgress {
  currentFileIndex: number;
  totalFiles: number;
  currentFileName: string;
  currentPage: number;
  totalPagesInFile: number;
  totalPaystubsFoundSoFar: number;
}

export interface ParseMultipleResult extends ParsePaystubResult {
  fileSummaries: {
    fileName: string;
    paystubsCount: number;
    pages: number;
    hasError?: boolean;
    errorMessage?: string;
  }[];
}

/**
 * Processa um lote de múltiplos arquivos PDF de contracheques sequencialmente
 * otimizando o uso de memória e evitando travamento do navegador.
 */
export async function parseMultipleComaraPdfs(
  files: { name: string; arrayBuffer: ArrayBuffer }[],
  existingEmployees: Employee[] = [],
  currentUserEmail?: string,
  onProgress?: (progress: MultiPdfProgress) => void
): Promise<ParseMultipleResult> {
  const warnings: string[] = [];
  const paystubsMap = new Map<string, PaystubRecord>();
  const fileSummaries: ParseMultipleResult['fileSummaries'] = [];
  let totalPagesAcrossAll = 0;

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const fileItem = files[fileIdx];
    const initialCountForThisFile = paystubsMap.size;
    let filePages = 0;

    try {
      const loadingTask = pdfjsLib.getDocument({
        data: fileItem.arrayBuffer,
        useSystemFonts: true,
      });

      const pdfDoc = await loadingTask.promise;
      filePages = pdfDoc.numPages;
      totalPagesAcrossAll += filePages;

      for (let pageNum = 1; pageNum <= filePages; pageNum++) {
        if (onProgress) {
          onProgress({
            currentFileIndex: fileIdx + 1,
            totalFiles: files.length,
            currentFileName: fileItem.name,
            currentPage: pageNum,
            totalPagesInFile: filePages,
            totalPaystubsFoundSoFar: paystubsMap.size
          });
        }

        try {
          const page = await pdfDoc.getPage(pageNum);
          const lines = await extractLinesFromPdfPage(page);

          if (lines.length > 0) {
            const parsed = parseSingleContrachequeText(lines, currentUserEmail, pageNum);
            if (parsed && parsed.matricula) {
              const existing = paystubsMap.get(parsed.id);
              if (existing) {
                // Mescla rubricas e consolida dados mais detalhados
                if (parsed.rubricas.length > 0) {
                  if (existing.rubricas.length === 0) {
                    paystubsMap.set(parsed.id, parsed);
                  } else {
                    parsed.rubricas.forEach(r => {
                      const hasRub = existing.rubricas.some(er => er.codigo === r.codigo && er.descricao === r.descricao);
                      if (!hasRub) {
                        existing.rubricas.push(r);
                      }
                    });
                    existing.totalProventos = Math.max(existing.totalProventos, parsed.totalProventos);
                    existing.totalDescontos = Math.max(existing.totalDescontos, parsed.totalDescontos);
                    existing.valorLiquido = Math.max(existing.valorLiquido, parsed.valorLiquido);
                    if (parsed.salarioBase && !existing.salarioBase) existing.salarioBase = parsed.salarioBase;
                  }
                }
              } else {
                paystubsMap.set(parsed.id, parsed);
              }
            }
          }
        } catch (pageErr: any) {
          warnings.push(`[${fileItem.name}] Erro na pág ${pageNum}: ${pageErr?.message || pageErr}`);
        }
      }

      const extractedFromFile = paystubsMap.size - initialCountForThisFile;
      fileSummaries.push({
        fileName: fileItem.name,
        paystubsCount: Math.max(0, extractedFromFile),
        pages: filePages
      });

    } catch (fileErr: any) {
      warnings.push(`Erro ao processar arquivo ${fileItem.name}: ${fileErr?.message || fileErr}`);
      fileSummaries.push({
        fileName: fileItem.name,
        paystubsCount: 0,
        pages: filePages,
        hasError: true,
        errorMessage: fileErr?.message || 'Falha ao ler PDF'
      });
    }
  }

  const paystubs = Array.from(paystubsMap.values());

  // Identifica servidores não cadastrados no banco de colaboradores
  const existingMatriculasSet = new Set(
    existingEmployees.map(e => normalizeMatricula(e.matricula))
  );

  const unregisteredMap = new Map<string, { matricula: string; nome: string; cargo: string; sede: string; cpf?: string }>();

  for (const p of paystubs) {
    const normMat = normalizeMatricula(p.matricula);
    if (!existingMatriculasSet.has(normMat) && !unregisteredMap.has(normMat)) {
      unregisteredMap.set(normMat, {
        matricula: normMat,
        nome: p.nome,
        cargo: p.cargo,
        sede: p.sede || 'KO-DL',
        cpf: p.cpf
      });
    }
  }

  const unregisteredEmployees = Array.from(unregisteredMap.values());

  return {
    paystubs,
    totalPages: totalPagesAcrossAll,
    totalExtracted: paystubs.length,
    unregisteredEmployees,
    warnings,
    fileSummaries
  };
}

/**
 * Cria novos objetos Employee a partir dos servidores não cadastrados encontrados no PDF
 */
export function buildEmployeesFromPaystubs(
  unregistered: { matricula: string; nome: string; cargo: string; sede: string; cpf?: string }[],
  dataAdmissaoDefault: string = '2026-07-01'
): Employee[] {
  return unregistered.map((u) => {
    const sedeMapeada: Branch = u.sede.includes('BE') ? 'BE' : u.sede.includes('MN') ? 'MN' : 'KO';
    return {
      id: u.matricula,
      matricula: u.matricula,
      nome: u.nome,
      funcao: u.cargo || 'Mecânico de Manutenção',
      cargo: u.cargo || 'Mecânico de Manutenção',
      sede: sedeMapeada,
      sede_origem: sedeMapeada,
      sede_atual: sedeMapeada,
      cpf: u.cpf,
      cpfMascarado: u.cpf ? maskCPF(u.cpf) : undefined,
      dataAdmissao: dataAdmissaoDefault,
      status: 'Ativo',
      saldoInicialHoras: 0,
      primeiroAcesso: true,
      senhaCadastrada: false,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    };
  });
}

/**
 * Dados de Demonstração Oficiais COMARA para testes imediatos sem upload
 */
export function getDemoComaraPaystubs(): PaystubRecord[] {
  return [
    {
      id: '13974_07-2026',
      matricula: '13974',
      nome: 'OTNIEL DA ROCHA CABRAL',
      cargo: 'MECANICO DE MANUTENCAO DE MAQUINAS DE CONSTRUCAO E',
      sede: 'KO-DL',
      periodo: '07/2026',
      mesAno: '07-2026',
      ano: 2026,
      mes: 7,
      dataInicio: '01/07/2026',
      dataFim: '31/07/2026',
      cpf: '003.***.***-09',
      banco: '001 - BANCO DO BRASIL',
      agencia: '2345-6',
      conta: '13974-0',
      rubricas: [
        { codigo: '001', descricao: 'Salário Base', referencia: '', provento: 2830.38, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '060', descricao: 'Auxilio Transporte ATS JUL e AGO/26', referencia: '', provento: 560.53, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '600', descricao: 'Auxílio Alimentação', referencia: '', provento: 1192.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '722', descricao: 'Auxilio Alimentacao Atrasado JUL', referencia: '', provento: 1192.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '611', descricao: 'Desc. auxilio transporte', referencia: '', provento: 0, desconto: 124.54, tipo: 'DESCONTO' },
        { codigo: '903', descricao: 'INSS Folha', referencia: '', provento: 0, desconto: 230.41, tipo: 'DESCONTO' },
      ],
      totalProventos: 5774.91,
      totalDescontos: 354.95,
      valorLiquido: 5419.96,
      salarioBase: 2830.38,
      baseInss: 2830.38,
      baseFgts: 2830.38,
      fgtsMes: 0.00,
      baseIrrf: 2223.18,
      importadoEm: new Date().toISOString(),
      importadoPorEmail: 'coari.comara@gmail.com',
      observacoes: 'Ficha Financeira Oficial COMARA - Extraída do Modelo de Folha (KO-DL)'
    },
    {
      id: '13853_07-2026',
      matricula: '13853',
      nome: 'CLESIO DE SOUZA FARO LOPES',
      cargo: 'OPERADOR DE MOTONIVEL',
      sede: 'KO-DL',
      periodo: '07/2026',
      mesAno: '07-2026',
      ano: 2026,
      mes: 7,
      dataInicio: '01/07/2026',
      dataFim: '31/07/2026',
      cpf: '004.***.***-12',
      banco: '001 - BANCO DO BRASIL',
      agencia: '2345-6',
      conta: '98765-4',
      rubricas: [
        { codigo: '001', descricao: 'Salário Base', referencia: '30D', provento: 3850.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '032', descricao: 'Aux Transporte', referencia: '22D', provento: 260.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '600', descricao: 'Auxílio Alimentação', referencia: '22D', provento: 750.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '722', descricao: 'Aux. Alimentação Atrasado', referencia: '', provento: 180.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '045', descricao: 'Insalubridade 40%', referencia: '40%', provento: 608.00, desconto: 0, tipo: 'PROVENTO' },
        { codigo: '611', descricao: 'Desc. auxilio transporte', referencia: '6.00%', provento: 0, desconto: 231.00, tipo: 'DESCONTO' },
        { codigo: '903', descricao: 'INSS Folha', referencia: '14.00%', provento: 0, desconto: 539.00, tipo: 'DESCONTO' },
        { codigo: '904', descricao: 'IRRF Folha', referencia: '7.50%', provento: 0, desconto: 142.50, tipo: 'DESCONTO' },
      ],
      totalProventos: 5648.00,
      totalDescontos: 912.50,
      valorLiquido: 4735.50,
      salarioBase: 3850.00,
      baseInss: 4458.00,
      baseFgts: 4458.00,
      fgtsMes: 356.64,
      baseIrrf: 3919.00,
      importadoEm: new Date().toISOString(),
      importadoPorEmail: 'coari.comara@gmail.com',
      observacoes: 'Ficha Financeira Oficial - COMARA Canteiro Coari (KO-DL)'
    }
  ];
}

