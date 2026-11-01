export function getSupabaseConfig() {
  const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
  const supabasePublishableKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Configure them in .env.local.",
    );
  }

  return { supabaseUrl, supabasePublishableKey };
}
