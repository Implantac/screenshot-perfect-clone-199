/**
 * `GET /api/health` — sonda de saúde para monitor de disponibilidade (wave 26).
 *
 * POR QUE FORA DO PAINEL
 * Uptime monitor (UptimeRobot, Better Stack, cron do próprio hospedeiro) precisa
 * de um `200`/`503` sem sessão. O painel `/sistema` é para humano; isto é para
 * máquina.
 *
 * O QUE **NÃO** SAI DAQUI
 * Nenhum valor de variável de ambiente — só o rótulo da integração e se está ok.
 * Um endpoint de saúde que devolve configuração é um mapa do tesouro: diz ao
 * atacante exatamente o que falta para ele completar o ataque.
 */
import { createFileRoute } from "@tanstack/react-router";
import { integrationStatuses } from "@/lib/observability/telemetry";
import { LATEST_MIGRATION, MIGRATION_COUNT } from "@/lib/observability/schema-manifest";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const statuses = integrationStatuses(process.env).map((status) => ({
          key: status.key,
          label: status.label,
          severity: status.severity,
        }));

        const critical = statuses.filter((status) => status.severity === "critical").length;
        const warning = statuses.filter((status) => status.severity === "warning").length;
        const state = critical > 0 ? "fora" : warning > 0 ? "degradado" : "ok";

        return Response.json(
          {
            state,
            // O processo está de pé e respondendo — o resto é consequência.
            checks: { process: "ok", integrations: statuses },
            manifest: { migrations: MIGRATION_COUNT, latest: LATEST_MIGRATION },
            at: new Date().toISOString(),
          },
          {
            status: state === "fora" ? 503 : 200,
            headers: {
              // Saúde não pode ser cacheada: cache de 200 esconde queda.
              "cache-control": "no-store, max-age=0",
            },
          },
        );
      },
    },
  },
});
