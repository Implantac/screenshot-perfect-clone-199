/**
 * Trilha visível do tool-use: o que o JARVIS consultou para responder.
 *
 * A regra é simples: se o agente rodou uma ferramenta, o usuário vê qual foi e
 * com que número ela voltou. Sem isso, "IA" e "chute" ficam com a mesma cara.
 */
import { CheckCircle2, ChevronRight, CircleSlash } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JarvisToolTrace } from "@/lib/jarvis/types";

export function ToolTraceList({ traces }: { traces: JarvisToolTrace[] }) {
  if (traces.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
        Ferramentas executadas
      </p>
      <div className="space-y-1.5">
        {traces.map((trace) => (
          <details
            key={`${trace.tool}-${trace.label}`}
            className="group rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden"
          >
            <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer list-none select-none">
              {trace.ok ? (
                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              ) : (
                <CircleSlash className="h-3 w-3 text-orange-400 shrink-0" />
              )}
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/80 truncate">
                {trace.label}
              </span>
              <span
                className={cn(
                  "text-[9px] font-mono truncate",
                  trace.ok ? "text-muted-foreground/60" : "text-orange-400/80",
                )}
              >
                {trace.tool}
              </span>
              <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/40 transition-transform group-open:rotate-90 shrink-0" />
            </summary>
            <div className="px-3 pb-3 pt-0 space-y-1.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">{trace.summary}</p>
              {trace.sources.length > 0 && (
                <p className="text-[9px] font-mono text-muted-foreground/60">
                  {trace.sources.map((source) => `${source.label}: ${source.value}`).join(" · ")}
                </p>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
