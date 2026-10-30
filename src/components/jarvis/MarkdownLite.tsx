/**
 * Renderizador mínimo de markdown para as respostas do JARVIS.
 * Suporta negrito, itálico, listas (- e 1.) e parágrafos — sem dangerouslySetInnerHTML.
 */
function inline(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={key} className="text-foreground font-bold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
      return (
        <em key={key} className="text-muted-foreground">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = text.split("\n");

  return (
    <div className={className}>
      {lines.map((raw, index) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={index} className="h-2" />;

        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2 py-0.5">
              <span className="mt-[7px] h-1 w-1 rounded-full bg-primary shrink-0" />
              <span className="min-w-0">{inline(bullet[1], `b${index}`)}</span>
            </div>
          );
        }

        const numbered = line.match(/^\s*(\d+)\.\s+(.*)$/);
        if (numbered) {
          return (
            <div key={index} className="flex gap-2 py-0.5">
              <span className="text-primary font-black tabular-nums shrink-0">{numbered[1]}.</span>
              <span className="min-w-0">{inline(numbered[2], `n${index}`)}</span>
            </div>
          );
        }

        const heading = line.match(/^#{1,4}\s+(.*)$/);
        if (heading) {
          return (
            <p key={index} className="font-black uppercase tracking-wide text-foreground pt-1">
              {inline(heading[1], `h${index}`)}
            </p>
          );
        }

        return (
          <p key={index} className="py-0.5">
            {inline(line, `p${index}`)}
          </p>
        );
      })}
    </div>
  );
}
