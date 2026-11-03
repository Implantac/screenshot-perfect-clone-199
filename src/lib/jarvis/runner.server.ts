/**
 * Executor das ferramentas do JARVIS (lado servidor).
 *
 * Fluxo: pergunta → roteador escolhe ferramentas → aqui carregamos **somente**
 * os datasets que elas declaram → ferramenta roda → resultado vai para o prompt
 * (ou para o analista local) e para a UI.
 *
 * Dois cuidados que vieram de cicatriz de projeto:
 *  - Migration não aplicada não pode virar tela quebrada: cada consulta falha
 *    para lista vazia e a falha é **declarada** em `warnings`.
 *  - Somar posição + ativo registral sem checar origem dobra o patrimônio; aqui a
 *    separação financeiro/registral é feita no motor de balanço, não na mão.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PortfolioBriefing } from "@/lib/jarvis/types";
import { inferArgs, routeQuestion, type RouteResult } from "@/lib/jarvis/router";
import {
  runTool,
  type DatasetKey,
  type JarvisToolData,
  type JarvisToolName,
  type ToolResult,
} from "@/lib/jarvis/tools";

type Client = SupabaseClient<Database>;

export type ToolRunOutcome = {
  route: RouteResult;
  results: ToolResult[];
  warnings: string[];
  args: Record<string, unknown>;
};

async function loadDatasets(
  supabase: Client,
  datasets: DatasetKey[],
  briefing: PortfolioBriefing,
): Promise<{ data: Partial<JarvisToolData>; warnings: string[] }> {
  const data: Partial<JarvisToolData> = { briefing };
  const warnings: string[] = [];
  const wanted = new Set(datasets);
  if (wanted.size === 0) return { data, warnings };

  const queries: Promise<void>[] = [];

  if (wanted.has("posicoes")) {
    queries.push(
      (async () => {
        const { data: rows, error } = await supabase
          .from("positions")
          .select("name, asset_class, currency, quantity, unit_price, liquidity");
        if (error) {
          warnings.push(`Posições indisponíveis (${error.message}); cálculos sem custódia financeira.`);
          data.posicoes = [];
        } else {
          data.posicoes = rows ?? [];
        }
      })(),
    );
  }

  if (wanted.has("passivos")) {
    queries.push(
      (async () => {
        const { data: rows, error } = await supabase
          .from("liabilities")
          .select("name, outstanding, rate_annual, amortization, term_months, due_date");
        if (error) {
          warnings.push(`Passivos indisponíveis (${error.message}); dívida considerada zero.`);
          data.passivos = [];
        } else {
          data.passivos = (rows ?? []).map((row) => ({
            name: row.name,
            outstanding: row.outstanding,
            rate_annual: row.rate_annual,
            amortization: row.amortization,
            term_months: row.term_months,
            due_date: row.due_date,
          }));
        }
      })(),
    );
  }

  if (wanted.has("registrais")) {
    queries.push(
      (async () => {
        const { data: rows, error } = await supabase.from("assets").select("current_value");
        if (error) {
          warnings.push(`Ativos registrais indisponíveis (${error.message}).`);
          data.registrais = [];
        } else {
          data.registrais = (rows ?? []) as { current_value?: number | null }[];
        }
      })(),
    );
  }

  if (wanted.has("juridico")) {
    queries.push(
      (async () => {
        const { data: rows, error } = await supabase
          .from("legal_cases")
          .select(
            "id, case_number, title, type, status, risk_level, value_at_stake, polarity, probability, phase, expected_settlement",
          );
        if (error) {
          warnings.push(`Contencioso indisponível (${error.message}).`);
          data.juridico = [];
        } else {
          data.juridico = (rows ?? []) as never;
        }
      })(),
    );
  }

  if (wanted.has("agro")) {
    queries.push(
      (async () => {
        const [fields, leases, barters, environments] = await Promise.all([
          supabase.from("agro_fields").select("name, area_ha, crop, productivity_sc_ha, cost_per_ha"),
          supabase
            .from("agro_leases")
            .select("role, area_ha, payment, price_per_ha_year, bags_per_ha, share_percent"),
          supabase.from("agro_barters").select("input_value, bags_due, bag_reference_price, months_to_delivery"),
          supabase
            .from("agro_environmental")
            .select("total_ha, biome, in_legal_amazon, legal_reserve_declared_ha, app_ha, car_status"),
        ]);
        const failed = [fields, leases, barters, environments].filter((result) => result.error);
        if (failed.length > 0) {
          warnings.push(`Agro parcialmente indisponível (${failed[0].error?.message ?? "erro"}) — números podem faltar talhões.`);
        }
        data.agro = {
          fields: (fields.data ?? []) as never,
          leases: (leases.data ?? []) as never,
          barters: (barters.data ?? []) as never,
          environments: (environments.data ?? []) as never,
        };
      })(),
    );
  }

  await Promise.all(queries);
  return { data, warnings };
}

/** Roda as ferramentas que a pergunta aciona. Nunca lança: erro vira aviso. */
export async function runJarvisTools(
  supabase: Client,
  question: string,
  briefing: PortfolioBriefing,
): Promise<ToolRunOutcome> {
  const route = routeQuestion(question);
  const args = inferArgs(question);
  if (route.empty) return { route, results: [], warnings: [], args };

  const { data, warnings } = await loadDatasets(supabase, route.datasets, briefing);
  const full: JarvisToolData = { ...data, briefing } as JarvisToolData;

  const results = route.tools.map((name: JarvisToolName) => runTool(name, full, args));
  return { route, results, warnings, args };
}
