/**
 * Política de segurança de acesso: senha, MFA e sessão.
 *
 * O ponto de partida é desconfortável: até a wave 17, o portal gravava
 * `require_mfa` no convite e **nada exigia MFA de fato**. Uma promessa no banco
 * sem controle no acesso é pior que não prometer — cria confiança sem lastro.
 *
 * Este módulo é a régua da aplicação:
 *   · `evaluatePassword` — reprova senha fraca antes de chegar ao Supabase Auth,
 *     porque o GoTrue não aceita política customizada em projeto gerenciado;
 *   · `assessMfa` — traduz fatores + AAL em "está protegido?" e "qual o próximo
 *     passo", em vez de mostrar um booleano;
 *   · `evaluatePosture` — dá a nota do conjunto e lista o que trava a nota.
 *
 * Tudo é função pura: a tela, os formulários de senha e o teste usam a mesma regra.
 */

export type SecurityPolicy = {
  /** MFA obrigatório para quem administra o tenant. */
  mfa_required_admin: boolean;
  /** MFA obrigatório para acessar o portal do cliente. */
  mfa_required_portal: boolean;
  /** Dias de tolerância após o convite antes de bloquear. */
  mfa_grace_days: number;
  min_password_length: number;
  require_mixed_case: boolean;
  require_number: boolean;
  require_symbol: boolean;
  /** Rejeita senhas do dicionário curto de senhas vazadas. */
  block_common_passwords: boolean;
  /** Quantas senhas anteriores não podem ser repetidas. */
  password_history: number;
  max_failed_attempts: number;
  session_timeout_minutes: number;
};

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  mfa_required_admin: true,
  mfa_required_portal: true,
  mfa_grace_days: 7,
  min_password_length: 12,
  require_mixed_case: true,
  require_number: true,
  require_symbol: true,
  block_common_passwords: true,
  password_history: 5,
  max_failed_attempts: 5,
  session_timeout_minutes: 480,
};

/**
 * Dicionário curto de senhas que aparecem em vazamento. Não pretende ser
 * completo: serve para pegar o caso real (a senha óbvia com número no fim).
 */
const COMMON_PASSWORDS = [
  "senha",
  "password",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "abc123",
  "admin",
  "administrador",
  "patrium",
  "patrium123",
  "familia",
  "family",
  "brasil",
  "brasil123",
  "mudar123",
  "trocar123",
  "welcome",
  "letmein",
  "iloveyou",
  "monkey",
  "dragon",
  "sunshine",
  "princesa",
  "football",
  "corinthians",
  "flamengo",
  "palmeiras",
  "saopaulo",
  "investimento",
  "patrimonio",
  "heranca",
  "sucessao",
  "holding",
  "familyoffice",
  "mudar@123",
  "senha@123",
  "admin@123",
  "qwerty123",
];

const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export type PasswordIssue = { code: string; message: string };

export type PasswordEvaluation = {
  ok: boolean;
  /** 0–100, para a barra de força. */
  score: number;
  /** Entropia aproximada em bits. */
  entropyBits: number;
  issues: PasswordIssue[];
  /** O que já está atendido — dá ao usuário o que ele acertou, não só o erro. */
  passed: string[];
};

function hasMixedCase(password: string): boolean {
  return /[a-z]/.test(password) && /[A-Z]/.test(password);
}

function isSequential(password: string): boolean {
  const lower = password.toLowerCase();
  return SEQUENCES.some((sequence) => {
    for (let index = 0; index + 3 < sequence.length; index += 1) {
      const chunk = sequence.slice(index, index + 4);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(""))) return true;
    }
    return false;
  });
}

function repeatsTooMuch(password: string): boolean {
  return /(.)\1{2,}/.test(password) || new Set(password).size < Math.max(4, password.length / 3);
}

function entropy(password: string): number {
  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/[0-9]/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 32;
  if (pool === 0) return 0;
  return Math.round(password.length * Math.log2(pool));
}

/**
 * Avalia a senha contra a política.
 * `personal` permite reprovar quem usa o próprio e-mail/nome — o caso mais comum.
 */
export function evaluatePassword(
  password: string,
  policy: SecurityPolicy = DEFAULT_SECURITY_POLICY,
  personal: string[] = [],
): PasswordEvaluation {
  const issues: PasswordIssue[] = [];
  const passed: string[] = [];
  const value = String(password ?? "");

  if (value.length < policy.min_password_length) {
    issues.push({
      code: "length",
      message: `Mínimo de ${policy.min_password_length} caracteres (atual: ${value.length}).`,
    });
  } else {
    passed.push(`${policy.min_password_length}+ caracteres`);
  }

  if (policy.require_mixed_case && !hasMixedCase(value)) {
    issues.push({ code: "case", message: "Use maiúsculas e minúsculas." });
  } else if (policy.require_mixed_case) {
    passed.push("maiúsculas e minúsculas");
  }

  if (policy.require_number && !/[0-9]/.test(value)) {
    issues.push({ code: "number", message: "Inclua ao menos um número." });
  } else if (policy.require_number) {
    passed.push("número");
  }

  if (policy.require_symbol && !/[^A-Za-z0-9]/.test(value)) {
    issues.push({ code: "symbol", message: "Inclua ao menos um símbolo (!@#$…)." });
  } else if (policy.require_symbol) {
    passed.push("símbolo");
  }

  if (value && policy.block_common_passwords) {
    // Sem acento e sem símbolo: "Família@2026" tem que cair em "familia".
    const lower = value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const simple = lower.replace(/[^a-z0-9]/g, "");
    const common = COMMON_PASSWORDS.some(
      (entry) => lower === entry || simple === entry.replace(/[^a-z0-9]/g, "") || lower.includes(entry),
    );
    if (common) {
      issues.push({ code: "common", message: "Essa senha está no dicionário de senhas vazadas." });
    } else {
      passed.push("fora do dicionário de vazamentos");
    }
  }

  if (value && isSequential(value)) {
    issues.push({ code: "sequence", message: "Evite sequências (1234, abcd, qwerty)." });
  }
  if (value && repeatsTooMuch(value)) {
    issues.push({ code: "repeat", message: "Evite repetição de caracteres." });
  }

  const personalHits = personal
    .filter((entry) => entry && entry.length >= 4)
    .filter((entry) => {
      const needle = entry.toLowerCase().split("@")[0];
      return needle.length >= 4 && value.toLowerCase().includes(needle);
    });
  if (personalHits.length > 0) {
    issues.push({ code: "personal", message: "Não use seu nome ou e-mail na senha." });
  }

  const bits = entropy(value);
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(bits * 1.1) - issues.filter((issue) => issue.code !== "length").length * 12,
    ),
  );

  return { ok: issues.length === 0, score, entropyBits: bits, issues, passed };
}

export type MfaScope = "admin" | "portal";
export type AalLevel = "aal1" | "aal2";

export type MfaAssessment = {
  required: boolean;
  /** Fatores TOTP verificados no usuário. */
  verifiedFactors: number;
  /** Sessão elevada (aal2) = o segundo fator foi usado agora. */
  elevated: boolean;
  satisfied: boolean;
  status: "desligado" | "pendente" | "ativo";
  nextStep: string;
};

/**
 * Traduz fatores + AAL em estado. Sessão `aal1` com fator verificado significa
 * "tem MFA, mas não usou nesta sessão" — situação diferente de "não tem MFA".
 */
export function assessMfa(input: {
  verifiedFactors: number;
  policy?: SecurityPolicy;
  scope?: MfaScope;
  aal?: AalLevel;
}): MfaAssessment {
  const policy = input.policy ?? DEFAULT_SECURITY_POLICY;
  const scope = input.scope ?? "admin";
  const required = scope === "portal" ? policy.mfa_required_portal : policy.mfa_required_admin;
  const verifiedFactors = Math.max(0, input.verifiedFactors);
  const elevated = (input.aal ?? "aal1") === "aal2";

  const status: MfaAssessment["status"] =
    verifiedFactors === 0 ? "desligado" : elevated ? "ativo" : "pendente";

  const nextStep =
    verifiedFactors === 0
      ? "Cadastre um aplicativo autenticador (TOTP) para ativar o segundo fator."
      : elevated
        ? "Sessão verificada em dois fatores."
        : "Confirme o código do autenticador para elevar a sessão (aal2).";

  return {
    required,
    verifiedFactors,
    elevated,
    // Sem exigência de política, ter MFA já basta; com exigência, a sessão precisa estar elevada.
    satisfied: required ? verifiedFactors > 0 && elevated : true,
    status,
    nextStep,
  };
}

export type PostureUser = { email: string; mfaEnrolled: boolean; role?: string };

export type SecurityFinding = {
  id: string;
  severity: "alta" | "media" | "baixa";
  text: string;
};

export type SecurityPosture = {
  score: number;
  grade: "A" | "B" | "C" | "D";
  findings: SecurityFinding[];
  /** O que impede a nota de subir, em ordem de impacto. */
  blockers: string[];
  breakdown: { label: string; points: number; max: number }[];
};

/** Nota do conjunto: política + quem está protegido. */
export function evaluatePosture(input: {
  policy: SecurityPolicy;
  users?: PostureUser[];
  myMfa?: MfaAssessment;
}): SecurityPosture {
  const policy = input.policy;
  const users = input.users ?? [];
  const findings: SecurityFinding[] = [];
  const breakdown: { label: string; points: number; max: number }[] = [];

  const policyPoints = [
    policy.mfa_required_admin,
    policy.mfa_required_portal,
    policy.min_password_length >= 12,
    policy.require_mixed_case,
    policy.require_number,
    policy.require_symbol,
    policy.block_common_passwords,
    policy.password_history > 0,
    policy.session_timeout_minutes > 0 && policy.session_timeout_minutes <= 720,
  ].filter(Boolean).length;
  breakdown.push({ label: "Política de senha e MFA", points: Math.round((policyPoints / 9) * 50), max: 50 });

  const enrolled = users.filter((user) => user.mfaEnrolled).length;
  const coverage = users.length > 0 ? enrolled / users.length : 1;
  // Sem a lista de usuários não se presume cobertura: metade dos pontos.
  breakdown.push({
    label: "Cobertura de MFA",
    points: users.length > 0 ? Math.round(coverage * 30) : 15,
    max: 30,
  });

  const myMfa = input.myMfa;
  const sessionPoints = myMfa ? (myMfa.satisfied ? 20 : myMfa.verifiedFactors > 0 ? 12 : 0) : 20;
  breakdown.push({ label: "Sessão atual", points: sessionPoints, max: 20 });

  const score = Math.min(100, breakdown.reduce((total, item) => total + item.points, 0));
  const grade: SecurityPosture["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 55 ? "C" : "D";

  if (!policy.mfa_required_admin && !policy.mfa_required_portal) {
    findings.push({
      id: "mfa_policy",
      severity: "alta",
      text: "Nenhum perfil exige segundo fator: um vazamento de senha abre o patrimônio inteiro.",
    });
  } else if (!policy.mfa_required_portal) {
    findings.push({
      id: "mfa_portal",
      severity: "alta",
      text: "O portal do cliente não exige segundo fator — convites gravam `require_mfa` e ninguém aplica.",
    });
  }
  if (policy.min_password_length < 12) {
    findings.push({
      id: "password_length",
      severity: "media",
      text: `Senha de ${policy.min_password_length} caracteres é curta para 2026: 12 é o piso razoável.`,
    });
  }
  if (!policy.block_common_passwords) {
    findings.push({
      id: "password_dictionary",
      severity: "media",
      text: "Sem bloqueio de senhas vazadas — é o controle de maior retorno por menor esforço.",
    });
  }
  if (policy.password_history < 3) {
    findings.push({
      id: "password_history",
      severity: "baixa",
      text: "Histórico de senha baixo permite alternar duas senhas para sempre.",
    });
  }
  if (policy.session_timeout_minutes > 720) {
    findings.push({
      id: "session",
      severity: "media",
      text: `Sessão de ${Math.round(policy.session_timeout_minutes / 60)} h: em dispositivo compartilhado isso é acesso aberto.`,
    });
  }
  if (users.length > 0 && enrolled < users.length) {
    findings.push({
      id: "mfa_coverage",
      severity: "alta",
      text: `${users.length - enrolled} usuário(s) sem segundo fator: a nota da política não vale sem cobertura.`,
    });
  }
  if (myMfa && myMfa.required && !myMfa.satisfied) {
    findings.push({
      id: "my_mfa",
      severity: "alta",
      text:
        myMfa.verifiedFactors === 0
          ? "Sua própria conta ainda não tem segundo fator — comece por ela."
          : "Seu segundo fator está cadastrado, mas esta sessão não está verificada (aal1).",
    });
  }

  const blockers = findings
    .filter((finding) => finding.severity !== "baixa")
    .map((finding) => finding.text);

  return { score, grade, findings, blockers, breakdown };
}

/** Rótulo curto do escopo, usado na tela e nos relatórios. */
export const POLICY_LABELS: Record<keyof SecurityPolicy, string> = {
  mfa_required_admin: "MFA obrigatório para administração",
  mfa_required_portal: "MFA obrigatório no portal do cliente",
  mfa_grace_days: "Tolerância após o convite (dias)",
  min_password_length: "Comprimento mínimo da senha",
  require_mixed_case: "Maiúsculas e minúsculas",
  require_number: "Exige número",
  require_symbol: "Exige símbolo",
  block_common_passwords: "Bloqueia senhas vazadas",
  password_history: "Senhas anteriores bloqueadas",
  max_failed_attempts: "Tentativas antes de bloquear",
  session_timeout_minutes: "Expiração da sessão (min)",
};
