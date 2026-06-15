import { Router } from "express";
import type { Request, Response } from "express";

const router = Router();

// POST /evolution/proxy
// Body: { apiUrl, apiKey, path, body? }
// Proxies the request to the Evolution API server-side, bypassing CORS.
router.post("/proxy", async (req: Request, res: Response) => {
  const { apiUrl, apiKey, path, body } = req.body as {
    apiUrl?: string;
    apiKey?: string;
    path?: string;
    body?: unknown;
  };

  if (!apiUrl || !apiKey || !path) {
    res.status(400).json({ error: "apiUrl, apiKey and path are required" });
    return;
  }

  const url = `${apiUrl.replace(/\/+$/, "")}${path}`;

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await upstream.text();
    console.log(`[evo-proxy] ${path} → ${upstream.status} — body: ${text.slice(0, 500)}`);

    let json: unknown;
    try { json = JSON.parse(text); } catch { json = text; }

    res.status(upstream.status).json(json);
  } catch (err: any) {
    console.error(`[evo-proxy] fetch error for ${url}: ${err?.message}`);
    res.status(502).json({ error: "Upstream request failed", detail: err?.message });
  }
});

export default router;
