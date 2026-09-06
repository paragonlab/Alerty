import { router } from "expo-router";
import { isSupabaseConfigured, supabase } from "../supabase";

const AUTH_NEXT_KEY = "alerty_auth_next";

const ALLOWED_EXACT = new Set(["/report", "/premium", "/business"]);

export function isAllowedAuthNext(next: string | undefined): next is string {
  if (!next || next.includes("://") || next.includes("..") || !next.startsWith("/")) {
    return false;
  }
  if (ALLOWED_EXACT.has(next)) return true;
  return /^\/alert\/[0-9a-f-]{8,36}$/i.test(next);
}

let memoryNext: string | undefined;

export function setAuthNext(next?: string) {
  const value = isAllowedAuthNext(next) ? next : undefined;
  memoryNext = value;
  if (typeof sessionStorage === "undefined") return;
  if (value) sessionStorage.setItem(AUTH_NEXT_KEY, value);
  else sessionStorage.removeItem(AUTH_NEXT_KEY);
}

export function consumeAuthNext(): string | undefined {
  let value = memoryNext;
  if (!value && typeof sessionStorage !== "undefined") {
    value = sessionStorage.getItem(AUTH_NEXT_KEY) ?? undefined;
  }
  memoryNext = undefined;
  if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(AUTH_NEXT_KEY);
  return isAllowedAuthNext(value) ? value : undefined;
}

export async function requireSession(nextPath?: string): Promise<boolean> {
  if (isSupabaseConfigured && supabase) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
  }
  setAuthNext(nextPath);
  router.push("/(auth)/login");
  return false;
}
