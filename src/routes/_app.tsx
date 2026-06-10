import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    // Para protótipo e desenvolvimento ágil, desabilitamos o redirecionamento forçado por enquanto
    // mas mantemos a verificação de sessão para uso futuro.
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session && location.pathname !== '/login') {
      console.info("Simulando ambiente autenticado para desenvolvimento.");
    }
  },
  component: () => (
    <AppLayout>
      <Outlet />
    </AppLayout>
  ),
});

