/**
 * Suíte de Testes Fase 4 — Blindagem Contábil do Ciclo de Fechamento
 * Executável via tsx: npx tsx src/services/competenciaBlindagem.test.ts
 *
 * Cobre os requisitos de blindagem da especificação:
 * - Pré-requisito de fechamento (C-1 precisa estar FECHADO; implantação sem C-1 é permitida)
 * - Delta de refechamento (base da propagação em cascata)
 * - Refechamento retroativo com cascata multi-meses (Janeiro -> Fevereiro -> Março)
 * - Virada de ano na cascata (Dezembro/2026 -> Janeiro/2027)
 */

import {
  validarPreRequisitoFechamento,
  calcularDeltaRefechamentoMinutos,
  calcularCompetenciaColaborador,
  propagarDeltaCascata,
  getCompetenciaAnterior,
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
    console.error(`  ❌ [FAIL] ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

function lanc(
  id: string,
  matricula: string,
  competencia: string,
  dia: string,
  tipo: 'CREDITO' | 'DEBITO',
  minutos: number
): LancamentoSimples {
  return {
    id,
    matricula,
    dataRegistro: `${competencia}-${dia}`,
    competencia,
    tipo,
    minutos,
    descricao: '',
  };
}

console.log('=============================================================');
console.log('🧪 FASE 4: BLINDAGEM CONTÁBIL — PRÉ-REQUISITOS, DELTA E CASCATA');
console.log('=============================================================\n');

// -------------------------------------------------------------
// Teste 1: Pré-requisito de fechamento (C-1)
// -------------------------------------------------------------
console.log('--- Teste 1: Pré-requisito de fechamento (C-1 deve estar FECHADO) ---');

// 1.1 Cenário de implantação: sem controle de C-1 no banco → permitido
const rImplantacao = validarPreRequisitoFechamento(null);
assert(rImplantacao.valido === true, 'Implantação (sem C-1 no banco): fechamento permitido');

const rIndefinido = validarPreRequisitoFechamento(undefined);
assert(rIndefinido.valido === true, 'Controle de C-1 indefinido: fechamento permitido');

// 1.2 C-1 FECHADO → permitido
const rFechado = validarPreRequisitoFechamento('FECHADO');
assert(rFechado.valido === true, 'C-1 com status FECHADO: fechamento permitido');

// 1.3 C-1 ABERTO → bloqueado com motivo explícito
const rAberto = validarPreRequisitoFechamento('ABERTO');
assert(rAberto.valido === false, 'C-1 com status ABERTO: fechamento BLOQUEADO');
assert(
  !!rAberto.motivo && rAberto.motivo.includes('ABERTO'),
  'Motivo do bloqueio cita explicitamente o status ABERTO'
);

// 1.4 C-1 REABERTO → bloqueado
const rReaberto = validarPreRequisitoFechamento('REABERTO');
assert(rReaberto.valido === false, 'C-1 com status REABERTO: fechamento BLOQUEADO');

// -------------------------------------------------------------
// Teste 2: Delta de refechamento
// -------------------------------------------------------------
console.log('\n--- Teste 2: Apuração do delta de refechamento (minutos inteiros) ---');

const colaborador: ColaboradorBase = { matricula: '1001', nome: 'Carlos', sede: 'KO' };

// Primeiro fechamento de Janeiro: +720 min de crédito, -120 min de débito => saldo +600 min (10h)
const lancamentosJanOriginal: LancamentoSimples[] = [
  lanc('j1', '1001', '2026-01', '05', 'CREDITO', 720),
  lanc('j2', '1001', '2026-01', '20', 'DEBITO', 120),
];

const resumoJanOriginal = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJanOriginal,
  status: 'FECHADO',
});
assert(resumoJanOriginal.saldoFinalTransportadoMinutos === 600, 'Janeiro fechou com saldo final exato de +600 min (10h)');

// 2.1 Primeiro fechamento (sem resumo anterior): delta 0 — não há cadeia oficial
assert(
  calcularDeltaRefechamentoMinutos(null, resumoJanOriginal) === 0,
  'Primeiro fechamento (sem resumo anterior): delta é 0 (não há cascata a propagar)'
);

// 2.2 Refechamento idêntico: delta 0
const resumoJanIgual = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJanOriginal,
  status: 'FECHADO',
});
assert(
  calcularDeltaRefechamentoMinutos(resumoJanOriginal, resumoJanIgual) === 0,
  'Refechamento com dados idênticos: delta é 0'
);

// 2.3 Correção retroativa: crédito de 720 -> 600 min => saldo final 600 -> 480 (delta -120)
const lancamentosJanCorrigido: LancamentoSimples[] = [
  lanc('j1c', '1001', '2026-01', '05', 'CREDITO', 600),
  lanc('j2', '1001', '2026-01', '20', 'DEBITO', 120),
];
const resumoJanCorrigido = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJanCorrigido,
  status: 'FECHADO',
});
assert(resumoJanCorrigido.saldoFinalTransportadoMinutos === 480, 'Janeiro retificado fecha com saldo final exato de +480 min (8h)');
assert(
  calcularDeltaRefechamentoMinutos(resumoJanOriginal, resumoJanCorrigido) === -120,
  'Delta de refechamento apurado com exatidão: -120 min (10h -> 8h)'
);

// -------------------------------------------------------------
// Teste 3: Cenário completo — reabrir Janeiro, retificar e refechar com cascata
// -------------------------------------------------------------
console.log('\n--- Teste 3: Reabertura de Janeiro com cascata em Fevereiro e Março ---');

// Fevereiro: +300 min (5h), herdando saldo de Janeiro original
const lancamentosFev: LancamentoSimples[] = [
  lanc('f1', '1001', '2026-02', '10', 'CREDITO', 300),
];
const resumoFev = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-02',
  resumoAnterior: resumoJanOriginal,
  lancamentosDoMes: lancamentosFev,
  status: 'FECHADO',
});
assert(resumoFev.saldoAnteriorMinutos === 600, 'Fevereiro herdou saldo anterior exato de +600 min (10h) de Janeiro');
assert(resumoFev.saldoFinalTransportadoMinutos === 900, 'Fevereiro fechou com saldo final exato de +900 min (15h)');

// Março aberto, sem lançamentos: herda de Fevereiro
const resumoMar = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: resumoFev,
  lancamentosDoMes: [],
  status: 'ABERTO',
});
assert(resumoMar.saldoAnteriorMinutos === 900, 'Março abriu herdando exatamente +900 min (15h) de Fevereiro');

// Reabre Janeiro e retifica: delta -120 min propaga para Fevereiro
const deltaRetificacao = calcularDeltaRefechamentoMinutos(resumoJanOriginal, resumoJanCorrigido);
assert(deltaRetificacao === -120, 'Delta da retificação de Janeiro apurado: -120 min');

const cascataFev = propagarDeltaCascata({
  matricula: '1001',
  competenciaOrigem: '2026-01',
  deltaMinutos: deltaRetificacao,
  resumosSubsequentesOrdenados: [resumoFev],
});
const fevAjustado = cascataFev[0];
assert(fevAjustado.saldoAnteriorMinutos === 480, 'Fevereiro reajustado: saldo anterior corrigido para +480 min (8h)');
assert(fevAjustado.saldoFinalTransportadoMinutos === 780, 'Fevereiro reajustado: saldo final corrigido para +780 min (13h)');
assert(fevAjustado.horasCreditoMinutos === 300, 'Fevereiro: créditos próprios do mês permanecem INTACTOS (300 min)');
assert(fevAjustado.horasDebitoMinutos === 0, 'Fevereiro: débitos próprios do mês permanecem INTACTOS (0 min)');
assert(fevAjustado.statusIntegridade === 'REAJUSTADO_POR_CASCATA', 'Fevereiro marcado como REAJUSTADO_POR_CASCATA para auditoria');
assert(fevAjustado.deltaAplicadoMinutos === -120, 'Delta aplicado (-120 min) registrado explicitamente no documento');
assert(fevAjustado.versao === (resumoFev.versao || 1) + 1, 'Versão do resumo de Fevereiro incrementada');

// Março recalculado com o Fevereiro reajustado
const resumoMarAposCascata = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: fevAjustado,
  lancamentosDoMes: [],
  status: 'ABERTO',
});
assert(resumoMarAposCascata.saldoAnteriorMinutos === 780, 'Março recalculado abre com o saldo reajustado de +780 min (13h)');

// -------------------------------------------------------------
// Teste 4: Cascata com múltiplos meses intermediários (delta linear)
// -------------------------------------------------------------
console.log('\n--- Teste 4: Cascata linear por múltiplos meses intermediários ---');

const resumoAbril = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-04',
  resumoAnterior: resumoMarAposCascata,
  lancamentosDoMes: [lanc('a1', '1001', '2026-04', '12', 'CREDITO', 60)],
  status: 'FECHADO',
});
const resumoMaio = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-05',
  resumoAnterior: resumoAbril,
  lancamentosDoMes: [lanc('m1', '1001', '2026-05', '18', 'DEBITO', 30)],
  status: 'FECHADO',
});

// Nova retificação de Janeiro: delta adicional -60 min
const lancamentosJanCorrigido2: LancamentoSimples[] = [
  lanc('j1d', '1001', '2026-01', '05', 'CREDITO', 540),
  lanc('j2', '1001', '2026-01', '20', 'DEBITO', 120),
];
const resumoJanCorrigido2 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-01',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosJanCorrigido2,
  status: 'FECHADO',
});
const delta2 = calcularDeltaRefechamentoMinutos(resumoJanCorrigido, resumoJanCorrigido2);
assert(delta2 === -60, 'Segunda retificação de Janeiro apura delta de -60 min');

const cadeiaAjustada = propagarDeltaCascata({
  matricula: '1001',
  competenciaOrigem: '2026-01',
  deltaMinutos: delta2,
  resumosSubsequentesOrdenados: [resumoAbril, resumoMaio, fevAjustado],
});
const porCompetencia = new Map<string, ResumoMensalContabil>();
cadeiaAjustada.forEach((r) => porCompetencia.set(r.competencia, r));
assert(porCompetencia.get('2026-02')!.saldoFinalTransportadoMinutos === 720, 'Fevereiro: segunda cascata acumulada corrige saldo para +720 min (12h)');
assert(porCompetencia.get('2026-03')?.saldoAnteriorMinutos === undefined, 'Março (sem resumo materializado) permanece fora da cadeia oficial');

// -------------------------------------------------------------
// Teste 5: Virada de ano na cascata (Dezembro/2026 -> Janeiro/2027)
// -------------------------------------------------------------
console.log('\n--- Teste 5: Virada de ano na cascata ---');

assert(getCompetenciaAnterior('2027-01') === '2026-12', 'Álgebra de datas: anterior de 2027-01 é 2026-12');

const resumoDez2026 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-12',
  resumoAnterior: resumoMaio,
  lancamentosDoMes: [lanc('d1', '1001', '2026-12', '24', 'DEBITO', 480)],
  status: 'FECHADO',
});
const resumoJan2027 = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2027-01',
  resumoAnterior: resumoDez2026,
  lancamentosDoMes: [],
  status: 'FECHADO',
});
assert(resumoJan2027.saldoAnteriorMinutos === resumoDez2026.saldoFinalTransportadoMinutos, 'Janeiro/2027 abriu com o saldo exato de Dezembro/2026');

// Retificação de Dezembro/2026 propaga através da virada de ano
const lancamentosDezCorrigido: LancamentoSimples[] = [
  lanc('d1c', '1001', '2026-12', '24', 'DEBITO', 360),
];
const resumoDezCorrigido = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-12',
  resumoAnterior: resumoMaio,
  lancamentosDoMes: lancamentosDezCorrigido,
  status: 'FECHADO',
});
const deltaViradaAno = calcularDeltaRefechamentoMinutos(resumoDez2026, resumoDezCorrigido);
assert(deltaViradaAno === 120, 'Retificação de Dezembro/2026 apura delta de +120 min');

const cascata2027 = propagarDeltaCascata({
  matricula: '1001',
  competenciaOrigem: '2026-12',
  deltaMinutos: deltaViradaAno,
  resumosSubsequentesOrdenados: [resumoJan2027],
});
assert(
  cascata2027[0].saldoFinalTransportadoMinutos === resumoJan2027.saldoFinalTransportadoMinutos + 120,
  'Cascata atravessa a virada de ano: Janeiro/2027 reajustado em +120 min'
);
assert(cascata2027[0].statusIntegridade === 'REAJUSTADO_POR_CASCATA', 'Janeiro/2027 marcado como REAJUSTADO_POR_CASCATA');

// -------------------------------------------------------------
// Teste 6: Precisão de minutos inteiros nas somas da cascata
// -------------------------------------------------------------
console.log('\n--- Teste 6: Sanidade de minutos inteiros na cascata ---');
assert(Number.isInteger(deltaRetificacao) && Number.isInteger(delta2) && Number.isInteger(deltaViradaAno), 'Todos os deltas são minutos inteiros exatos');
assert(resumoJanCorrigido.saldoFinalTransportadoMinutos === 480 && resumoJanCorrigido2.saldoFinalTransportadoMinutos === 420, 'Saldos finais retificados são inteiros exatos (480 e 420 min)');

console.log('\n=============================================================');
console.log(`📊 RESULTADO FASE 4: ${passedTests}/${totalTests} TESTES ${failedTests === 0 ? 'PASSARAM COM SUCESSO!' : 'FALHARAM!'}`);
if (failedTests === 0) {
  console.log('🎉 BLINDAGEM CONTÁBIL VALIDADA: PRÉ-REQUISITOS, DELTA DE REFECHAMENTO E CASCATA OPERACIONAIS!');
} else {
  console.log(`❌ ${failedTests} teste(s) falharam.`);
  process.exit(1);
}
console.log('=============================================================');
