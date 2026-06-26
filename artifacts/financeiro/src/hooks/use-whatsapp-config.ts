import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  type EvoConfig,
  ensureEvolutionWebhook,
  fetchEvolutionConfig,
  readStoredEvolutionConfig,
  saveEvolutionConfig,
} from "@/lib/whatsapp-config";

export function useEvolutionConfig() {
  const { getToken, isLoaded } = useAuth();
  const initialConfigRef = useRef<EvoConfig | null>(readStoredEvolutionConfig());
  const [config, setConfig] = useState<EvoConfig | null>(initialConfigRef.current);
  const [isReady, setIsReady] = useState(Boolean(initialConfigRef.current));

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    let cancelled = false;

    (async () => {
      const remote = await fetchEvolutionConfig(getToken);
      if (cancelled) return;

      if (remote) {
        setConfig(remote);
        setIsReady(true);
        void ensureEvolutionWebhook(getToken).catch(() => null);
        return;
      }

      if (initialConfigRef.current) {
        try {
          const saved = await saveEvolutionConfig(initialConfigRef.current, getToken, {
            clearDraft: false,
          });
          if (!cancelled) {
            setConfig(saved);
          }
          void ensureEvolutionWebhook(getToken).catch(() => null);
        } catch {
          if (!cancelled) {
            setConfig(initialConfigRef.current);
          }
          void ensureEvolutionWebhook(getToken).catch(() => null);
        }
      }

      if (!cancelled) {
        setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded]);

  const persistConfig = useCallback(
    async (nextConfig: EvoConfig) => {
      const saved = await saveEvolutionConfig(nextConfig, getToken);
      setConfig(saved);
      setIsReady(true);
      return saved;
    },
    [getToken],
  );

  return {
    config,
    isReady,
    setConfig,
    saveConfig: persistConfig,
  };
}
