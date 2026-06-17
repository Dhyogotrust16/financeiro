# Sistema Financeiro

Sistema de gestão financeira para contadores e escritórios de contabilidade — gerencia honorários, reembolsos de despesas, cobranças de clientes e relatórios de lucratividade.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — sistema completo em uma porta só
- `pnpm start` — atalho equivalente no root do workspace
- `pnpm --filter @workspace/api-server run backfill:current-month-billings` — cria Contas a Receber faltantes para clientes ativos com honorário
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run typecheck:libs` — rebuild lib declarations (run after schema changes)
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Clerk auth (`@clerk/express`)
- DB: PostgreSQL + Drizzle ORM (lib/db)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec at `lib/api-spec/openapi.yaml`)
- Frontend: React 19 + Vite 7, Tailwind v4, shadcn/ui, Recharts, wouter, react-hook-form
- Auth: Clerk (managed via Replit integration)

## Where things live

- `lib/db/src/schema/` — DB schema (clients, categories, revenues, expenses, billings)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for API types)
- `lib/api-client-react/src/generated/` — generated hooks & schemas (do not edit)
- `artifacts/api-server/src/routes/` — Express route handlers (all user-scoped by Clerk userId)
- `artifacts/financeiro/src/pages/` — React pages (dashboard, clientes, receitas, despesas, cobranças, etc.)
- `artifacts/financeiro/src/components/layout/Shell.tsx` — main sidebar/nav layout
- `artifacts/financeiro/src/lib/format.ts` — Brazilian currency/date formatting utilities

## Architecture decisions

- All API data is scoped to `userId` from Clerk — no cross-user data leakage possible
- Dashboard/cashflow/monthly-close use path params (`/summary/:year/:month`) not query params — avoids Orval TS2308 `*Params` naming collision
- Orval-generated hooks follow `{ query: { enabled, queryKey } }` options format (not flat)
- Express 5 async route handlers require consistent `return res.json(...)` on every path to satisfy `noImplicitReturns`
- After any lib schema change, run `pnpm run typecheck:libs` before leaf artifact checks

## Product

- **Clientes**: cadastro completo com honorário mensal, dia de vencimento, CNPJ/CPF
- **Receitas**: lançamento de recebimentos com cliente, forma de pagamento, status
- **Despesas**: despesas do escritório e reembolsáveis por cliente com categorias
- **Cobranças**: geração automática de cobrança mensal (honorário + despesas do mês)
- **Contas a Receber / Pagar**: visão consolidada de pendências financeiras
- **Dashboard**: resumo mensal com KPIs, gráfico de fluxo de caixa 12 meses, lucratividade por cliente
- **Relatórios**: análise de receitas, despesas e rentabilidade com Recharts

## Gotchas

- After changing `lib/db` schema, run `pnpm run typecheck:libs` to rebuild declarations before API server typecheck
- Orval query hook options are nested: `{ query: { enabled: true, queryKey: [...] } }` — NOT flat `{ enabled: true }`
- `UserButton` from `@clerk/react` does NOT accept `afterSignOutUrl` in this version — remove it
- Demo seed data uses `userId = 'demo_seed_user'` — real data is per Clerk user

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
