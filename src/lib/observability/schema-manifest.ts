/**
 * Manifesto das migrations — a lista que o código, o painel de saúde e o CI
 * usam para responder "esta base está com o schema desta versão?".
 *
 * Por que um manifesto em código e não um `ls` do diretório:
 *  - o servidor em produção não tem o diretório `supabase/migrations`;
 *  - `check:schema` precisa saber **qual** migration criar cada tabela para dizer
 *    o que aplicar, não só o que falta;
 *  - e o mais importante: um teste compara este manifesto com os arquivos em
 *    disco e **falha** quando os dois divergem. Sem isso, a lista vira
 *    documentação morta na primeira migration nova (que é exatamente o que
 *    acontece em todo projeto).
 *
 * Regra ao adicionar migration: criar o arquivo E acrescentar a entrada aqui. O
 * teste `schema-manifest` reprova o esquecimento.
 */

export type MigrationEntry = {
  /** Nome do arquivo, sem diretório. */
  file: string;
  wave: number;
  /** O que a migration entrega, em uma linha. */
  summary: string;
  /** Tabelas criadas (usadas pelo diagnóstico de esquema). */
  tables: string[];
  /** Colunas adicionadas em tabelas existentes, no formato `tabela.coluna`. */
  columns: string[];
  /** Funções/views/RPCs criadas (aparecem no painel, não são sondadas como tabela). */
  functions: string[];
};

export const MIGRATIONS: MigrationEntry[] = [
  {
    file: "20260610005424_20ccfbf5-5fa3-4866-a9d0-d1ca1942a97c.sql",
    wave: 1,
    summary: "Estrutura inicial: entidades, membros, quotas, ativos, documentos, riscos, transações e trilha.",
    tables: [
      "entities",
      "members",
      "entity_shares",
      "assets",
      "documents",
      "risks",
      "transactions",
      "audit_logs",
    ],
    columns: [],
    functions: [],
  },
  {
    file: "20260610005435_6c43fddb-3b73-4629-a555-fa1a76b211dc.sql",
    wave: 1,
    summary: "Tabelas base do domínio.",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20260610021939_33a9ff1f-d322-4079-8caa-07037b3b6aaa.sql",
    wave: 1,
    summary: "Ownership por usuário (owner_user_id), user_roles e owns_entity().",
    tables: ["user_roles"],
    columns: [],
    functions: ["owns_entity"],
  },
  {
    file: "20260610021956_70b0e969-4299-460e-a05d-e0f7d720574d.sql",
    wave: 1,
    summary: "Papéis: função has_role e grants de execução.",
    tables: [],
    columns: [],
    functions: ["has_role"],
  },
  {
    file: "20260610025124_5330b128-0933-44cb-90f7-4ad9de6b2eab.sql",
    wave: 1,
    summary: "Painéis do Jarvis: insights, planos de ação e health scores.",
    tables: ["jarvis_insights", "jarvis_action_plans", "jarvis_health_scores"],
    columns: [],
    functions: [],
  },
  {
    file: "20260610025137_5daeab63-35a0-4d8b-912b-0a93fca258ce.sql",
    wave: 1,
    summary: "Ajustes de políticas e índices (continuação).",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20260610112939_291c5fb6-1ed6-402b-b12f-0b01f255b25e.sql",
    wave: 1,
    summary: "Consolidação das políticas por entidade.",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20260610121229_823351fd-1429-40f8-8843-38ae48c959e1.sql",
    wave: 1,
    summary: "Storage e ajustes finais da base original.",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20261030120000_audit_trail.sql",
    wave: 4,
    summary: "Trilha de auditoria com trigger, diff old/new e autor.",
    tables: [],
    columns: [],
    functions: ["record_audit_log"],
  },
  {
    file: "20261030130000_tenant_scoped_uniques.sql",
    wave: 4,
    summary: "Unicidade por tenant (tax_id, e-mail) em vez de global.",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20261030140000_operations_tables.sql",
    wave: 5,
    summary: "Fornecedores e contencioso, com auditoria lida pelo dono do dado.",
    tables: ["suppliers", "legal_cases"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030150000_wealth_core.sql",
    wave: 4,
    summary: "Núcleo de custódia: custodiantes, contas, posições, fluxos e snapshots.",
    tables: ["custodians", "accounts", "positions", "cash_flows", "portfolio_snapshots", "tax_scenarios"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030160000_imports.sql",
    wave: 6,
    summary: "Lotes de importação de extrato.",
    tables: ["import_batches"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030170000_quotes.sql",
    wave: 7,
    summary: "Cotações de mercado e execuções de cotação.",
    tables: ["quotes", "quote_runs"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030180000_fund_quotes.sql",
    wave: 8,
    summary: "Cotações de fundos (CVM).",
    tables: [],
    columns: [],
    functions: [],
  },
  {
    file: "20261030190000_private_markets.sql",
    wave: 9,
    summary: "Private markets: compromissos, eventos de capital e avaliações.",
    tables: ["commitments", "capital_events"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030200000_balance_sheet.sql",
    wave: 10,
    summary: "Balanço: passivos, metas e ativos registrais.",
    tables: ["liabilities", "goals"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030210000_portal_access.sql",
    wave: 14,
    summary: "Portal do cliente com permissão granular.",
    tables: ["portal_grants"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030220000_auth_security.sql",
    wave: 17,
    summary: "Política de segurança, MFA e funções de sessão.",
    tables: ["security_policies"],
    columns: [],
    functions: ["my_mfa_factors", "mfa_satisfied", "session_is_elevated"],
  },
  {
    file: "20261030230000_legal_provisions.sql",
    wave: 18,
    summary: "Provisão de contencioso (CPC 25) como subledger.",
    tables: ["legal_provision_entries"],
    columns: [],
    functions: ["provisions_pending_closure"],
  },
  {
    file: "20261030240000_agro.sql",
    wave: 19,
    summary: "Agro: talhões, arrendamentos, barter e passivo ambiental.",
    tables: ["agro_fields", "agro_leases", "agro_barters", "agro_environmental"],
    columns: [],
    functions: [],
  },
  {
    file: "20261030250000_audit_chain.sql",
    wave: 20,
    summary: "Cadeia de hash por tenant, âncoras e verificação.",
    tables: ["audit_anchors"],
    columns: ["audit_logs.sequence", "audit_logs.prev_hash", "audit_logs.entry_hash", "audit_logs.owner_user_id"],
    functions: ["audit_payload_text", "verify_audit_chain"],
  },
  {
    file: "20261030260000_jarvis_tools.sql",
    wave: 21,
    summary: "Propostas do JARVIS com aprovação humana.",
    tables: ["jarvis_proposals"],
    columns: [],
    functions: ["jarvis_pending_proposals"],
  },
  {
    file: "20261030270000_multi_family_office.sql",
    wave: 22,
    summary: "Escritório (MFO), equipe e consentimento das famílias.",
    tables: ["offices", "office_members", "office_clients"],
    columns: [],
    functions: [
      "office_role_of",
      "office_can_read_tenant",
      "office_lookup",
      "claim_office_invites",
      "office_consolidation",
    ],
  },
  {
    file: "20261030280000_tenant_isolation.sql",
    wave: 23,
    summary: "Fecha policies legadas e coloca linhas órfãs em quarentena.",
    tables: [],
    columns: [],
    functions: ["patrium_tenant_tables", "patrium_isolation_audit", "patrium_orphan_counts"],
  },
  {
    file: "20261030290000_office_detail_scope.sql",
    wave: 24,
    summary: "Escopo consentido por seção e log de acesso à família.",
    tables: ["office_access_log"],
    columns: ["office_clients.scopes"],
    functions: [
      "office_client_scopes",
      "office_family_detail",
      "office_my_access_log",
      "office_set_scopes",
    ],
  },
  {
    file: "20261030300000_anchor_signature.sql",
    wave: 25,
    summary: "Assinatura assimétrica das âncoras (ECDSA P-256).",
    tables: [],
    columns: [
      "audit_anchors.signature_format",
      "audit_anchors.public_key",
      "audit_anchors.key_fingerprint",
    ],
    functions: ["audit_signing_keys_used"],
  },
  {
    file: "20261030310000_system_events.sql",
    wave: 26,
    summary: "Eventos de observabilidade (erros, lentidão, falhas de integração).",
    tables: ["system_events"],
    columns: [],
    functions: ["system_event_counts", "system_events_recent"],
  },
];

/** Todas as tabelas que o aplicativo espera encontrar. */
export function expectedTables(): { table: string; migration: string }[] {
  return MIGRATIONS.flatMap((migration) =>
    migration.tables.map((table) => ({ table, migration: migration.file })),
  );
}

/** Todas as colunas adicionadas por migration, no formato `tabela.coluna`. */
export function expectedColumns(): { table: string; column: string; migration: string }[] {
  return MIGRATIONS.flatMap((migration) =>
    migration.columns.map((entry) => {
      const [table, column] = entry.split(".");
      return { table, column, migration: migration.file };
    }),
  );
}

export const LATEST_MIGRATION = MIGRATIONS[MIGRATIONS.length - 1]?.file ?? "";
export const MIGRATION_COUNT = MIGRATIONS.length;
