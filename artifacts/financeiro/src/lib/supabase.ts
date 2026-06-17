import { createClient } from "@supabase/supabase-js";
import { setAuthTokenGetter, setBaseUrl } from "@workspace/api-client-react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Keep API calls relative so the app works from any Vercel deployment URL.
setBaseUrl(null);

// Register token getter at module level - runs before any React component mounts
// This ensures all API calls always have the token, even on first render
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});
