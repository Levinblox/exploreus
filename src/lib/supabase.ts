import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, hasSupabase } from "./env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (client) return client;
  client = createClient(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
