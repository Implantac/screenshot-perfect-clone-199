/**
 * Seletor de escopos consentidos (wave 24).
 *
 * Cada seção é uma decisão separada, com a descrição do que exatamente será
 * exibido. `resumo` aparece marcado e desabilitado: não é uma escolha, é a base
 * do consolidado — deixar desmarcar criaria a ilusão de "nada compartilhado"
 * enquanto o agregado continua visível.
 */
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SCOPE_DEFINITIONS, type OfficeScope } from "@/lib/office/access";

export type ScopePickerProps = {
  value: OfficeScope[];
  onChange: (next: OfficeScope[]) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function ScopePicker({ value, onChange, disabled, compact }: ScopePickerProps) {
  const toggle = (scope: OfficeScope) => {
    if (value.includes(scope)) onChange(value.filter((item) => item !== scope));
    else onChange([...value, scope]);
  };

  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      {SCOPE_DEFINITIONS.map((definition) => {
        const checked = value.includes(definition.key);
        return (
          <label
            key={definition.key}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 transition-colors",
              checked ? "border-primary/30 bg-primary/5" : "border-white/10 bg-white/[0.02]",
              definition.required && "cursor-default opacity-90",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              disabled={disabled || definition.required}
              onChange={() => toggle(definition.key)}
              className="mt-0.5 h-3.5 w-3.5 accent-[oklch(0.72_0.14_155)]"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[11px] font-bold">
                {definition.label}
                {definition.required && <Lock className="h-2.5 w-2.5 text-muted-foreground/60" />}
              </span>
              {!compact && (
                <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                  {definition.description}
                </span>
              )}
            </span>
          </label>
        );
      })}
    </div>
  );
}
