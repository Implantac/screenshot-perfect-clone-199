# Migrations — `drizzle/` é o que a Lovable executa

## Por que esta pasta existe (e por que ela é a fonte de verdade da execução)

O repositório tem **duas** árvores de migrations, com papéis diferentes:

| Árvore | Papel | Quem executa |
|---|---|---|
| `supabase/migrations/*.sql` | **fonte de verdade legível** — comentários, o "por que" de cada decisão, revisão humana | ninguém, sozinha |
| `drizzle/migrations/*.sql` | **o que roda de fato** | o pipeline da Lovable (`drizzle-kit migrate`, `LOVABLE_DB_MIGRATION_URL`) |

O `drizzle/schema.ts` é deliberadamente vazio (`// auto-generated and intentionally left blank`): o drizzle aqui **não** é usado de forma declarativa. Ele é apenas o executor das migrations — cada arquivo em `drizzle/migrations/` é o SQL de uma migration de `supabase/migrations/`, com os comentários removidos. Os `meta/*_snapshot.json` também são vazios de tabelas, pelo mesmo motivo.

### O incidente que revelou isso

Em 04/11/2026 o banco publicado tinha exatamente **9** migrations aplicadas — `audit_trail` até `balance_sheet` — enquanto o código publicado estava na wave 28. As 9 coincidiam, uma a uma, com os 9 arquivos que existiam em `drizzle/migrations/`. As waves 14 a 28 existiam em `supabase/migrations/` e **nunca chegaram ao banco**, porque nunca foram espelhadas aqui.

**Regra que passa a valer:** toda migration nova precisa das **duas** cópias. Só `supabase/migrations/` não aplica nada.

## Estado atual

| drizzle | supabase | wave | assunto |
|---|---|---|---|
| `0000_audit_trail` | `20261030120000` | 4 | trilha de auditoria |
| `0001_tenant_scoped_uniques` | `20261030130000` | 4 | unicidade por tenant |
| `0002_operations_tables` | `20261030140000` | 5 | fornecedores e contencioso |
| `0003_wealth_core` | `20261030150000` | 4 | custodiantes, contas, posições |
| `0004_imports` | `20261030160000` | 6 | lotes de importação |
| `0005_quotes` | `20261030170000` | 7 | cotações |
| `0006_fund_quotes` | `20261030180000` | 8 | cotas de fundos (CVM) |
| `0007_private_markets` | `20261030190000` | 9 | compromissos e eventos |
| `0008_balance_sheet` | `20261030200000` | 11 | passivos e metas |
| `0009_portal_access` | `20261030210000` | 14 | portal do cliente |
| `0010_auth_security` | `20261030220000` | 17 | política de segurança / MFA |
| `0011_legal_provisions` | `20261030230000` | 18 | provisão CPC 25 |
| `0012_agro` | `20261030240000` | 19 | talhões, arrendamento, barter |
| `0013_audit_chain` | `20261030250000` | 20 | cadeia de hash e âncoras |
| `0014_jarvis_tools` | `20261030260000` | 21 | propostas do JARVIS |
| `0015_multi_family_office` | `20261030270000` | 22 | escritório, equipe, consentimento |
| `0016_tenant_isolation` | `20261030280000` | 23 | fecha policies legadas |
| `0017_office_detail_scope` | `20261030290000` | 24 | escopo por seção e log |
| `0018_anchor_signature` | `20261030300000` | 25 | assinatura ECDSA das âncoras |
| `0019_system_events` | `20261030310000` | 26 | eventos de observabilidade |
| `0020_account_balances` | `20261030320000` | 28 | saldo por conta |

Os 8 primeiros arquivos de `supabase/migrations/` (`20260610*`) são o esquema inicial criado pela própria Lovable e já vêm aplicados na criação do projeto — não têm espelho em `drizzle/` e não precisam ter.

## Como adicionar uma wave nova

1. Escreva a migration em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`, com os comentários explicando o **porquê**.
2. Gere o espelho, na raiz do repo:

   ```bash
   bun run db:mirror
   ```

   O script remove comentários (`--` e `/* */`) sem tocar em string literal nem em dollar-quote, cria `drizzle/migrations/NNNN_nome.sql` e o snapshot encadeado, e acrescenta a entrada em `meta/_journal.json`. Ele é idempotente: não recria o que já existe e **falha** se o SQL do espelho divergir do original.
3. Rode `bun run check:migrations` para conferir que cada arquivo de `drizzle/` tem token idêntico ao de `supabase/` (prova de que nenhum SQL se perdeu na remoção de comentários).
4. Commit das duas árvores juntas.

## O que **não** editar à mão

- `drizzle/schema.ts` — é gerado e vazio de propósito.
- `meta/*_snapshot.json` — só o `id`/`prevId` importam (encadeamento); o resto é vazio por desenho. Use o script.
- Nunca edite um arquivo de `drizzle/migrations/` já aplicado: o drizzle guarda o hash e o runner para de reconhecer aquela migration.

## Caminho alternativo (só emergência)

`supabase/APLICAR-FALTANTES.sql` contém as waves 14–28 num arquivo só, para colar no SQL Editor do Supabase caso o pipeline da Lovable esteja indisponível. **Não use os dois caminhos ao mesmo tempo**: o drizzle veria as migrations como pendentes e tentaria reaplicar (o DDL é idempotente, mas você fica com dois históricos divergentes).

O workflow `.github/workflows/migrations.yml` é o mesmo tipo de plano B, por `supabase db push` — disparo manual, `dry-run` por padrão. Ele exige um baseline (`supabase migration repair`) porque o histórico `schema_migrations` nunca foi alimentado; instruções em `/home/user/AUTOMATIZAR-MIGRATIONS.md` (fora deste repo).
