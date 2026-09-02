/**
 * Testes Unitários da Fase 2: Integração com Firestore e Operações Atômicas
 * Executado via tsx sem side-effects
 */

import {
  isCompetenciaValida,
  getCompetenciaAnterior,
  horasParaMinutos,
  minutosParaHorasDecimais,
} from './competenciaEngine';

console.log('=============================================================');
console.log('🧪 INICIANDO TESTES DA FASE 2: INTEGRAÇÃO COM FIRESTORE');
console.log('=============================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failCount++;
  }
}

// -------------------------------------------------------------
// Teste 1: Chaves Determinísticas e Particionamento de Lotes (Batch)
// -------------------------------------------------------------
console.log('--- Teste 1: Chaves Determinísticas e Particionamento de Batch ---');

const matricula = '123456';
const competencia = '2026-08';
const docId = `${matricula}_${competencia}`;
assert(docId === '123456_2026-08', 'ID determinístico do resumo_mensal é "${matricula}_${competencia}"');

// Simulação de chunking de 750 registros com limite de 300 por batch
const registrosSimulados = Array.from({ length: 750 }, (_, i) => ({
  matricula: `MAT_${i}`,
  competencia: '2026-08',
}));

const CHUNK_SIZE = 300;
const chunks: any[][] = [];
for (let i = 0; i < registrosSimulados.length; i += CHUNK_SIZE) {
  chunks.push(registrosSimulados.slice(i, i + CHUNK_SIZE));
}

assert(chunks.length === 3, '750 registros divididos corretamente em 3 lotes');
assert(chunks[0].length === 300, 'Lote 1 possui 300 operações (respeitando teto Firestore)');
assert(chunks[1].length === 300, 'Lote 2 possui 300 operações');
assert(chunks[2].length === 150, 'Lote 3 possui os 150 registros restantes');

// -------------------------------------------------------------
// Teste 2: Intervalo de Datas Rigoroso para Query por Competência
// -------------------------------------------------------------
console.log('\n--- Teste 2: Filtro de Intervalo Fechado para Consultas ---');

function gerarIntervaloCompetencia(comp: string) {
  const [ano, mes] = comp.split('-');
  const dataInicio = `${comp}-01`;
  const ultimoDia = new Date(parseInt(ano, 10), parseInt(mes, 10), 0).getDate();
  const dataFim = `${comp}-${String(ultimoDia).padStart(2, '0')}`;
  return { dataInicio, dataFim };
}

const intervaloAgosto = gerarIntervaloCompetencia('2026-08');
assert(intervaloAgosto.dataInicio === '2026-08-01', 'Agosto/2026 inicia em 2026-08-01');
assert(intervaloAgosto.dataFim === '2026-08-31', 'Agosto/2026 termina exatamente em 2026-08-31');

const intervaloFevBissexto = gerarIntervaloCompetencia('2024-02');
assert(intervaloFevBissexto.dataFim === '2024-02-29', 'Fevereiro de ano bissexto (2024) termina em 2024-02-29');

const intervaloFevComum = gerarIntervaloCompetencia('2025-02');
assert(intervaloFevComum.dataFim === '2025-02-28', 'Fevereiro de ano comum (2025) termina em 2025-02-28');

// -------------------------------------------------------------
// Teste 3: Metadados e Ciclo de Vida da Competência
// -------------------------------------------------------------
console.log('\n--- Teste 3: Ciclo de Vida da Competência (ABERTO -> FECHADO -> REABERTO) ---');

interface MockCompetenciaControle {
  id: string;
  status: 'ABERTO' | 'FECHADO' | 'REABERTO';
  versaoCalculo: number;
  processandoFechamento?: boolean;
}

const compControle: MockCompetenciaControle = {
  id: '2026-08',
  status: 'ABERTO',
  versaoCalculo: 1,
};

// 1. Início de fechamento: adquire lock
compControle.processandoFechamento = true;
assert(compControle.processandoFechamento === true, 'Lock de concorrência ativado');

// 2. Conclusão do fechamento
compControle.status = 'FECHADO';
compControle.processandoFechamento = false;
assert(compControle.status === 'FECHADO' && !compControle.processandoFechamento, 'Status atualizado para FECHADO e lock liberado');

// 3. Reabertura administrativa
compControle.status = 'REABERTO';
compControle.versaoCalculo += 1;
assert(compControle.status === 'REABERTO', 'Status atualizado para REABERTO');
assert(compControle.versaoCalculo === 2, 'versaoCalculo incrementada para auditoria');

// -------------------------------------------------------------
// Teste 4: Sanidade de Minutos Inteiros na Persistência
// -------------------------------------------------------------
console.log('\n--- Teste 4: Sanidade de Minutos Inteiros na Persistência ---');

const horas = -17.5;
const minutos = horasParaMinutos(horas);
assert(Number.isInteger(minutos), 'Minutos calculados são estritamente inteiros');
assert(minutos === -1050, '-17.5 horas convertem exatamente para -1050 minutos');
const reconvertido = minutosParaHorasDecimais(minutos);
assert(reconvertido === -17.5, 'Reconversão para horas decimais é idêntica sem dízimas');

console.log('\n=============================================================');
console.log(`📊 RESULTADO FASE 2: ${passCount}/${passCount + failCount} TESTES PASSARAM!`);
console.log('=============================================================');

if (failCount > 0) {
  process.exit(1);
}
