import { createClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";

let supabaseClient: ReturnType<typeof createClient> | null = null;

function getSupabaseClient() {
  const supabaseUrl =
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  return supabaseClient;
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL) &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ??
        process.env.SUPABASE_ANON_KEY ??
        process.env.VITE_SUPABASE_ANON_KEY),
  );
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    res.status(503).json({
      error: "Supabase auth is not configured",
    });
    return;
  }

  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  (req as any).userId = data.user.id;
  next();
}
