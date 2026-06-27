import { saveSystemBranding } from "@/lib/system-branding";

export interface UserProfileSettings {
  phone: string;
  role: string;
  company: string;
  bio: string;
  logoDataUrl: string | null;
}

export interface PartnerSettings {
  id: string;
  name: string;
  email: string;
  percentage: number;
}

export const EMPTY_PROFILE_SETTINGS: UserProfileSettings = {
  phone: "",
  role: "",
  company: "",
  bio: "",
  logoDataUrl: null,
};

async function authorizedRequest(path: string, getToken: () => Promise<string | null>, init: RequestInit = {}) {
  const token = await getToken();
  if (!token) {
    throw new Error("Autenticacao indisponivel");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);

  try {
    return await fetch(`/api/${path}`, {
      ...init,
      headers,
      signal: init.signal ?? controller.signal,
    });
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseProfile(data: Partial<UserProfileSettings> | null | undefined): UserProfileSettings {
  return {
    phone: data?.phone ?? "",
    role: data?.role ?? "",
    company: data?.company ?? "",
    bio: data?.bio ?? "",
    logoDataUrl: data?.logoDataUrl ?? null,
  };
}

function parsePartners(data: unknown): PartnerSettings[] {
  if (!Array.isArray(data)) return [];

  return data
    .map((item) => {
      const partner = item as Partial<PartnerSettings>;
      return {
        id: String(partner.id ?? ""),
        name: String(partner.name ?? ""),
        email: String(partner.email ?? ""),
        percentage: Number(partner.percentage ?? 0),
      };
    })
    .filter((partner) => partner.id && partner.name && Number.isFinite(partner.percentage));
}

export async function fetchUserProfileSettings(getToken: () => Promise<string | null>) {
  const response = await authorizedRequest("settings/profile", getToken);
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar as configuracoes.");
  }

  return parseProfile(await response.json().catch(() => null));
}

export async function saveUserProfileSettings(
  settings: UserProfileSettings,
  getToken: () => Promise<string | null>,
) {
  const response = await authorizedRequest("settings/profile", getToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || "Nao foi possivel salvar as configuracoes.");
  }

  const saved = parseProfile(await response.json().catch(() => null));
  saveSystemBranding({ logoDataUrl: saved.logoDataUrl });
  return saved;
}

export async function fetchPartners(getToken: () => Promise<string | null>) {
  const response = await authorizedRequest("partners", getToken);
  if (!response.ok) {
    throw new Error("Nao foi possivel carregar os socios.");
  }

  return parsePartners(await response.json().catch(() => null));
}

export async function savePartnersRemote(
  partners: PartnerSettings[],
  getToken: () => Promise<string | null>,
) {
  const response = await authorizedRequest("partners", getToken, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partners }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(text || "Nao foi possivel salvar os socios.");
  }

  return parsePartners(await response.json().catch(() => null));
}
