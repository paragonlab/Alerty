import { Platform } from "react-native";
import { supabase } from "../supabase";

/** En web el origen de la pestaña, para no caer en el Site URL viejo de Supabase. */
export function oauthRedirectTo(): string {
  if (Platform.OS !== "web") return "alerty://auth-callback";
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/auth-callback`;
  }
  return "https://pulso-ciudadano.com/auth-callback";
}

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
