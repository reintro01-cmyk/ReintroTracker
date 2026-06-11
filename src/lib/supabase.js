import { createClient } from "@supabase/supabase-js";

// Read the Supabase project from env so dev and production can point at SEPARATE projects
// (separate users/data). Falls back to the dev project when env vars are unset, so local dev
// works with no .env. In production (Vercel), set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// to the PRODUCTION project — otherwise it falls back to dev. The anon/publishable key is safe
// to expose (RLS-protected); never put the service_role key here.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://fmaqipsfrfpfpoqzotnk.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_dKjRhjUESeG1kSYY23-GLA_rn-iqdke";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
