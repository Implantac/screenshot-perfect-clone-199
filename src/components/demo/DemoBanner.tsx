import { useState } from "react";
import { Database, Loader2, Sparkles, X } from "lucide-react";
import { useEntities } from "@/hooks/usePatrimonio";
import { useSeedDemo } from "@/hooks/useCrud";

/**
 * Convite para popular a demonstração. Aparece só quando o tenant está vazio —
 * hoje o dashboard mostrava "AUM R$ 0.0M / Compliance 0%", o que quebra a narrativa
 * comercial do produto.
 */
export function DemoBanner() {
  const { data: entities, isLoading } = useEntities();
  const seed = useSeedDemo();
  const [dismissed, setDismissed] = useState(false);

  if (isLoading || dismissed) return null;
  if (entities && entities.length > 0) return null;

  return (
    <div className="mb-6 lg:mb-8 relative overflow-hidden rounded-2xl lg:rounded-[2rem] border border-primary/25 bg-gradient-to-r from-primary/[0.10] via-primary/[0.04] to-transparent p-5 lg:p-6">
      <div className="absolute -top-16 -right-10 h-44 w-44 bg-primary/20 rounded-full blur-[80px] pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="h-12 w-12 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
          <Database className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80">
            Conta sem dados
          </p>
          <h3 className="text-lg lg:text-xl font-black tracking-tight text-foreground leading-tight">
            Popule a demonstração e veja o cockpit funcionando
          </h3>
          <p className="text-xs lg:text-sm text-muted-foreground leading-relaxed">
            3 holdings, 12 ativos, 24 lançamentos, 8 riscos e 6 insights com datas relativas a hoje.
            Gravado no seu tenant, com RLS — você pode apagar depois.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => seed.mutate(false)}
            disabled={seed.isPending}
            className="h-11 px-5 rounded-xl bg-primary text-primary-foreground text-[10px] lg:text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-60 shadow-lg shadow-primary/20"
          >
            {seed.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {seed.isPending ? "Populando…" : "Popular demonstração"}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="h-11 w-11 rounded-xl border border-white/10 text-muted-foreground hover:bg-white/5 transition-colors flex items-center justify-center"
            aria-label="Dispensar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
