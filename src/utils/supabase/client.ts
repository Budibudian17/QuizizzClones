import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseConfig } from "./config";

let supabaseClient: ReturnType<typeof createBrowserClient> | undefined;
let playerClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!supabaseClient) {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
    supabaseClient = createBrowserClient(supabaseUrl, supabasePublishableKey);
  }

  return supabaseClient;
}

export function createPlayerClient() {
  if (typeof window === "undefined") {
    throw new Error("Player Supabase client is only available in the browser.");
  }
  if (!playerClient) {
    const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();
    const tabKeyStorage = "kampusquiz.player-tab";
    let tabKey = window.sessionStorage.getItem(tabKeyStorage);
    if (!tabKey) {
      tabKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);
      window.sessionStorage.setItem(tabKeyStorage, tabKey);
    }

    const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
    playerClient = createBrowserClient(supabaseUrl, supabasePublishableKey, {
      cookieOptions: { name: `sb-${projectRef}-player-${tabKey}-auth-token` },
      isSingleton: false,
    });
  }

  return playerClient;
}
