/**
 * Multi-family office (wave 22) — server functions do escritório.
 *
 * Duas pontas, de propósito:
 *
 *  A) **Escritório** (socio/gestor): cria o escritório, convida a equipe por
 *     e-mail, vê a consolidação agregada das famílias que lhe deram acesso.
 *  B) **Família** (qualquer tenant): consente usando o slug do escritório,
 *     define com que nome aparece no consolidado e pode revogar.
 *
 * O ponto sensível é o consentimento: `office_clients` só aceita INSERT quando
 * `owner_user_id = auth.uid()` — nem sócio do escritório cria vínculo no lugar da
 * família. A escrita aqui passa pela sessão do usuário (RLS ligado), sem service
 * role: se a policy barrar, o erro aparece em vez de virar acesso silencioso.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  officeCreateSchema,
  officeGrantSchema,
  officeInviteSchema,
  officeMemberUpdateSchema,
  officeRevokeSchema,
} from "@/lib/validation/schemas";
import {
  buildAllConsolidations,
  type OfficeConsolidation,
  type OfficeFamilyRow,
} from "@/lib/office/consolidate";

export type OfficeSummary = {
  id: string;
  name: string;
  slug: string | null;
  role: string | null;
  members: number;
  families: number;
};

export type OfficeMemberView = {
  id: string;
  officeId: string;
  email: string | null;
  userId: string | null;
  role: string;
  status: string;
  joined: boolean;
};

export type OfficeFamilyLink = {
  id: string;
  officeId: string;
  officeName: string;
  label: string;
  status: string;
  grantedAt: string | null;
};

export type OfficeWorkspace = {
  /** Escritórios de que faço parte (equipe) e meu papel em cada um. */
  offices: OfficeSummary[];
  /** Equipes dos escritórios que administro. */
  members: OfficeMemberView[];
  /** Vínculos em que EU sou a família (posso revogar). */
  myGrants: OfficeFamilyLink[];
  /** Consolidados agregados das famílias que concederam acesso. */
  consolidations: OfficeConsolidation[];
  /** Convites reivindicados nesta sessão (por e-mail). */
  claimedInvites: number;
  /** Migration 20261030270000 aplicada? */
  available: boolean;
};

const isMigrationMissing = (message: string) =>
  /does not exist|schema cache|Could not find the function|function .* does not exist/i.test(message);

export const getOfficeWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OfficeWorkspace> => {
    const supabase = context.supabase;
    const empty: OfficeWorkspace = {
      offices: [],
      members: [],
      myGrants: [],
      consolidations: [],
      claimedInvites: 0,
      available: false,
    };

    // Convites por e-mail viram vínculo na primeira sessão. Se a função não
    // existir (migration pendente), seguimos sem quebrar a tela.
    let claimedInvites = 0;
    const claim = await supabase.rpc("claim_office_invites" as never);
    if (claim.error) {
      if (isMigrationMissing(claim.error.message)) return { ...empty, claimedInvites: 0 };
      console.error("[MFO] falha ao reivindicar convites:", claim.error.message);
    } else {
      claimedInvites = Number(claim.data ?? 0);
    }

    const [memberships, grants] = await Promise.all([
      supabase.from("office_members").select("office_id, role, status, id, email, user_id"),
      supabase.from("office_clients").select("id, office_id, label, status, granted_at, owner_user_id"),
    ]);

    const membershipRows = (memberships.data ?? []) as {
      office_id: string;
      role: string;
      status: string;
      id: string;
      email: string | null;
      user_id: string | null;
    }[];

    const officeIds = Array.from(new Set(membershipRows.map((row) => row.office_id)));

    const officesQuery = officeIds.length
      ? await supabase.from("offices").select("id, name, slug").in("id", officeIds)
      : { data: [], error: null };

    // Contagens por escritório (famílias vinculadas e tamanho da equipe).
    const familyCounts = new Map<string, number>();
    for (const grant of grants.data ?? []) {
      if (grant.status === "encerrado") continue;
      familyCounts.set(grant.office_id, (familyCounts.get(grant.office_id) ?? 0) + 1);
    }
    const memberCounts = new Map<string, number>();
    for (const row of membershipRows) {
      memberCounts.set(row.office_id, (memberCounts.get(row.office_id) ?? 0) + 1);
    }

    const offices: OfficeSummary[] = (officesQuery.data ?? []).map((office) => {
      const mine = membershipRows.find((row) => row.office_id === office.id);
      return {
        id: office.id,
        name: office.name,
        slug: office.slug,
        role: mine?.role ?? null,
        members: memberCounts.get(office.id) ?? 0,
        families: familyCounts.get(office.id) ?? 0,
      };
    });

    // Equipes: só dos escritórios em que administro (o RLS já limita; aqui
    // evitamos mostrar convite alheio a quem é apenas analista).
    const adminOfficeIds = new Set(
      membershipRows
        .filter((row) => row.role === "socio" || row.role === "gestor")
        .map((row) => row.office_id),
    );

    let members: OfficeMemberView[] = [];
    if (adminOfficeIds.size > 0) {
      const team = await supabase
        .from("office_members")
        .select("id, office_id, email, user_id, role, status")
        .in("office_id", Array.from(adminOfficeIds));
      members = (team.data ?? []).map((row) => ({
        id: row.id,
        officeId: row.office_id,
        email: row.email,
        userId: row.user_id,
        role: row.role,
        status: row.status,
        joined: row.user_id !== null,
      }));
    }

    // Vínculos em que EU sou a família.
    const myGrants: OfficeFamilyLink[] = (grants.data ?? [])
      .filter((grant) => grant.owner_user_id === context.userId)
      .map((grant) => ({
        id: grant.id,
        officeId: grant.office_id,
        officeName: offices.find((office) => office.id === grant.office_id)?.name ?? "Escritório",
        label: grant.label,
        status: grant.status,
        grantedAt: grant.granted_at,
      }));

    // Consolidado: RPC agregada (nunca linhas cruas de cliente).
    const rows = await supabase.rpc("office_consolidation" as never);
    let consolidations: OfficeConsolidation[] = [];
    if (rows.error) {
      if (!isMigrationMissing(rows.error.message)) {
        console.error("[MFO] falha na consolidação:", rows.error.message);
      }
    } else {
      consolidations = buildAllConsolidations((rows.data ?? []) as unknown as OfficeFamilyRow[]);
    }

    return {
      offices,
      members,
      myGrants,
      consolidations,
      claimedInvites,
      available: true,
    };
  });

export const createOffice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(officeCreateSchema)
  .handler(async ({ data, context }): Promise<OfficeSummary> => {
    const supabase = context.supabase;

    const slug =
      data.slug?.toLowerCase() ??
      data.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40);

    const office = await supabase
      .from("offices")
      .insert({ name: data.name, slug, document: data.document ?? null, created_by: context.userId })
      .select("id, name, slug")
      .single();

    if (office.error || !office.data) {
      throw new Error(
        isMigrationMissing(office.error?.message ?? "")
          ? "A migration 20261030270000 (multi-family office) ainda não foi aplicada."
          : `Não consegui criar o escritório: ${office.error?.message}`,
      );
    }

    // Quem cria entra como sócio — é o que a policy de INSERT exige.
    const member = await supabase.from("office_members").insert({
      office_id: office.data.id,
      user_id: context.userId,
      email: null,
      role: "socio",
      status: "ativo",
      invited_by: context.userId,
    });
    if (member.error) {
      throw new Error(`Escritório criado, mas não consegui registrar você como sócio: ${member.error.message}`);
    }

    return {
      id: office.data.id,
      name: office.data.name,
      slug: office.data.slug,
      role: "socio",
      members: 1,
      families: 0,
    };
  });

export const inviteOfficeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(officeInviteSchema)
  .handler(async ({ data, context }): Promise<OfficeMemberView> => {
    const { data: inserted, error } = await context.supabase
      .from("office_members")
      .insert({
        office_id: data.officeId,
        user_id: null,
        email: data.email.toLowerCase(),
        role: data.role,
        status: "convidado",
        invited_by: context.userId,
      })
      .select("id, office_id, email, user_id, role, status")
      .single();

    if (error || !inserted) {
      if (isMigrationMissing(error?.message ?? "")) {
        throw new Error("A migration 20261030270000 (multi-family office) ainda não foi aplicada.");
      }
      const duplicate = /duplicate key|unique/i.test(error?.message ?? "");
      throw new Error(
        duplicate
          ? "Essa pessoa já está na equipe deste escritório."
          : `Não consegui convidar: ${error?.message}`,
      );
    }

    return {
      id: inserted.id,
      officeId: inserted.office_id,
      email: inserted.email,
      userId: inserted.user_id,
      role: inserted.role,
      status: inserted.status,
      joined: false,
    };
  });

export const updateOfficeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(officeMemberUpdateSchema)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const patch: { role?: string; status?: string } = {};
    if (data.role) patch.role = data.role;
    if (data.status) patch.status = data.status;

    const { error } = await context.supabase
      .from("office_members")
      .update(patch)
      .eq("id", data.memberId);
    if (error) throw new Error(`Não consegui atualizar o membro: ${error.message}`);
    return { ok: true };
  });

export const grantOfficeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(officeGrantSchema)
  .handler(async ({ data, context }): Promise<OfficeFamilyLink> => {
    const lookup = await context.supabase.rpc("office_lookup" as never, { _slug: data.officeSlug } as never);
    if (lookup.error) {
      throw new Error(
        isMigrationMissing(lookup.error.message)
          ? "A migration 20261030270000 (multi-family office) ainda não foi aplicada."
          : `Não consegui consultar o escritório: ${lookup.error.message}`,
      );
    }
    const office = (lookup.data as unknown as { id: string; name: string }[] | null)?.[0];
    if (!office) throw new Error("Escritório não encontrado. Confira o identificador com o seu assessor.");

    // O WITH CHECK da policy exige owner_user_id = auth.uid(): consentimento é
    // sempre da própria família, mesmo que a chamada venha do escritório.
    const { data: created, error } = await context.supabase
      .from("office_clients")
      .insert({
        office_id: office.id,
        owner_user_id: context.userId,
        label: data.label,
        status: "ativo",
        granted_by: context.userId,
      })
      .select("id, office_id, label, status, granted_at")
      .single();

    if (error || !created) {
      const duplicate = /duplicate key|unique/i.test(error?.message ?? "");
      throw new Error(
        duplicate
          ? "Você já concedeu acesso a este escritório. Revogue o vínculo anterior para criar outro."
          : `Não consegui conceder o acesso: ${error?.message}`,
      );
    }

    return {
      id: created.id,
      officeId: created.office_id,
      officeName: office.name,
      label: created.label,
      status: created.status,
      grantedAt: created.granted_at,
    };
  });

export const revokeOfficeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(officeRevokeSchema)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    // Revogação é registro, não exclusão: status vira 'encerrado' e a data fica.
    const { error } = await context.supabase
      .from("office_clients")
      .update({ status: "encerrado", revoked_at: new Date().toISOString() })
      .eq("id", data.grantId);
    if (error) throw new Error(`Não consegui revogar: ${error.message}`);
    return { ok: true };
  });
