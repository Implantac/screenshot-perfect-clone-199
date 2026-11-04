/**
 * Ambiente de teste de componente (wave 29).
 *
 * POR QUE EXISTE
 * Até aqui a suíte cobria motores puros e parsers — 710 testes que não tocam em
 * um único pixel. Isso deixava um buraco conhecido: um componente pode quebrar
 * (prop renomeada, texto trocado, estado errado) com `tsc` limpo, porque o
 * TypeScript garante o tipo e não a renderização. Este arquivo monta um DOM de
 * verdade (happy-dom) para o `bun test`, sem baixar navegador.
 *
 * POR QUE HAPPY-DOM E NÃO JSDOM
 * happy-dom é mais rápido, não precisa de `jsdom` + `canvas` e registra os
 * globais numa linha. Para teste de componente o que importa é DOM, evento e
 * `matchMedia` — não layout real. Layout real continua sendo papel do Playwright
 * (`bun run verify:ui`), e a diferença é declarada: **teste de componente não
 * substitui smoke em navegador**.
 */
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register({
  settings: { disableCSSFileLoading: true, disableJavaScriptFileLoading: true },
});

// happy-dom não implementa matchMedia: emular é mais honesto que silenciar o
// erro no componente que consulta mídia.
if (!globalThis.matchMedia) {
  Object.defineProperty(globalThis, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

if (!globalThis.ResizeObserver) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: ResizeObserverStub });
}

// `scrollIntoView` é chamado por listas com foco; happy-dom não implementa.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
