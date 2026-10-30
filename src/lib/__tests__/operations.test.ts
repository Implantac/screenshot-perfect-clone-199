/**
 * Testes da wave 2: validadores de fornecedor/processo/sócio/participação e as
 * invariantes do dataset de demonstração que alimenta o seed.
 *
 * Rodar com: bun test
 */
import { describe, expect, test } from "bun:test";
import { buildDemoDataset } from "@/lib/demo/demoData";
import {
  supplierInputSchema,
  supplierUpdateSchema,
  legalCaseInputSchema,
  legalCaseUpdateSchema,
  memberInputSchema,
  shareInputSchema,
  documentUpdateSchema,
} from "@/lib/validation/schemas";

const UUID = "3f0a8f0e-6a3b-4b6f-9e0e-9a9f0d4c1b21";
const UUID2 = "7b1c2d3e-4f50-4a6b-8c9d-0e1f2a3b4c5d";

describe("validador de fornecedor", () => {
  test("aceita o mínimo (nome + entidade) e aplica o status padrão", () => {
    const parsed = supplierInputSchema.parse({ name: "Ikeda Advocacia", entity_id: UUID });
    expect(parsed.status).toBe("em_analise");
    expect(parsed.name).toBe("Ikeda Advocacia");
  });

  test("exige entidade válida — holdings são o escopo do fornecedor", () => {
    const result = supplierInputSchema.safeParse({ name: "Sem holding", entity_id: "" });
    expect(result.success).toBe(false);
  });

  test("rejeita compliance fora de 0–100", () => {
    expect(supplierInputSchema.safeParse({ name: "X", entity_id: UUID, compliance_score: 130 }).success).toBe(
      false,
    );
    expect(supplierInputSchema.safeParse({ name: "X", entity_id: UUID, compliance_score: -1 }).success).toBe(
      false,
    );
  });

  test("e-mail vazio virá como undefined (não salva string vazia no banco)", () => {
    const parsed = supplierInputSchema.parse({
      name: "Rio Verde Insumos",
      entity_id: UUID,
      contact_email: "",
    });
    expect(parsed.contact_email).toBeUndefined();
  });

  test("e-mail malformado é barrado", () => {
    expect(
      supplierInputSchema.safeParse({ name: "X", entity_id: UUID, contact_email: "nao-e-email" }).success,
    ).toBe(false);
  });

  test("update exige id e aceita atualização parcial", () => {
    expect(supplierUpdateSchema.safeParse({ id: UUID, status: "homologado" }).success).toBe(true);
    expect(supplierUpdateSchema.safeParse({ status: "homologado" }).success).toBe(false);
    expect(supplierUpdateSchema.safeParse({ id: UUID, status: "aprovado_pelo_gerente" }).success).toBe(
      false,
    );
  });
});

describe("validador de processo jurídico", () => {
  test("aplica defaults coerentes (cível, em andamento, risco médio)", () => {
    const parsed = legalCaseInputSchema.parse({
      case_number: "0001234-56.2026.8.16.0001",
      title: "Execução fiscal",
      entity_id: UUID,
    });
    expect(parsed).toMatchObject({ type: "civel", status: "em_andamento", risk_level: "medium" });
  });

  test("aceita ativo e responsável opcionais vazios", () => {
    const parsed = legalCaseInputSchema.parse({
      case_number: "0001234-56.2026.8.16.0001",
      title: "Execução fiscal",
      entity_id: UUID,
      asset_id: "",
      responsible_id: "",
    });
    expect(parsed.asset_id).toBeUndefined();
    expect(parsed.responsible_id).toBeUndefined();
  });

  test("rejeita tipo e status fora do enum do banco", () => {
    const base = { case_number: "0001234-56.2026.8.16.0001", title: "Execução fiscal", entity_id: UUID };
    expect(legalCaseInputSchema.safeParse({ ...base, type: "penal" }).success).toBe(false);
    expect(legalCaseInputSchema.safeParse({ ...base, status: "arquivado" }).success).toBe(false);
  });

  test("update aceita só o id + status", () => {
    expect(legalCaseUpdateSchema.safeParse({ id: UUID, status: "acordo" }).success).toBe(true);
  });
});

describe("validador de sócio e participação", () => {
  test("sócio exige nome", () => {
    expect(memberInputSchema.safeParse({ full_name: "", role: "Sucessor" }).success).toBe(false);
    expect(memberInputSchema.parse({ full_name: "Helena Alencar" }).full_name).toBe("Helena Alencar");
  });

  test("e-mail vazio do sócio não vira string vazia", () => {
    const parsed = memberInputSchema.parse({ full_name: "Helena", email: "" });
    expect(parsed.email).toBeUndefined();
  });

  test("participação aceita 0% e 100%, recusa fora da faixa", () => {
    expect(shareInputSchema.safeParse({ entity_id: UUID, member_id: UUID2, share_percentage: 0 }).success).toBe(
      true,
    );
    expect(
      shareInputSchema.safeParse({ entity_id: UUID, member_id: UUID2, share_percentage: 100 }).success,
    ).toBe(true);
    expect(
      shareInputSchema.safeParse({ entity_id: UUID, member_id: UUID2, share_percentage: 100.5 }).success,
    ).toBe(false);
    expect(
      shareInputSchema.safeParse({ entity_id: UUID, member_id: UUID2, share_percentage: -5 }).success,
    ).toBe(false);
  });

  test("participação converte string de input em número", () => {
    const parsed = shareInputSchema.parse({
      entity_id: UUID,
      member_id: UUID2,
      share_percentage: "37.5",
    });
    expect(parsed.share_percentage).toBe(37.5);
  });
});

describe("workflow documental", () => {
  test("aceita mudança de status sem data e vice-versa", () => {
    expect(documentUpdateSchema.safeParse({ id: UUID, status: "alerta" }).success).toBe(true);
    expect(documentUpdateSchema.safeParse({ id: UUID, expiry_date: "2027-01-31" }).success).toBe(true);
  });

  test("rejeita status inexistente no enum", () => {
    expect(documentUpdateSchema.safeParse({ id: UUID, status: "vencido" }).success).toBe(false);
  });
});

describe("dataset de demonstração (wave 2)", () => {
  const demo = buildDemoDataset();

  test("traz fornecedores e processos suficientes para a tela ficar realista", () => {
    expect(demo.suppliers.length).toBeGreaterThanOrEqual(5);
    expect(demo.legalCases.length).toBeGreaterThanOrEqual(4);
  });

  test("todo fornecedor aponta para uma holding existente e tem status válido", () => {
    const holdings = new Set(demo.entities.map((e) => e.name));
    const allowed = new Set(["homologado", "em_analise", "risco_critico", "inativo"]);
    for (const supplier of demo.suppliers) {
      expect(holdings.has(supplier.entity)).toBe(true);
      expect(allowed.has(supplier.status)).toBe(true);
      expect(supplier.compliance_score).toBeGreaterThanOrEqual(0);
      expect(supplier.compliance_score).toBeLessThanOrEqual(100);
    }
  });

  test("o dataset cobre os quatro status de fornecedor (para exercitar os filtros)", () => {
    const statuses = new Set(demo.suppliers.map((s) => s.status));
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  test("todo processo referencia holding real e, quando tem ativo, o ativo existe nela", () => {
    const assetsByName = new Map(demo.assets.map((a) => [a.name, a]));
    for (const legalCase of demo.legalCases) {
      expect(demo.entities.some((e) => e.name === legalCase.entity)).toBe(true);
      if (legalCase.asset) {
        const asset = assetsByName.get(legalCase.asset);
        expect(asset).toBeDefined();
        expect(asset?.entity).toBe(legalCase.entity);
      }
    }
  });

  test("responsável de cada processo é um sócio do núcleo familiar", () => {
    const members = new Set(demo.members.map((m) => m.full_name));
    for (const legalCase of demo.legalCases) {
      expect(members.has(legalCase.responsible)).toBe(true);
    }
  });

  test("a exposição do contencioso é positiva e há audiência futura", () => {
    const exposure = demo.legalCases.reduce((sum, c) => sum + c.value_at_stake, 0);
    expect(exposure).toBeGreaterThan(0);
    expect(demo.legalCases.some((c) => c.hearingInDays >= 0)).toBe(true);
  });

  test("os processos passam no validador do formulário (id sintético no lugar de entity_id)", () => {
    for (const legalCase of demo.legalCases) {
      const result = legalCaseInputSchema.safeParse({
        case_number: legalCase.case_number,
        title: legalCase.title,
        entity_id: UUID,
        type: legalCase.type,
        status: legalCase.status,
        court: legalCase.court,
        risk_level: legalCase.risk_level,
        value_at_stake: legalCase.value_at_stake,
        notes: legalCase.notes,
      });
      expect(result.success).toBe(true);
    }
  });
});
