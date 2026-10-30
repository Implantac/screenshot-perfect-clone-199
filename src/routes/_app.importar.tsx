import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Loader2,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Undo2,
  Filter,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  useEntities,
  useImportBatches,
  useTransactions,
  isMissingTableError,
} from "@/hooks/usePatrimonio";
import { useImportStatement, useDeleteImportBatch } from "@/hooks/useCrud";
import { parseOfx, looksLikeOfx } from "@/lib/import/ofx";
import { parseCsv } from "@/lib/import/csv";
import {
  normalizeOfx,
  normalizeCsv,
  dedupeWithinFile,
  summarizeRows,
  fingerprint,
  type NormalizedRow,
} from "@/lib/import/normalize";

export const Route = createFileRoute("/_app/importar")({
  component: Importar,
});

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const dateBr = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const CATEGORIES = [
  "Receita operacional",
  "Arrendamento",
  "Proventos e rendimentos",
  "Investimentos",
  "Folha de pagamento",
  "Tributos",
  "Encargos financeiros",
  "Insumos",
  "Transferências",
  "Outras",
];

type Preview = {
  fileName: string;
  format: "ofx" | "csv";
  fileHash: string;
  rows: NormalizedRow[];
  warnings: string[];
  removedInFile: number;
};

function Importar() {
  const { data: entities } = useEntities();
  const batches = useImportBatches();
  const transactions = useTransactions();
  const importStatement = useImportStatement();
  const deleteBatch = useDeleteImportBatch();

  const [entityId, setEntityId] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [parsing, setParsing] = useState(false);
  const [onlyNew, setOnlyNew] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  /** Colunas de importação ausentes (migration não aplicada): só pré-visualiza. */
  const [schemaPending, setSchemaPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentEntityId = entityId || entities?.[0]?.id || "";

  /** IDs que já existem no banco para a entidade — base do badge "duplicado". */
  async function loadExisting(entity: string, ids: string[]) {
    const existing = new Set<string>();
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      const { data, error } = await supabase
        .from("transactions")
        .select("external_id")
        .eq("entity_id", entity)
        .in("external_id", slice);
      if (error) throw error;
      for (const row of data ?? []) if (row.external_id) existing.add(row.external_id);
    }
    return existing;
  }

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const entity = currentEntityId;
    if (!entity) {
      toast.error("Selecione a entidade antes de importar.");
      return;
    }
    setParsing(true);
    setPreview(null);
    try {
      const text = await file.text();
      const isOfx = looksLikeOfx(text) || /\.ofx$/i.test(file.name);
      const format: "ofx" | "csv" = isOfx ? "ofx" : "csv";

      const parsed = isOfx ? parseOfx(text) : parseCsv(text);
      const normalized = isOfx ? normalizeOfx(parsed.transactions) : normalizeCsv(parsed.transactions);
      const deduped = dedupeWithinFile(normalized);

      let existing = new Set<string>();
      try {
        existing = await loadExisting(
          entity,
          deduped.rows.map((row) => row.external_id),
        );
        setSchemaPending(false);
      } catch (error) {
        const message = (error as { message?: string } | null)?.message ?? "";
        if (/external_id|import_batch/i.test(message)) {
          // Coluna ainda não existe no banco: a pré-visualização continua útil,
          // mas gravar seria enganoso — bloqueia a importação e explica.
          setSchemaPending(true);
        } else {
          throw error;
        }
      }
      const rows = deduped.rows.map((row) => ({ ...row, duplicate: existing.has(row.external_id) }));

      setPreview({
        fileName: file.name,
        format,
        fileHash: fingerprint([file.name, rows.length, rows[0]?.date ?? "", rows.at(-1)?.date ?? ""]),
        rows,
        warnings: parsed.warnings ?? [],
        removedInFile: deduped.removed,
      });
      toast.success(`${rows.length} lançamento(s) lido(s) de ${file.name}.`);
    } catch (error) {
      console.error("[importar]", error);
      toast.error(error instanceof Error ? error.message : "Falha ao ler o arquivo.");
    } finally {
      setParsing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const newRows = useMemo(() => preview?.rows.filter((row) => !row.duplicate) ?? [], [preview]);
  const dupRows = useMemo(() => preview?.rows.filter((row) => row.duplicate) ?? [], [preview]);
  const summary = useMemo(() => {
    if (!preview) return null;
    const existing = new Set(dupRows.map((row) => row.external_id));
    return summarizeRows(newRows, existing);
  }, [preview, newRows, dupRows]);

  function editRow(externalId: string, patch: Partial<NormalizedRow>) {
    setPreview((current) =>
      current
        ? {
            ...current,
            rows: current.rows.map((row) =>
              row.external_id === externalId ? { ...row, ...patch } : row,
            ),
          }
        : current,
    );
  }

  async function commit() {
    if (!preview || !currentEntityId) return;
    const rows = newRows.map((row) => ({
      external_id: row.external_id,
      date: row.date,
      amount: row.amount,
      description: row.description.slice(0, 180),
      type: row.type,
      category: row.category || "",
    }));
    if (rows.length === 0) {
      toast.info("Todos os lançamentos do arquivo já estavam no sistema.");
      return;
    }
    try {
      const result = await importStatement.mutateAsync({
        entity_id: currentEntityId,
        file_name: preview.fileName,
        format: preview.format,
        file_hash: preview.fileHash,
        rows,
      });
      toast.success(
        `${result.imported} lançamento(s) importado(s); ${result.duplicated} já existiam.`,
      );
      setPreview(null);
      batches.refetch();
    } catch {
      /* o hook já mostra o erro */
    }
  }

  /**
   * Conciliação simples: soma do que veio de extrato contra o que foi lançado à
   * mão na mesma janela de 90 dias. Divergência grande = falta importar arquivo
   * ou sobrou lançamento manual duplicado. Não é contabilidade: é sinal.
   */
  const reconciliation = useMemo(() => {
    const rows = (transactions.data ?? []).filter((row) => {
      if (!currentEntityId || row.entity_id !== currentEntityId) return false;
      if (!row.transaction_date) return false;
      const when = new Date(`${row.transaction_date}T00:00:00`);
      return Date.now() - when.getTime() <= 90 * 24 * 60 * 60 * 1000;
    });
    const sum = (list: typeof rows) =>
      list.reduce((total, row) => total + Number(row.amount ?? 0), 0);
    const imported = rows.filter((row) => row.import_batch_id);
    const manual = rows.filter((row) => !row.import_batch_id);
    return {
      importedCount: imported.length,
      importedTotal: sum(imported),
      manualCount: manual.length,
      manualTotal: sum(manual),
      divergence: sum(imported) - sum(manual),
    };
  }, [transactions.data, currentEntityId]);

  const shown = preview ? (onlyNew ? newRows : preview.rows) : [];
  const batchesMissing = batches.error && isMissingTableError(batches.error);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <UploadCloud className="h-6 w-6 text-primary" />
            Importar extrato
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            OFX do internet banking ou CSV/planilha. Nada entra duas vezes: o sistema reconhece
            lançamentos já existentes pelo identificador do banco (FITID) ou por uma impressão
            digital do lançamento.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Entidade</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={currentEntityId}
            onChange={(event) => {
              setEntityId(event.target.value);
              setPreview(null);
            }}
          >
            {(entities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>
                {entity.name}
              </option>
            ))}
            {!entities?.length ? <option value="">— sem entidades —</option> : null}
          </select>
        </label>
      </header>

      {batchesMissing ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Falta aplicar a migration de importação
          </p>
          <p className="mt-1 text-muted-foreground">
            Rode <code>supabase/migrations/20261030160000_imports.sql</code> no SQL Editor do
            projeto. Enquanto isso, a leitura do arquivo funciona, mas o histórico de lotes não.
          </p>
        </div>
      ) : null}

      {/* dropzone */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card/40",
        )}
      >
        {parsing ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : (
          <UploadCloud className="h-7 w-7 text-muted-foreground" />
        )}
        <p className="text-sm font-medium">Arraste o arquivo aqui ou selecione</p>
        <p className="text-xs text-muted-foreground">
          .ofx (Banco do Brasil, Itaú, Bradesco, Santander, Sicredi, Sicoob) · .csv / .txt com
          data, histórico e valor
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            <FileText className="h-4 w-4" /> Escolher arquivo
          </button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".ofx,.csv,.txt"
          className="hidden"
          onChange={(event) => void handleFiles(event.target.files)}
        />
      </div>

      {preview ? (
        <section className="space-y-3 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4">
            <div className="flex items-center gap-3">
              {preview.format === "ofx" ? (
                <FileText className="h-5 w-5 text-primary" />
              ) : (
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              )}
              <div>
                <p className="text-sm font-medium">{preview.fileName}</p>
                <p className="text-xs text-muted-foreground">
                  {preview.rows.length} lançamentos · {preview.format.toUpperCase()}
                  {summary?.periodStart
                    ? ` · ${dateBr(summary.periodStart)} a ${dateBr(summary.periodEnd!)}`
                    : ""}
                  {preview.removedInFile > 0
                    ? ` · ${preview.removedInFile} repetido(s) dentro do próprio arquivo`
                    : ""}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> {newRows.length} novas
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600">
                <Copy className="h-3.5 w-3.5" /> {dupRows.length} já existentes
              </span>
              <button
                type="button"
                onClick={() => setOnlyNew((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium hover:bg-accent"
              >
                <Filter className="h-3.5 w-3.5" />
                {onlyNew ? "Ver tudo" : "Ver só novas"}
              </button>
              <button
                type="button"
                onClick={() => void commit()}
                disabled={importStatement.isPending || newRows.length === 0 || schemaPending}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {importStatement.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Importar {newRows.length}
              </button>
            </div>
          </div>

          {schemaPending ? (
            <p className="mx-4 rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
              As colunas de importação ainda não existem neste banco. Aplique{" "}
              <code>20261030160000_imports.sql</code> para liberar a gravação — a leitura do arquivo
              já está validada acima.
            </p>
          ) : null}

          {preview.warnings.length > 0 ? (
            <ul className="mx-4 list-inside list-disc rounded-md bg-amber-500/10 p-3 text-xs text-amber-700">
              {preview.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="max-h-[440px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Data</th>
                  <th className="px-4 py-2">Descrição</th>
                  <th className="px-4 py-2">Categoria</th>
                  <th className="px-4 py-2 text-right">Valor</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr
                    key={row.external_id}
                    className={cn(
                      "border-t border-border/60",
                      row.duplicate && "bg-amber-500/5 text-muted-foreground",
                    )}
                  >
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums">{dateBr(row.date)}</td>
                    <td className="max-w-[320px] truncate px-4 py-2" title={row.description}>
                      {row.description}
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.category}
                        onChange={(event) =>
                          editRow(row.external_id, { category: event.target.value })
                        }
                        disabled={row.duplicate}
                        className="h-8 rounded-md border border-input bg-background px-1.5 text-xs disabled:opacity-60"
                      >
                        {[...new Set([row.category, ...CATEGORIES])].filter(Boolean).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-4 py-2 text-right tabular-nums",
                        row.type === "income" ? "text-emerald-600" : "text-rose-600",
                      )}
                    >
                      {row.type === "income" ? "+" : "−"} {brl(row.amount)}
                    </td>
                    <td className="px-4 py-2">
                      {row.duplicate ? (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700">
                          já existe
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-700">
                          nova
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum lançamento novo neste arquivo — tudo já está no sistema.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* conciliação */}
      <section className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4">
        <div className="md:col-span-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Conciliação dos últimos 90 dias</h2>
          <span className="text-xs text-muted-foreground">
            extrato importado × lançamentos manuais
          </span>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Do extrato</p>
          <p className="text-lg font-semibold tabular-nums">{brl(reconciliation.importedTotal)}</p>
          <p className="text-xs text-muted-foreground">{reconciliation.importedCount} lançamentos</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Manuais</p>
          <p className="text-lg font-semibold tabular-nums">{brl(reconciliation.manualTotal)}</p>
          <p className="text-xs text-muted-foreground">{reconciliation.manualCount} lançamentos</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Divergência</p>
          <p
            className={cn(
              "text-lg font-semibold tabular-nums",
              Math.abs(reconciliation.divergence) > 0 ? "text-amber-600" : "text-emerald-600",
            )}
          >
            {brl(reconciliation.divergence)}
          </p>
          <p className="text-xs text-muted-foreground">extrato − manual</p>
        </div>
        <div className="text-xs text-muted-foreground">
          Divergência relevante costuma significar extrato faltando ou lançamento manual duplicado.
        </div>
      </section>

      {/* histórico */}
      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Importações recentes</h2>
          <span className="text-xs text-muted-foreground">Desfazer remove só o que o lote criou</span>
        </div>
        {batches.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (batches.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum arquivo importado ainda.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Arquivo</th>
                  <th className="py-2 pr-4">Formato</th>
                  <th className="py-2 pr-4">Período</th>
                  <th className="py-2 pr-4 text-right">Novos</th>
                  <th className="py-2 pr-4 text-right">Duplicados</th>
                  <th className="py-2 pr-4">Quando</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(batches.data ?? []).map((batch) => (
                  <tr key={batch.id} className="border-t border-border/60">
                    <td className="max-w-[240px] truncate py-2 pr-4" title={batch.file_name}>
                      {batch.file_name}
                    </td>
                    <td className="py-2 pr-4 uppercase text-xs text-muted-foreground">
                      {batch.format}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs text-muted-foreground">
                      {batch.period_start ? dateBr(batch.period_start) : "—"} a{" "}
                      {batch.period_end ? dateBr(batch.period_end) : "—"}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-emerald-600">
                      {batch.rows_imported}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-amber-600">
                      {batch.rows_duplicated}
                    </td>
                    <td className="whitespace-nowrap py-2 pr-4 text-xs text-muted-foreground">
                      {batch.created_at
                        ? new Date(batch.created_at).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Desfazer a importação de "${batch.file_name}"? Os ${batch.rows_imported} lançamentos criados por ela serão removidos.`,
                            )
                          )
                            return;
                          deleteBatch.mutate({ id: batch.id });
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-accent"
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Desfazer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
