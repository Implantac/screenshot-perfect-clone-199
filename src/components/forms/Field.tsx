import { cn } from "@/lib/utils";

/** Classes compartilhadas dos controles de formulário (tema escuro do PATRIUM). */
export const inputClass =
  "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 transition-all";

export const labelClass =
  "block text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/70 mb-2";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1.5 text-[10px] text-muted-foreground/50">{hint}</p>}
      {error && <p className="mt-1.5 text-[10px] font-bold text-red-400">{error}</p>}
    </div>
  );
}
