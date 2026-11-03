/**
 * Seed de dados de demonstração.
 *
 * Estratégia: o app roda com a anon key + JWT do usuário, então todo INSERT passa
 * pelas políticas de RLS. Isso é proposital — gravar por aqui prova que as regras de
 * ownership (`owner_user_id` / `owns_entity`) estão realmente corretas.
 *
 * A versão SQL equivalente (service_role, para ambientes gerenciados) está em
 * `supabase/seed.sql` e espelha exatamente este dataset.
 *
 * Módulo puro: recebe um client `SupabaseClient<Database>` e não importa nada de Vite.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildDemoDataset, DEMO_ENTITY_NAMES } from "./demoData";

type Client = SupabaseClient<Database>;
type Nullable<T> = T | null;

export type SeedResult = {
  seeded: boolean;
  message: string;
  counts?: Record<string, number>;
  /** Tabelas opcionais ausentes (migrations não aplicadas) — o seed segue sem elas. */
  skipped?: string[];
};

/**
 * Erro de tabela inexistente: acontece quando o banco ainda não recebeu a
 * migration que cria `suppliers` / `legal_cases`. Não deve derrubar o seed.
 */
function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return (
    code === "PGRST205" ||
    code === "42P01" ||
    /could not find the table|does not exist/i.test(message ?? "")
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Data ISO a N meses de hoje (usada para o desembolso previsto da provisão). */
function addMonths(months: number): string | null {
  if (!months) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return isoDate(d);
}

/** Último dia do mês N meses atrás (0 = mês corrente). */
function monthEnd(monthsAgo: number): Date {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo + 1, 0));
}

/** Data de um mês atrás (0 = mês corrente), no dia indicado. */
function monthsAgo(days: number, day: number): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - days);
  d.setDate(Math.min(day, 28));
  return isoDate(d);
}

/** Lê no máximo 1 registro para saber se o tenant já tem dados. */
async function hasData(supabase: Client): Promise<boolean> {
  const { data, error } = await supabase.from("entities").select("id").limit(1);
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

/**
 * Popula o tenant do usuário logado com o dataset de demonstração.
 * Idempotente: se já existir qualquer entidade, não faz nada.
 */
export async function seedDemoData(
  supabase: Client,
  options: { force?: boolean } = {},
): Promise<SeedResult> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth?.user;
  if (!user) {
    return {
      seeded: false,
      message: "É necessário estar autenticado para popular a demonstração.",
    };
  }

  if (!options.force && (await hasData(supabase))) {
    return {
      seeded: false,
      message:
        "Sua conta já possui dados. O dataset de demonstração só é aplicado em tenants vazios.",
    };
  }

  if (options.force) {
    // Remove apenas o que pertence ao usuário (RLS garante o recorte).
    await supabase.from("jarvis_action_plans").delete().not("id", "is", null);
    await supabase.from("jarvis_insights").delete().not("id", "is", null);
    await supabase.from("jarvis_health_scores").delete().not("id", "is", null);
    await supabase.from("legal_cases").delete().not("id", "is", null);
    await supabase.from("portfolio_snapshots").delete().not("id", "is", null);
    await supabase.from("cash_flows").delete().not("id", "is", null);
    await supabase.from("positions").delete().not("id", "is", null);
    await supabase.from("accounts").delete().not("id", "is", null);
    await supabase.from("suppliers").delete().not("id", "is", null);
    await supabase.from("transactions").delete().not("id", "is", null);
    await supabase.from("risks").delete().not("id", "is", null);
    await supabase.from("documents").delete().not("id", "is", null);
    await supabase.from("assets").delete().not("id", "is", null);
    await supabase.from("entity_shares").delete().not("id", "is", null);
    await supabase.from("members").delete().not("id", "is", null);
    await supabase.from("entities").delete().not("id", "is", null);
  }

  const demo = buildDemoDataset();
  const counts: Record<string, number> = {};

  // 1. Entidades (holdings)
  //
  // Atenção: em projetos que ainda têm a constraint global `entities_tax_id_key`
  // (ver migration 20261030130000_tenant_scoped_uniques.sql) um CNPJ já usado por
  // OUTRO tenant derruba o insert inteiro com 23505. Nesse caso reenviamos sem o
  // tax_id — o dado de demonstração continua válido e o CNPJ pode ser preenchido
  // depois na tela de Holdings.
  const entityRows = demo.entities.map((e) => ({ ...e, owner_user_id: user.id }));
  let entityInsert = await supabase.from("entities").insert(entityRows).select("id, name");
  if (entityInsert.error?.code === "23505") {
    console.warn(
      "[seed] CNPJ conflita com outro tenant (constraint global legada); inserindo sem tax_id.",
    );
    entityInsert = await supabase
      .from("entities")
      .insert(entityRows.map((row) => ({ ...row, tax_id: null })))
      .select("id, name");
  }
  const { data: entities, error: entitiesError } = entityInsert;
  if (entitiesError) throw entitiesError;
  counts.entities = entities?.length ?? 0;

  const entityId = new Map<string, string>();
  for (const e of entities ?? []) {
    if (DEMO_ENTITY_NAMES.includes(e.name as (typeof DEMO_ENTITY_NAMES)[number])) {
      entityId.set(e.name, e.id);
    }
  }
  const entityRef = (name: string): Nullable<string> => entityId.get(name) ?? null;

  // 2. Membros / sócios (mesma ressalva de unicidade global de e-mail/CPF)
  const memberRows = demo.members.map((m) => ({
    full_name: m.full_name,
    email: m.email,
    tax_id: m.tax_id,
    role: m.role,
    owner_user_id: user.id,
  }));
  let memberInsert = await supabase.from("members").insert(memberRows).select("id, full_name");
  if (memberInsert.error?.code === "23505") {
    console.warn(
      "[seed] e-mail/CPF de sócio conflita com outro tenant; inserindo sem email/tax_id.",
    );
    memberInsert = await supabase
      .from("members")
      .insert(memberRows.map((row) => ({ ...row, email: null, tax_id: null })))
      .select("id, full_name");
  }
  const { data: members, error: membersError } = memberInsert;
  if (membersError) throw membersError;
  counts.members = members?.length ?? 0;

  const memberId = new Map<string, string>();
  for (const m of members ?? []) memberId.set(m.full_name, m.id);

  // 3. Participações societárias
  const shares = demo.members.flatMap((m) =>
    m.shares.map((s) => ({
      entity_id: entityRef(s.entity),
      member_id: memberId.get(m.full_name) ?? null,
      share_percentage: s.percentage,
    })),
  );
  const { error: sharesError } = await supabase.from("entity_shares").insert(shares);
  if (sharesError) throw sharesError;
  counts.entity_shares = shares.length;

  // 4. Ativos
  const { data: assets, error: assetsError } = await supabase
    .from("assets")
    .insert(
      demo.assets.map((a) => ({
        name: a.name,
        type: a.type,
        entity_id: entityRef(a.entity),
        value: a.value,
        location: a.location,
        area: a.area,
        registration_number: a.registration_number,
        status: a.status,
        health_score: a.health_score,
      })),
    )
    .select("id, name");
  if (assetsError) throw assetsError;
  counts.assets = assets?.length ?? 0;

  const assetId = new Map<string, string>();
  for (const a of assets ?? []) assetId.set(a.name, a.id);
  const assetRef = (name: string | null): Nullable<string> =>
    name ? (assetId.get(name) ?? null) : null;

  // 5. Documentos
  const { error: documentsError } = await supabase.from("documents").insert(
    demo.documents.map((d) => {
      const asset = assetRef(d.asset);
      const owner = demo.assets.find((a) => a.name === d.asset);
      return {
        title: d.title,
        type: d.type,
        asset_id: asset,
        entity_id: owner ? entityRef(owner.entity) : entityRef(DEMO_ENTITY_NAMES[0]),
        expiry_date: isoDate(new Date(addDays(d.expiresInDays))),
        status: d.status,
        ocr_processed: d.ocr_processed,
      };
    }),
  );
  if (documentsError) throw documentsError;
  counts.documents = demo.documents.length;

  // 6. Riscos
  const { error: risksError } = await supabase.from("risks").insert(
    demo.risks.map((r) => {
      const asset = assetRef(r.asset);
      const owner = demo.assets.find((a) => a.name === r.asset);
      return {
        title: r.title,
        description: r.description,
        severity: r.severity,
        status: "pending",
        asset_id: asset,
        entity_id: owner ? entityRef(owner.entity) : entityRef(DEMO_ENTITY_NAMES[0]),
        due_date: addDays(r.dueInDays),
        responsible_id: memberId.get(r.responsible) ?? null,
      };
    }),
  );
  if (risksError) throw risksError;
  counts.risks = demo.risks.length;

  // 7. Transações
  const { error: transactionsError } = await supabase.from("transactions").insert(
    demo.transactions.map((t) => ({
      title: t.title,
      entity_id: entityRef(t.entity),
      asset_id: assetRef(t.asset),
      amount: t.amount,
      type: t.type,
      category: t.category,
      transaction_date: monthsAgo(t.monthsAgo, t.day),
    })),
  );
  if (transactionsError) throw transactionsError;
  counts.transactions = demo.transactions.length;

  // 8. Insights do JARVIS
  const { data: insights, error: insightsError } = await supabase
    .from("jarvis_insights")
    .insert(
      demo.insights.map((i) => ({
        type: i.type,
        severity: i.severity,
        title: i.title,
        description: i.description,
        entity_id: entityRef(i.entity),
        asset_id: assetRef(i.asset),
        metadata: i.metadata,
        is_resolved: false,
      })),
    )
    .select("id, title");
  if (insightsError) throw insightsError;
  counts.jarvis_insights = insights?.length ?? 0;

  const insightId = new Map<string, string>();
  for (const i of insights ?? []) insightId.set(i.title, i.id);

  // 9. Planos de ação
  const { error: plansError } = await supabase.from("jarvis_action_plans").insert(
    demo.actionPlans.map((p) => ({
      insight_id: insightId.get(p.insightTitle) ?? null,
      title: p.title,
      due_date: addDays(p.dueInDays),
      priority: p.priority,
      status: p.status,
      impact_analysis: p.impact_analysis,
      suggested_resolution: p.suggested_resolution,
    })),
  );
  if (plansError) throw plansError;
  counts.jarvis_action_plans = demo.actionPlans.length;

  // 10. Histórico de health scores (série para o gráfico)
  const { error: healthError } = await supabase.from("jarvis_health_scores").insert(
    demo.healthScores.map((h) => ({
      entity_id: h.entity ? entityRef(h.entity) : entityRef(DEMO_ENTITY_NAMES[0]),
      patrimonial_score: h.patrimonial_score,
      documental_score: h.documental_score,
      compliance_score: h.compliance_score,
      risk_score: h.risk_score,
      global_score: h.global_score,
      recorded_at: addDays(-30 * h.monthsAgo),
    })),
  );
  if (healthError) throw healthError;
  counts.jarvis_health_scores = demo.healthScores.length;

  const skipped: string[] = [];

  // 13-15. Custódia: contas, posições, fluxos e série de fechamentos
  // (tabelas da migration 20261030150000_wealth_core.sql)
  const accountId = new Map<string, string>();
  const { data: insertedAccounts, error: accountsError } = await supabase
    .from("accounts")
    .insert(
      demo.accounts.map((account) => ({
        entity_id: entityRef(account.entity)!,
        name: account.name,
        kind: account.kind,
        currency: account.currency,
        account_number: account.accountNumber,
      })),
    )
    .select("id, name");

  if (accountsError) {
    if (isMissingTable(accountsError)) skipped.push("accounts");
    else throw accountsError;
  } else {
    for (const row of insertedAccounts ?? []) accountId.set(row.name, row.id);
    counts.accounts = insertedAccounts?.length ?? 0;
  }

  if (!skipped.includes("accounts")) {
    const { error: positionsError } = await supabase.from("positions").insert(
      demo.positions.map((position) => ({
        entity_id: entityRef(position.entity)!,
        account_id: accountId.get(position.account) ?? null,
        asset_class: position.asset_class,
        liquidity: position.liquidity,
        symbol: position.symbol,
        instrument_id: position.instrument_id ?? null,
        name: position.name,
        quantity: position.quantity,
        unit_price: position.unit_price,
        cost_basis: position.cost_basis,
        currency: position.currency,
        is_offshore: position.is_offshore ?? false,
        as_of: isoDate(new Date()),
      })),
    );
    if (positionsError) {
      if (isMissingTable(positionsError)) skipped.push("positions");
      else throw positionsError;
    } else {
      counts.positions = demo.positions.length;
    }

    const { error: flowsError } = await supabase.from("cash_flows").insert(
      demo.cashFlows.map((flow) => ({
        entity_id: entityRef(flow.entity)!,
        account_id: accountId.get(flow.account) ?? null,
        kind: flow.kind,
        amount: flow.amount,
        currency: "BRL",
        flow_date: isoDate(new Date(addDays(flow.daysAgo))),
        description: flow.description,
      })),
    );
    if (flowsError) {
      if (isMissingTable(flowsError)) skipped.push("cash_flows");
      else throw flowsError;
    } else {
      counts.cash_flows = demo.cashFlows.length;
    }

    const { error: snapshotsError } = await supabase.from("portfolio_snapshots").insert(
      demo.snapshots.map((snapshot) => ({
        entity_id: entityRef(snapshot.entity)!,
        as_of: isoDate(monthEnd(snapshot.monthOffset)),
        market_value: snapshot.marketValue,
        cost_basis: snapshot.costBasis,
        net_flow: snapshot.netFlow,
        source: "demo",
      })),
    );
    if (snapshotsError) {
      if (isMissingTable(snapshotsError)) skipped.push("portfolio_snapshots");
      else throw snapshotsError;
    } else {
      counts.portfolio_snapshots = demo.snapshots.length;
    }
  }

  // 11. Fornecedores (tabela criada na migration 20261030140000)
  const { error: suppliersError } = await supabase.from("suppliers").insert(
    demo.suppliers.map((sup) => ({
      name: sup.name,
      entity_id: entityRef(sup.entity),
      tax_id: sup.tax_id,
      category: sup.category,
      contact_email: sup.contact_email,
      status: sup.status,
      compliance_score: sup.compliance_score,
      contract_value: sup.contract_value,
      contract_expiry: isoDate(new Date(addDays(sup.contractExpiryInDays))),
      notes: sup.notes,
    })),
  );
  if (suppliersError) {
    if (isMissingTable(suppliersError)) skipped.push("suppliers");
    else throw suppliersError;
  } else {
    counts.suppliers = demo.suppliers.length;
  }

  // 12. Processos jurídicos + lançamentos de provisão (wave 18)
  const legalBase = demo.legalCases.map((c) => ({
    case_number: c.case_number,
    title: c.title,
    entity_id: entityRef(c.entity),
    asset_id: assetRef(c.asset),
    type: c.type,
    status: c.status,
    court: c.court,
    risk_level: c.risk_level,
    value_at_stake: c.value_at_stake,
    next_hearing: addDays(c.hearingInDays),
    responsible_id: memberId.get(c.responsible) ?? null,
    notes: c.notes,
  }));

  const legalFull = demo.legalCases.map((c, index) => ({
    ...legalBase[index],
    polarity: c.polarity,
    // 0 vira null: "sem probabilidade informada" é diferente de "chance zero".
    probability: c.probability > 0 ? c.probability : null,
    phase: c.phase,
    expected_settlement: addMonths(c.settlementInMonths),
    lawyer_assessment: c.lawyer_assessment,
  }));

  let legalInsert = await supabase
    .from("legal_cases")
    .insert(legalFull)
    .select("id, case_number");

  // Projeto sem a migration da wave 18: as colunas novas não existem (PGRST204).
  // A demonstração continua válida, só sem o bloco de provisão.
  let provisionSupported = true;
  if (legalInsert.error?.code === "PGRST204") {
    provisionSupported = false;
    skipped.push("legal_provision_entries");
    legalInsert = await supabase.from("legal_cases").insert(legalBase).select("id, case_number");
  }

  if (legalInsert.error) {
    if (isMissingTable(legalInsert.error)) skipped.push("legal_cases");
    else throw legalInsert.error;
  } else {
    counts.legal_cases = demo.legalCases.length;

    if (provisionSupported) {
      const caseId = new Map(
        (legalInsert.data ?? []).map((row) => [row.case_number as string, row.id as string]),
      );
      const entryRows = demo.provisionEntries
        .map((entry) => ({
          case_id: caseId.get(entry.case_number) ?? null,
          kind: entry.kind,
          amount: entry.amount,
          occurred_on: isoDate(new Date(Date.now() - entry.daysAgo * 86_400_000)),
          note: entry.note,
        }))
        .filter((entry): entry is typeof entry & { case_id: string } => Boolean(entry.case_id));

      if (entryRows.length > 0) {
        const { error: entryError } = await supabase
          .from("legal_provision_entries")
          .insert(entryRows);
        if (entryError) {
          if (isMissingTable(entryError)) skipped.push("legal_provision_entries");
          else throw entryError;
        } else {
          counts.legal_provision_entries = entryRows.length;
        }
      }
    }
  }

  // 13. Agro (wave 19): talhão, arrendamento, barter e ambiental.
  // Cada bloco é independente: projeto sem a migration do agro continua semeando
  // o resto em vez de abortar.
  const recordAgro = (table: string, error: unknown, length: number) => {
    if (!error) {
      counts[table] = length;
      return;
    }
    if (isMissingTable(error)) skipped.push(table);
    else throw error;
  };

  const agroEntityId = entityRef(demo.entities[1]?.name ?? demo.entities[0]?.name);

  if (demo.agroFields.length > 0) {
    const rows = demo.agroFields.map((field) => ({
      asset_id: assetRef(field.asset),
      entity_id: agroEntityId,
      name: field.name,
      area_ha: field.areaHa,
      crop: field.crop,
      system: field.system,
      productivity_sc_ha: field.productivityScHa,
      cost_per_ha: field.costPerHa,
      season: field.season,
    }));
    const { error } = await supabase.from("agro_fields").insert(rows);
    recordAgro("agro_fields", error, rows.length);
  }

  if (demo.agroLeases.length > 0) {
    const rows = demo.agroLeases.map((lease) => ({
      asset_id: assetRef(lease.asset),
      entity_id: agroEntityId,
      role: lease.role,
      counterparty: lease.counterparty,
      area_ha: lease.areaHa,
      payment: lease.payment,
      price_per_ha_year: lease.pricePerHaYear,
      bags_per_ha: lease.bagsPerHa,
      share_percent: lease.sharePercent,
      starts_on: isoDate(new Date(Date.now() - 365 * 86_400_000)),
      ends_on: addMonths(lease.endsInMonths),
      adjustment_index: lease.adjustmentIndex,
    }));
    const { error } = await supabase.from("agro_leases").insert(rows);
    recordAgro("agro_leases", error, rows.length);
  }

  if (demo.agroBarters.length > 0) {
    const rows = demo.agroBarters.map((barter) => ({
      asset_id: assetRef(barter.asset),
      entity_id: agroEntityId,
      supplier: barter.supplier,
      season: barter.season,
      input_value: barter.inputValue,
      bags_due: barter.bagsDue,
      bag_reference_price: barter.bagReferencePrice,
      area_ha: barter.areaHa,
      months_to_delivery: barter.monthsToDelivery,
      delivery_on: addMonths(barter.monthsToDelivery),
    }));
    const { error } = await supabase.from("agro_barters").insert(rows);
    recordAgro("agro_barters", error, rows.length);
  }

  if (demo.agroEnvironmental.length > 0) {
    const rows = demo.agroEnvironmental.map((env) => ({
      asset_id: assetRef(env.asset),
      entity_id: agroEntityId,
      total_ha: env.totalHa,
      biome: env.biome,
      in_legal_amazon: env.inLegalAmazon,
      legal_reserve_declared_ha: env.legalReserveDeclaredHa,
      app_ha: env.appHa,
      car_number: env.carNumber,
      car_status: env.carStatus,
    }));
    const { error } = await supabase.from("agro_environmental").insert(rows);
    recordAgro("agro_environmental", error, rows.length);
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const base = `Demonstração criada: ${total} registros em ${Object.keys(counts).length} tabelas.`;
  return {
    seeded: true,
    message:
      skipped.length > 0
        ? `${base} Faltam as tabelas ${skipped.join(", ")} — aplique a migration 20261030140000 para incluí-las.`
        : base,
    counts,
    skipped,
  };
}
