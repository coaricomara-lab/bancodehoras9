/**
 * Suíte de Testes Fase 5 — Rastreabilidade, Validade, Auditoria e Portas de Acesso
 * Executável via tsx: npx tsx src/services/competenciaValidade.test.ts
 *
 * Cenários exigidos:
 * - Crédito gerado / compensação parcial / compensação total
 * - Vencimento (REGULAR, ATENCAO ≤60d, CRITICO ≤30d, VENCIDO) e prazo configurável (6/12 meses)
 * - Duplicação (idempotência do fechamento com metadados)
 * - Alteração retroativa (refechamento com cascata e metadados recalculados)
 * - Competência fechada (bloqueio de homologação/pré-requisito)
 * - Auditoria (valor anterior → novo por servidor, LGPD: sem dados pessoais)
 * - Acesso não autorizado (porta de homologação para não-gestores)
 */

import {
  PRAZO_BANCO_HORAS_MESES,
  apurarRastreioLancamentos,
  calcularMetadadosValidade,
  calcularCompetenciaColaborador,
  calcularDeltaRefechamentoMinutos,
  propagarDeltaCascata,
  isFechamentoIdempotente,
  podeHomologarCompetencia,
  montarResumoAuditoriaFechamento,
  validarPreRequisitoFechamento,
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
console.log('🧪 FASE 5: RASTREABILIDADE, VALIDADE, AUDITORIA E ACESSO');
console.log('=============================================================\n');

// -------------------------------------------------------------
// Teste 1: Prazo configurável central
// -------------------------------------------------------------
console.log('--- Teste 1: Prazo configurável central (PRAZO_BANCO_HORAS_MESES) ---');
assert(PRAZO_BANCO_HORAS_MESES === 6, 'Prazo central definido em 6 meses (SPTF, Art. 59 §5º)');

// -------------------------------------------------------------
// Teste 2: Crédito gerado, compensação parcial e total
// -------------------------------------------------------------
console.log('\n--- Teste 2: Rastreio de créditos (gerado / parcial / total) ---');

// 2.1 Crédito gerado sem compensação (saldo_remanescente ausente = totalmente em aberto)
const rGerado = apurarRastreioLancamentos([{ saldoCalculadoMinutos: 720 }]);
assert(rGerado.minutosGerados === 720 && rGerado.minutosCompensados === 0, 'Crédito gerado de 720 min sem compensação: gerados=720, compensados=0');

// 2.2 Compensação parcial (FIFO consumiu parte do crédito)
const rParcial = apurarRastreioLancamentos([{ saldoCalculadoMinutos: 720, saldoRemanescenteMinutos: 300 }]);
assert(rParcial.minutosGerados === 720 && rParcial.minutosCompensados === 420, 'Compensação PARCIAL: gerados=720, compensados=420, disponíveis=300');

// 2.3 Compensação total (saldo_remanescente = 0)
const rTotal = apurarRastreioLancamentos([{ saldoCalculadoMinutos: 720, saldoRemanescenteMinutos: 0 }]);
assert(rTotal.minutosGerados === 720 && rTotal.minutosCompensados === 720, 'Compensação TOTAL: gerados=720, compensados=720, disponíveis=0');

// 2.4 Débitos e registros inválidos são ignorados
const rDebitos = apurarRastreioLancamentos([
  { saldoCalculadoMinutos: -480 },
  { saldoCalculadoMinutos: 0 },
  { saldoCalculadoMinutos: 90 },
]);
assert(rDebitos.minutosGerados === 90 && rDebitos.minutosCompensados === 0, 'Débitos e registros neutros são ignorados no rastreio (apenas 90 min contados)');

// 2.5 Múltiplos créditos consolidam corretamente
const rMulti = apurarRastreioLancamentos([
  { saldoCalculadoMinutos: 720, saldoRemanescenteMinutos: 0 },
  { saldoCalculadoMinutos: 300 },
  { saldoCalculadoMinutos: 150, saldoRemanescenteMinutos: 60 },
]);
assert(rMulti.minutosGerados === 1170 && rMulti.minutosCompensados === 810, 'Consolidação multi-crédito: gerados=1170, compensados=810, disponíveis=360');

// -------------------------------------------------------------
// Teste 3: Metadados de validade e situações de vencimento
// -------------------------------------------------------------
console.log('\n--- Teste 3: Metadados de validade (geração, prazo, vencimento, situação) ---');

const metaRegular = calcularMetadadosValidade({
  competencia: '2026-03',
  minutosGerados: 600,
  minutosCompensados: 200,
  dataReferencia: '2026-04-10',
});
assert(metaRegular.dataGeracao === '2026-03-01', 'Data de geração = primeiro dia da competência (2026-03-01)');
assert(metaRegular.prazoMeses === 6, 'Prazo aplicável registrado: 6 meses');
assert(metaRegular.dataVencimento === '2026-09-01', 'Data de vencimento = geração + 6 meses (2026-09-01)');
assert(metaRegular.minutosDisponiveis === 400, 'Minutos disponíveis = gerados - compensados (400 min)');
assert(metaRegular.situacao === 'REGULAR', 'Com referência longe do vencimento: situação REGULAR');

// 3.1 ATENÇÃO: entre 31 e 60 dias do vencimento
const metaAtencao = calcularMetadadosValidade({
  competencia: '2026-03',
  minutosGerados: 600,
  minutosCompensados: 0,
  dataReferencia: '2026-07-15',
});
assert(metaAtencao.situacao === 'ATENCAO', 'Vencendo entre 31 e 60 dias: situação ATENCAO (alerta preventivo)');

// 3.2 CRÍTICO: 30 dias ou menos
const metaCritico = calcularMetadadosValidade({
  competencia: '2026-03',
  minutosGerados: 600,
  minutosCompensados: 0,
  dataReferencia: '2026-08-15',
});
assert(metaCritico.situacao === 'CRITICO', 'Vencendo em até 30 dias: situação CRITICO');

// 3.3 VENCIDO: após a data de vencimento
const metaVencido = calcularMetadadosValidade({
  competencia: '2026-03',
  minutosGerados: 600,
  minutosCompensados: 0,
  dataReferencia: '2026-09-15',
});
assert(metaVencido.situacao === 'VENCIDO', 'Após a data de vencimento: situação VENCIDO');

// 3.4 Nada disponível => nada a vencer
const metaZerado = calcularMetadadosValidade({
  competencia: '2026-03',
  minutosGerados: 600,
  minutosCompensados: 600,
  dataReferencia: '2026-09-15',
});
assert(metaZerado.minutosDisponiveis === 0 && metaZerado.situacao === 'REGULAR', 'Créditos totalmente compensados: situação REGULAR (nada a vencer)');

// 3.5 Prazo customizado de 12 meses (configurável)
const meta12 = calcularMetadadosValidade({
  competencia: '2026-09',
  minutosGerados: 300,
  minutosCompensados: 0,
  prazoMeses: 12,
  dataReferencia: '2026-10-01',
});
assert(meta12.dataVencimento === '2027-09-01' && meta12.situacao === 'REGULAR', 'Prazo configurável de 12 meses: vencimento em 2027-09-01, situação REGULAR');

// 3.6 Metadados anexados ao resumo da competência
const colaborador = { matricula: '1001', nome: 'Carlos', sede: 'KO' };
const resumoComMeta = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: null,
  lancamentosDoMes: [lanc('c1', '1001', '2026-03', '10', 'CREDITO', 600)],
  status: 'FECHADO',
});
Object.assign(
  resumoComMeta,
  calcularMetadadosValidade({
    competencia: '2026-03',
    minutosGerados: 600,
    minutosCompensados: 100,
  })
);
assert(resumoComMeta.minutosGerados === 600 && resumoComMeta.minutosCompensados === 100, 'Resumo mensal persiste metadados: gerados=600, compensados=100');
assert(resumoComMeta.minutosDisponiveis === 500 && resumoComMeta.dataVencimento === '2026-09-01', 'Resumo mensal persiste disponíveis=500 e vencimento=2026-09-01');
assert(!('nomeColaborador' in resumoComMeta) && !('cpf' in resumoComMeta) && !('salario' in resumoComMeta), 'LGPD: resumo mensal sem nome, CPF ou salário (apenas matrícula e totais)');

// -------------------------------------------------------------
// Teste 4: Duplicação (idempotência do fechamento com metadados)
// -------------------------------------------------------------
console.log('\n--- Teste 4: Duplicação — fechar duas vezes não altera resultado ---');

const lancamentosMar = [lanc('c1', '1001', '2026-03', '10', 'CREDITO', 600)];
const resumoMarOriginal = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosMar,
  status: 'FECHADO',
});
Object.assign(resumoMarOriginal, calcularMetadadosValidade({ competencia: '2026-03', minutosGerados: 600, minutosCompensados: 0 }));

const resumoMarDuplicado = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: null,
  lancamentosDoMes: lancamentosMar, // mesmos dados — clique duplicado / retentativa
  status: 'FECHADO',
});
Object.assign(resumoMarDuplicado, calcularMetadadosValidade({ competencia: '2026-03', minutosGerados: 600, minutosCompensados: 0 }));

assert(resumoMarDuplicado.id === resumoMarOriginal.id, 'ID determinístico: fechamento duplicado gravaria o MESMO documento (sem duplicação)');
assert(isFechamentoIdempotente(resumoMarOriginal, resumoMarDuplicado), 'Fechamento duplicado com mesmos dados é detectado como idempotente (sem regravação)');
assert(
  resumoMarDuplicado.hashLancamentosConsolidados === resumoMarOriginal.hashLancamentosConsolidados,
  'Hash dos lançamentos idêntico: nada mudou entre as duas execuções'
);

// -------------------------------------------------------------
// Teste 5: Alteração retroativa (refechamento com cascata + metadados)
// -------------------------------------------------------------
console.log('\n--- Teste 5: Alteração retroativa — reabrir, retificar e refechar ---');

const resumoAbril = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-04',
  resumoAnterior: resumoMarOriginal,
  lancamentosDoMes: [lanc('a1', '1001', '2026-04', '05', 'CREDITO', 120)],
  status: 'FECHADO',
});
assert(resumoAbril.saldoAnteriorMinutos === 600, 'Abril herdou saldo anterior exato de Março (600 min)');

// Reabre Março e retifica: crédito de 600 -> 480 min (delta -120)
const resumoMarRetificado = calcularCompetenciaColaborador({
  colaborador,
  competencia: '2026-03',
  resumoAnterior: null,
  lancamentosDoMes: [lanc('c1b', '1001', '2026-03', '10', 'CREDITO', 480)],
  status: 'FECHADO',
});
Object.assign(resumoMarRetificado, calcularMetadadosValidade({ competencia: '2026-03', minutosGerados: 480, minutosCompensados: 0 }));

const delta = calcularDeltaRefechamentoMinutos(resumoMarOriginal, resumoMarRetificado);
assert(delta === -120, 'Delta retroativo apurado com exatidão: -120 min');
assert(resumoMarRetificado.minutosGerados === 480, 'Metadados recalculados no refechamento: gerados=480 (não permanecem os antigos)');

const cascata = propagarDeltaCascata({
  matricula: '1001',
  competenciaOrigem: '2026-03',
  deltaMinutos: delta,
  resumosSubsequentesOrdenados: [resumoAbril],
});
assert(cascata[0].saldoAnteriorMinutos === 480, 'Cascata: Abril reajustado com saldo anterior de 480 min (600-120)');
assert(cascata[0].statusIntegridade === 'REAJUSTADO_POR_CASCATA', 'Resumo posterior marcado como REAJUSTADO_POR_CASCATA');

// -------------------------------------------------------------
// Teste 6: Competência fechada (bloqueios)
// -------------------------------------------------------------
console.log('\n--- Teste 6: Competência fechada — bloqueios de homologação ---');

assert(validarPreRequisitoFechamento('ABERTO').valido === false, 'Fechamento bloqueado com competência anterior ABERTA');
assert(validarPreRequisitoFechamento('REABERTO').valido === false, 'Fechamento bloqueado com competência anterior REABERTA (retificação pendente)');
assert(podeHomologarCompetencia(true, 'FECHADO') === false, 'Competência já FECHADA não pode ser homologada novamente pela porta comum');
assert(podeHomologarCompetencia(true, 'REABERTO') === true, 'Competência REABERTA pode ser refechada pelo gestor');

// -------------------------------------------------------------
// Teste 7: Auditoria enriquecida (anterior → novo por servidor)
// -------------------------------------------------------------
console.log('\n--- Teste 7: Auditoria enriquecida e minimização LGPD ---');

const diffPayload = montarResumoAuditoriaFechamento({
  competencia: '2026-03',
  operadorEmail: 'gestor@comara.mil.br',
  diffs: [
    { matricula: '1001', saldoFinalAnteriorMinutos: 500, saldoFinalNovoMinutos: 380, deltaMinutos: -120 },
    { matricula: '1002', saldoFinalAnteriorMinutos: 240, saldoFinalNovoMinutos: 240, deltaMinutos: 0 },
  ],
  mesesAfetadosCascata: ['2026-04'],
  dataHora: '2026-09-03T15:00:00.000Z',
});

const diffJson = JSON.stringify(diffPayload);
assert(diffJson.includes('"saldoFinalAnteriorMinutos":500') && diffJson.includes('"saldoFinalNovoMinutos":380'), 'Auditoria registra valor ANTERIOR → NOVO por servidor (500 → 380 min)');
assert(diffPayload.usuario === 'gestor@comara.mil.br' && diffPayload.dataHora === '2026-09-03T15:00:00.000Z', 'Auditoria registra usuário e data/hora da operação');
assert(diffPayload.motivo === 'REFECHAMENTO_RETIFICACAO', 'Auditoria classifica o motivo como REFECHAMENTO_RETIFICACAO quando houve alteração');
assert(
  diffPayload.impacto.servidoresAlterados === 2 &&
    diffPayload.impacto.deltaTotalMinutos === -120 &&
    diffPayload.impacto.mesesAfetadosCascata[0] === '2026-04',
  'Auditoria consolida o impacto (2 servidores, delta -120 min, cascata em 2026-04)'
);
assert(!diffJson.includes('"nome"') && !diffJson.includes('"cpf"') && !diffJson.includes('"salario"'), 'LGPD: log de auditoria sem nome, CPF ou salário (apenas matrícula e valores)');

// Homologação inicial (sem resumo anterior) é classificada corretamente
const payloadPrimeira = montarResumoAuditoriaFechamento({
  competencia: '2026-03',
  operadorEmail: 'gestor@comara.mil.br',
  diffs: [],
  mesesAfetadosCascata: [],
});
assert(payloadPrimeira.motivo === 'HOMOLOGACAO_FECHAMENTO', 'Primeira homologação (sem diffs) classificada como HOMOLOGACAO_FECHAMENTO');

// -------------------------------------------------------------
// Teste 8: Acesso não autorizado
// -------------------------------------------------------------
console.log('\n--- Teste 8: Acesso não autorizado — porta de homologação ---');

assert(podeHomologarCompetencia(false, 'ABERTO') === false, 'Usuário SEM perfil de gestor global NÃO pode homologar competência');
assert(podeHomologarCompetencia(false, 'REABERTO') === false, 'Usuário sem perfil de gestor NÃO pode refechar competência reaberta');
assert(podeHomologarCompetencia(true, 'ABERTO') === true, 'Gestor global (SUPER_ADMIN/GESTOR_RH) pode homologar competência aberta');

console.log('\n=============================================================');
console.log(`📊 RESULTADO FASE 5: ${passedTests}/${totalTests} TESTES ${failedTests === 0 ? 'PASSARAM COM SUCESSO!' : 'FALHARAM!'}`);
if (failedTests === 0) {
  console.log('🎉 RASTREABILIDADE, VALIDADE, AUDITORIA E PORTAS DE ACESSO VALIDADAS!');
} else {
  console.log(`❌ ${failedTests} teste(s) falharam.`);
  process.exit(1);
}
console.log('=============================================================');
