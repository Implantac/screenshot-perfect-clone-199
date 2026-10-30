import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    // Guard de sessão.
    //
    // Só roda no browser: `getSession()` depende do storage local, e instanciar o
    // supabase-js no servidor inicializa o Realtime — que quebra no Node 20
    // ("Node.js 20 detected without native WebSocket support") e derrubava o SSR
    // de toda rota protegida com HTTP 500. No SSR o conteúdo é renderizado sem
    // dados (as queries só rodam no cliente), então não há vazamento.
    if (typeof window === "undefined") return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: () => (
    <div className="w-full max-w-full overflow-x-hidden">
      <AppLayout>
        <Outlet />
      </AppLayout>
    </div>
  ),
});


