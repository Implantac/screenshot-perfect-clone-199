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
} from "@/lib/api/crud.functions";
import { seedDemo } from "@/lib/api/demo.functions";
import type { SeedResult } from "@/lib/demo/seedDemo";
import type {
  AssetInput,
  AssetUpdateInput,
  EntityInput,
  RiskInput,
  RiskUpdateInput,
  DocumentInput,
  TransactionInput,
  ActionPlanUpdateInput,
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
