import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

type EventPayload = {
  event_type: string;
  metadata?: Record<string, unknown>;
};

const VISIT_SESSION_KEY = "alerty_visit_session";
const VISIT_MARK_KEY = "alerty_visit_marked";
/** En este dispositivo no sumar visitas al dashboard (admin / moderador). */
const SKIP_TRAFFIC_KEY = "alerty_skip_traffic";

function newSessionId() {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getSkipTraffic(): Promise<boolean> {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    return localStorage.getItem(SKIP_TRAFFIC_KEY) === "1";
  }
  try {
    return (await AsyncStorage.getItem(SKIP_TRAFFIC_KEY)) === "1";
  } catch {
    return false;
  }
}

async function setSkipTraffic() {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(SKIP_TRAFFIC_KEY, "1");
    return;
  }
  try {
    await AsyncStorage.setItem(SKIP_TRAFFIC_KEY, "1");
  } catch {
    // ignore
  }
}

/** Moderadores no cuentan; al detectarlo, este navegador/dispositivo queda fuera. */
async function shouldSkipTraffic(): Promise<boolean> {
  if (await getSkipTraffic()) return true;
  if (!supabase) return false;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("users")
      .select("is_moderator")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.is_moderator) {
      await setSkipTraffic();
      return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function getVisitSessionId(): Promise<string> {
  if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
    const existing = sessionStorage.getItem(VISIT_SESSION_KEY);
    if (existing) return existing;
    const id = newSessionId();
    sessionStorage.setItem(VISIT_SESSION_KEY, id);
    return id;
  }
  try {
    const existing = await AsyncStorage.getItem(VISIT_SESSION_KEY);
    if (existing) return existing;
    const id = newSessionId();
    await AsyncStorage.setItem(VISIT_SESSION_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

async function visitAlreadyMarked(sessionId: string): Promise<boolean> {
  if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
    return sessionStorage.getItem(VISIT_MARK_KEY) === sessionId;
  }
  try {
    return (await AsyncStorage.getItem(VISIT_MARK_KEY)) === sessionId;
  } catch {
    return false;
  }
}

async function markVisit(sessionId: string) {
  if (Platform.OS === "web" && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(VISIT_MARK_KEY, sessionId);
    return;
  }
  try {
    await AsyncStorage.setItem(VISIT_MARK_KEY, sessionId);
  } catch {
    // ignore
  }
}

export const trackEvent = async ({ event_type, metadata = {} }: EventPayload) => {
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  try {
    await supabase.from("app_events").insert({
      user_id: user.id,
      event_type,
      metadata,
    });
  } catch {
    // Ignore if analytics table is not configured for this project.
  }
};

/** Una visita por sesión de app/navegador. Cuenta también sin cuenta. */
export async function trackVisit() {
  if (!supabase) return;
  if (await shouldSkipTraffic()) return;
  try {
    const sessionId = await getVisitSessionId();
    if (await visitAlreadyMarked(sessionId)) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("app_events").insert({
      user_id: user?.id ?? null,
      session_id: sessionId,
      event_type: "visit",
      metadata: { guest: !user, platform: Platform.OS },
    });
    if (!error) await markVisit(sessionId);
  } catch {
    // ignore
  }
}

/** ~1 ping por minuto en pantalla; el admin suma los pings como minutos aproximados. */
export async function trackSessionPing() {
  if (!supabase) return;
  if (await shouldSkipTraffic()) return;
  try {
    const sessionId = await getVisitSessionId();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("app_events").insert({
      user_id: user?.id ?? null,
      session_id: sessionId,
      event_type: "session_ping",
      metadata: { guest: !user, platform: Platform.OS },
    });
  } catch {
    // ignore
  }
}

export function startSessionPings() {
  void trackVisit();
  void trackSessionPing();
  const id = setInterval(() => {
    void trackSessionPing();
  }, 60_000);
  return () => clearInterval(id);
}
