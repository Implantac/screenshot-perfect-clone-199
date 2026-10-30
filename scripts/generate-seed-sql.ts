/**
 * Gera `supabase/seed.sql` a partir do dataset de demonstração em
 * `src/lib/demo/demoData.ts` — fonte única de verdade.
 *
 * Uso:
 *   bun run scripts/generate-seed-sql.ts            # usa o e-mail padrão de demo
 *   SEED_USER_EMAIL=eu@exemplo.com bun run scripts/generate-seed-sql.ts
 *
 * O SQL gerado é idempotente por tenant: apaga os dados do usuário alvo
 * (identificado por e-mail em auth.users) e recria o dataset completo.
 * Rodar com service_role / psql, nunca no browser.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDemoDataset, DEMO_ENTITY_NAMES } from "../src/lib/demo/demoData";

const email = process.env.SEED_USER_EMAIL ?? "demo@patrium.os";

const q = (v: string | null): string => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null): string => (v === null ? "NULL" : String(v));
const d = (days: number): string => `(CURRENT_DATE + ${days})`;
const ts = (days: number): string => `(now() + interval '${days} days')`;

function monthsAgo(m: number, day: number): string {
  return `(date_trunc('month', now()) - interval '${m} months' + interval '${day - 1} days')::date`;
}

const demo = buildDemoDataset();
const lines: string[] = [];

lines.push(`-- =============================================================================`);
lines.push(`-- PATRIUM OS — dataset de demonstração`);
lines.push(`-- GERADO AUTOMATICAMENTE por scripts/generate-seed-sql.ts`);
lines.push(`-- Não edite à mão: altere src/lib/demo/demoData.ts e rode o gerador.`);
lines.push(`--`);
lines.push(`-- Uso (service_role / psql, após criar o usuário ${email} em Authentication):`);
lines.push(`--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql`);
lines.push(`--   ou: supabase db reset   (o CLI roda supabase/seed.sql automaticamente)`);
lines.push(`-- =============================================================================`);
lines.push(``);
lines.push(`DO $$`);
lines.push(`DECLARE`);
lines.push(`  v_user uuid;`);
lines.push(`  v_holding uuid;`);
lines.push(`  v_agro uuid;`);
lines.push(`  v_re uuid;`);
lines.push(`  v_asset uuid;`);
lines.push(`  v_insight uuid;`);
lines.push(`  v_member uuid;`);
lines.push(`BEGIN`);
lines.push(`  SELECT id INTO v_user FROM auth.users WHERE email = ${q(email)};`);
lines.push(`  IF v_user IS NULL THEN`);
lines.push(
  `    RAISE EXCEPTION 'Usuário % não encontrado em auth.users. Crie a conta primeiro.', ${q(email)};`,
);
lines.push(`  END IF;`);
lines.push(``);
lines.push(`  -- Limpa o tenant alvo (ordem respeita as FKs)`);
lines.push(
  `  DELETE FROM public.jarvis_action_plans WHERE insight_id IN (SELECT id FROM public.jarvis_insights WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user));`,
);
lines.push(
  `  DELETE FROM public.jarvis_insights   WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.jarvis_health_scores WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.transactions WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.risks        WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.documents    WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.assets       WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(
  `  DELETE FROM public.entity_shares WHERE entity_id IN (SELECT id FROM public.entities WHERE owner_user_id = v_user);`,
);
lines.push(`  DELETE FROM public.members  WHERE owner_user_id = v_user;`);
lines.push(`  DELETE FROM public.entities WHERE owner_user_id = v_user;`);
lines.push(``);

// Entidades
lines.push(`  -- Holdings`);
for (const e of demo.entities) {
  const taxIdExpr = `CASE WHEN EXISTS (SELECT 1 FROM public.entities WHERE tax_id = ${q(e.tax_id)}) THEN NULL ELSE ${q(e.tax_id)} END`;
  lines.push(
    `  INSERT INTO public.entities (name, tax_id, type, founded_at, compliance_score, owner_user_id) VALUES (${q(e.name)}, ${taxIdExpr}, ${q(e.type)}, ${q(e.founded_at)}, ${n(e.compliance_score)}, v_user) RETURNING id INTO ${e.name === DEMO_ENTITY_NAMES[0] ? "v_holding" : e.name === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re"};`,
  );
}
lines.push(``);

// Membros
lines.push(`  -- Sócios e conselho`);
for (const m of demo.members) {
  lines.push(
    `  INSERT INTO public.members (full_name, email, tax_id, role, owner_user_id) VALUES (` +
      `${q(m.full_name)}, ` +
      `CASE WHEN EXISTS (SELECT 1 FROM public.members WHERE email = ${q(m.email)}) THEN NULL ELSE ${q(m.email)} END, ` +
      `CASE WHEN EXISTS (SELECT 1 FROM public.members WHERE tax_id = ${q(m.tax_id)}) THEN NULL ELSE ${q(m.tax_id)} END, ` +
      `${q(m.role)}, v_user);`,
  );
}
lines.push(``);

// Shares
lines.push(`  -- Participações societárias`);
for (const m of demo.members) {
  for (const s of m.shares) {
    const entityVar =
      s.entity === DEMO_ENTITY_NAMES[0]
        ? "v_holding"
        : s.entity === DEMO_ENTITY_NAMES[1]
          ? "v_agro"
          : "v_re";
    lines.push(
      `  SELECT id INTO v_member FROM public.members WHERE email = ${q(m.email)} AND owner_user_id = v_user LIMIT 1;\n` +
        `  INSERT INTO public.entity_shares (entity_id, member_id, share_percentage) VALUES (${entityVar}, v_member, ${n(s.percentage)});`,
    );
  }
}
lines.push(``);

// Ativos
lines.push(`  -- Ativos`);
for (const a of demo.assets) {
  const entityVar =
    a.entity === DEMO_ENTITY_NAMES[0]
      ? "v_holding"
      : a.entity === DEMO_ENTITY_NAMES[1]
        ? "v_agro"
        : "v_re";
  lines.push(
    `  INSERT INTO public.assets (name, type, entity_id, value, location, area, registration_number, status, health_score) VALUES (${q(a.name)}, ${q(a.type)}::public.asset_type, ${entityVar}, ${n(a.value)}, ${q(a.location)}, ${q(a.area)}, ${q(a.registration_number)}, ${q(a.status)}::public.compliance_status, ${n(a.health_score)});`,
  );
}
lines.push(``);

// Documentos
lines.push(`  -- Documentos`);
for (const doc of demo.documents) {
  const owner = demo.assets.find((a) => a.name === doc.asset);
  const entityVar = owner
    ? owner.entity === DEMO_ENTITY_NAMES[0]
      ? "v_holding"
      : owner.entity === DEMO_ENTITY_NAMES[1]
        ? "v_agro"
        : "v_re"
    : "v_holding";
  const assetLookup = doc.asset
    ? `(SELECT id FROM public.assets WHERE name = ${q(doc.asset)} AND entity_id = ${entityVar} LIMIT 1)`
    : "NULL";
  lines.push(
    `  INSERT INTO public.documents (title, type, asset_id, entity_id, expiry_date, status, ocr_processed) VALUES (${q(doc.title)}, ${q(doc.type)}, ${assetLookup}, ${entityVar}, ${d(doc.expiresInDays)}, ${q(doc.status)}::public.compliance_status, ${doc.ocr_processed});`,
  );
}
lines.push(``);

// Riscos
lines.push(`  -- Riscos`);
for (const r of demo.risks) {
  const owner = demo.assets.find((a) => a.name === r.asset);
  const entityVar = owner
    ? owner.entity === DEMO_ENTITY_NAMES[0]
      ? "v_holding"
      : owner.entity === DEMO_ENTITY_NAMES[1]
        ? "v_agro"
        : "v_re"
    : "v_holding";
  const assetLookup = r.asset
    ? `(SELECT id FROM public.assets WHERE name = ${q(r.asset)} AND entity_id = ${entityVar} LIMIT 1)`
    : "NULL";
  lines.push(
    `  INSERT INTO public.risks (title, description, severity, status, asset_id, entity_id, due_date, responsible_id) VALUES (${q(r.title)}, ${q(r.description)}, ${q(r.severity)}::public.risk_severity, 'pending', ${assetLookup}, ${entityVar}, ${ts(r.dueInDays)}, (SELECT id FROM public.members WHERE email = ${q(demo.members.find((m) => m.full_name === r.responsible)?.email ?? "")} AND owner_user_id = v_user LIMIT 1));`,
  );
}
lines.push(``);

// Transações
lines.push(`  -- Transações financeiras`);
for (const t of demo.transactions) {
  const entityVar =
    t.entity === DEMO_ENTITY_NAMES[0]
      ? "v_holding"
      : t.entity === DEMO_ENTITY_NAMES[1]
        ? "v_agro"
        : "v_re";
  const assetLookup = t.asset
    ? `(SELECT id FROM public.assets WHERE name = ${q(t.asset)} AND entity_id = ${entityVar} LIMIT 1)`
    : "NULL";
  lines.push(
    `  INSERT INTO public.transactions (title, entity_id, asset_id, amount, type, category, transaction_date) VALUES (${q(t.title)}, ${entityVar}, ${assetLookup}, ${n(t.amount)}, ${q(t.type)}, ${q(t.category)}, ${monthsAgo(t.monthsAgo, t.day)});`,
  );
}
lines.push(``);

// Insights
lines.push(`  -- Insights do JARVIS`);
for (const i of demo.insights) {
  const entityVar =
    i.entity === DEMO_ENTITY_NAMES[0]
      ? "v_holding"
      : i.entity === DEMO_ENTITY_NAMES[1]
        ? "v_agro"
        : "v_re";
  const assetLookup = i.asset
    ? `(SELECT id FROM public.assets WHERE name = ${q(i.asset)} AND entity_id = ${entityVar} LIMIT 1)`
    : "NULL";
  lines.push(
    `  INSERT INTO public.jarvis_insights (type, severity, title, description, entity_id, asset_id, metadata) VALUES (${q(i.type)}, ${q(i.severity)}, ${q(i.title)}, ${q(i.description)}, ${entityVar}, ${assetLookup}, ${q(JSON.stringify(i.metadata))}::jsonb);`,
  );
}
lines.push(``);

// Planos de ação
lines.push(`  -- Planos de ação`);
for (const p of demo.actionPlans) {
  lines.push(
    `  SELECT id INTO v_insight FROM public.jarvis_insights WHERE title = ${q(p.insightTitle)} LIMIT 1;`,
  );
  lines.push(
    `  INSERT INTO public.jarvis_action_plans (insight_id, title, due_date, priority, status, impact_analysis, suggested_resolution) VALUES (v_insight, ${q(p.title)}, ${ts(p.dueInDays)}, ${q(p.priority)}, ${q(p.status)}, ${q(p.impact_analysis)}, ${q(p.suggested_resolution)});`,
  );
}
lines.push(``);

// Health scores
// Fornecedores
lines.push(`  -- Fornecedores`);
for (const sup of demo.suppliers) {
  const entityVar = sup.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : sup.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  lines.push(
    `  INSERT INTO public.suppliers (name, entity_id, tax_id, category, contact_email, status, compliance_score, contract_value, contract_expiry, notes) VALUES (${q(sup.name)}, ${entityVar}, ${q(sup.tax_id)}, ${q(sup.category)}, ${q(sup.contact_email)}, ${q(sup.status)}::public.supplier_status, ${n(sup.compliance_score)}, ${n(sup.contract_value)}, ${d(sup.contractExpiryInDays)}, ${q(sup.notes)});`,
  );
}
lines.push(``);

// Processos jurídicos
lines.push(`  -- Processos jurídicos`);
for (const c of demo.legalCases) {
  const entityVar = c.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : c.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  const assetLookup = c.asset
    ? `(SELECT id FROM public.assets WHERE name = ${q(c.asset)} AND entity_id = ${entityVar} LIMIT 1)`
    : "NULL";
  lines.push(
    `  INSERT INTO public.legal_cases (case_number, title, entity_id, asset_id, type, status, court, risk_level, value_at_stake, next_hearing, responsible_id, notes) VALUES (${q(c.case_number)}, ${q(c.title)}, ${entityVar}, ${assetLookup}, ${q(c.type)}::public.legal_case_type, ${q(c.status)}::public.legal_case_status, ${q(c.court)}, ${q(c.risk_level)}::public.risk_severity, ${n(c.value_at_stake)}, ${ts(c.hearingInDays)}, (SELECT id FROM public.members WHERE email = ${q(demo.members.find((m) => m.full_name === c.responsible)?.email ?? "")} AND owner_user_id = v_user LIMIT 1), ${q(c.notes)});`,
  );
}
lines.push(``);

// Custódia: contas, posições, fluxos e fechamentos
lines.push(`  -- Contas de custódia`);
for (const a of demo.accounts) {
  const entityVar = a.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : a.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  lines.push(
    `  INSERT INTO public.accounts (entity_id, custodian_id, name, kind, currency, account_number) VALUES (${entityVar}, (SELECT id FROM public.custodians WHERE name = ${q(a.custodian)} LIMIT 1), ${q(a.name)}, ${q(a.kind)}::public.account_kind, ${q(a.currency)}, ${q(a.accountNumber)});`,
  );
}
lines.push(``);

lines.push(`  -- Posições financeiras`);
for (const p of demo.positions) {
  const entityVar = p.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : p.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  lines.push(
    `  INSERT INTO public.positions (entity_id, account_id, asset_class, liquidity, symbol, name, quantity, unit_price, cost_basis, currency, is_offshore, as_of) VALUES (${entityVar}, (SELECT id FROM public.accounts WHERE name = ${q(p.account)} AND entity_id = ${entityVar} LIMIT 1), ${q(p.asset_class)}::public.asset_class, ${q(p.liquidity)}::public.asset_liquidity, ${q(p.symbol)}, ${q(p.name)}, ${n(p.quantity)}, ${n(p.unit_price)}, ${n(p.cost_basis)}, ${q(p.currency)}, ${p.is_offshore ? "true" : "false"}, CURRENT_DATE);`,
  );
}
lines.push(``);

lines.push(`  -- Fluxos de caixa (aportes/resgates/proventos)`);
for (const f of demo.cashFlows) {
  const entityVar = f.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : f.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  lines.push(
    `  INSERT INTO public.cash_flows (entity_id, account_id, kind, amount, currency, flow_date, description) VALUES (${entityVar}, (SELECT id FROM public.accounts WHERE name = ${q(f.account)} AND entity_id = ${entityVar} LIMIT 1), ${q(f.kind)}::public.flow_kind, ${n(f.amount)}, 'BRL', CURRENT_DATE + (${f.daysAgo}), ${q(f.description)});`,
  );
}
lines.push(``);

lines.push(`  -- Fechamentos mensais (série de TWR)`);
for (const s of demo.snapshots) {
  const entityVar = s.entity === DEMO_ENTITY_NAMES[0] ? "v_holding" : s.entity === DEMO_ENTITY_NAMES[1] ? "v_agro" : "v_re";
  lines.push(
    `  INSERT INTO public.portfolio_snapshots (entity_id, as_of, market_value, cost_basis, net_flow, source) VALUES (${entityVar}, (date_trunc('month', CURRENT_DATE) - interval '${s.monthOffset} months' + interval '1 month - 1 day')::date, ${n(s.marketValue)}, ${n(s.costBasis)}, ${n(s.netFlow)}, 'demo');`,
  );
}
lines.push(``);

lines.push(`  -- Histórico de health score (12 meses)`);
for (const h of demo.healthScores) {
  lines.push(
    `  INSERT INTO public.jarvis_health_scores (entity_id, patrimonial_score, documental_score, compliance_score, risk_score, global_score, recorded_at) VALUES (v_holding, ${n(h.patrimonial_score)}, ${n(h.documental_score)}, ${n(h.compliance_score)}, ${n(h.risk_score)}, ${n(h.global_score)}, now() - interval '${h.monthsAgo * 30} days');`,
  );
}
lines.push(``);
lines.push(
  `  RAISE NOTICE 'PATRIUM OS: dataset de demonstração aplicado ao usuário %.', ${q(email)};`,
);
lines.push(`END $$;`);
lines.push(``);

const out = resolve(import.meta.dir, "..", "supabase", "seed.sql");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`✅ supabase/seed.sql gerado (${lines.length} linhas) para ${email}`);
console.log(
  `   ${demo.entities.length} holdings · ${demo.assets.length} ativos · ${demo.documents.length} documentos · ${demo.risks.length} riscos · ${demo.transactions.length} transações · ${demo.insights.length} insights`,
);
console.log(
  `   ${demo.accounts.length} contas · ${demo.positions.length} posições · ${demo.cashFlows.length} fluxos · ${demo.snapshots.length} fechamentos`,
);
