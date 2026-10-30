/**
 * Preferências do usuário persistidas no navegador.
 *
 * Não há tabela de `profiles` no schema atual, então o que é preferência de UI
 * (nome de exibição, cargo, notificações, tema) fica em `localStorage` — o que é
 * credencial (senha, 2FA) nunca é gravado aqui.
 */
import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "patrium:user-settings:v1";

export type UserSettings = {
  displayName: string;
  jobTitle: string;
  /** Interruptores de notificação (ainda sem canal de envio — ver Configurações). */
  notifications: {
    riskAlerts: boolean;
    documentExpiry: boolean;
    weeklyDigest: boolean;
  };
  /**
   * Interruptor local do 2FA. NÃO é MFA de verdade: o provedor de auth atual
   * (Supabase padrão) não tem TOTP habilitado neste projeto.
   */
  twoFactorEnabled: boolean;
};

export const defaultSettings: UserSettings = {
  displayName: "",
  jobTitle: "Gestor de Patrimônio",
  notifications: {
    riskAlerts: true,
    documentExpiry: true,
    weeklyDigest: false,
  },
  twoFactorEnabled: false,
};

function read(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return {
      ...defaultSettings,
      ...parsed,
      notifications: { ...defaultSettings.notifications, ...(parsed.notifications ?? {}) },
    };
  } catch {
    return defaultSettings;
  }
}

/** Lê e persiste as preferências; sincroniza entre abas pelo evento `storage`. */
export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(read());
    setLoaded(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setSettings(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const save = useCallback((next: UserSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* modo privado / cota cheia: mantém só em memória */
    }
  }, []);

  const patch = useCallback(
    (partial: Partial<UserSettings>) => {
      save({ ...read(), ...partial });
    },
    [save],
  );

  return { settings, loaded, save, patch };
}
