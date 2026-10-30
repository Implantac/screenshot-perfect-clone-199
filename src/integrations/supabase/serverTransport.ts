/**
 * Transport "no-op" de WebSocket para o supabase-js no servidor.
 *
 * Por que isso existe: o `@supabase/supabase-js` instancia o cliente de Realtime
 * no construtor, e em runtimes sem WebSocket nativo (Node < 22, que é o que o
 * README original sugere) ele lança:
 *
 *   Node.js 20 detected without native WebSocket support.
 *
 * Isso derrubava TODA server function autenticada (seed, CRUD, JARVIS) e o SSR das
 * rotas protegidas com HTTP 500. Como o servidor deste app nunca usa Realtime —
 * as telas fazem queries pontuais —, passamos um transport que falha de forma
 * explícita se algum dia for usado, em vez de depender de `ws` ou exigir Node 22.
 */
import type { RealtimeClientOptions } from "@supabase/supabase-js";

class ServerRealtimeDisabled {
  constructor() {
    throw new Error(
      "[supabase] Realtime não está disponível no servidor. Use queries pontuais (select/insert) " +
        "ou faça a assinatura em tempo real no cliente.",
    );
  }
}

export const serverRealtimeOptions = {
  transport: ServerRealtimeDisabled as unknown as RealtimeClientOptions["transport"],
};
