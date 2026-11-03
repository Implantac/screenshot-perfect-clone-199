/**
 * Trilha de auditoria encadeada — leitura e emissão de âncoras (wave 20).
 *
 * O app não assina nada: quem assina é o servidor, com `AUDIT_SIGNING_SECRET`.
 * Sem o segredo, a âncora é emitida **sem assinatura** e a tela declara a
 * pendência — assinatura falsa seria pior que assinatura ausente.
 *
 * A verificação completa (elo + sequência + conteúdo) roda no cliente sobre o
 * texto canônico devolvido pela view `audit_logs_chain`; aqui só se busca dado.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildAnchor,
  buildExportPackage,
  verifyAnchorSignature,
  verifyChain,
  type AuditManifest,
  type ChainEntry,
  type SignedAnchor,
} from "@/lib/audit/chain";

const authed = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

const chainInput = z.object({
  limit: z.coerce.number().int().min(1).max(2000).default(300),
  ownerOnly: z.boolean().default(false),
});

export type AuditChainPayload = {
  entries: ChainEntry[];
  /** true quando a view ainda não existe (migration pendente). */
  migrationPending: string | null;
};

const MIGRATION = "20261030250000_audit_chain.sql";

function mapEntry(row: {
  sequence: number | null;
  owner_user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  user_id: string | null;
  created_at: string | null;
  prev_hash: string | null;
  entry_hash: string | null;
  payload_text: string | null;
}): ChainEntry {
  return {
    sequence: Number(row.sequence ?? 0),
    ownerUserId: row.owner_user_id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    userId: row.user_id,
    createdAt: row.created_at ?? "",
    prevHash: row.prev_hash ?? "",
    entryHash: row.entry_hash ?? "",
    payloadText: row.payload_text,
  };
}

export const getAuditChain = authed
  .inputValidator(chainInput)
  .handler(async ({ data, context }): Promise<AuditChainPayload> => {
    let query = context.supabase
      .from("audit_logs_chain")
      .select("sequence, owner_user_id, action, table_name, record_id, user_id, created_at, prev_hash, entry_hash, payload_text")
      .order("sequence", { ascending: false })
      .limit(data.limit);

    if (data.ownerOnly) {
      const userId = (context.claims as { sub?: string })?.sub;
      if (userId) query = query.eq("owner_user_id", userId);
    }

    const { data: rows, error } = await query;

    if (error) {
      // View ausente = migration da wave 20 não aplicada.
      if (/does not exist|schema cache|relation|column/i.test(error.message)) {
        return { entries: [], migrationPending: MIGRATION };
      }
      throw new Error(error.message);
    }

    const entries = (rows ?? []).map(mapEntry);
    // Devolve em ordem cronológica: é assim que a verificação e a tela pensam.
    entries.sort((a, b) => a.sequence - b.sequence);
    return { entries, migrationPending: null };
  });

export const issueAuditAnchor = authed
  .inputValidator(
    z.object({
      limit: z.coerce.number().int().min(1).max(2000).default(300),
      periodFrom: z.string().trim().max(40).optional().or(z.literal("")),
      periodTo: z.string().trim().max(40).optional().or(z.literal("")),
    }),
  )
  .handler(async ({ data, context }): Promise<{ anchor: SignedAnchor; stored: boolean; note?: string }> => {
    const { data: rows, error } = await context.supabase
      .from("audit_logs_chain")
      .select("sequence, owner_user_id, action, table_name, record_id, user_id, created_at, prev_hash, entry_hash, payload_text")
      .order("sequence", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);

    const entries = (rows ?? []).map(mapEntry).sort((a, b) => a.sequence - b.sequence);
    const userId = (context.claims as { sub?: string })?.sub ?? null;

    const anchor = buildAnchor({
      entries,
      generatedAt: new Date().toISOString(),
      periodFrom: data.periodFrom || null,
      periodTo: data.periodTo || null,
      ownerUserId: userId,
      secret: process.env.AUDIT_SIGNING_SECRET ?? null,
    });

    if (!userId) throw new Error("Sessão sem usuário: não é possível emitir âncora.");

    const { error: insertError } = await context.supabase.from("audit_anchors").insert({
      owner_user_id: userId,
      period_from: anchor.manifest.periodFrom,
      period_to: anchor.manifest.periodTo,
      entries: anchor.manifest.entries,
      head_sequence: anchor.manifest.headSequence,
      head_hash: anchor.manifest.headHash,
      chain_hash: anchor.manifest.chainHash,
      manifest_hash: anchor.manifestHash,
      signature: anchor.signature,
      signature_algorithm: anchor.signatureAlgorithm,
      manifest: anchor.manifest as unknown as never,
    });

    return {
      anchor,
      stored: !insertError,
      note: insertError
        ? `Âncora calculada, mas não foi possível gravar: ${insertError.message}`
        : anchor.signaturePending
          ? "Âncora gravada sem assinatura: configure AUDIT_SIGNING_SECRET no servidor para assinar com HMAC-SHA256."
          : undefined,
    };
  });

export type StoredAnchor = {
  id: string;
  createdAt: string;
  entries: number;
  headSequence: number | null;
  headHash: string | null;
  chainHash: string;
  manifestHash: string;
  signature: string | null;
  signatureAlgorithm: string | null;
  manifest: AuditManifest;
  /** Recalculado no servidor com o segredo atual. */
  signatureValid: boolean | null;
};

export const getAuditAnchors = authed
  .inputValidator(z.object({ limit: z.coerce.number().int().min(1).max(200).default(20) }))
  .handler(async ({ data, context }): Promise<{ anchors: StoredAnchor[]; migrationPending: string | null }> => {
    const { data: rows, error } = await context.supabase
      .from("audit_anchors")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) {
      if (/does not exist|schema cache|relation/i.test(error.message)) {
        return { anchors: [], migrationPending: MIGRATION };
      }
      throw new Error(error.message);
    }

    const secret = process.env.AUDIT_SIGNING_SECRET ?? null;

    return {
      anchors: (rows ?? []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        entries: Number(row.entries ?? 0),
        headSequence: row.head_sequence === null ? null : Number(row.head_sequence),
        headHash: row.head_hash,
        chainHash: row.chain_hash,
        manifestHash: row.manifest_hash,
        signature: row.signature,
        signatureAlgorithm: row.signature_algorithm,
        manifest: row.manifest as unknown as AuditManifest,
        signatureValid: row.signature ? verifyAnchorSignature({ manifestHash: row.manifest_hash, signature: row.signature }, secret) : null,
      })),
      migrationPending: null,
    };
  });

/**
 * Pacote completo para o auditor: manifest assinado + janela de entradas.
 * Devolvido como JSON serializável (o download acontece na tela).
 */
export const exportAuditPackage = authed
  .inputValidator(z.object({ limit: z.coerce.number().int().min(1).max(2000).default(300) }))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("audit_logs_chain")
      .select("sequence, owner_user_id, action, table_name, record_id, user_id, created_at, prev_hash, entry_hash, payload_text")
      .order("sequence", { ascending: false })
      .limit(data.limit);

    if (error) throw new Error(error.message);

    const entries = (rows ?? []).map(mapEntry).sort((a, b) => a.sequence - b.sequence);
    const userId = (context.claims as { sub?: string })?.sub ?? null;

    const anchor = buildAnchor({
      entries,
      generatedAt: new Date().toISOString(),
      ownerUserId: userId,
      secret: process.env.AUDIT_SIGNING_SECRET ?? null,
    });

    const verification = verifyChain(entries);
    return {
      package: buildExportPackage(anchor, entries),
      verification,
    };
  });
