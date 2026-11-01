import { createMiddleware } from "@tanstack/react-start";
import { getCookies } from "@tanstack/react-start/server";

import { createClient } from "./server";

export const supabaseSessionMiddleware = createMiddleware().server(async ({ next }) => {
  const hasSessionCookie = Object.keys(getCookies()).some(
    (name) => name.startsWith("sb-") && name.includes("-auth-token"),
  );

  if (hasSessionCookie) {
    const supabase = createClient();
    const { error } = await supabase.auth.getClaims();

    if (error) {
      throw new Error("Failed to refresh the Supabase session.", { cause: error });
    }
  }

  return next();
});
