import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { reportClientEvent } from "@/lib/api/observability.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço acessado não existe ou foi movido.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
    // Wave 26: a mesma falha também alimenta o painel `/sistema`, onde o admin
    // vê o que mais repete. O envio é "fire and forget": erro ao reportar erro
    // não pode virar uma segunda tela de erro.
    void reportClientEvent({
      data: {
        source: "ui.boundary",
        message: error instanceof Error ? error.message : String(error),
        context: { boundary: "root" },
      },
    }).catch(() => undefined);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página não carregou
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo falhou do nosso lado. Tente recarregar ou voltar para o início.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "USE PATRIUM OS | Digital Director for Strategic Governance" },
      { name: "description", content: "USE PATRIUM OS - O primeiro Sistema Operacional de Governança Patrimonial do Brasil. Comandado por JARVIS, seu Diretor Patrimonial Digital." },
      { name: "author", content: "Patrium Strategic Intelligence" },
      { property: "og:title", content: "USE PATRIUM OS | Strategic Intelligence" },
      { property: "og:description", content: "Proteja seu legado com o primeiro Sistema Operacional Patrimonial do Brasil. Inteligência executiva 24/7." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Use Patrium" },
      { name: "twitter:description", content: "JARVIS PATRIUM - O primeiro Diretor Patrimonial Digital do Brasil. Monitoramento ativo de holdings, ativos e compliance." },
      { property: "og:image", content: "https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" },
      { name: "twitter:image", content: "https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png" },

    ],
    links: [
      {
        rel: "icon",
        href: "https://hckncgrfhedoswsdkyni.supabase.co/storage/v1/object/public/uploads/dc291665-321e-4f33-9043-0d314f227a70/logo.png",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Captura o que a fronteira de erro do React não vê: exceção fora do render
 * (listener, timer, promessa rejeitada sem catch) — wave 26.
 *
 * Limites declarados: no máximo 5 eventos por carregamento de página e nenhum
 * repetido na mesma sessão. Sem isso, um `setInterval` quebrado geraria um
 * evento a cada segundo e o painel viraria ruído — o oposto de observabilidade.
 */
function SystemEventReporter() {
  useEffect(() => {
    const sent = new Set<string>();
    const send = (source: string, message: string) => {
      if (sent.size >= 5) return;
      const key = `${source}:${message.slice(0, 120)}`;
      if (sent.has(key)) return;
      sent.add(key);
      void reportClientEvent({
        data: {
          source,
          message,
          context: { route: typeof window === "undefined" ? null : window.location.pathname },
        },
      }).catch(() => undefined);
    };

    const onError = (event: ErrorEvent) => send("ui.window.error", event.message || "erro sem mensagem");
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      send(
        "ui.promise.rejection",
        reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "promessa rejeitada",
      );
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <SystemEventReporter />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-right" expand={false} richColors theme="dark" />
    </QueryClientProvider>

  );
}
