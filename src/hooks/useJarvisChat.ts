/**
 * Estado de conversa do JARVIS, compartilhado entre o chat de página inteira e o
 * drawer lateral. A resposta vem sempre do servidor (askJarvis), que decide entre
 * LLM configurado e analista local — o cliente nunca inventa conteúdo.
 */
import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyJarvisProposal,
  askJarvis,
  decideJarvisProposal,
  getJarvisStatus,
  getPortfolioBriefing,
  listJarvisProposals,
} from "@/lib/api/jarvis.functions";
import type { JarvisProposalView, JarvisProvider, JarvisToolTrace } from "@/lib/jarvis/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: JarvisProvider;
  sources?: { label: string; value: string }[];
  followUps?: string[];
  /** Ferramentas que o agente executou para responder. */
  toolCalls?: JarvisToolTrace[];
  /** Propostas criadas nesta resposta (pendentes de aprovação). */
  proposals?: JarvisProposalView[];
  warnings?: string[];
};

const GREETING: ChatMessage = {
  id: "greeting",
  role: "assistant",
  content:
    "Protocolos JARVIS em operação. Estou lendo seu patrimônio, seus riscos e a janela de vencimento de documentos. Pergunte à vontade — toda resposta é ancorada nos dados do seu tenant.",
  followUps: [
    "Quais são meus riscos críticos?",
    "Quais documentos vencem nos próximos 60 dias?",
    "Resumo do patrimônio",
    "Qual meu VaR em 21 dias?",
    "E se os imóveis caírem 20%?",
  ],
};

let counter = 0;
const nextId = () => `m-${Date.now()}-${counter++}`;

export function useJarvisChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [isThinking, setIsThinking] = useState(false);
  const [busyProposal, setBusyProposal] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["jarvis-status"],
    queryFn: () => getJarvisStatus(),
    staleTime: 5 * 60_000,
  });

  const briefingQuery = useQuery({
    queryKey: ["jarvis-briefing"],
    queryFn: () => getPortfolioBriefing(),
    staleTime: 30_000,
  });

  /** Propostas persistidas: sobrevivem ao refresh e aparecem após a resposta. */
  const proposalsQuery = useQuery({
    queryKey: ["jarvis-proposals"],
    queryFn: () => listJarvisProposals(),
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: (payload: {
      message: string;
      history: { role: "user" | "assistant"; content: string }[];
    }) => askJarvis({ data: payload }),
    onSuccess: (answer) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: answer.answer,
          provider: answer.provider,
          sources: answer.sources,
          followUps: answer.followUps,
          toolCalls: answer.toolCalls,
          proposals: answer.proposals,
          warnings: answer.warnings,
        },
      ]);
      briefingQuery.refetch();
      if ((answer.proposals?.length ?? 0) > 0) proposalsQuery.refetch();
    },
    onError: (error: Error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: `Não consegui concluir a análise: ${error.message}. Tente novamente em instantes.`,
        },
      ]);
    },
    onSettled: () => setIsThinking(false),
  });

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || mutation.isPending) return;

      // Histórico enviado ao servidor: últimas 8 mensagens reais (sem o greeting).
      const history = messages
        .filter((m) => m.id !== "greeting")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { id: nextId(), role: "user", content: message }]);
      setIsThinking(true);
      mutation.mutate({ message, history });
    },
    [messages, mutation],
  );

  /** Aprovar/rejeitar — chamado pelo cartão de proposta. */
  const decide = useCallback(
    async (id: string, decision: "approved" | "rejected") => {
      setBusyProposal(id);
      try {
        const updated = await decideJarvisProposal({ data: { id, decision } });
        // Atualiza a cópia dentro das mensagens e a lista lateral.
        setMessages((prev) =>
          prev.map((message) =>
            message.proposals
              ? {
                  ...message,
                  proposals: message.proposals.map((proposal) =>
                    proposal.id === id ? { ...proposal, status: updated.status } : proposal,
                  ),
                }
              : message,
          ),
        );
        await proposalsQuery.refetch();
      } finally {
        setBusyProposal(null);
      }
    },
    [proposalsQuery],
  );

  /** Aplicar o efeito aprovado (grava no módulo, com trilha). */
  const apply = useCallback(
    async (id: string) => {
      setBusyProposal(id);
      try {
        const result = await applyJarvisProposal({ data: { id } });
        const nextStatus = result.proposal?.status ?? (result.ok ? "applied" : "failed");
        setMessages((prev) => [
          ...prev.map((message) =>
            message.proposals
              ? {
                  ...message,
                  proposals: message.proposals.map((proposal) =>
                    proposal.id === id ? { ...proposal, status: nextStatus } : proposal,
                  ),
                }
              : message,
          ),
          {
            id: nextId(),
            role: "assistant",
            content: result.ok
              ? `Proposta aplicada: ${result.message} Registro criado e evento gravado na trilha de auditoria.`
              : `Não consegui aplicar a proposta: ${result.message} A proposta ficou marcada como falha e você pode revisá-la.`,
          },
        ]);
        await Promise.all([proposalsQuery.refetch(), briefingQuery.refetch()]);
      } finally {
        setBusyProposal(null);
      }
    },
    [briefingQuery, proposalsQuery],
  );

  const pendingProposals = (proposalsQuery.data ?? []).filter((proposal) => proposal.status === "pending");

  return {
    messages,
    send,
    isThinking,
    status: statusQuery.data,
    briefing: briefingQuery.data,
    isBriefingLoading: briefingQuery.isLoading,
    proposals: proposalsQuery.data ?? [],
    pendingProposals,
    isProposalsLoading: proposalsQuery.isLoading,
    busyProposal,
    decide,
    apply,
    queryClient,
  };
}
