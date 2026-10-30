/**
 * Teste de fumaça em navegador real (Playwright) contra o dev server local.
 * Fluxo: cadastro → seed pela UI → dashboard com números → Central de Riscos → JARVIS responde.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:8080";
const stamp = Date.now().toString(36);
const EMAIL = `ui.${stamp}@patrium.qa`;
const PASSWORD = `Patrium!${stamp}`;

const shots = process.env.SHOT_DIR ?? "/home/user/screenshots";

const log = (...a: unknown[]) => console.log(...a);

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();

const consoleErrors: string[] = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 300));
});
page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message.slice(0, 300)}`));

try {
  // 1. cadastro
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Cadastrar/i }).click();
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole("button", { name: /Criar Minha Conta/i }).click();
  await page.waitForURL("**/dashboard", { timeout: 30_000 });
  log("✅ cadastro + login → /dashboard");

  // 2. banner de demonstração
  await page.waitForSelector("text=Popular demonstração", { timeout: 30_000 });
  const aumBefore = await page.locator("text=/R\\$ [\\d.]+/").first().textContent();
  log(`   AUM antes do seed: ${aumBefore?.trim()}`);

  await page.getByRole("button", { name: /Popular demonstração/i }).click();
  await page.waitForSelector("text=Holding", { timeout: 45_000 }).catch(() => {});
  await page.waitForFunction(() => !document.body.innerText.includes("R$ 0.0"), undefined, {
    timeout: 45_000,
  });
  await page.waitForTimeout(1500);
  const bodyText = await page.locator("body").innerText();
  const aumMatch = bodyText.match(/R\$\s?([\d.,]+)M/);
  log(`✅ seed pela UI → dashboard com AUM ${aumMatch?.[1]}M`);
  log(
    `   contém "Holding Alencar": ${bodyText.includes("HOLDING ALENCAR") || bodyText.includes("Holding Alencar")}`,
  );
  await page.screenshot({ path: `${shots}/01-dashboard.png`, fullPage: false });

  // 3. central de riscos + resolver
  await page.goto(`${BASE}/riscos`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Central de Riscos", { timeout: 20_000 });
  const riskRows = await page.locator("text=/risco\\(s\\) no total/").first().textContent();
  log(`✅ Central de Riscos: ${riskRows?.trim()}`);
  await page.screenshot({ path: `${shots}/02-riscos.png` });

  // 4. nova holding pelo modal (camada de escrita)
  await page.goto(`${BASE}/holdings`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Nova Holding/i }).click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
  await page.getByPlaceholder(/Alencar Participações/i).fill(`Holding UI ${stamp}`);
  await page.getByRole("button", { name: /Criar holding/i }).click();
  await page.waitForSelector(`text=Holding UI ${stamp}`, { timeout: 30_000 });
  log("✅ escrita via server function: holding criada pela UI e renderizada");
  await page.screenshot({ path: `${shots}/03-holdings.png` });

  // 5. JARVIS
  await page.goto(`${BASE}/jarvis/chat`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const badge = await page.locator("text=/IA Online|Modo analítico local/").first().textContent();
  log(`   status do JARVIS: ${badge?.trim()}`);

  await page.getByPlaceholder(/Pergunte ao JARVIS/i).fill("Quais são meus riscos críticos?");
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => /risco\(s\) aberto\(s\)|riscos abertos|Não consegui/.test(document.body.innerText),
    undefined,
    { timeout: 60_000 },
  );
  await page.waitForTimeout(1000);
  const chatText = await page.locator("body").innerText();
  const answerLine = chatText.split("\n").find((l) => /risco\(s\) aberto\(s\)/.test(l));
  log(`✅ JARVIS respondeu: ${answerLine?.slice(0, 140)}`);
  log(`   fontes exibidas: ${/Patrimônio monitorado/.test(chatText)}`);
  await page.screenshot({ path: `${shots}/04-jarvis-chat.png` });

  // 6. erro de validação (Zod) na UI
  await page.goto(`${BASE}/imoveis`, { waitUntil: "networkidle" });
  await page
    .getByRole("button", { name: /Cadastrar Ativo/i })
    .first()
    .click();
  await page.waitForSelector('[role="dialog"]', { timeout: 10_000 });
  await page
    .getByRole("button", { name: /Cadastrar ativo/i })
    .last()
    .click();
  await page.waitForTimeout(800);
  const validation = await page.locator('[role="dialog"]').innerText();
  log(`✅ validação Zod na UI: ${/ao menos 2 caracteres|Selecione um registro/.test(validation)}`);
  await page.screenshot({ path: `${shots}/05-form-validacao.png` });

  // 7. telas convertidas para dados reais (wave 2)
  const screens: [string, RegExp][] = [
    ["/fornecedores", /Fornecedores|Homologar/i],
    ["/legal", /Assessoria Jurídica/i],
    ["/family-office", /Family Office/i],
    ["/regularizacao", /Regularização/i],
    ["/jarvis/historico", /Histórico/i],
    ["/jarvis/alertas", /Alertas/i],
    ["/jarvis/grafo", /Rede patrimonial/i],
    ["/settings", /Configurações/i],
    ["/mapa", /Cartografia Patrimonial/i],
  ];
  for (const [route, pattern] of screens) {
    const errorsBefore = consoleErrors.length;
    await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(700);
    const text = await page.locator("body").innerText();
    const rendered = pattern.test(text);
    const crashed = /Something went wrong|Application error|Erro inesperado/i.test(text);
    const fresh = consoleErrors.length - errorsBefore;
    log(
      `${rendered && !crashed && fresh === 0 ? "✅" : "❌"} ${route.padEnd(18)} render=${rendered} erros=${fresh}`,
    );
    if (!rendered || crashed || fresh > 0) process.exitCode = 1;
  }
  await page.screenshot({ path: `${shots}/06-fornecedores.png` });

  log(`\nErros de console: ${consoleErrors.length}`);
  for (const e of consoleErrors.slice(0, 12)) log(`   · ${e}`);
} catch (error) {
  console.error("❌ FALHOU:", error);
  await page.screenshot({ path: `${shots}/falha.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
