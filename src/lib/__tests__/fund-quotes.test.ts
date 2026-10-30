import { describe, expect, test } from "bun:test";
import { listZipEntries, readZipEntryByName } from "@/lib/quotes/zip";
import {
  createFundCollector,
  cvmInfDiarioUrl,
  entryNameForMonth,
  fetchCvmFundQuotes,
  mapCvmHeader,
  parseCvmInfDiario,
  parseCvmNumber,
  parseCvmRow,
  recentMonths,
} from "@/lib/quotes/cvm";
import { fundSymbol, normalizeCnpj, planQuoteUpdates, splitQuotableSymbols } from "@/lib/quotes";

// ------------------------------------------------------------------ ZIP de teste
// Geramos o ZIP na mão para testar o leitor sem depender de nenhum arquivo externo.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as unknown as BlobPart])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function makeZip(files: { name: string; content: string; deflate: boolean }[]): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const raw = encoder.encode(file.content);
    const payload = file.deflate ? await deflateRaw(raw) : raw;
    const name = encoder.encode(file.name);
    const crc = crc32(raw);

    const local = new Uint8Array(30 + name.length + payload.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(8, file.deflate ? 8 : 0, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, payload.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(payload, 30 + name.length);

    const central = new Uint8Array(46 + name.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(10, file.deflate ? 8 : 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, payload.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const centralSize = centrals.reduce((total, entry) => total + entry.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...locals, ...centrals, eocd];
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

// -------------------------------------------------------------------- fixtures
const HEADER =
  "TP_FUNDO_CLASSE;CNPJ_FUNDO_CLASSE;ID_SUBCLASSE;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ;CAPTC_DIA;RESG_DIA;NR_COTST";
const CSV = [
  HEADER,
  "CLASSES - FIF;12.345.678/0001-90;;2026-09-28;1000000.00;2.345678900000;1200000.00;0.00;0.00;12",
  "CLASSES - FIF;12.345.678/0001-90;;2026-09-29;1001000.00;2.356789000000;1210000.00;0.00;0.00;12",
  "CLASSES - FIF;98.765.432/0001-10;;2026-09-29;500.00;1.010000000000;600.00;0.00;0.00;3",
  "CLASSES - FIF;11.222.333/0001-81;;2026-09-29;0.00;0.000000000000;0.00;0.00;0.00;0",
].join("\r\n");

describe("leitor de ZIP", () => {
  test("lê entradas comprimidas e armazenadas", async () => {
    const zip = await makeZip([
      { name: "inf_diario_fi_202609.csv", content: "a;b\n1;2\n", deflate: true },
      { name: "leia-me.txt", content: "texto puro", deflate: false },
    ]);

    const entries = listZipEntries(zip);
    expect(entries.map((entry) => entry.name)).toEqual([
      "inf_diario_fi_202609.csv",
      "leia-me.txt",
    ]);
    expect(entries[0].compression).toBe(8);

    const deflated = await readZipEntryByName(zip, /\.csv$/);
    expect(new TextDecoder().decode(deflated!.bytes)).toBe("a;b\n1;2\n");

    const stored = await readZipEntryByName(zip, "leia-me.txt");
    expect(new TextDecoder().decode(stored!.bytes)).toBe("texto puro");
  });

  test("buffer sem assinatura de ZIP falha com mensagem clara", () => {
    expect(() => listZipEntries(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/diretório central/);
  });
});

describe("informe diário da CVM", () => {
  test("CNPJ canônico e símbolo de fundo", () => {
    expect(normalizeCnpj("12.345.678/0001-90")).toBe("12345678000190");
    expect(normalizeCnpj("12345678000190")).toBe("12345678000190");
    expect(normalizeCnpj("00000000000000")).toBeNull();
    expect(normalizeCnpj("123")).toBeNull();
    expect(fundSymbol("12.345.678/0001-90")).toBe("FUND:12345678000190");
  });

  test("URL, nome da entrada e meses candidatos", () => {
    expect(cvmInfDiarioUrl("202609")).toContain("inf_diario_fi_202609.zip");
    expect(entryNameForMonth("202609")).toBe("inf_diario_fi_202609.csv");
    expect(recentMonths(new Date("2026-10-15T00:00:00Z"), 2)).toEqual([
      "202610",
      "202609",
      "202608",
    ]);
    // virada de ano
    expect(recentMonths(new Date("2026-01-10T00:00:00Z"), 1)).toEqual(["202601", "202512"]);
  });

  test("números: ponto decimal e vírgula pt-BR", () => {
    expect(parseCvmNumber("2.356789000000")).toBeCloseTo(2.356789, 6);
    expect(parseCvmNumber("2,356789")).toBeCloseTo(2.356789, 6);
    expect(parseCvmNumber("1.234,56")).toBeCloseTo(1234.56, 2);
    expect(parseCvmNumber("")).toBeNull();
  });

  test("header é lido por nome, não por posição", () => {
    expect(mapCvmHeader(HEADER)).toEqual({ cnpj: 1, date: 3, quota: 5, net: 6 });
    // versão antiga do layout
    expect(mapCvmHeader("TP_FUNDO;CNPJ_FUNDO;DT_COMPTC;VL_TOTAL;VL_QUOTA;VL_PATRIM_LIQ")).toEqual({
      cnpj: 1,
      date: 2,
      quota: 4,
      net: 5,
    });
    expect(mapCvmHeader("outra;coisa")).toBeNull();
  });

  test("linha inválida, data ruim e cota zero são descartadas", () => {
    const map = mapCvmHeader(HEADER);
    expect(parseCvmRow(HEADER, map)).toBeNull();
    expect(parseCvmRow("CLASSES - FIF;12.345.678/0001-90;;28/09/2026;1;2.5", map)).toBeNull();
    expect(parseCvmRow("CLASSES - FIF;12.345.678/0001-90;;2026-09-29;1;0.00", map)).toBeNull();
    expect(parseCvmRow("lixo", map)).toBeNull();
  });

  test("guarda só a cota mais recente de cada fundo pedido", () => {
    const rows = parseCvmInfDiario(CSV, new Set(["12345678000190"]));
    expect(rows).toHaveLength(1);
    expect(rows[0].cnpj).toBe("12345678000190");
    expect(rows[0].date).toBe("2026-09-29");
    expect(rows[0].quota).toBeCloseTo(2.356789, 6);
    expect(rows[0].netAssets).toBeCloseTo(1_210_000, 2);
  });

  test("coletor tolera lotes quebrados no meio da linha", () => {
    const collector = createFundCollector(new Set(["12345678000190"]));
    for (const chunk of [CSV.slice(0, 120), CSV.slice(120)]) {
      for (const line of chunk.split("\r\n")) if (line) collector.push(line);
    }
    // O corte no meio gera uma linha corrompida — o coletor ignora, mas não quebra.
    expect(collector.result().length).toBeGreaterThanOrEqual(1);
  });
});

describe("busca de cotas (fluxo completo com fetch simulado)", () => {
  test("baixa o ZIP, acha o CSV e devolve a cota mais recente", async () => {
    const zip = await makeZip([{ name: entryNameForMonth("202609"), content: CSV, deflate: true }]);
    const calls: string[] = [];
    const fakeFetch = async (url: string) => {
      calls.push(url);
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
      };
    };

    const result = await fetchCvmFundQuotes(["12.345.678/0001-90"], {
      months: ["202609"],
      fetchImpl: fakeFetch as never,
    });

    expect(calls[0]).toContain("inf_diario_fi_202609.zip");
    expect(result.month).toBe("202609");
    expect(result.quotes).toHaveLength(1);
    expect(result.quotes[0].symbol).toBe("FUND:12345678000190");
    expect(result.quotes[0].price).toBeCloseTo(2.356789, 6);
    expect(result.quotes[0].asOf).toBe("2026-09-29");
    expect(result.quotes[0].source).toBe("cvm");
  });

  test("mês não publicado (404) cai para o mês anterior", async () => {
    const zip = await makeZip([{ name: entryNameForMonth("202608"), content: CSV, deflate: true }]);
    const asked: string[] = [];
    const fakeFetch = async (url: string) => {
      asked.push(url);
      if (url.includes("202609")) return { ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) };
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
      };
    };

    const result = await fetchCvmFundQuotes(["12345678000190"], {
      months: ["202609", "202608"],
      fetchImpl: fakeFetch as never,
    });

    expect(asked).toHaveLength(2);
    expect(result.month).toBe("202608");
    expect(result.quotes).toHaveLength(1);
  });

  test("CNPJ fora do informe devolve erro útil, não carteira vazia silenciosa", async () => {
    const zip = await makeZip([{ name: entryNameForMonth("202609"), content: CSV, deflate: true }]);
    const result = await fetchCvmFundQuotes(["99.999.999/0001-99"], {
      months: ["202609"],
      fetchImpl: (async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength),
      })) as never,
    });
    expect(result.quotes).toHaveLength(0);
    expect(result.errors[0].message).toMatch(/Nenhuma cota encontrada/);
  });

  test("lista de CNPJs vazia não faz requisição", async () => {
    let called = false;
    const result = await fetchCvmFundQuotes([], {
      fetchImpl: (async () => {
        called = true;
        return { ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) };
      }) as never,
    });
    expect(called).toBe(false);
    expect(result.quotes).toHaveLength(0);
  });
});

describe("posição de fundo no plano de atualização", () => {
  test("CNPJ tem precedência sobre o rótulo do símbolo", () => {
    const positions = [
      {
        id: "f1",
        symbol: "FIM-MULTI",
        instrument_id: "12.345.678/0001-90",
        name: "Fundo Multimercado",
        quantity: 4000,
        unit_price: 2.3,
        as_of: "2026-08-31",
      },
      { id: "a1", symbol: "PETR4", name: "Petrobras", quantity: 100, unit_price: 50, as_of: "2026-08-31" },
      { id: "x1", symbol: "FIAGRO", name: "Fundo agro sem CNPJ", quantity: 10, unit_price: 112, as_of: "2026-08-31" },
    ];

    expect(splitQuotableSymbols(positions)).toEqual({
      market: ["PETR4"],
      funds: ["FUND:12345678000190"],
    });

    const plan = planQuoteUpdates(positions, [
      {
        symbol: "FUND:12345678000190",
        price: 2.356789,
        currency: "BRL",
        asOf: "2026-09-29",
        source: "cvm",
      },
    ]);

    expect(plan.updates).toHaveLength(1);
    expect(plan.updates[0].positionId).toBe("f1");
    expect(plan.updates[0].source).toBe("cvm");
    expect(plan.updates[0].toPrice).toBeCloseTo(2.356789, 6);
    // 4.000 cotas × (2,356789 − 2,30)
    expect(plan.totalDeltaBrl).toBeCloseTo(227.16, 0);
  });
});
