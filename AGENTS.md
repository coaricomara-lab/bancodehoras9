# Base44 development notes

- Run the app with `docker compose -f docker-compose.base44.yml up -d`.
- The frontend is a Vite development server on port 3000 with source bind-mounted for live reload.
- Firebase client configuration is committed in `firebase-applet-config.json`; the UI falls back to browser-local data when Firestore is unavailable or access is denied.
- `GEMINI_API_KEY` appears only as an optional template entry and is not required by the current source or at boot.
- Verify locally with `curl -f http://localhost:3000/` and externally with a non-localhost Host header.
- Type-check with `docker compose -f docker-compose.base44.yml exec -T web npm run lint`.
- Máquina de Competências (Fase 1–4): rodar as suítes com `npx tsx src/services/competenciaEngine.test.ts` (44 testes), `npx tsx src/services/competenciaService.test.ts` (16) e `npx tsx src/services/competenciaBlindagem.test.ts` (33) dentro do serviço `web`.
- Fase 4 (blindagem): `firestore.rules` bloqueia create/update/delete de `lancamentos` em competência FECHADO (bypass Super Admin); todo lançamento persiste o campo `competencia` (YYYY-MM) derivado de `dataRegistro`; `fecharCompetencia` exige C-1 FECHADO, apura delta de refechamento e dispara cascata automática nas competências posteriores. As regras alteradas precisam ser publicadas com `npm run deploy:rules` (requer Firebase CLI autenticado — fora do sandbox).

## Design System — Paleta Institucional Aeronáutica

- **Tokens:** `src/constants/designTokens.ts` (TS reference) + CSS custom properties in `src/index.css` (`:root` for light, `[data-theme="dark"]` for dark). App.tsx syncs `data-theme` on `document.documentElement` via `useEffect`.
- **Palette:** dark mode uses navy institutional surfaces (`#0B1426` base, `#16243D` card, `#243756` border) with slate text scale (`#E2E8F0`, `#94A3B8`, `#64748B`). Light mode uses slate surfaces (`#F1F5F9` base, `#FFFFFF` card, `#E2E8F0` border). Brand accent `#3B82F6` (blue-500) preserved across both themes. Semantic colors (success/danger/warning/purple) unchanged.
- **Base components:** `src/components/ui/` — `Button` (6 variants × 4 sizes, loading state), `Card`/`CardHeader`/`CardBody`, `Input` (label, icon, error, hint), `Badge` (6 semantic variants). All consume CSS variables for theme-awareness.
- **Consistency:** All inputs have `focus:ring-2` focus rings. Primary buttons use `shadow-lg shadow-blue-600/20` + `active:scale-[0.98]` tactile feedback. All buttons with `cursor-pointer` + `transition-*` have `active:scale-[0.98]`.
- **To add a new screen:** prefer importing from `src/components/ui/` for buttons, cards, inputs, badges. Use CSS variables (`var(--surface-card)`, etc.) for theme-aware colors.
