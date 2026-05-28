export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
};

export const hasSupabase = () => env.supabaseUrl !== "" && env.supabaseAnonKey !== "";
export const hasMapbox = () => env.mapboxToken !== "";
