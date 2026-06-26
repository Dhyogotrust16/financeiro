export interface EvoConfig {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
}

export const EVOLUTION_CONFIG_STORAGE_KEY = "evo_config";
export const EVOLUTION_CONFIG_DRAFT_KEY = "evo_config_draft";

export const EMPTY_EVOLUTION_CONFIG: EvoConfig = {
  apiUrl: "",
  apiKey: "",
  instanceName: "",
};

export function normalizeEvolutionConfig(config: EvoConfig): EvoConfig {
  return {
    apiUrl: config.apiUrl.trim().replace(/\/+$/, ""),
    apiKey: config.apiKey.trim(),
    instanceName: config.instanceName.trim(),
  };
}

function parseEvolutionConfig(raw: string | null): EvoConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<EvoConfig>;
    if (!parsed.apiUrl || !parsed.apiKey || !parsed.instanceName) {
      return null;
    }
    return normalizeEvolutionConfig({
      apiUrl: parsed.apiUrl,
      apiKey: parsed.apiKey,
      instanceName: parsed.instanceName,
    });
  } catch {
    return null;
  }
}

export function readStoredEvolutionConfig(): EvoConfig | null {
  try {
    return parseEvolutionConfig(localStorage.getItem(EVOLUTION_CONFIG_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function storeEvolutionConfig(config: EvoConfig) {
  localStorage.setItem(
    EVOLUTION_CONFIG_STORAGE_KEY,
    JSON.stringify(normalizeEvolutionConfig(config)),
  );
}

export function clearStoredEvolutionConfig() {
  localStorage.removeItem(EVOLUTION_CONFIG_STORAGE_KEY);
}

export function readStoredEvolutionDraft(): Partial<EvoConfig> | null {
  try {
    const raw = localStorage.getItem(EVOLUTION_CONFIG_DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Partial<EvoConfig>) : null;
  } catch {
    return null;
  }
}

export function storeEvolutionDraft(values: Partial<EvoConfig>) {
  localStorage.setItem(EVOLUTION_CONFIG_DRAFT_KEY, JSON.stringify(values));
}

export function clearStoredEvolutionDraft() {
  localStorage.removeItem(EVOLUTION_CONFIG_DRAFT_KEY);
}

async function requestWhatsAppApi(
  path: string,
  getToken: () => Promise<string | null>,
  init: RequestInit,
) {
  const token = await getToken();
  if (!token) {
    throw new Error("Autenticação indisponível");
  }

  return fetch(`/api/whatsapp/${path}`, {
    ...init,
    headers: (() => {
      const headers = new Headers(init.headers);
      headers.set("Authorization", `Bearer ${token}`);
      return headers;
    })(),
  });
}

async function requestEvolutionConfig(
  getToken: () => Promise<string | null>,
  init: RequestInit,
) {
  return requestWhatsAppApi("config", getToken, init);
}

export async function fetchEvolutionConfig(getToken: () => Promise<string | null>) {
  try {
    const response = await requestEvolutionConfig(getToken, { method: "GET" });
    if (!response.ok) {
      return null;
    }

    const data = (await response.json().catch(() => null)) as Partial<EvoConfig> | null;
    if (!data?.apiUrl || !data.apiKey || !data.instanceName) {
      return null;
    }

    const config = normalizeEvolutionConfig({
      apiUrl: data.apiUrl,
      apiKey: data.apiKey,
      instanceName: data.instanceName,
    });
    storeEvolutionConfig(config);
    return config;
  } catch {
    return null;
  }
}

export async function saveEvolutionConfig(
  config: EvoConfig,
  getToken: () => Promise<string | null>,
  options: { clearDraft?: boolean } = {},
) {
  const normalized = normalizeEvolutionConfig(config);
  const response = await requestEvolutionConfig(getToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(normalized),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || `HTTP ${response.status}`);
  }

  const data = (await response.json().catch(() => null)) as Partial<EvoConfig> | null;
  const saved = data?.apiUrl && data.apiKey && data.instanceName
    ? normalizeEvolutionConfig({
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        instanceName: data.instanceName,
      })
    : normalized;

  storeEvolutionConfig(saved);
  if (options.clearDraft !== false) {
    clearStoredEvolutionDraft();
  }
  return saved;
}

export async function ensureEvolutionWebhook(getToken: () => Promise<string | null>) {
  try {
    const response = await requestWhatsAppApi("webhook/ensure", getToken, {
      method: "POST",
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new Error(text || `HTTP ${response.status}`);
    }

    return (await response.json().catch(() => null)) as { ok?: boolean } | null;
  } catch {
    return null;
  }
}
