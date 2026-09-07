import { Platform } from "react-native";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "../supabase";

export const oauthRedirectTo =
  Platform.OS === "web"
    ? makeRedirectUri({ path: "auth-callback" })
    : "alerty://auth-callback";

const AUTH_CODE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const exchanged = new Set<string>();

export function authErrorFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.get("error_description") ?? parsed.searchParams.get("error");
  } catch {
    return null;
  }
}

/** Solo el auth code de Supabase (UUID). Ignora el `code` de Google (`4/0A…`). */
export function authCodeFromUrl(url: string): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (Platform.OS !== "web" && parsed.protocol !== "alerty:") return null;
  const code = parsed.searchParams.get("code");
  if (!code || !AUTH_CODE.test(code)) return null;
  return code;
}

export async function exchangeAuthCodeOnce(code: string) {
  if (!supabase) {
    return { data: { session: null }, error: { message: "Supabase no configurado" } };
  }
  if (exchanged.has(code)) {
    return { data: { session: null }, error: null };
  }
  exchanged.add(code);
  return supabase.auth.exchangeCodeForSession(code);
}
