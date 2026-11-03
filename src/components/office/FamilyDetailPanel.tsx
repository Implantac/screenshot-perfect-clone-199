/**
 * Detalhe de uma família para o escritório (wave 24).
 *
 * Abre só o que a família consentiu, seção por seção, e cada abertura é registrada
 * no log que a própria família lê. O aviso no topo não é decoração: quem abre o
 * detalhe precisa saber que está sendo visto.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Eye,
  FileText,
  Gavel,
  Landmark,
  Loader2,
  Sprout,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getOfficeFamilyDetail } from "@/lib/api/office.functions";
import type { FamilyDetailPayload } from "@/lib/office/access";

const brl = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(0)}%`;
const date = (iso: string | null) => {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleDateString("pt-BR");
};

const CLASS_LABEL: Record<string, string> = {
  caixa: "Caixa",
  renda_fixa: "Renda fixa",
  renda_variavel: "Renda variável",
  fundos: "Fundos",
  imoveis: "Imóveis",
  internacional: "Internacional",
  alternativos: "Alternativos",
  cripto: "Cripto",
};

export function FamilyDetailPanel({
  ownerUserId,
  label,
  onClose,
}: {
  ownerUserId: string;
  label: string;
  onClose: () => void;
}) {
  const query = useQuery({
    queryKey: ["office-family-detail", ownerUserId],
    queryFn: () => getOfficeFamilyDetail({ data: { ownerUserId } }),
    retry: false,
    staleTime: 0,
  });

  const detail: FamilyDetailPayload | undefined = query.data;

  // Fechar com Esc: o detalhe é uma camada sobre a tela, não uma página.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 md:items-center md:p-6">
      <div className="glass-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-background/95 p-5 md:rounded-[2rem]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
              Detalhe consentido
            </p>
            <h2 className="font-display text-xl font-black uppercase tracking-tight">{label}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] text-primary">
          <Eye className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Esta abertura ficou registrada no log de acesso da família, com seu usuário, a seção e o horário.
          </span>
        </p>

        {query.isLoading && (
          <div className="flex items-center gap-2 py-6 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Abrindo o que foi consentido…
          </div>
        )}

        {query.error && (
          <div className="flex items-start gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2 text-[11px] text-orange-400">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{(query.error as Error).message}</span>
          </div>
        )}

        {detail && (
          <div className="space-y-3">
            {detail.sections.resumo && (
              <Section icon={Landmark} title="Resumo patrimonial">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="Entidades" value={String(detail.sections.resumo.entities)} />
                  <Metric label="Ativos registrais" value={brl(detail.sections.resumo.assetsValue)} />
                  <Metric label="Última atualização" value={date(detail.sections.resumo.lastUpdate)} />
                </div>
              </Section>
            )}

            {detail.sections.custodia && (
              <Section icon={Wallet} title="Custódia e dívida">
                <div className="mb-2 grid gap-2 sm:grid-cols-3">
                  <Metric label="Custódia" value={brl(detail.sections.custodia.total)} />
                  <Metric label="Dívida" value={brl(detail.sections.custodia.debt)} />
                  <Metric
                    label="Patrimônio líquido"
                    value={brl(detail.sections.custodia.total + (detail.sections.resumo?.assetsValue ?? 0) - detail.sections.custodia.debt)}
                  />
                </div>
                {detail.sections.custodia.byClass.length > 0 ? (
                  <div className="space-y-1">
                    {detail.sections.custodia.byClass.map((row) => (
                      <div key={row.class} className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="text-muted-foreground">
                          {CLASS_LABEL[row.class] ?? row.class} · {row.positions} posição(ões)
                        </span>
                        <span className="font-bold tabular-nums">{brl(row.value)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">Sem posição financeira lançada.</p>
                )}
              </Section>
            )}

            {detail.sections.contencioso && (
              <Section icon={Gavel} title="Contencioso">
                <Metric label="Exposição total" value={brl(detail.sections.contencioso.exposure)} />
                <div className="mt-2 space-y-1">
                  {detail.sections.contencioso.cases.length === 0 && (
                    <p className="text-[10px] text-muted-foreground">Nenhum processo cadastrado.</p>
                  )}
                  {detail.sections.contencioso.cases.map((legalCase, index) => (
                    <div key={`${legalCase.title}-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {legalCase.title} · {legalCase.type} · {pct(legalCase.probability)}
                      </span>
                      <span className="shrink-0 font-bold tabular-nums">{brl(legalCase.value)}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {detail.sections.agro && (
              <Section icon={Sprout} title="Agro">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Metric label="Área de lavoura" value={`${detail.sections.agro.areaHa.toLocaleString("pt-BR")} ha`} />
                  <Metric label="Talhões" value={String(detail.sections.agro.fields.length)} />
                </div>
                <div className="mt-2 space-y-1">
                  {detail.sections.agro.fields.map((field) => (
                    <div key={field.name} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">
                        {field.name} · {field.crop} · {field.area_ha.toLocaleString("pt-BR")} ha
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {field.productivity_sc_ha ? `${field.productivity_sc_ha} sc/ha` : "produtividade não informada"}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {detail.sections.documentos && (
              <Section icon={FileText} title="Documentos">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Metric label="A vencer (60 dias)" value={String(detail.sections.documentos.expiring)} />
                  <Metric label="Vencidos" value={String(detail.sections.documentos.overdue)} />
                </div>
                <div className="mt-2 space-y-1">
                  {detail.sections.documentos.items.map((document, index) => (
                    <div key={`${document.title}-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">{document.title}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {date(document.expiry_date)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[9px] text-muted-foreground/60">
                  Somente metadados: arquivos e URLs não fazem parte do escopo.
                </p>
              </Section>
            )}

            {detail.sections.riscos && (
              <Section icon={AlertTriangle} title="Riscos abertos">
                <Metric label="Abertos" value={String(detail.sections.riscos.open)} />
                <div className="mt-2 space-y-1">
                  {detail.sections.riscos.items.map((risk, index) => (
                    <div key={`${risk.title}-${index}`} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="min-w-0 truncate text-muted-foreground">{risk.title}</span>
                      <span
                        className={cn(
                          "shrink-0 text-[9px] font-black uppercase tracking-widest",
                          risk.severity === "critical" || risk.severity === "critica" || risk.severity === "alta"
                            ? "text-red-400"
                            : "text-muted-foreground",
                        )}
                      >
                        {risk.severity ?? "—"} · {date(risk.due_date)}
                      </span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            <p className="pt-1 text-[9px] text-muted-foreground/60">
              Seções exibidas: {detail.scopes.join(", ")}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Landmark;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
      <h3 className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary" /> {title}
      </h3>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <p className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{label}</p>
      <p className="text-[12px] font-black tabular-nums">{value}</p>
    </div>
  );
}
