import { describe, expect, test } from "bun:test";
import {
  DEFAULT_SECURITY_POLICY,
  assessMfa,
  evaluatePassword,
  evaluatePosture,
  type SecurityPolicy,
} from "@/lib/security/policy";

const policy = DEFAULT_SECURITY_POLICY;

describe("política de senha", () => {
  test("senha boa passa com folga", () => {
    const result = evaluatePassword("Cavalo#Forte2026", policy);
    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.score).toBeGreaterThan(60);
    expect(result.passed.length).toBeGreaterThanOrEqual(4);
  });

  test("reprova curta, sem símbolo e sem número com motivo específico", () => {
    const curta = evaluatePassword("Ab1!", policy);
    expect(curta.ok).toBe(false);
    expect(curta.issues.some((issue) => issue.code === "length")).toBe(true);

    const semSimbolo = evaluatePassword("CavaloForte2026", policy);
    expect(semSimbolo.issues.some((issue) => issue.code === "symbol")).toBe(true);

    const semNumero = evaluatePassword("Cavalo#ForteAbc", policy);
    expect(semNumero.issues.some((issue) => issue.code === "number")).toBe(true);

    const semCaixa = evaluatePassword("cavalo#forte2026", policy);
    expect(semCaixa.issues.some((issue) => issue.code === "case")).toBe(true);
  });

  test("dicionário de vazamento pega a senha óbvia", () => {
    for (const fraca of ["Patrium@123", "senha#12345", "Admin@2026", "Família@2026"]) {
      const result = evaluatePassword(fraca, policy);
      expect(result.ok).toBe(false);
      expect(result.issues.some((issue) => issue.code === "common")).toBe(true);
    }
  });

  test("sequências e repetições são reprovadas", () => {
    expect(evaluatePassword("Abcd#efgh1234", policy).issues.some((issue) => issue.code === "sequence")).toBe(true);
    expect(evaluatePassword("Aaaa#1111bbbb", policy).issues.map((issue) => issue.code)).toContain("repeat");
  });

  test("nome ou e-mail na senha é reprovado", () => {
    const result = evaluatePassword("Marina#Almeida2026", policy, ["marina@almeida.com"]);
    expect(result.issues.some((issue) => issue.code === "personal")).toBe(true);
    // sem o dado pessoal, a mesma senha passa
    expect(evaluatePassword("Marina#Almeida2026", policy).ok).toBe(true);
  });

  test("entropia e nota acompanham a complexidade", () => {
    const fraca = evaluatePassword("aaaa", policy);
    const forte = evaluatePassword("T4b#uL@r!mN0v3l", policy);
    expect(forte.entropyBits).toBeGreaterThan(fraca.entropyBits);
    expect(forte.score).toBeGreaterThan(fraca.score);
    expect(fraca.score).toBeGreaterThanOrEqual(0);
    expect(forte.score).toBeLessThanOrEqual(100);
  });

  test("política mais frouxa aceita senha que a padrão recusa", () => {
    const frouxa: SecurityPolicy = {
      ...policy,
      min_password_length: 8,
      require_symbol: false,
      block_common_passwords: false,
      require_mixed_case: false,
    };
    expect(evaluatePassword("cavalo2026", policy).ok).toBe(false);
    expect(evaluatePassword("cavalo2026", frouxa).ok).toBe(true);
  });

  test("senha vazia não quebra e reprova", () => {
    const result = evaluatePassword("", policy);
    expect(result.ok).toBe(false);
    expect(result.entropyBits).toBe(0);
  });
});

describe("MFA", () => {
  test("sem fator: desligado e com próximo passo claro", () => {
    const assessment = assessMfa({ verifiedFactors: 0 });
    expect(assessment.status).toBe("desligado");
    expect(assessment.satisfied).toBe(false);
    expect(assessment.nextStep).toContain("autenticador");
  });

  test("com fator mas sessão aal1: pendente, não bloqueado", () => {
    const assessment = assessMfa({ verifiedFactors: 1, aal: "aal1" });
    expect(assessment.status).toBe("pendente");
    expect(assessment.verifiedFactors).toBe(1);
    expect(assessment.satisfied).toBe(false);
    expect(assessment.nextStep).toContain("aal2");
  });

  test("fator verificado e sessão elevada: ativo e satisfeito", () => {
    const assessment = assessMfa({ verifiedFactors: 1, aal: "aal2" });
    expect(assessment.status).toBe("ativo");
    expect(assessment.satisfied).toBe(true);
  });

  test("escopo portal e admin seguem políticas diferentes", () => {
    const semExigencia: SecurityPolicy = { ...policy, mfa_required_admin: false, mfa_required_portal: false };
    const assessment = assessMfa({ verifiedFactors: 0, policy: semExigencia, scope: "admin" });
    expect(assessment.required).toBe(false);
    expect(assessment.satisfied).toBe(true); // nada exigido, nada pendente
  });
});

describe("postura de segurança", () => {
  test("política padrão com sessão sem MFA não tira nota máxima", () => {
    const posture = evaluatePosture({
      policy,
      myMfa: assessMfa({ verifiedFactors: 0 }),
    });
    expect(posture.score).toBeLessThan(100);
    expect(posture.blockers.some((blocker) => blocker.includes("Sua própria conta"))).toBe(true);
  });

  test("política frouxa derruba a nota e gera achados de severidade alta", () => {
    const fraca: SecurityPolicy = {
      ...policy,
      mfa_required_admin: false,
      mfa_required_portal: false,
      min_password_length: 6,
      block_common_passwords: false,
      password_history: 0,
      session_timeout_minutes: 1440,
    };
    const posture = evaluatePosture({ policy: fraca, myMfa: assessMfa({ verifiedFactors: 1, aal: "aal2" }) });
    expect(posture.score).toBeLessThan(60);
    expect(posture.grade).toBe("D");
    expect(posture.findings.filter((finding) => finding.severity === "alta").length).toBeGreaterThanOrEqual(1);
    expect(posture.findings.length).toBeGreaterThanOrEqual(4);
  });

  test("cobertura de MFA entra na conta", () => {
    const users = [
      { email: "a@x.com", mfaEnrolled: true },
      { email: "b@x.com", mfaEnrolled: false },
      { email: "c@x.com", mfaEnrolled: false },
    ];
    const posture = evaluatePosture({ policy, users, myMfa: assessMfa({ verifiedFactors: 1, aal: "aal2" }) });
    expect(posture.findings.some((finding) => finding.id === "mfa_coverage")).toBe(true);
    const cobertura = posture.breakdown.find((item) => item.label === "Cobertura de MFA")!;
    expect(cobertura.points).toBe(10);
  });

  test("tudo em ordem chega a A", () => {
    const posture = evaluatePosture({
      policy,
      users: [{ email: "a@x.com", mfaEnrolled: true }],
      myMfa: assessMfa({ verifiedFactors: 1, aal: "aal2" }),
    });
    expect(posture.score).toBe(100);
    expect(posture.grade).toBe("A");
    expect(posture.findings).toEqual([]);
  });

  test("portal sem exigência de MFA é achado de severidade alta (a promessa sem lastro)", () => {
    const posture = evaluatePosture({
      policy: { ...policy, mfa_required_portal: false },
      myMfa: assessMfa({ verifiedFactors: 1, aal: "aal2" }),
    });
    const finding = posture.findings.find((item) => item.id === "mfa_portal")!;
    expect(finding.severity).toBe("alta");
    expect(finding.text).toContain("ninguém aplica");
  });

  test("breakdown soma a nota final", () => {
    const posture = evaluatePosture({ policy, myMfa: assessMfa({ verifiedFactors: 1, aal: "aal2" }) });
    const soma = posture.breakdown.reduce((total, item) => total + item.points, 0);
    expect(posture.score).toBe(Math.min(100, soma));
  });
});
