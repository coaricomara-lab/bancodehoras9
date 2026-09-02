/**
 * Suíte de Testes Automatizados - Máquina de Competências (Fase 1)
 * Executável via tsx: npx tsx src/services/competenciaEngine.test.ts
 */

import {
  horasParaMinutos,
  minutosParaStringFormatada,
  minutosParaHorasDecimais,
  getCompetenciaAnterior,
  getProximaCompetencia,
  gerarCadeiaCompetencias,
  calcularCompetenciaColaborador,
  propagarDeltaCascata,
  isFechamentoIdempotente,
  ColaboradorBase,
  LancamentoSimples,
  ResumoMensalContabil,
} from './competenciaEngine';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${testName} ${detail ? `-> ${detail}` : ''}`);
  }
}

console.log('\n=============================================================');
console.log('🧪 INICIANDO TESTES DA FASE 1: MÁQUINA DE COMPETÊNCIAS');
console.log('=============================================================\n');

// -------------------------------------------------------------
// TESTE 1: Precisão em Minutos Inteiros (Zero Erro de Ponto Flutuante)
// -------------------------------------------------------------
console.log('--- Teste 1: Álgebra de Minutos Inteiros ---');

const min1 = horasParaMinutos('01:30'); // 90 min
const min2 = horasParaMinutos(0.75);    // 45 min (45/60)
const min3 = horasParaMinutos('-00:30'); // -30 min
const soma = min1 + min2 + min3; // 90 + 45 - 30 = 105 min (1h45m)

assert(min1 === 90, 'Converte "01:30" para 90 minutos inteiros');
assert(min2 === 45, 'Converte 0.75 decimal para 45 minutos inteiros');
assert(min3 === -30, 'Converte "-00:30" para -30 minutos inteiros');
assert(soma === 105, 'Soma aritmética sem erros flutuantes resulta em 105 minutos');
assert(minutosParaStringFormatada(soma) === '+01:45', 'Formata 105 minutos para "+01:45"');
assert(minutosParaStringFormatada(-135) === '-02:15', 'Formata -135 minutos para "-02:15"');
assert(minutosParaStringFormatada(0) === '00:00', 'Formata 0 minutos para "00:00"');
assert(minutosParaHorasDecimais(90) === 1.5, 'Converte 90 minutos para 1.5 horas decimais');

// -------------------------------------------------------------
// TESTE 2: Álgebra de Competências e Virada de Ano
// -------------------------------------------------------------
console.log('\n--- Teste 2: Álgebra de Competências e Virada de Ano ---');

assert(getCompetenciaAnterior('2026-08') === '2026-07', 'Competência anterior a 2026-08 é 2026-07');
assert(getCompetenciaAnterior('2027-01') === '2026-12', 'VIRADA DE ANO: Competência anterior a 2027-01 é 2026-12');
assert(getProximaCompetencia('2026-12') === '2027-01', 'VIRADA DE ANO: Próxima competência após 2026-12 é 2027-01');

const cadeiaVirada = gerarCadeiaCompetencias('2026-11', '2027-02');
assert(
  JSON.stringify(cadeiaVirada) === JSON.stringify(['2026-11', '2026-12', '2027-01', '2027-02']),
  'Gera cadeia contínua atravessando a virada de ano (2026-11 a 2027-02)'
);

// -------------------------------------------------------------
// TESTE 3: Cadeia Linear Trimestral (Jan -> Fev -> Mar)
// -------------------------------------------------------------
console.log('\n--- Teste 3: Cadeia Linear Trimestral (Jan -> Fev -> Mar) ---');

const colaborador: ColaboradorBase = {
  matricula: '1001',
  nome: 'Carlos Eduardo',
  sede: 'KO',
  saldoInicialMinutos: 0,
};

// Janeiro/2026: +12h extras (720 min), -2h débitos (120 min) -> Saldo Final: +10h (600 min)
const lancamentosJan: LancamentoSimples[] = [
  { id: 'L1', matricula: '1001', dataRegistro: '2026-01-10', competencia: '2026-01', tipo: 'CREDITO', minutos: 480 },
  { id: 'L2', matricula: '1001', dataRegistro: '2026-01-15', competencia: '2026-01', tipo: 'CREDITO', minutos: 240 },
  { id: 'L3', matricula: '1001', dataRegistro: '2026-01-20', competencia: '2026-01', tipo: 'DEBITO', minutos: 120 },
];

const resumoJan = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJan,
  status: 'FECHADO',
});

assert(resumoJan.saldoAnteriorMinutos === 0, 'Janeiro: Saldo anterior inicial é 0 min');
assert(resumoJan.horasCreditoMinutos === 720, 'Janeiro: Créditos somam 720 min (+12h)');
assert(resumoJan.horasDebitoMinutos === 120, 'Janeiro: Débitos somam 120 min (-2h)');
assert(resumoJan.saldoFinalTransportadoMinutos === 600, 'Janeiro: Saldo final transportado é +600 min (+10h)');

// Fevereiro/2026: Herda +600 min de Jan. Créditos: +5h (300 min). Débitos: 0. Saldo Final: +900 min (+15h).
const lancamentosFev: LancamentoSimples[] = [
  { id: 'L4', matricula: '1001', dataRegistro: '2026-02-05', competencia: '2026-02', tipo: 'CREDITO', minutos: 300 },
];

const resumoFev = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-02',
  resumoAnterior: resumoJan,
  lancamentosDoMes: lancamentosFev,
  status: 'FECHADO',
});

assert(resumoFev.saldoAnteriorMinutos === 600, 'Fevereiro: Herda exatamente os 600 min de Janeiro como saldo anterior');
assert(resumoFev.horasCreditoMinutos === 300, 'Fevereiro: Créditos somam 300 min (+5h)');
assert(resumoFev.saldoFinalTransportadoMinutos === 900, 'Fevereiro: Saldo final transportado é +900 min (+15h)');

// Março/2026 (Aberta): Herda +900 min de Fev. Sem novos lançamentos ainda.
const resumoMar = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: resumoFev,
  lancamentosDoMes: [],
  status: 'ABERTO',
});

assert(resumoMar.saldoAnteriorMinutos === 900, 'Março: Herda os 900 min de Fevereiro');
assert(resumoMar.saldoFinalTransportadoMinutos === 900, 'Março: Saldo atual é +900 min (+15h)');
assert(resumoMar.origemSaldoAnterior === 'COMPETENCIA_ANTERIOR', 'Origem do saldo é COMPETENCIA_ANTERIOR');

// -------------------------------------------------------------
// TESTE 4: Teste de Fogo — Virada de Ano Contábil (Dez/2026 -> Jan/2027)
// -------------------------------------------------------------
console.log('\n--- Teste 4: Virada de Ano Contábil (Dez/2026 -> Jan/2027) ---');

// Dezembro/2026: Saldo anterior vindo de Nov: +18h (1080 min). Débitos: compensação de 8h (480 min).
const resumoNovFake: ResumoMensalContabil = {
  id: '1001_2026-11',
  matricula: '1001',
  competencia: '2026-11',
  saldoAnteriorMinutos: 600,
  horasCreditoMinutos: 480,
  horasDebitoMinutos: 0,
  saldoMesMinutos: 480,
  saldoFinalTransportadoMinutos: 1080, // 18h
  origemSaldoAnterior: 'COMPETENCIA_ANTERIOR',
  movimentoNeutro: false,
  statusCompetencia: 'FECHADO',
  versao: 1,
  hashLancamentosConsolidados: 'H_NOV',
  atualizadoEm: '2026-11-30T23:59:59Z',
};

const lancamentosDez: LancamentoSimples[] = [
  { id: 'L_DEZ1', matricula: '1001', dataRegistro: '2026-12-24', competencia: '2026-12', tipo: 'DEBITO', minutos: 480 },
];

const resumoDez = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-12',
  resumoAnterior: resumoNovFake,
  lancamentosDoMes: lancamentosDez,
  status: 'FECHADO',
});

assert(resumoDez.saldoFinalTransportadoMinutos === 600, 'Dezembro: 1080 min - 480 min = 600 min (+10h)');

// Janeiro/2027: O sistema pede a competência anterior getCompetenciaAnterior('2027-01') que é '2026-12'
const compAnteriorCalculada = getCompetenciaAnterior('2027-01');
assert(compAnteriorCalculada === '2026-12', 'Verificação de chave: anterior de 2027-01 é 2026-12');

const resumoJan2027 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2027-01',
  resumoAnterior: resumoDez,
  lancamentosDoMes: [],
  status: 'ABERTO',
});

assert(resumoJan2027.saldoAnteriorMinutos === 600, 'Janeiro/2027: Começa rigorosamente com os 600 min (+10h) de Dezembro/2026');
assert(resumoJan2027.saldoFinalTransportadoMinutos === 600, 'Janeiro/2027: Saldo final transportado preservado na virada de ano');

// -------------------------------------------------------------
// TESTE 5: Ausência de Histórico (Implantação / Novo Servidor)
// -------------------------------------------------------------
console.log('\n--- Teste 5: Ausência de Histórico (Novo Servidor / Implantação) ---');

const novoColaboradorComSaldoBase: ColaboradorBase = {
  matricula: '2002',
  nome: 'Mariana Lima',
  sede: 'BE',
  saldoInicialMinutos: 360, // 6 horas de contrato
};

const resumoSemHistoricoComSaldo = calcularCompetenciaColaborador({
  colaborador: novoColaboradorComSaldoBase,
  competencia: '2027-01',
  resumoAnterior: null, // Não há 2026-12
  lancamentosDoMes: [],
  status: 'ABERTO',
});

assert(resumoSemHistoricoComSaldo.saldoAnteriorMinutos === 360, 'Sem resumo anterior: adota saldoInicialMinutos do cadastro (360 min)');
assert(resumoSemHistoricoComSaldo.origemSaldoAnterior === 'SALDO_BASE_CADASTRO', 'Origem marcada como SALDO_BASE_CADASTRO');

const novoColaboradorSemNada: ColaboradorBase = {
  matricula: '3003',
  nome: 'Lucas Silva',
  sede: 'MN',
};

const resumoSemNada = calcularCompetenciaColaborador({
  colaborador: novoColaboradorSemNada,
  competencia: '2027-01',
  resumoAnterior: null,
  lancamentosDoMes: [],
  status: 'ABERTO',
});

assert(resumoSemNada.saldoAnteriorMinutos === 0, 'Sem resumo anterior e sem cadastro: adota 0 min explicitamente');
assert(resumoSemNada.origemSaldoAnterior === 'INICIAL_PADRAO', 'Origem marcada como INICIAL_PADRAO');

// -------------------------------------------------------------
// TESTE 6: Transporte Neutro (Colaborador Sem Lançamentos)
// -------------------------------------------------------------
console.log('\n--- Teste 6: Transporte Neutro (Sem Lançamentos no Mês) ---');

const resumoNeutro = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-04',
  resumoAnterior: resumoMar,
  lancamentosDoMes: [], // Zero lançamentos
  status: 'FECHADO',
});

assert(resumoNeutro.movimentoNeutro === true, 'Flag movimentoNeutro é TRUE quando não há lançamentos');
assert(resumoNeutro.horasCreditoMinutos === 0, 'Créditos são 0');
assert(resumoNeutro.horasDebitoMinutos === 0, 'Débitos são 0');
assert(resumoNeutro.saldoFinalTransportadoMinutos === resumoMar.saldoFinalTransportadoMinutos, 'Saldo é transportado integralmente sem quebrar a cadeia');

// -------------------------------------------------------------
// TESTE 7: Idempotência do Fechamento
// -------------------------------------------------------------
console.log('\n--- Teste 7: Idempotência Absoluta do Fechamento ---');

const calculo1 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJan,
  status: 'FECHADO',
});

const calculo2 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJan,
  status: 'FECHADO',
});

assert(isFechamentoIdempotente(calculo1, calculo2) === true, 'Executar fechamento duas vezes seguidas é reconhecido como idempotente');

const calculoComAlteracao = {
  ...calculo2,
  horasCreditoMinutos: 999,
};
assert(isFechamentoIdempotente(calculo1, calculoComAlteracao) === false, 'Detecta quando houve alteração e invalida idempotência');

// -------------------------------------------------------------
// TESTE 8: Alteração Retroativa em Cascata através de Múltiplos Anos (2025 -> 2026)
// -------------------------------------------------------------
console.log('\n--- Teste 8: Recálculo em Cascata Multi-Anos (Março/2025 -> Setembro/2026 = 18 Meses) ---');

// Simulamos uma cadeia de 18 meses fechados onde cada mês teve movimento neutro ou positivo
const mesesCadeia = gerarCadeiaCompetencias('2025-04', '2026-09'); // 18 meses
assert(mesesCadeia.length === 18, 'Cadeia abrange exatamente 18 meses posteriores');

let saldoAcumulado = 600; // Março/2025 havia terminado com +600 min (+10h)
const resumosOriginais: ResumoMensalContabil[] = mesesCadeia.map((comp) => {
  const saldoAnt = saldoAcumulado;
  const saldoFinal = saldoAnt + 60; // cada mês ganha 1h (60 min)
  saldoAcumulado = saldoFinal;
  return {
    id: `1001_${comp}`,
    matricula: '1001',
    competencia: comp,
    saldoAnteriorMinutos: saldoAnt,
    horasCreditoMinutos: 60,
    horasDebitoMinutos: 0,
    saldoMesMinutos: 60,
    saldoFinalTransportadoMinutos: saldoFinal,
    origemSaldoAnterior: 'COMPETENCIA_ANTERIOR',
    movimentoNeutro: false,
    statusCompetencia: 'FECHADO',
    statusIntegridade: 'ORIGINAL',
    versao: 1,
    hashLancamentosConsolidados: 'H_TEST',
    atualizadoEm: '2025-01-01T00:00:00Z',
  };
});

const saldoSetembroAntes = resumosOriginais[resumosOriginais.length - 1].saldoFinalTransportadoMinutos;

// Gestor reabre Março/2025 e retifica um apontamento: reduz 2h (-120 min).
const delta = -120; // -2h
const resumosRecalculados = propagarDeltaCascata({
  matricula: '1001',
  competenciaOrigem: '2025-03',
  deltaMinutos: delta,
  resumosSubsequentesOrdenados: resumosOriginais,
});

assert(resumosRecalculados.length === 18, 'Todos os 18 meses foram reprocessados');
assert(
  resumosRecalculados[0].saldoAnteriorMinutos === resumosOriginais[0].saldoAnteriorMinutos + delta,
  'Abril/2025: Saldo anterior ajustado em exatamente -120 min'
);
assert(
  resumosRecalculados[0].saldoFinalTransportadoMinutos === resumosOriginais[0].saldoFinalTransportadoMinutos + delta,
  'Abril/2025: Saldo final ajustado em exatamente -120 min'
);
assert(
  resumosRecalculados[0].horasCreditoMinutos === 60,
  'Abril/2025: Lançamentos próprios do mês (60 min) permanecem INTACTOS'
);
assert(
  resumosRecalculados[0].statusIntegridade === 'REAJUSTADO_POR_CASCATA',
  'Mês fechado marcado como REAJUSTADO_POR_CASCATA para auditoria'
);
assert(
  resumosRecalculados[0].deltaAplicadoMinutos === -120,
  'Delta aplicado (-120 min) registrado explicitamente no documento'
);

const saldoSetembroDepois = resumosRecalculados[resumosRecalculados.length - 1].saldoFinalTransportadoMinutos;
assert(
  saldoSetembroDepois === saldoSetembroAntes + delta,
  `Setembro/2026 (18 meses depois): Saldo final refletiu o delta com precisão cirúrgica (${saldoSetembroAntes} -> ${saldoSetembroDepois})`
);

console.log('\n=============================================================');
console.log(`📊 RESULTADO FINAL: ${passedTests}/${totalTests} TESTES PASSARAM COM SUCESSO!`);
if (failedTests === 0) {
  console.log('🎉 TODOS OS REQUISITOS MATEMÁTICOS E ESTRUTURAIS FORAM VALIDADOS!');
} else {
  console.error(`⚠️ ${failedTests} TESTE(S) FALHARAM!`);
}
console.log('=============================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
