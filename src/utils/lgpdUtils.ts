/**
 * LGPD-Compliant CPF Security Utilities
 * Provides hashing and masking functions for secure CPF handling
 */

/**
 * Limpa um CPF removendo todos os caracteres não numéricos
 * @param cpf String contendo o CPF (formatado ou não)
 * @returns CPF limpo contendo apenas dígitos
 */
export function cleanCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  return cpf.toString().replace(/\D/g, '').trim();
}

/**
 * Valida se uma string é um CPF com formato correto (11 dígitos numéricos válidos)
 * @param cpf CPF a validar
 * @returns true se é um CPF válido
 */
export function isValidCPF(cpf: string | null | undefined): boolean {
  const clean = cleanCPF(cpf);
  if (clean.length !== 11) return false;
  // Rejeita sequências de dígitos repetidos óbvias (ex: 00000000000, 11111111111)
  if (/^(\d)\1{10}$/.test(clean)) return false;
  return true;
}

/**
 * Gera um hash SHA-256 do CPF limpo para ser usado como chave de desduplicação
 * Mantém o CPF seguro usando apenas o hash para buscas no banco
 * 
 * @param cpf String contendo o CPF (formatado ou não)
 * @returns Promessa que resolve para string hexadecimal do hash SHA-256
 * 
 * @example
 * const hash = await generateCPFHash('123.456.789-01');
 * // hash é uma string única e irreversível
 */
export async function generateCPFHash(cpf: string | null | undefined): Promise<string> {
  const clean = cleanCPF(cpf);
  
  if (!clean || !isValidCPF(clean)) {
    return '';
  }

  // Usa SubtleCrypto para gerar hash SHA-256 de forma segura no browser
  const encoder = new TextEncoder();
  const data = encoder.encode(clean);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Converte o buffer para string hexadecimal
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Mascara um CPF no padrão LGPD oficial: XXX.***.***-YY
 * Exibe exatamente os 3 primeiros e os 2 últimos dígitos para conferência visual segura.
 * 
 * @param cpf String contendo o CPF (formatado, limpo ou parcialmente mascarado)
 * @returns CPF mascarado no padrão XXX.***.***-YY
 * 
 * @example
 * maskCPF('123.456.789-01'); // Retorna: 123.***.***-01
 * maskCPF('12345678901');    // Retorna: 123.***.***-01
 * maskCPF('00394429009');    // Retorna: 003.***.***-09
 */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '***.***.***-**';
  
  const rawStr = cpf.toString().trim();
  const clean = cleanCPF(rawStr);
  
  // Se possui 11 dígitos completos
  if (clean.length === 11) {
    return `${clean.substring(0, 3)}.***.***-${clean.substring(9, 11)}`;
  }
  
  // Se já veio com padrão de 3 primeiros e 2 últimos (ex: "123.***.***-01" ou "123***01")
  const match3and2 = rawStr.match(/^(\d{3})[.\s\*\-]*(\d{2})$/);
  if (match3and2) {
    return `${match3and2[1]}.***.***-${match3and2[2]}`;
  }

  // Se veio com os 3 primeiros e os 2 últimos em formato já mascarado padrão
  if (/^\d{3}\.\*{3}\.\*{3}\-\d{2}$/.test(rawStr)) {
    return rawStr;
  }

  // Se possuir entre 5 e 10 dígitos limpos (ex: sem zeros à esquerda)
  if (clean.length >= 5 && !rawStr.includes('*')) {
    const padded = clean.padStart(11, '0');
    return `${padded.substring(0, 3)}.***.***-${padded.substring(9, 11)}`;
  }

  return '***.***.***-**';
}

/**
 * Compara dois CPFs gerando e comparando seus hashes
 * Útil para desduplicação segura sem armazenar CPF em texto plano
 * 
 * @param cpf1 Primeiro CPF
 * @param cpf2 Segundo CPF
 * @returns Promessa que resolve para true se os CPFs são idênticos
 */
export async function compareCPFsSecurely(
  cpf1: string | null | undefined,
  cpf2: string | null | undefined
): Promise<boolean> {
  const hash1 = await generateCPFHash(cpf1);
  const hash2 = await generateCPFHash(cpf2);
  
  return hash1 === hash2 && hash1 !== '';
}

/**
 * Converte um CPF para o formato padrão brasileiro (XXX.XXX.XXX-XX)
 * @param cpf String contendo o CPF (formatado ou não)
 * @returns CPF formatado ou string vazia se inválido
 */
export function formatCPF(cpf: string | null | undefined): string {
  const clean = cleanCPF(cpf);
  
  if (!isValidCPF(clean)) {
    return '';
  }

  return `${clean.substring(0, 3)}.${clean.substring(3, 6)}.${clean.substring(6, 9)}-${clean.substring(9)}`;
}
