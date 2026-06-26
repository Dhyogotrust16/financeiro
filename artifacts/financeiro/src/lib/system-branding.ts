import { useEffect, useState } from "react";

const BRANDING_STORAGE_KEY = "financeiro-system-branding";
const BRANDING_EVENT = "financeiro-system-branding-change";

export interface SystemBranding {
  logoDataUrl: string | null;
}

const defaultBranding: SystemBranding = {
  logoDataUrl: null,
};

function readBranding(): SystemBranding {
  if (typeof window === "undefined") return defaultBranding;

  try {
    const raw = window.localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return defaultBranding;

    return { ...defaultBranding, ...JSON.parse(raw) };
  } catch {
    return defaultBranding;
  }
}

export function getSystemBranding() {
  return readBranding();
}

export function saveSystemBranding(branding: SystemBranding) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
  window.dispatchEvent(new CustomEvent(BRANDING_EVENT, { detail: branding }));
}

export function useSystemBranding() {
  const [branding, setBranding] = useState<SystemBranding>(() => readBranding());

  useEffect(() => {
    const sync = () => setBranding(readBranding());

    window.addEventListener("storage", sync);
    window.addEventListener(BRANDING_EVENT, sync);

    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(BRANDING_EVENT, sync);
    };
  }, []);

  return branding;
}
