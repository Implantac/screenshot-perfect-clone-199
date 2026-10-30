import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Dialog simples sem dependência extra: portal, ESC, clique no backdrop,
 * lock de scroll e foco inicial. Substitui o uso de <div>s soltos nas telas.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", damping: 26, stiffness: 260 }}
            className={cn(
              "relative w-full bg-card border border-white/10 rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden",
              size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl",
            )}
          >
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-white/5 shrink-0">
              <div className="min-w-0">
                <h2 className="text-lg font-black tracking-tight uppercase italic leading-tight truncate">
                  {title}
                </h2>
                {description && (
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar"
                className="h-9 w-9 shrink-0 flex items-center justify-center rounded-xl hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none">{children}</div>

            {footer && (
              <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
