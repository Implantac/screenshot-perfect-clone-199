/**
 * Testes de componente (wave 29).
 *
 * POR QUE ESTES COMPONENTES
 * A suíte tinha 710 testes de motor puro e zero de render. Um componente quebra
 * com `tsc` limpo: prop renomeada, texto trocado, condição invertida. Aqui a
 * escolha não foi "os mais fáceis", foi **os que tomam decisão que o usuário lê**:
 *
 *  - `ReconciliationPanel` decide o que está conciliado e o que ficou sem lastro
 *    (dinheiro do cliente);
 *  - `ScopePicker` decide o que o escritório pode ver de uma família (consentimento);
 *  - `ToolTraceList` mostra em que o JARVIS se baseou (a diferença entre IA e chute);
 *  - `MarkdownLite` renderiza texto do modelo sem `dangerouslySetInnerHTML`.
 *
 * LIMITE DECLARADO
 * happy-dom não faz layout nem CSS: estes testes provam *o que aparece e o que
 * acontece ao clicar*, não como fica. Aparência e interação real continuam no
 * Playwright (`bun run verify:ui`).
 */
import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// O painel de conciliação importa o hook de escrita, que carrega o cliente
// Supabase. Mockar o hook (e não o cliente) mantém o teste no nível certo:
// o que se verifica aqui é a decisão da tela, não a chamada de rede.
mock.module("@/hooks/useCrud", () => ({
  useCreateCashFlow: () => ({ mutate: () => undefined, isPending: false }),
}));

const { ReconciliationPanel } = await import("@/components/custody/ReconciliationPanel");
const { ScopePicker } = await import("@/components/office/ScopePicker");
const { ToolTraceList } = await import("@/components/jarvis/ToolTraceList");
const { MarkdownLite } = await import("@/components/jarvis/MarkdownLite");
const { Field } = await import("@/components/forms/Field");

afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// MarkdownLite — texto do modelo, sem HTML injetado
// ---------------------------------------------------------------------------

describe("MarkdownLite", () => {
  test("negrito, itálico e parágrafo", () => {
    render(<MarkdownLite text={"Seu **patrimônio** está em _risco_ moderado"} />);
    expect(screen.getByText("patrimônio").tagName).toBe("STRONG");
    expect(screen.getByText("risco").tagName).toBe("EM");
  });

  test("lista com marcador e lista numerada", () => {
    const { container } = render(<MarkdownLite text={"- primeiro\n- segundo"} />);
    expect(container.textContent).toContain("primeiro");
    expect(container.textContent).toContain("segundo");

    const numbered = render(<MarkdownLite text={"1. aporte\n2. resgate"} />);
    expect(numbered.container.textContent).toContain("aporte");
    expect(numbered.container.textContent).toContain("resgate");
  });

  test("linha vazia vira espaçamento, não texto", () => {
    const { container } = render(<MarkdownLite text={"um\n\ndois"} />);
    // O RTL embrulha o resultado; o que interessa são os filhos do componente.
    const blocks = container.firstElementChild?.children ?? [];
    expect(blocks.length).toBe(3);
    expect(blocks[1]?.textContent).toBe(""); // linha vazia = espaçador, não parágrafo
    expect(container.textContent).not.toContain("\n");
  });

  test("HTML no texto do modelo é renderizado como texto, nunca como marcação", () => {
    const { container } = render(
      <MarkdownLite text={'<img src=x onerror="alert(1)"> e <script>alert(2)</script>'} />,
    );
    // Nenhuma tag executável criada: o conteúdo aparece literal.
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>");
  });

  test("texto vazio não quebra o render", () => {
    const { container } = render(<MarkdownLite text="" />);
    expect(container.textContent).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Field — rótulo ligado ao controle, erro visível
// ---------------------------------------------------------------------------

describe("Field", () => {
  test("rótulo aponta para o controle por htmlFor", () => {
    render(
      <Field label="Valor do ativo" htmlFor="valor">
        <input id="valor" />
      </Field>,
    );
    const label = screen.getByText("Valor do ativo");
    expect(label.getAttribute("for")).toBe("valor");
  });

  test("erro aparece e tem precedência sobre a dica", () => {
    render(
      <Field label="Vencimento" htmlFor="venc" hint="dd/mm/aaaa" error="Data inválida">
        <input id="venc" />
      </Field>,
    );
    expect(screen.getByText("Data inválida")).toBeDefined();
    expect(screen.queryByText("dd/mm/aaaa")).toBeNull();
  });

  test("sem erro mostra a dica", () => {
    render(
      <Field label="ITCMD" htmlFor="itcmd" hint="alíquota por faixa">
        <input id="itcmd" />
      </Field>,
    );
    expect(screen.getByText("alíquota por faixa")).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// ToolTraceList — em que o JARVIS se baseou
// ---------------------------------------------------------------------------

const trace = (
  over: Partial<{
    tool: string;
    label: string;
    ok: boolean;
    summary: string;
    sources: { label: string; value: string }[];
    proposalId: string | null;
  }> = {},
) => ({
  tool: "patrimonio_total",
  label: "Patrimônio total",
  ok: true,
  summary: "R$ 128.400.000",
  // `sources` não é decorativo: é o rastro de onde o número veio.
  sources: [{ label: "posições", value: "142" }],
  proposalId: null,
  ...over,
});

describe("ToolTraceList", () => {
  test("sem ferramenta executada, não ocupa espaço na tela", () => {
    const { container } = render(<ToolTraceList traces={[]} />);
    expect(container.innerHTML).toBe("");
  });

  test("mostra nome da ferramenta e o número que voltou", () => {
    render(<ToolTraceList traces={[trace()]} />);
    expect(screen.getByText("Ferramentas executadas")).toBeDefined();
    expect(screen.getByText("Patrimônio total")).toBeDefined();
    expect(screen.getByText(/patrimonio_total/)).toBeDefined();
    expect(screen.getByText(/128\.400\.000/)).toBeDefined();
    expect(screen.getByText(/posições: 142/)).toBeDefined();
  });

  test("ferramenta que falhou é distinguida da que rodou", () => {
    const { container } = render(
      <ToolTraceList traces={[trace(), trace({ tool: "irrf", label: "IRRF", ok: false })]} />,
    );
    const items = container.querySelectorAll("details");
    expect(items.length).toBe(2);
    // Ícone de sucesso vs. de falha: a cor/símbolo é o que o usuário lê.
    expect(items[0]?.querySelector(".text-emerald-500")).not.toBeNull();
    expect(items[1]?.querySelector(".text-orange-400")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ScopePicker — consentimento do escritório
// ---------------------------------------------------------------------------

describe("ScopePicker", () => {
  test("resumo patrimonial é obrigatório e não pode ser desmarcado", () => {
    render(<ScopePicker value={["resumo"]} onChange={() => undefined} />);
    const resumo = screen.getByRole("checkbox", { name: /Resumo patrimonial/i }) as HTMLInputElement;
    expect(resumo.checked).toBe(true);
    expect(resumo.disabled).toBe(true);
  });

  test("marcar uma seção acrescenta ao escopo consentido", async () => {
    const seen: string[][] = [];
    render(<ScopePicker value={["resumo"]} onChange={(next) => seen.push(next)} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Contencioso/i }));
    expect(seen[0]).toEqual(["resumo", "contencioso"]);
  });

  test("desmarcar remove do escopo", async () => {
    const seen: string[][] = [];
    render(<ScopePicker value={["resumo", "agro"]} onChange={(next) => seen.push(next)} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /Agro/i }));
    expect(seen[0]).toEqual(["resumo"]);
  });

  test("descrição do que será exibido aparece no modo completo e some no compacto", () => {
    const full = render(<ScopePicker value={["resumo"]} onChange={() => undefined} />);
    expect(full.getByText(/Quantidade de entidades/i)).toBeDefined();
    cleanup();

    const compact = render(<ScopePicker value={["resumo"]} onChange={() => undefined} compact />);
    expect(compact.queryByText(/Quantidade de entidades/i)).toBeNull();
  });

  test("modo desabilitado impede alteração", async () => {
    const seen: string[][] = [];
    render(<ScopePicker value={["resumo"]} onChange={(next) => seen.push(next)} disabled />);
    const checkbox = screen.getByRole("checkbox", { name: /Custódia e dívida/i }) as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
    await userEvent.click(checkbox);
    expect(seen).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// ReconciliationPanel — o que casou e o que ficou sem lastro
// ---------------------------------------------------------------------------

const entity = { id: "e1", name: "Holding Família Almeida" };

const transaction = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "t1",
  entity_id: "e1",
  title: "RESGATE FUNDO XP",
  amount: 42100,
  type: "income",
  category: "Investimentos",
  transaction_date: "2026-10-09",
  import_batch_id: "batch-1",
  ...over,
});

const flow = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "f1",
  entity_id: "e1",
  kind: "resgate",
  amount: 42100,
  flow_date: "2026-10-10",
  description: "Resgate fundo XP",
  ...over,
});

function renderPanel(props: Partial<Parameters<typeof ReconciliationPanel>[0]> = {}) {
  return render(
    <ReconciliationPanel
      transactions={[transaction()]}
      flows={[flow()]}
      entities={[entity]}
      entityFilter="e1"
      {...props}
    />,
  );
}

describe("ReconciliationPanel", () => {
  test("sem dados, explica o caminho em vez de mostrar painel vazio", () => {
    render(
      <ReconciliationPanel transactions={[]} flows={[]} entities={[entity]} entityFilter="e1" />,
    );
    expect(screen.getByText("Nada para conciliar ainda")).toBeDefined();
    expect(screen.getByText(/Importar extrato/i)).toBeDefined();
  });

  test("par casado por valor e proximidade de data (D+1)", () => {
    const { container } = renderPanel();
    expect(screen.getByText("RESGATE FUNDO XP")).toBeDefined();
    expect(screen.getByText("Resgate")).toBeDefined(); // rótulo do fluxo
    const badge = within(container).getByText("D+1");
    expect(badge).toBeDefined();
  });

  test("mesma data recebe selo de casamento exato", () => {
    renderPanel({ flows: [flow({ flow_date: "2026-10-09" })] });
    expect(screen.getByText("mesma data")).toBeDefined();
  });

  test("conta os quatro indicadores corretamente", () => {
    const { container } = renderPanel();
    const cards = container.querySelectorAll(".glass-card");
    const text = Array.from(cards)
      .map((card) => card.textContent ?? "")
      .join(" | ");
    expect(text).toContain("Conciliados");
    expect(text).toContain("Taxa de conciliação");
    expect(text).toContain("100,0%");
    expect(text).toContain("Extrato sem lastro");
    expect(text).toContain("Custódia sem extrato");
  });

  test("extrato sem lastro aparece com valor e ação de criar fluxo", () => {
    renderPanel({ flows: [flow({ amount: 999 })] });
    expect(screen.getByText("Extrato sem lastro na custódia")).toBeDefined();
    // Sugestão do tipo vem da categoria do extrato: "Investimentos" + crédito = aporte.
    expect(screen.getByText(/Criar Aporte/i)).toBeDefined();
  });

  test("custódia sem extrato aparece do outro lado", () => {
    renderPanel({ transactions: [transaction({ amount: 1, title: "TARIFA" })] });
    expect(screen.getByText("Custódia sem extrato correspondente")).toBeDefined();
    expect(screen.getByText(/Resgate fundo XP/)).toBeDefined();
  });

  test("valor repetido casa 1:1: dois lançamentos iguais não viram quatro pares", () => {
    renderPanel({
      transactions: [
        transaction({ id: "t1" }),
        transaction({ id: "t2", transaction_date: "2026-10-09" }),
      ],
      flows: [flow({ id: "f1" }), flow({ id: "f2" })],
    });
    expect(screen.getByText(/2 conciliado\(s\) de 2/)).toBeDefined();
    expect(screen.queryByText("Extrato sem lastro na custódia")).toBeNull();
  });

  test("filtro por entidade ignora lançamento de outra holding", () => {
    renderPanel({
      transactions: [
        transaction({ id: "t1" }),
        transaction({ id: "t9", entity_id: "e2", title: "LANÇAMENTO DE OUTRA HOLDING" }),
      ],
      entities: [entity, { id: "e2", name: "Agro Almeida" }],
    });
    expect(screen.queryByText("LANÇAMENTO DE OUTRA HOLDING")).toBeNull();
    expect(screen.getByText(/de 1/)).toBeDefined();
  });

  test("visão consolidada mostra as duas holdings separadas", () => {
    renderPanel({
      entityFilter: "todas",
      transactions: [
        transaction({ id: "t1" }),
        transaction({
          id: "t2",
          entity_id: "e2",
          title: "ARRENDAMENTO RECEBIDO",
          amount: 80000,
          transaction_date: "2026-10-02",
        }),
      ],
      flows: [flow(), flow({ id: "f2", entity_id: "e2", kind: "provento", amount: 80000, flow_date: "2026-10-02" })],
      entities: [entity, { id: "e2", name: "Agro Almeida" }],
    });
    expect(screen.getByText("Holding Família Almeida")).toBeDefined();
    expect(screen.getByText("Agro Almeida")).toBeDefined();
    expect(screen.getByText("ARRENDAMENTO RECEBIDO")).toBeDefined();
  });
});
