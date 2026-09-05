import { readFileSync } from 'node:fs';
import {
  podeGerenciarCanteiro,
  statusEfetivoCanteiro,
  validarLancamentoCanteiro,
  StatusCanteiros,
} from './competenciaEngine';

let totalTests = 0;
let passedTests = 0;

function assert(condition: boolean, name: string) {
  totalTests++;
  if (!condition) throw new Error(`[FAIL] ${name}`);
  passedTests++;
  console.log(`[PASS] ${name}`);
}

const fechadoAnterior: StatusCanteiros = {
  KO: { status: 'FECHADO', data: '2026-08-31T18:00:00Z', usuario: 'admin@comara.gov.br', motivo: null },
  BE: { status: 'ABERTO', data: null, usuario: null, motivo: null },
};

assert(statusEfetivoCanteiro(fechadoAnterior, 'KO') === 'FECHADO', 'status fechado do canteiro e localizado');
assert(statusEfetivoCanteiro(fechadoAnterior, 'BE') === 'ABERTO', 'status aberto permanece independente');
assert(!validarLancamentoCanteiro(fechadoAnterior, 'BE').permitido, 'bloqueia quando o mes anterior do canteiro nao esta fechado');
assert(validarLancamentoCanteiro(fechadoAnterior, 'KO').permitido, 'libera quando o mes anterior do canteiro esta fechado');

const reabertoAnterior: StatusCanteiros = {
  ...fechadoAnterior,
  KO: { ...fechadoAnterior.KO, status: 'ABERTO', motivo: 'Retificacao administrativa' },
};
assert(!validarLancamentoCanteiro(reabertoAnterior, 'KO').permitido, 'bloqueia novamente depois da reabertura');
assert(validarLancamentoCanteiro(reabertoAnterior, 'KO', true).bypass, 'SUPER_ADMIN pode usar bypass explicito');

assert(podeGerenciarCanteiro('CHEFE_DA', 'KO', 'KO'), 'CHEFE_DA gerencia o proprio canteiro');
assert(!podeGerenciarCanteiro('CHEFE_CANTEIRO', 'KO', 'BE'), 'CHEFE_CANTEIRO nao gerencia outro canteiro');
assert(podeGerenciarCanteiro('RH_ADMIN', undefined, 'BE'), 'RH_ADMIN gerencia todos os canteiros');
assert(podeGerenciarCanteiro('SUPER_ADMIN', undefined, 'BE'), 'SUPER_ADMIN gerencia todos os canteiros');

const rules = readFileSync('firestore.rules', 'utf8');
assert(rules.includes('function lancamentoCanteiroPermitido'), 'regras possuem a trava de lancamento por canteiro');
assert(rules.includes('competenciaAnterior(competencia)'), 'regras calculam a competencia anterior');
assert(rules.includes('statusCanteiros'), 'regras protegem statusCanteiros');
assert(rules.includes("affectedKeys().hasOnly(['statusCanteiros'])"), 'regras limitam update de chefia ao mapa de status');

console.log(`\n${passedTests}/${totalTests} testes de fechamento por canteiro passaram.`);
