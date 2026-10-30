/**
 * Estado de conversa do JARVIS, compartilhado entre o chat de página inteira e o
 * drawer lateral. A resposta vem sempre do servidor (askJarvis), que decide entre
 * LLM configurado e analista local — o cliente nunca inventa conteúdo.
 */
import { useCallback, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { askJarvis, getJarvisStatus, getPortfolioBriefing } from "@/lib/api/jarvis.functions";
import type { JarvisProvider } from "@/lib/jarvis/types";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  provider?: JarvisProvider;
  sources?: { label: string; value: string }[];
  followUps?: string[];
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
    "Como está meu compliance?",
  ],
};

let counter = 0;
const nextId = () => `m-${Date.now()}-${counter++}`;

export function useJarvisChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [isThinking, setIsThinking] = useState(false);

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
        },
      ]);
      briefingQuery.refetch();
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

  return {
    messages,
    send,
    isThinking,
    status: statusQuery.data,
    briefing: briefingQuery.data,
    isBriefingLoading: briefingQuery.isLoading,
  };
}
