# Relatório — Enquadramento da Regulamentação e Controle de Horas

## 1. Motor de cálculo (CLT/SPTF) — `src/services/timebankEngine.ts`
- **Tipos de ocorrência regulamentados** (`src/types.ts`): TRABALHO, ACABOU_BANHOU, FALTA INJUSTIFICADA ('F'/'D'), FALTA JUSTIFICADA, DISPENSA SPTF (guia 2 vias), DISPENSA OPERACIONAL, COMPENSAÇÃO, ATESTADO MÉDICO ('AT'), FÉRIAS ('FE'), LICENÇA.
- **Multiplicadores legais de horas**: Seg–Sex 1:1 · Sábado **1:1,5** · Domingo/Feriado **1:2 (horas em dobro)**.
- **Calendário de feriados** nacionais/municipais 2025–2026 por sede, com cálculo automático de feriado.
- **Destino de cada lançamento**: Folha de Pagamento (falta injustificada → desconto), Banco de Horas (trabalho/dispensas/compensações) ou Neutro p/ Auditoria (atestado, férias, licença) — com trilha de decisão documentada (`descricaoRegra`).

## 2. Entrada de dados e validações
- `LaunchModal` — parametrização de regras com exibição em tempo real da regra aplicada e do cálculo antes de salvar.
- `DailyEntryModal` — registro diário com validação obrigatória de comprovante (atestado exige anexo) e observação, férias com expansão dia a dia (8h/dia, neutro).
- `QuickBatchEntryModal` e `ImportTimeRecordsModal` — lançamento em lote e importação de registros de ponto.

## 3. Conformidade trabalhista
- **Folha de Portaria** (`PortariaAttendanceSheetModal`) — espelho de presença diária imprimível no formato de portaria, excluindo desligados.
- **Dispensas de SPTF** (`SptfDispensaModal`, `DispensasFaltasManagement`) — guia oficial em 2 vias vinculada ao débito no banco de horas.

## 4. Controle de competência mensal (fechamento blindado)
- `competenciaService`/`competenciaEngine` — fechamento com **pré-requisito sequencial** (C-1 fechado), **reabertura versionada** (versaoCalculo) e delta de refechamento auditado.
- `LiquidacaoReportModal` e `ValidityAlertsPanel` — liquidação na competência e alertas de validade.
- **Blindagem no Firestore** (`firestore.rules`): bloqueio de lançamento de horas em competência fechada **no próprio banco**, independente da interface; GERENTE_CANTEIRO é somente leitura.

## 5. Auditoria e relatórios
- `auditService` — log de todas as ações sobre lançamentos e fechamentos (`AuditTrailView`).
- `ExecutiveReportsView` (relatórios de Banco de Horas e Insalubridade), extrato do colaborador (`EmployeeStatement`, `CollaboratorBalancesPrintModal`) e portal de autosserviço (`EmployeeSelfServicePortal`) com saldo do banco de horas (credor/devedor/zerado, HE 50%/100%).
- **Testes automatizados**: `competenciaEngine.test.ts`, `competenciaService.test.ts`, `competenciaValidade.test.ts`, `competenciaBlindagem.test.ts`.
