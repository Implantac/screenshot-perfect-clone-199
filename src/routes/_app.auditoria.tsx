import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileCheck2,
  FileWarning,
  Fingerprint,
  Link2,
  Loader2,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  exportAuditPackage,
  getAuditAnchors,
  getAuditChain,
  issueAuditAnchor,
} from "@/lib/api/audit.functions";
import {
  buildAnchor,
  hashChain,
  shortHash,
  summarizeChain,
  verifyChain,
  type ChainEntry,
} from "@/lib/audit/chain";
import { PdfDocument, type Rgb } from "@/lib/reports/pdf-core";

export const Route = createFileRoute("/_app/auditoria")({
  component: Auditoria,
});

const INK: Rgb = [22, 28, 38];
const MUTED: Rgb = [110, 120, 136];
const ACCENT: Rgb = [16, 122, 87];
const DANGER: Rgb = [176, 42, 42];

const dateTime = (iso: string | null) => {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const ACTION_LABEL: Record<string, string> = {
  INSERT: "Criação",
  UPDATE: "Alteração",
  DELETE: "Exclusão",
};

const ACTION_TONE: Record<string, string> = {
  INSERT: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  UPDATE: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  DELETE: "border-red-500/20 bg-red-500/10 text-red-400",
};

/** Certidão em PDF da janela auditada — usa o escritor próprio da wave 13. */
function renderCertificate(input: {
  entries: ChainEntry[];
  verification: ReturnType<typeof verifyChain>;
  generatedAt: string;
}): Uint8Array {
  const doc = new PdfDocument();
  const margin = 46;
  let y = margin;
  const width = doc.width - margin * 2;

  doc.text("PATRIUM OS", margin, y, { size: 8, bold: true, color: MUTED });
  y += 16;
  doc.text("Certidão de trilha de auditoria", margin, y, { size: 18, bold: true, color: INK });
  y += 18;
  doc.text(`Emitida em ${dateTime(input.generatedAt)}`, margin, y, { size: 9, color: MUTED });
  doc.line(margin, y + 6, margin + width, y + 6, { color: [226, 230, 236] });
  y += 26;

  const summary = summarizeChain(input.entries);

  const line = (label: string, value: string, tone: Rgb = INK) => {
    doc.text(label, margin, y, { size: 8, color: MUTED });
    doc.text(value, margin + 150, y, { size: 9, bold: true, color: tone });
    y += 15;
  };

  line("Entradas verificadas", String(input.verification.checked));
  line("Com conteúdo recomputado", String(input.verification.contentChecked));
  line("Primeira sequência", summary.firstSequence === null ? "—" : String(summary.firstSequence));
  line("Última sequência", summary.headSequence === null ? "—" : String(summary.headSequence));
  line(
    "Resultado",
    input.verification.ok ? "CADEIA ÍNTEGRA" : "CADEIA ROMPIDA",
    input.verification.ok ? ACCENT : DANGER,
  );
  if (!input.verification.ok) {
    line("Primeira quebra na sequência", String(input.verification.firstBrokenSequence ?? "—"), DANGER);
  }

  y += 6;
  doc.text("Elo atual (SHA-256)", margin, y, { size: 8, color: MUTED });
  y += 11;
  const head = summary.headHash ?? "—";
  for (let index = 0; index < head.length; index += 64) {
    doc.text(head.slice(index, index + 64), margin, y, { size: 8, color: INK });
    y += 11;
  }

  y += 6;
  doc.text("Hash da cadeia", margin, y, { size: 8, color: MUTED });
  y += 11;
  const chainHash = hashChain(input.entries);
  for (let index = 0; index < chainHash.length; index += 64) {
    doc.text(chainHash.slice(index, index + 64), margin, y, { size: 8, color: INK });
    y += 11;
  }

  y += 10;
  doc.text(
    "Como verificar: SHA-256(prev_hash || '|' || payload_text) de cada entrada deve",
    margin,
    y,
    { size: 8, color: MUTED },
  );
  y += 10;
  doc.text("ser igual ao entry_hash gravado, e cada prev_hash deve fechar com o elo anterior.", margin, y, {
    size: 8,
    color: MUTED,
  });

  if (input.verification.issues.length > 0) {
    y += 16;
    doc.text("Não conformidades", margin, y, { size: 9, bold: true, color: DANGER });
    y += 13;
    for (const issue of input.verification.issues.slice(0, 8)) {
      doc.text(`#${issue.sequence} · ${issue.kind} · ${issue.detail}`, margin, y, {
        size: 8,
        color: DANGER,
      });
      y += 11;
    }
  }

  doc.line(margin, doc.height - 60, margin + width, doc.height - 60, { color: [226, 230, 236] });
  doc.text(
    "Documento gerado pelo PATRIUM OS. A assinatura da âncora é ECDSA P-256 (ou HMAC-SHA256 nas âncoras anteriores à wave 25).",
    margin,
    doc.height - 46,
    { size: 7, color: MUTED },
  );

  return doc.toBytes();
}

function download(bytes: Uint8Array, filename: string, type: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function Auditoria() {
  const queryClient = useQueryClient();
  const [limit, setLimit] = useState(300);

  const chainQuery = useQuery({
    queryKey: ["audit_chain", limit],
    queryFn: () => getAuditChain({ data: { limit, ownerOnly: false } }),
    retry: false,
  });

  const anchorsQuery = useQuery({
    queryKey: ["audit_anchors"],
    queryFn: () => getAuditAnchors({ data: { limit: 20 } }),
    retry: false,
  });

  const entries = chainQuery.data?.entries ?? [];
  const verification = useMemo(() => verifyChain(entries), [entries]);
  const summary = useMemo(() => summarizeChain(entries), [entries]);
  const localAnchor = useMemo(
    () => buildAnchor({ entries, generatedAt: new Date().toISOString(), secret: null }),
    [entries],
  );

  const issueAnchor = useMutation({
    mutationFn: () => issueAuditAnchor({ data: { limit } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audit_anchors"] }),
  });

  const downloadPackage = useMutation({
    mutationFn: () => exportAuditPackage({ data: { limit } }),
    onSuccess: (result) => {
      const text = JSON.stringify(result.package, null, 2);
      download(new TextEncoder().encode(text), `patrium-trilha-${Date.now()}.json`, "application/json");
    },
  });

  if (chainQuery.data?.migrationPending) {
    return (
      <div className="mx-auto w-full max-w-3xl p-6">
        <div className="glass-card rounded-[2rem] border border-amber-500/20 p-8">
          <FileWarning className="mb-3 h-6 w-6 text-amber-400" />
          <h1 className="font-display text-xl font-black uppercase tracking-tight">
            Falta aplicar a migration da trilha
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            Rode <code className="rounded bg-white/10 px-1">supabase/APLICAR-TUDO.sql</code> (wave 20) para
            encadear as entradas e habilitar âncoras.
          </p>
        </div>
      </div>
    );
  }

  const chainOk = verification.ok;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60">
            Governança
          </p>
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Trilha de auditoria
          </h1>
          <p className="mt-1 max-w-2xl text-[11px] text-muted-foreground">
            Cada entrada carrega o hash da anterior. Alterar ou apagar uma linha quebra todos os elos
            seguintes — e a <strong>âncora assinada</strong> prova que a cadeia tinha este estado nesta data.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-3 text-[11px]"
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
          >
            {[100, 300, 1000, 2000].map((value) => (
              <option key={value} value={value}>
                últimas {value} entradas
              </option>
            ))}
          </select>
          <button
            onClick={() => void chainQuery.refetch()}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 text-[10px] font-black uppercase tracking-widest hover:bg-white/10"
          >
            {chainQuery.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Verificar
          </button>
          <button
            onClick={() => issueAnchor.mutate()}
            disabled={issueAnchor.isPending || entries.length === 0}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-black uppercase tracking-widest text-primary-foreground disabled:opacity-50"
          >
            {issueAnchor.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Fingerprint className="h-3.5 w-3.5" />
            )}
            Emitir âncora
          </button>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Entradas na janela",
            value: String(summary.count),
            hint:
              summary.firstSequence !== null
                ? `sequências ${summary.firstSequence} a ${summary.headSequence}`
                : "sem entradas",
            icon: Link2,
            tone: "text-foreground",
          },
          {
            label: "Estado da cadeia",
            value: chainOk ? "Íntegra" : "Rompida",
            hint: chainOk
              ? `${verification.contentChecked} hashes recomputados`
              : `quebra na sequência ${verification.firstBrokenSequence}`,
            icon: chainOk ? CheckCircle2 : XCircle,
            tone: chainOk ? "text-emerald-400" : "text-red-400",
          },
          {
            label: "Elo atual",
            value: shortHash(summary.headHash, 16),
            hint: `hash da cadeia ${shortHash(hashChain(entries), 10)}`,
            icon: Fingerprint,
            tone: "text-foreground",
          },
          {
            label: "Âncoras emitidas",
            value: String(anchorsQuery.data?.anchors.length ?? 0),
            hint: (() => {
              const anchors = anchorsQuery.data?.anchors ?? [];
              if (anchors.length === 0) return "nenhuma emitida";
              if (anchors.some((anchor) => anchor.independentlyVerifiable && anchor.signatureValid))
                return "ECDSA P-256 verificável pelo auditor";
              if (anchors.some((anchor) => anchor.signatureValid)) return "HMAC-SHA256 verificada (simétrica)";
              return "assinatura pendente de chave";
            })(),
            icon: FileCheck2,
            tone: (anchorsQuery.data?.anchors.length ?? 0) > 0 ? "text-emerald-400" : "text-muted-foreground",
          },
        ].map((card) => (
          <div key={card.label} className="glass-card rounded-2xl border border-white/5 p-4">
            <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
              <card.icon className="h-3 w-3" /> {card.label}
            </div>
            <p className={cn("mt-2 truncate text-xl font-black tabular-nums", card.tone)}>{card.value}</p>
            <p className="truncate text-[10px] text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </div>

      {!chainOk ? (
        <div className="space-y-2">
          {verification.issues.slice(0, 6).map((issue) => (
            <div
              key={`${issue.sequence}-${issue.kind}`}
              className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-[11px] text-red-400"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                #{issue.sequence} · {issue.kind} — {issue.detail}
              </span>
            </div>
          ))}
        </div>
      ) : verification.startedMidChain ? (
        <div className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-[11px] text-muted-foreground">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0" />A janela começa na sequência{" "}
          {summary.firstSequence} (não no gênesis): os elos anteriores existem, só não estão nesta
          consulta. A verificação confere tudo o que está aqui.
        </div>
      ) : null}

      {issueAnchor.data?.note ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-[11px] text-amber-400">
          {issueAnchor.data.note}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="glass-card overflow-hidden rounded-[2rem] border border-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 p-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest">Entradas encadeadas</h2>
            <button
              onClick={() => downloadPackage.mutate()}
              disabled={downloadPackage.isPending || entries.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-50"
            >
              {downloadPackage.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              Pacote JSON
            </button>
            <button
              onClick={() =>
                download(
                  renderCertificate({
                    entries,
                    verification,
                    generatedAt: localAnchor.manifest.generatedAt,
                  }),
                  `patrium-certidao-${Date.now()}.pdf`,
                  "application/pdf",
                )
              }
              disabled={entries.length === 0}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[9px] font-black uppercase tracking-widest hover:bg-white/10 disabled:opacity-50"
            >
              <FileCheck2 className="h-3 w-3" /> Certidão PDF
            </button>
          </div>
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-background/95 backdrop-blur">
                <tr className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/70">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Quando</th>
                  <th className="px-4 py-2">Ação</th>
                  <th className="px-4 py-2">Tabela</th>
                  <th className="px-4 py-2">Elo anterior</th>
                  <th className="px-4 py-2">Hash</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[...entries].reverse().map((entry) => (
                  <tr key={`${entry.sequence}-${entry.entryHash}`} className="text-[11px] hover:bg-white/[0.02]">
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">{entry.sequence}</td>
                    <td className="px-4 py-2 tabular-nums text-muted-foreground">
                      {dateTime(entry.createdAt)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                          ACTION_TONE[entry.action] ?? "border-white/10 bg-white/5 text-muted-foreground",
                        )}
                      >
                        {ACTION_LABEL[entry.action] ?? entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                      {entry.tableName ?? "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">
                      {shortHash(entry.prevHash, 10)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10px]">{shortHash(entry.entryHash, 12)}</td>
                  </tr>
                ))}
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[11px] text-muted-foreground">
                      Nenhuma entrada na trilha ainda — crie ou altere um registro para gerar o primeiro elo.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <div className="space-y-4">
          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest">Âncoras emitidas</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Manifest assinado de um instante da cadeia. Imutável: não há UPDATE nem DELETE.
            </p>
            <div className="mt-3 space-y-2">
              {(anchorsQuery.data?.anchors ?? []).map((anchor) => (
                <div key={anchor.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[11px] font-bold tabular-nums">{dateTime(anchor.createdAt)}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-md border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        anchor.signatureValid
                          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                          : "border-amber-500/20 bg-amber-500/10 text-amber-400",
                      )}
                    >
                      {anchor.signatureValid ? "assinada" : anchor.signature ? "assinatura inválida" : "sem segredo"}
                    </span>
                  </div>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">
                    {anchor.entries} entradas · head {shortHash(anchor.headHash, 10)} · manifest{" "}
                    {shortHash(anchor.manifestHash, 10)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider",
                        anchor.signatureAlgorithm === "ECDSA-P256-SHA256"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-white/10 bg-white/5 text-muted-foreground",
                      )}
                    >
                      {anchor.signatureAlgorithm ?? "sem assinatura"}
                    </span>
                    {anchor.keyFingerprint && (
                      <span
                        className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[8px] text-muted-foreground"
                        title={`fingerprint SHA-256 completo: ${anchor.keyFingerprint}`}
                      >
                        chave {shortHash(anchor.keyFingerprint, 12)}
                      </span>
                    )}
                    {anchor.independentlyVerifiable && (
                      <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400">
                        auditor verifica sozinho
                      </span>
                    )}
                  </div>
                  {anchor.signatureIssue && (
                    <p className="mt-1 text-[9px] text-amber-400">{anchor.signatureIssue}</p>
                  )}
                </div>
              ))}
              {(anchorsQuery.data?.anchors.length ?? 0) === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  Nenhuma âncora ainda. Emita a primeira no fim de cada fechamento — é o que dá data
                  certa ao estado da trilha.
                </p>
              ) : null}
            </div>
          </section>

          <section className="glass-card rounded-[2rem] border border-white/5 p-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest">O que o auditor confere</h2>
            <ol className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
              <li>
                <strong className="text-foreground">1.</strong> SHA-256(prev_hash | payload_text) de cada
                entrada = entry_hash gravado.
              </li>
              <li>
                <strong className="text-foreground">2.</strong> Cada prev_hash fecha com o entry_hash
                anterior; sequências sem buraco.
              </li>
              <li>
                <strong className="text-foreground">3.</strong> SHA-256 do manifest canônico = manifestHash.
              </li>
              <li>
                <strong className="text-foreground">4.</strong> Assinatura da âncora sobre o manifestHash —
                ECDSA P-256 (chave pública no pacote) ou HMAC-SHA256 nas âncoras antigas.
              </li>
            </ol>
            <div className="mt-2 rounded-xl border border-primary/20 bg-primary/5 px-2.5 py-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-primary">
                Comando do auditor
              </p>
              <code className="mt-1 block break-all font-mono text-[9px] text-foreground/80">
                openssl dgst -sha256 -verify public.pem -signature signature.der manifest-hash.txt
              </code>
              <p className="mt-1 text-[9px] text-muted-foreground">
                A chave pública e a assinatura vão no pacote JSON. Verificar não exige nenhum segredo do
                PATRIUM — e não permite assinar outra âncora.
              </p>
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              O pacote JSON traz as instruções e as entradas com o texto canônico — dá para refazer a
              conta fora do PATRIUM.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
