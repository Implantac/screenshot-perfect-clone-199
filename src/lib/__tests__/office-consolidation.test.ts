import { describe, expect, it } from "bun:test";
import {
  buildAllConsolidations,
  buildOfficeConsolidation,
  daysBetween,
  groupByOffice,
  type OfficeFamilyRow,
} from "@/lib/office/consolidate";

const TODAY = "2026-11-03T12:00:00.000Z";

function family(overrides: Partial<OfficeFamilyRow> & { owner_user_id: string; label: string }): OfficeFamilyRow {
  return {
    office_id: "office-1",
    office_name: "Escritório Aurora",
    client_status: "ativo",
    granted_at: "2026-01-10T00:00:00.000Z",
    entities: 2,
    entities_value: 0,
    assets_value: 0,
    positions_value: 0,
    liabilities_value: 0,
    net_worth: 0,
    risks_open: 0,
    risks_critical: 0,
    documents_expiring: 0,
    documents_overdue: 0,
    legal_exposure: 0,
    agro_area_ha: 0,
    last_update: "2026-10-30T00:00:00.000Z",
    ...overrides,
  };
}

describe("consolidação do escritório", () => {
  it("patrimônio líquido = ativo − dívida, somando registral e custódia", () => {
    const result = buildOfficeConsolidation(
      [
        family({ owner_user_id: "f1", label: "Família A", assets_value: 3_000_000, positions_value: 2_000_000, liabilities_value: 1_000_000 }),
      ],
      { today: TODAY },
    );
    expect(result.families[0]?.totalAssets).toBe(5_000_000);
    expect(result.families[0]?.netWorth).toBe(4_000_000);
    expect(result.totals.netWorth).toBe(4_000_000);
    expect(result.totals.leverage).toBe(20);
  });

  it("não soma ativo registral duas vezes (assets e positions são coisas distintas)", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "A", assets_value: 100, positions_value: 250 })],
      { today: TODAY },
    );
    expect(result.totals.assets).toBe(350);
  });

  it("peso de cada família e concentração", () => {
    const result = buildOfficeConsolidation(
      [
        family({ owner_user_id: "f1", label: "Grande", assets_value: 8_000_000 }),
        family({ owner_user_id: "f2", label: "Média", assets_value: 1_500_000 }),
        family({ owner_user_id: "f3", label: "Pequena", assets_value: 500_000 }),
      ],
      { today: TODAY },
    );
    expect(result.concentration.topFamilyLabel).toBe("Grande");
    expect(result.concentration.topFamilyShare).toBe(80);
    expect(result.concentration.familiesAboveThreshold).toBe(1);
    expect(result.concentration.level).toBe("alta");
    // ordenado por ativo
    expect(result.families.map((item) => item.label)).toEqual(["Grande", "Média", "Pequena"]);
  });

  it("HHI de uma família só é 1 — concentração máxima", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Única", assets_value: 1_000 })],
      { today: TODAY },
    );
    expect(result.concentration.hhi).toBe(1);
    expect(result.concentration.level).toBe("alta");
    // família única não gera alerta de concentração (não há comparação possível)
    expect(result.alerts.some((alert) => alert.message.includes("Concentração"))).toBe(false);
  });

  it("carteira pulverizada dá HHI baixo", () => {
    const rows = Array.from({ length: 10 }, (_, index) =>
      family({ owner_user_id: `f${index}`, label: `Família ${index}`, assets_value: 1_000_000 }),
    );
    const result = buildOfficeConsolidation(rows, { today: TODAY });
    expect(result.concentration.hhi).toBe(0.1);
    expect(result.concentration.level).toBe("baixa");
    expect(result.concentration.top5Share).toBe(50);
  });

  it("sem família, declara em vez de mostrar zero", () => {
    const result = buildOfficeConsolidation([], { today: TODAY });
    expect(result.totals.families).toBe(0);
    expect(result.warnings[0]).toContain("Nenhuma família vinculada");
    expect(result.concentration.topFamilyLabel).toBeNull();
  });

  it("família sem dado é lacuna declarada, não patrimônio zero", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Sem dado", entities: 0, assets_value: 0, positions_value: 0 })],
      { today: TODAY },
    );
    const item = result.families[0]!;
    expect(item.missingData).toBe(true);
    expect(item.alerts).toContain("Sem ativo ou entidade lançada — consolidado incompleto.");
    expect(result.quality.familiesMissingData).toBe(1);
    expect(result.warnings.some((warning) => warning.includes("lacuna"))).toBe(true);
  });

  it("entidade sem ativo já não conta como lacuna", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Só entidade", entities: 3, assets_value: 0 })],
      { today: TODAY },
    );
    expect(result.families[0]?.missingData).toBe(false);
  });

  it("patrimônio líquido negativo vira alerta crítico", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Endividada", assets_value: 1_000, liabilities_value: 3_000 })],
      { today: TODAY },
    );
    expect(result.families[0]?.negativeNetWorth).toBe(true);
    expect(result.quality.familiesNegativeNetWorth).toBe(1);
    expect(result.alerts[0]?.severity).toBe("critical");
  });

  it("dado velho é marcado com o número de dias", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Parada", last_update: "2026-06-01T00:00:00.000Z" })],
      { today: TODAY },
    );
    const item = result.families[0]!;
    expect(item.stale).toBe(true);
    expect(item.daysSinceUpdate).toBe(155);
    expect(item.alerts.join(" ")).toContain("155 dias");
    expect(result.quality.familiesStale).toBe(1);
    expect(result.quality.freshnessPct).toBe(0);
  });

  it("frescura conta quem tem dado recente e lançado", () => {
    const result = buildOfficeConsolidation(
      [
        family({ owner_user_id: "f1", label: "Ok", assets_value: 100 }),
        family({ owner_user_id: "f2", label: "Velha", assets_value: 100, last_update: "2026-01-01T00:00:00.000Z" }),
      ],
      { today: TODAY },
    );
    expect(result.quality.freshnessPct).toBe(50);
  });

  it("contencioso grande em relação ao PL gera alerta proporcional", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "Judicial", assets_value: 1_000_000, legal_exposure: 300_000 })],
      { today: TODAY },
    );
    const alert = result.alerts.find((item) => item.message.includes("Contencioso"));
    expect(alert?.severity).toBe("critical");
    expect(alert?.message).toContain("30,0%");
  });

  it("contencioso pequeno não vira ruído", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "X", assets_value: 1_000_000, legal_exposure: 10_000 })],
      { today: TODAY },
    );
    expect(result.alerts.some((item) => item.message.includes("Contencioso"))).toBe(false);
  });

  it("risco crítico e documento vencido entram como alerta da família", () => {
    const result = buildOfficeConsolidation(
      [
        family({
          owner_user_id: "f1",
          label: "Risco",
          assets_value: 500_000,
          risks_critical: 2,
          documents_overdue: 3,
        }),
      ],
      { today: TODAY },
    );
    const labels = result.alerts.map((item) => item.message);
    expect(labels.some((text) => text.includes("2 risco(s) crítico(s)"))).toBe(true);
    expect(labels.some((text) => text.includes("3 documento(s) vencido(s)"))).toBe(true);
  });

  it("alertas vêm ordenados por severidade", () => {
    const result = buildOfficeConsolidation(
      [
        family({ owner_user_id: "f1", label: "A", assets_value: 100, documents_overdue: 1 }),
        family({ owner_user_id: "f2", label: "B", assets_value: 100, liabilities_value: 500 }),
      ],
      { today: TODAY },
    );
    expect(result.alerts[0]?.severity).toBe("critical");
    const last = result.alerts[result.alerts.length - 1];
    expect(last?.severity).not.toBe("critical");
  });

  it("threshold de concentração é configurável", () => {
    const rows = [
      family({ owner_user_id: "f1", label: "A", assets_value: 6_000 }),
      family({ owner_user_id: "f2", label: "B", assets_value: 4_000 }),
    ];
    expect(buildOfficeConsolidation(rows, { today: TODAY, singleFamilyThreshold: 40 }).concentration.familiesAboveThreshold).toBe(2);
    expect(buildOfficeConsolidation(rows, { today: TODAY, singleFamilyThreshold: 70 }).concentration.familiesAboveThreshold).toBe(0);
  });

  it("corte de antiguidade configurável", () => {
    const rows = [family({ owner_user_id: "f1", label: "A", assets_value: 10, last_update: "2026-09-01T00:00:00.000Z" })];
    expect(buildOfficeConsolidation(rows, { today: TODAY, staleDays: 90 }).families[0]?.stale).toBe(false);
    expect(buildOfficeConsolidation(rows, { today: TODAY, staleDays: 30 }).families[0]?.stale).toBe(true);
  });

  it("rótulo enviado pela UI tem precedência sobre o do banco", () => {
    const rows = [family({ owner_user_id: "f1", label: "Família Silva", label_override: "Grupo Silva (apelido interno)" })];
    expect(buildOfficeConsolidation(rows, { today: TODAY }).families[0]?.label).toBe("Grupo Silva (apelido interno)");
  });

  it("agro somado entre famílias", () => {
    const result = buildOfficeConsolidation(
      [
        family({ owner_user_id: "f1", label: "A", agro_area_ha: 1_200 }),
        family({ owner_user_id: "f2", label: "B", agro_area_ha: 800 }),
      ],
      { today: TODAY },
    );
    expect(result.totals.agroAreaHa).toBe(2_000);
  });
});

describe("vários escritórios", () => {
  it("agrupa por escritório sem misturar patrimônios", () => {
    const rows = [
      family({ owner_user_id: "f1", label: "A1", assets_value: 1_000, office_id: "o1", office_name: "Aurora" }),
      family({ owner_user_id: "f2", label: "B1", assets_value: 5_000, office_id: "o2", office_name: "Bravo" }),
      family({ owner_user_id: "f3", label: "A2", assets_value: 3_000, office_id: "o1", office_name: "Aurora" }),
    ];
    const grouped = groupByOffice(rows);
    expect(grouped.get("o1")).toHaveLength(2);
    expect(grouped.get("o2")).toHaveLength(1);

    const consolidations = buildAllConsolidations(rows, { today: TODAY });
    expect(consolidations.map((item) => item.officeName)).toEqual(["Bravo", "Aurora"]);
    expect(consolidations[0]?.totals.assets).toBe(5_000);
    expect(consolidations[1]?.totals.assets).toBe(4_000);
  });
});

describe("utilidades", () => {
  it("dias entre datas, com data ausente ou inválida", () => {
    expect(daysBetween("2026-11-01T00:00:00.000Z", TODAY)).toBe(2);
    expect(daysBetween(null, TODAY)).toBeNull();
    expect(daysBetween("não é data", TODAY)).toBeNull();
  });

  it("valores como string (numeric do Postgres) são lidos como número", () => {
    const result = buildOfficeConsolidation(
      [family({ owner_user_id: "f1", label: "A", assets_value: "1500.50" as unknown as number })],
      { today: TODAY },
    );
    expect(result.families[0]?.totalAssets).toBe(1500.5);
  });
});
