# PATRIUM OS

**Sistema Operacional de Governança Patrimonial** — cockpit executivo para holdings, family offices e patrimônio agro, com o **JARVIS**, diretor patrimonial digital que responde sobre os dados reais do seu portfólio.

TanStack Start (SSR) · React 19 · Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + RLS)

- **App publicado**: https://screenshot-perfect-clone-199.lovable.app
- **Editor Lovable**: https://lovable.dev/projects/05c4f172-b7b6-4b34-b12b-4f8a5e4e1653

---

## Como rodar

Requisitos: **[Bun](https://bun.sh)** (o `npm install` falha com o lockfile atual) e **Node ≥ 22** (ver nota abaixo).

```bash
bun install
bun run dev        # http://localhost:8080
```

> **Node 20 não funciona** para as rotas protegidas / server functions: o Realtime do
> `supabase-js` exige WebSocket nativo. O cliente do servidor já é criado com um
> transport desativado (`src/integrations/supabase/serverTransport.ts`), então o SSR
> não quebra mais — mas o runtime recomendado continua sendo Node 22+.

```bash
bun run build      # build de produção (Nitro → Cloudflare Workers)
bun run preview
bun run lint       # eslint (rode `bun run format` uma vez para zerar o Prettier)
```

### Variáveis de ambiente

Já vêm em `.env` (o projeto Supabase é compartilhado). Para o JARVIS com IA generativa:

```env
JARVIS_LLM_PROVIDER=openai     # openai | anthropic | gemini
JARVIS_LLM_API_KEY=sk-...
JARVIS_LLM_MODEL=gpt-4o-mini   # opcional
JARVIS_LLM_BASE_URL=           # opcional: gateway/proxy/Azure/mock
```

Sem chave configurada o JARVIS continua respondendo — pelo **analista local
determinístico** (ver abaixo) — e a interface sinaliza "Modo analítico local".

---

## Dados de demonstração

O app abre com o tenant vazio. Há duas formas de popular:

**1. Pela interface (recomendado).** Ao entrar, o banner *"Popular demonstração"* cria
3 holdings, 12 ativos, 12 documentos, 8 riscos, 24 lançamentos, 6 insights e o histórico
de health score — **usando o JWT do usuário**, ou seja, todos os `INSERT` passam pelas
políticas de RLS. É também um teste vivo do modelo de permissões.

**2. Por SQL** (`supabase/seed.sql`, gerado do mesmo dataset):

```bash
bun run seed:sql                                     # regenera a partir de src/lib/demo/demoData.ts
psql "$SUPABASE_DB_URL" -f supabase/seed.sql         # ou: supabase db reset
```

Fonte única de verdade: `src/lib/demo/demoData.ts`. As datas são relativas a *hoje*
(vencimentos, riscos e prazos sempre coerentes com a data corrente).

---

## O JARVIS

`src/lib/api/jarvis.functions.ts` é uma server function autenticada que:

1. **monta o briefing** do portfólio do usuário (`buildBriefing`) — AUM, ativos por classe,
   holdings, riscos abertos ordenados por severidade/prazo, documentos na janela de
   vencimento, insights e resultado dos últimos 6 meses. Tudo via RLS: o agente só
   enxerga o patrimônio de quem perguntou;
2. **serializa** esse briefing como contexto factual (`briefingToPrompt`);
3. **consulta o LLM** configurado (OpenAI / Anthropic / Gemini) com um system prompt que
   proíbe inventar dados;
4. **cai para o analista local** (`src/lib/jarvis/localAnalyst.ts`) quando não há chave
   ou o provedor falha — mesmo números, respostas determinísticas, zero alucinação.

A resposta volta com as **fontes numéricas** exibidas como chips no chat (AUM, riscos,
documentos) e os "Próximos passos" viram sugestões clicáveis.

---

## Camada de escrita

Antes, o app era 100% leitura. Agora todas as mutações passam por server functions
autenticadas (`src/lib/api/crud.functions.ts`), validadas com Zod no cliente **e** no
servidor (`src/lib/validation/schemas.ts`), com CSRF habilitado:

| Tela | Ações |
| --- | --- |
| Imóveis | cadastrar / editar / excluir ativo, busca e filtros funcionais |
| Holdings | criar / editar holding |
| Riscos | registrar risco, marcar como resolvido |
| Saúde Documental | arquivar documento com vencimento |
| Financeiro | novo lançamento (entrada/saída) |

---

## Verificação

```bash
bun run test          # 13 testes unitários (bun test): dataset, analista local, schemas
bun run verify:llm    # caminho do LLM com stub HTTP local (sem gastar API)
bun run verify:db     # E2E real: signup, seed sob RLS, briefing, isolamento entre tenants
bun run verify:ui     # smoke em navegador (Playwright): login → seed → CRUD → JARVIS
```

`verify:db` cria usuários `@patrium.qa` no projeto Supabase — podem ser apagados em
*Authentication* depois da verificação.

---

## Estrutura

```
src/
  routes/                   24 rotas (TanStack Router file-based)
    __root.tsx              shell SSR, SEO, toasts
    index.tsx               landing de marketing
    login.tsx               auth (+ suporte a ?redirect=)
    _app.tsx                guard de sessão + AppLayout
    _app.*.tsx              cockpit: dashboard, jarvis/*, imoveis, holdings, riscos…
  components/
    layout/                 AppLayout (header, drawer do JARVIS), Sidebar
    forms/                  AssetForm, RiskForm, EntityForm, DocumentForm, TransactionForm
    jarvis/                 MarkdownLite
    demo/                   DemoBanner (popular demonstração)
    ui/                     shadcn/ui
  hooks/                    queries (usePatrimonio, useJarvis), mutações (useCrud), chat
  lib/
    api/                    server functions: crud, jarvis, demo
    jarvis/                 briefing.server, localAnalyst, types
    demo/                   demoData (dataset), seedDemo (gravação sob RLS)
    validation/             schemas Zod compartilhados
  integrations/supabase/    client, client.server, auth-middleware, serverTransport
supabase/
  migrations/               schema, RLS multi-tenant, auditoria, unicidade por tenant
  seed.sql                  dataset para psql / supabase db reset
scripts/                    geradores e verificações
```

---

## Segurança

- **RLS multi-tenant por linha**: tudo herda de `entities.owner_user_id` via
  `owns_entity()`; `admin` (via `user_roles`) enxerga tudo.
- **Server functions** exigem Bearer token (`requireSupabaseAuth`) e passaram a ter
  **middleware de CSRF** — o TanStack Start avisava que mutações RPC estavam expostas.
- **Trilha de auditoria real**: trigger `record_audit_log()` registra INSERT/UPDATE/DELETE
  em entities, assets, documents, risks, transactions e jarvis_insights, com autor e diff
  em JSONB (antes a tabela `audit_logs` existia e nada escrevia nela).
- **Unicidade por tenant**: `tax_id`/`email` eram únicos **globalmente** (migração
  `20261030130000` corrige). Além de impedir dois tenants de cadastrarem o mesmo CNPJ,
  o erro 23505 funcionava como oráculo de existência entre tenants.

---

## Notas de desenvolvimento

- `src/routeTree.gen.ts` é gerado — não editar.
- O guard de sessão (`_app.tsx`) roda só no browser: `getSession()` depende do storage
  local e instanciar o Supabase no SSR derrubava as rotas protegidas com HTTP 500.
- Rotas já usam `Link` para navegação interna em vez de botões sem `onClick`.
