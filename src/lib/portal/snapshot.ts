/**
 * Portal do cliente — visão do convidado.
 *
 * O convidado nunca recebe dado bruto para "esconder na tela": a resolução de
 * permissão e a redação acontecem **antes** de virar objeto de renderização. Este
 * motor recebe o retrato agregado da entidade (já recortado pelo banco) e devolve
 * exatamente o que a pessoa pode ver — e com que grão.
 *
 * Regra de honestidade: seção negada não vira bloco vazio. Ela aparece como
 * "não disponível para o seu perfil", com o motivo, para que a ausência de um
 * número não seja confundida com um número que deu errado.
 */

import {
  redactAmount,
  resolvePortalAccess,
  type PortalAccess,
  type PortalGrant,
  type PortalVisibility,
} from "./access";

export type PortalSnapshotInput = {
  grant: PortalGrant;
  entityName: string;
  /** Totais patrimoniais em R$. */
  totals: { financial: number; registered: number; debt: number };
  /** Alocação por classe, em % do financeiro. */
  classes: { key: string; label: string; percentage: number; value: number }[];
  /** Contribuição por classe no mês, em p.p. */
  contributions: { label: string; returnPct: number; contribution: number }[];
  monthReturnPct: number;
  ytdReturnPct: number;
  goals: { name: string; progressPct: number; requiredMonthly: number; targetDate: string }[];
  asOf: string;
  today?: string;
};

export type PortalCard = { label: string; value: string; hint?: string };

export type PortalView = {
  meta: { entityName: string; holderName: string; asOf: string; visibility: PortalVisibility };
  access: PortalAccess;
  cards: PortalCard[];
  classes: { label: string; percentage: string; amount: string | null }[];
  contributions: { label: string; contribution: string; returnPct: string }[];
  goals: { name: string; progress: string; requiredMonthly: string; targetDate: string }[];
  /** Seções negadas, com motivo — aparece no rodapé do portal. */
  unavailable: { label: string; reason: string }[];
  canExport: boolean;
  notes: string[];
};

const pct = (value: number, digits = 1) => `${value.toFixed(digits).replace(".", ",")}%`;
const signedPp = (value: number) => `${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(2).replace(".", ",")} p.p.`;

const dateBr = (iso: string) => {
  const [year, month, day] = iso.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
};

export function buildPortalView(input: PortalSnapshotInput): PortalView {
  const access = resolvePortalAccess(input.grant, input.today ? new Date(`${input.today}T12:00:00Z`) : new Date());
  const visibility = access.visibility;
  const has = (section: string) => access.allowedSections.includes(section);

  const cards: PortalCard[] = [];
  if (has("resumo")) {
    cards.push({
      label: "Patrimônio líquido",
      value: redactAmount(input.totals.financial + input.totals.registered - input.totals.debt, visibility),
      hint: "ativo total menos dívida",
    });
    cards.push({ label: "Retorno no mês", value: `${input.monthReturnPct >= 0 ? "+" : ""}${pct(input.monthReturnPct, 2)}` });
    cards.push({ label: "Retorno no ano", value: `${input.ytdReturnPct >= 0 ? "+" : ""}${pct(input.ytdReturnPct, 2)}` });
  }
  if (has("balanco")) {
    cards.push({ label: "Dívida", value: redactAmount(input.totals.debt, visibility) });
  }

  const classes = has("alocacao")
    ? input.classes.map((item) => ({
        label: item.label,
        percentage: pct(item.percentage),
        // O valor absoluto da classe só sai quando a pessoa pode ver resumo/balanço:
        // percentual isolado já comunica alocação sem revelar tamanho.
        amount:
          has("resumo") && visibility !== "faixas" ? redactAmount(item.value, visibility) : null,
      }))
    : [];

  const contributions = has("atribuicao")
    ? input.contributions.map((item) => ({
        label: item.label,
        contribution: signedPp(item.contribution),
        returnPct: `${item.returnPct >= 0 ? "+" : ""}${pct(item.returnPct, 2)}`,
      }))
    : [];

  const goals = has("metas")
    ? input.goals.map((goal) => ({
        name: goal.name,
        progress: pct(goal.progressPct, 0),
        requiredMonthly: redactAmount(goal.requiredMonthly, visibility),
        targetDate: dateBr(goal.targetDate),
      }))
    : [];

  const unavailable = access.deniedSections.map((section) => ({ label: section.label, reason: section.reason }));

  const notes: string[] = [];
  if (visibility === "faixas") {
    notes.push("Os valores são apresentados em faixas por opção de privacidade do seu perfil.");
  } else if (visibility === "resumido") {
    notes.push("Os valores são apresentados em milhões por opção de privacidade do seu perfil.");
  }
  if (has("atribuicao") && input.contributions.length === 0) {
    notes.push(
      "A atribuição de retorno por classe ainda não foi apurada neste fechamento — os números acima são do consolidado.",
    );
  }
  if (!access.canExport) {
    notes.push("A exportação em PDF não está liberada para o seu perfil — peça ao gestor responsável.");
  }
  if (access.daysToExpiry !== null && access.daysToExpiry <= 30) {
    notes.push(`Este acesso vence em ${access.daysToExpiry} dia(s).`);
  }

  return {
    meta: {
      entityName: input.entityName,
      holderName: input.grant.full_name,
      asOf: input.asOf,
      visibility,
    },
    access,
    cards,
    classes,
    contributions,
    goals,
    unavailable,
    canExport: access.canExport && access.allowedSections.length > 0,
    notes,
  };
}

/** Resumo em texto — para e-mail, WhatsApp e para o teste de regressão. */
export function formatPortalViewText(view: PortalView): string {
  const lines: string[] = [];
  lines.push(`PATRIUM — PORTAL DE ${view.meta.entityName.toUpperCase()}`);
  lines.push(`${view.meta.holderName} · posição de ${dateBr(view.meta.asOf)}`);
  lines.push("");
  if (view.cards.length > 0) {
    lines.push("RESUMO");
    for (const card of view.cards) lines.push(`  ${card.label}: ${card.value}`);
    lines.push("");
  }
  if (view.classes.length > 0) {
    lines.push("ALOCAÇÃO");
    for (const item of view.classes) {
      lines.push(`  ${item.label.padEnd(18)} ${item.percentage.padStart(6)}${item.amount ? `  ${item.amount}` : ""}`);
    }
    lines.push("");
  }
  if (view.contributions.length > 0) {
    lines.push("CONTRIBUIÇÃO NO MÊS");
    for (const item of view.contributions) lines.push(`  ${item.label.padEnd(18)} ${item.contribution}`);
    lines.push("");
  }
  if (view.goals.length > 0) {
    lines.push("METAS");
    for (const goal of view.goals) {
      lines.push(`  ${goal.name}: ${goal.progress} (aporte ${goal.requiredMonthly}/mês até ${goal.targetDate})`);
    }
    lines.push("");
  }
  if (view.unavailable.length > 0) {
    lines.push("NÃO DISPONÍVEL PARA O SEU PERFIL");
    for (const item of view.unavailable) lines.push(`  ${item.label} — ${item.reason}`);
    lines.push("");
  }
  for (const note of view.notes) lines.push(`· ${note}`);
  return lines.join("\n");
}
