import { Router } from "express";
import type { Request } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  loadEvolutionConfig,
  registerEvolutionWebhook,
  saveEvolutionConfig,
} from "../lib/whatsapp-settings";

const router = Router();

function getWebhookBaseUrl(req: Request) {
  const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0]?.trim();
  const forwardedHost = (req.headers["x-forwarded-host"] as string | undefined)?.split(",")[0]?.trim();
  const proto = forwardedProto || req.protocol;
  const host = forwardedHost || req.get("host") || "localhost";
  return `${proto}://${host}`;
}

function parseEvolutionConfig(body: unknown) {
  const { apiUrl, apiKey, instanceName } = (body ?? {}) as Record<string, string | undefined>;

  if (!apiUrl?.trim() || !apiKey?.trim() || !instanceName?.trim()) {
    return null;
  }

  try {
    new URL(apiUrl);
  } catch {
    return null;
  }

  return {
    apiUrl: apiUrl.trim(),
    apiKey: apiKey.trim(),
    instanceName: instanceName.trim(),
  };
}

router.get("/config", requireAuth, async (_req, res) => {
  const config = await loadEvolutionConfig();
  res.json(config);
});

router.post("/config", requireAuth, async (req, res) => {
  const config = parseEvolutionConfig(req.body);
  if (!config) {
    res.status(400).json({
      error: "apiUrl, apiKey e instanceName são obrigatórios",
    });
    return;
  }

  const webhookUrl = `${getWebhookBaseUrl(req)}/api/whatsapp/webhook/${encodeURIComponent(config.instanceName)}`;
  try {
    const saved = await saveEvolutionConfig(config, { webhookUrl });
    const webhook = await registerEvolutionWebhook(saved, webhookUrl);
    if (!webhook.ok) {
      console.warn(`[whatsapp-settings] webhook setup failed for ${saved.instanceName}: ${webhook.status}`);
    }
    res.json({ ...saved, webhook });
  } catch (err: any) {
    console.warn(`[whatsapp-settings] webhook setup error for ${config.instanceName}: ${err?.message}`);
    res.json(config);
  }
});

router.post("/webhook/ensure", requireAuth, async (req, res) => {
  const config = await loadEvolutionConfig();
  if (!config) {
    res.status(503).json({ error: "Evolution API configuration not found" });
    return;
  }

  try {
    const webhookUrl = `${getWebhookBaseUrl(req)}/api/whatsapp/webhook/${encodeURIComponent(config.instanceName)}`;
    const webhook = await registerEvolutionWebhook(config, webhookUrl);
    if (!webhook.ok) {
      console.warn(`[whatsapp-settings] webhook ensure failed for ${config.instanceName}: ${webhook.status}`);
    }
    res.json({ ok: true, webhook });
  } catch (err: any) {
    console.warn(`[whatsapp-settings] webhook ensure error for ${config.instanceName}: ${err?.message}`);
    res.json({ ok: false, error: err?.message ?? "Falha ao registrar webhook" });
  }
});

export default router;
