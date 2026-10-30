import { useCallback, useState } from "react";
import type { z } from "zod";

/**
 * Formulário mínimo com validação Zod: sem dependências novas, valida no cliente
 * com o MESMO schema usado pela server function (fonte única de verdade).
 */
export function useZodForm<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  initial: z.input<TSchema>,
) {
  const [values, setValues] = useState<Record<string, unknown>>(initial as Record<string, unknown>);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = useCallback((name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const reset = useCallback(
    (next?: Record<string, unknown>) => {
      setValues((next ?? (initial as Record<string, unknown>)) as Record<string, unknown>);
      setErrors({});
    },
    [initial],
  );

  /** Valida e devolve os dados tipados, ou null (preenchendo os erros por campo). */
  const validate = useCallback((): z.output<TSchema> | null => {
    const parsed = schema.safeParse(values);
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const next: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!next[key]) next[key] = issue.message;
    }
    setErrors(next);
    return null;
  }, [schema, values]);

  return { values, errors, setValue, setValues, validate, reset };
}
