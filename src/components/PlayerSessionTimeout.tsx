import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { createPlayerClient } from "@/utils/supabase/client";
import { isPlayerSessionIdleExpired } from "@/utils/player-session-idle";

const LAST_ACTIVITY_KEY = "kampusquiz.player-last-activity";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "mousemove"] as const;
const ACTIVITY_STORAGE_THROTTLE_MS = 15_000;
const SESSION_CHECK_INTERVAL_MS = 30_000;

export function PlayerSessionTimeout() {
  const navigate = useNavigate();

  useEffect(() => {
    const client = createPlayerClient();
    let active = true;
    let isPermanentPlayer = false;
    let expirationStarted = false;
    let lastActivityAt = 0;
    let lastActivityStoredAt = 0;

    const readStoredActivity = (): number => {
      try {
        const stored = Number(window.sessionStorage.getItem(LAST_ACTIVITY_KEY));
        return Number.isFinite(stored) ? stored : 0;
      } catch (cause) {
        console.error("Could not read the player idle timeout.", cause);
        return 0;
      }
    };

    const storeActivity = (timestamp: number) => {
      try {
        window.sessionStorage.setItem(LAST_ACTIVITY_KEY, String(timestamp));
        lastActivityStoredAt = timestamp;
      } catch (cause) {
        console.error("Could not persist player activity time.", cause);
      }
    };

    const removeStoredActivity = () => {
      try {
        window.sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (cause) {
        console.error("Could not clear player activity time.", cause);
      }
    };

    const expireSession = async () => {
      if (!active || expirationStarted) return;
      expirationStarted = true;
      removeStoredActivity();
      try {
        const { error } = await client.auth.signOut();
        if (error) throw error;
      } catch (cause) {
        console.error("Failed to sign out an idle player session.", cause);
      } finally {
        if (active) {
          await navigate({
            to: "/player-dashboard",
            search: { reason: "idle-timeout" },
            replace: true,
          });
        }
      }
    };

    const checkSession = () => {
      if (isPermanentPlayer && isPlayerSessionIdleExpired(lastActivityAt, Date.now())) {
        void expireSession();
      }
    };

    const onActivity = () => {
      if (!isPermanentPlayer || expirationStarted) return;
      const now = Date.now();
      lastActivityAt = now;
      if (now - lastActivityStoredAt >= ACTIVITY_STORAGE_THROTTLE_MS) {
        storeActivity(now);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkSession();
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = window.setInterval(checkSession, SESSION_CHECK_INTERVAL_MS);

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      const user = session?.user;
      isPermanentPlayer = Boolean(user && user.is_anonymous !== true);

      if (!isPermanentPlayer) {
        if (event === "SIGNED_OUT") removeStoredActivity();
        lastActivityAt = 0;
        lastActivityStoredAt = 0;
        return;
      }

      if (event === "SIGNED_IN") {
        lastActivityAt = Date.now();
        storeActivity(lastActivityAt);
        return;
      }

      lastActivityAt = readStoredActivity();
      if (lastActivityAt === 0) {
        lastActivityAt = Date.now();
        storeActivity(lastActivityAt);
      }
      lastActivityStoredAt = lastActivityAt;
      checkSession();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
      window.clearInterval(intervalId);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [navigate]);

  return null;
}
