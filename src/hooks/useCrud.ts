/**
 * Hooks de escrita: cada mutação chama a server function autenticada e invalida
 * as queries afetadas. A UI nunca fala com o Supabase para gravar — só o servidor.
 */
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createAsset,
  updateAsset,
  deleteAsset,
  createEntity,
  updateEntity,
  deleteEntity,
  createRisk,
  updateRisk,
  resolveRisk,
  deleteRisk,
  createDocument,
  deleteDocument,
  createTransaction,
  updateActionPlan,
  resolveInsight,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  toggleSupplierStatus,
  createLegalCase,
  updateLegalCase,
  deleteLegalCase,
  createMember,
  updateMember,
  deleteMember,
  upsertShare,
  deleteShare,
  updateDocument,
  createAccount,
  deleteAccount,
  createPosition,
  updatePosition,
  deletePosition,
  createCashFlow,
  deleteCashFlow,
  upsertSnapshot,
  rebuildSnapshots,
  createTaxScenario,
  deleteTaxScenario,
  importStatement,
  deleteImportBatch,
} from "@/lib/api/crud.functions";
import { seedDemo } from "@/lib/api/demo.functions";
import type { SeedResult } from "@/lib/demo/seedDemo";
import type { ImportResult } from "@/lib/import/normalize";
import type {
  AssetInput,
  AssetUpdateInput,
  EntityInput,
  RiskInput,
  RiskUpdateInput,
  DocumentInput,
  TransactionInput,
  ActionPlanUpdateInput,
  SupplierInput,
  LegalCaseInput,
  MemberInput,
  ShareInput,
  DocumentUpdateInput,
  supplierUpdateSchema,
  legalCaseUpdateSchema,
  memberUpdateSchema,
  accountInputSchema,
  positionInputSchema,
  positionUpdateSchema,
  importStatementSchema,
  cashFlowInputSchema,
  snapshotInputSchema,
  taxScenarioInputSchema,
} from "@/lib/validation/schemas";
import type { z } from "zod";
import type { actionPlanUpdateSchema } from "@/lib/validation/schemas";

type IdInput = { id: string };

/** Invalida as queries informadas e devolve um toast de sucesso/erro. */
function useInvalidatingMutation<TInput, TResult>(
  mutationFn: (args: { data: TInput }) => Promise<TResult>,
  keys: QueryKey[],
  messages: { success: string; error: string },
) {
  const queryClient = useQueryClient();
  return useMutation<TResult, Error, TInput>({
    mutationFn: (data) => mutationFn({ data }),
    onSuccess: () => {
      for (const key of keys) queryClient.invalidateQueries({ queryKey: key });
      toast.success(messages.success);
    },
    onError: (error) => {
      console.error("[crud]", error);
      toast.error(error.message || messages.error);
    },
  });
}

const ASSET_KEYS: QueryKey[] = [["assets"], ["entities"], ["risks"], ["jarvis-insights"]];

export const useCreateAsset = () =>
  useInvalidatingMutation<AssetInput, unknown>(createAsset, ASSET_KEYS, {
    success: "Ativo cadastrado.",
    error: "Não foi possível cadastrar o ativo.",
  });

export const useUpdateAsset = () =>
  useInvalidatingMutation<AssetUpdateInput, unknown>(updateAsset, ASSET_KEYS, {
    success: "Ativo atualizado.",
    error: "Não foi possível atualizar o ativo.",
  });

export const useDeleteAsset = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteAsset, ASSET_KEYS, {
    success: "Ativo removido.",
    error: "Não foi possível remover o ativo.",
  });

const ENTITY_KEYS: QueryKey[] = [["entities"], ["assets"], ["risks"], ["jarvis-health"]];

export const useCreateEntity = () =>
  useInvalidatingMutation<EntityInput, unknown>(createEntity, ENTITY_KEYS, {
    success: "Holding criada.",
    error: "Não foi possível criar a holding.",
  });

export const useUpdateEntity = () =>
  useInvalidatingMutation<EntityInput & IdInput, unknown>(updateEntity, ENTITY_KEYS, {
    success: "Holding atualizada.",
    error: "Não foi possível atualizar a holding.",
  });

export const useDeleteEntity = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteEntity, ENTITY_KEYS, {
    success: "Holding removida.",
    error: "Não foi possível remover a holding.",
  });

const RISK_KEYS: QueryKey[] = [["risks"], ["jarvis-insights"], ["jarvis-health"]];

export const useCreateRisk = () =>
  useInvalidatingMutation<RiskInput, unknown>(createRisk, RISK_KEYS, {
    success: "Risco registrado.",
    error: "Não foi possível registrar o risco.",
  });

export const useUpdateRisk = () =>
  useInvalidatingMutation<RiskUpdateInput, unknown>(updateRisk, RISK_KEYS, {
    success: "Risco atualizado.",
    error: "Não foi possível atualizar o risco.",
  });

export const useResolveRisk = () =>
  useInvalidatingMutation<IdInput, unknown>(resolveRisk, RISK_KEYS, {
    success: "Risco marcado como resolvido.",
    error: "Não foi possível resolver o risco.",
  });

export const useDeleteRisk = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteRisk, RISK_KEYS, {
    success: "Risco removido.",
    error: "Não foi possível remover o risco.",
  });

const DOC_KEYS: QueryKey[] = [["documents"], ["risks"]];

export const useCreateDocument = () =>
  useInvalidatingMutation<DocumentInput, unknown>(createDocument, DOC_KEYS, {
    success: "Documento arquivado no cofre digital.",
    error: "Não foi possível arquivar o documento.",
  });

export const useDeleteDocument = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteDocument, DOC_KEYS, {
    success: "Documento removido.",
    error: "Não foi possível remover o documento.",
  });

export const useCreateTransaction = () =>
  useInvalidatingMutation<TransactionInput, unknown>(createTransaction, [["transactions"]], {
    success: "Lançamento registrado.",
    error: "Não foi possível registrar o lançamento.",
  });

export const useUpdateActionPlan = () =>
  useInvalidatingMutation<
    z.input<typeof actionPlanUpdateSchema> & { status: ActionPlanUpdateInput["status"] },
    unknown
  >(updateActionPlan, [["jarvis-action-plans"], ["jarvis-insights"]], {
    success: "Plano de ação atualizado.",
    error: "Não foi possível atualizar o plano.",
  });

export const useResolveInsight = () =>
  useInvalidatingMutation<IdInput, unknown>(
    resolveInsight,
    [["jarvis-insights"], ["jarvis-health"]],
    {
      success: "Insight marcado como tratado.",
      error: "Não foi possível atualizar o insight.",
    },
  );

/** Botão "Popular demonstração" — cria o dataset no tenant do usuário. */
export const useSeedDemo = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (force: boolean): Promise<SeedResult> => seedDemo({ data: { force } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      if (result.seeded) toast.success(result.message);
      else toast.info(result.message);
    },
    onError: (error: Error) => {
      console.error("[seed]", error);
      toast.error(error.message || "Falha ao popular a demonstração.");
    },
  });
};

const SUPPLIER_KEYS: QueryKey[] = [["suppliers"], ["audit_logs"]];

export const useCreateSupplier = () =>
  useInvalidatingMutation<SupplierInput, unknown>(createSupplier, SUPPLIER_KEYS, {
    success: "Fornecedor cadastrado.",
    error: "Não foi possível cadastrar o fornecedor.",
  });

export const useUpdateSupplier = () =>
  useInvalidatingMutation<z.input<typeof supplierUpdateSchema>, unknown>(updateSupplier, SUPPLIER_KEYS, {
    success: "Fornecedor atualizado.",
    error: "Não foi possível atualizar o fornecedor.",
  });

export const useToggleSupplierStatus = () =>
  useInvalidatingMutation<
    { id: string; status: "homologado" | "em_analise" | "risco_critico" | "inativo" },
    unknown
  >(toggleSupplierStatus, SUPPLIER_KEYS, {
    success: "Status do fornecedor atualizado.",
    error: "Não foi possível alterar o status.",
  });

export const useDeleteSupplier = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteSupplier, SUPPLIER_KEYS, {
    success: "Fornecedor removido.",
    error: "Não foi possível remover o fornecedor.",
  });

const LEGAL_KEYS: QueryKey[] = [["legal_cases"], ["audit_logs"]];

export const useCreateLegalCase = () =>
  useInvalidatingMutation<LegalCaseInput, unknown>(createLegalCase, LEGAL_KEYS, {
    success: "Processo registrado.",
    error: "Não foi possível registrar o processo.",
  });

export const useUpdateLegalCase = () =>
  useInvalidatingMutation<z.input<typeof legalCaseUpdateSchema>, unknown>(updateLegalCase, LEGAL_KEYS, {
    success: "Processo atualizado.",
    error: "Não foi possível atualizar o processo.",
  });

export const useDeleteLegalCase = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteLegalCase, LEGAL_KEYS, {
    success: "Processo removido.",
    error: "Não foi possível remover o processo.",
  });

const MEMBER_KEYS: QueryKey[] = [["members"], ["entity_shares"], ["entities"], ["audit_logs"]];

export const useCreateMember = () =>
  useInvalidatingMutation<MemberInput, unknown>(createMember, MEMBER_KEYS, {
    success: "Sócio adicionado à estrutura.",
    error: "Não foi possível adicionar o sócio.",
  });

export const useUpdateMember = () =>
  useInvalidatingMutation<z.input<typeof memberUpdateSchema>, unknown>(updateMember, MEMBER_KEYS, {
    success: "Sócio atualizado.",
    error: "Não foi possível atualizar o sócio.",
  });

export const useDeleteMember = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteMember, MEMBER_KEYS, {
    success: "Sócio removido.",
    error: "Não foi possível remover o sócio.",
  });

export const useUpsertShare = () =>
  useInvalidatingMutation<ShareInput, unknown>(upsertShare, MEMBER_KEYS, {
    success: "Participação atualizada.",
    error: "Não foi possível atualizar a participação.",
  });

export const useDeleteShare = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteShare, MEMBER_KEYS, {
    success: "Participação removida.",
    error: "Não foi possível remover a participação.",
  });

export const useUpdateDocument = () =>
  useInvalidatingMutation<DocumentUpdateInput, unknown>(updateDocument, [["documents"], ["risks"]], {
    success: "Documento atualizado.",
    error: "Não foi possível atualizar o documento.",
  });

// ------------------------------------------------------------ custódia (wave 4)

const CUSTODY_KEYS: QueryKey[] = [
  ["positions"],
  ["accounts"],
  ["cash_flows"],
  ["portfolio_snapshots"],
  ["audit_logs"],
  ["transactions"],
  ["import_batches"],
];

export const useCreateAccount = () =>
  useInvalidatingMutation<z.input<typeof accountInputSchema>, unknown>(createAccount, CUSTODY_KEYS, {
    success: "Conta de custódia criada.",
    error: "Não foi possível criar a conta.",
  });

export const useDeleteAccount = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteAccount, CUSTODY_KEYS, {
    success: "Conta removida.",
    error: "Não foi possível remover a conta.",
  });

export const useCreatePosition = () =>
  useInvalidatingMutation<z.input<typeof positionInputSchema>, unknown>(createPosition, CUSTODY_KEYS, {
    success: "Posição lançada.",
    error: "Não foi possível lançar a posição.",
  });

export const useUpdatePosition = () =>
  useInvalidatingMutation<z.input<typeof positionUpdateSchema>, unknown>(updatePosition, CUSTODY_KEYS, {
    success: "Posição atualizada.",
    error: "Não foi possível atualizar a posição.",
  });

export const useDeletePosition = () =>
  useInvalidatingMutation<IdInput, unknown>(deletePosition, CUSTODY_KEYS, {
    success: "Posição removida.",
    error: "Não foi possível remover a posição.",
  });

export const useCreateCashFlow = () =>
  useInvalidatingMutation<z.input<typeof cashFlowInputSchema>, unknown>(createCashFlow, CUSTODY_KEYS, {
    success: "Fluxo registrado.",
    error: "Não foi possível registrar o fluxo.",
  });

export const useDeleteCashFlow = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteCashFlow, CUSTODY_KEYS, {
    success: "Fluxo removido.",
    error: "Não foi possível remover o fluxo.",
  });

export const useUpsertSnapshot = () =>
  useInvalidatingMutation<z.input<typeof snapshotInputSchema>, unknown>(upsertSnapshot, CUSTODY_KEYS, {
    success: "Fechamento salvo.",
    error: "Não foi possível salvar o fechamento.",
  });

export const useRebuildSnapshots = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entityId: string) => rebuildSnapshots({ data: { entity_id: entityId } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["portfolio_snapshots"] });
      toast.success(`Série reconstruída: ${result.count} fechamentos.`);
    },
    onError: (error: Error) => {
      console.error("[snapshots]", error);
      toast.error(error.message || "Não foi possível reconstruir a série.");
    },
  });
};

export const useCreateTaxScenario = () =>
  useInvalidatingMutation<z.input<typeof taxScenarioInputSchema>, unknown>(createTaxScenario, [["tax_scenarios"]], {
    success: "Cenário salvo.",
    error: "Não foi possível salvar o cenário.",
  });

export const useDeleteTaxScenario = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteTaxScenario, [["tax_scenarios"]], {
    success: "Cenário removido.",
    error: "Não foi possível remover o cenário.",
  });

// ------------------------------------------------------- importação (wave 5)

/** Importa um extrato OFX/CSV. Invalida transações e o histórico de lotes. */
export const useImportStatement = () =>
  useInvalidatingMutation<z.input<typeof importStatementSchema>, ImportResult>(importStatement, CUSTODY_KEYS, {
    success: "Extrato processado.",
    error: "Não foi possível importar o extrato.",
  });

export const useDeleteImportBatch = () =>
  useInvalidatingMutation<IdInput, unknown>(deleteImportBatch, CUSTODY_KEYS, {
    success: "Importação desfeita — lançamentos removidos.",
    error: "Não foi possível desfazer a importação.",
  });
