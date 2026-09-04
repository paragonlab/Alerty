/**
 * Cuentas de X de confianza para Culiacán / Sinaloa (medios y autoridades).
 *
 * Cómo editar:
 * 1) Constante abajo (redeploy sync-x-community), o
 * 2) Secret `X_ALLOWLIST=handle1:medio,handle2:oficial` (sin @, minúsculas ok).
 *
 * Un handle en allowlist se sincroniza aunque el texto no tenga keyword fuerte;
 * sigue aplicándose filtro anti-ruido y preferencia de geo.
 */
export type TrustTier = "community" | "medio" | "oficial" | "news";

export type AllowlistEntry = {
  handle: string; // sin @
  tier: "medio" | "oficial";
};

export const DEFAULT_X_ALLOWLIST: AllowlistEntry[] = [
  { handle: "LineaDirectaMX", tier: "medio" },
  { handle: "DebateCuliacan", tier: "medio" },
  { handle: "ElDebate", tier: "medio" },
  { handle: "Riodoce", tier: "medio" },
  { handle: "Noroeste", tier: "medio" },
  { handle: "SSPSinaloa", tier: "oficial" },
  { handle: "CuliacanGob", tier: "oficial" },
  { handle: "PC_Culiacan", tier: "oficial" },
  { handle: "FGESinaloa", tier: "oficial" },
];

export function parseAllowlistEnv(raw: string | undefined): AllowlistEntry[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [handleRaw, tierRaw] = part.split(":");
      const handle = (handleRaw ?? "").replace(/^@/, "").trim();
      const tier = tierRaw?.trim() === "oficial" ? "oficial" : "medio";
      return handle ? { handle, tier } : null;
    })
    .filter((x): x is AllowlistEntry => Boolean(x));
}

export function mergeAllowlist(envRaw?: string): AllowlistEntry[] {
  const fromEnv = parseAllowlistEnv(envRaw);
  const map = new Map<string, AllowlistEntry>();
  for (const e of [...DEFAULT_X_ALLOWLIST, ...fromEnv]) {
    map.set(e.handle.toLowerCase(), { handle: e.handle, tier: e.tier });
  }
  return Array.from(map.values());
}

export function trustForHandle(
  username: string | undefined,
  allowlist: AllowlistEntry[],
): TrustTier {
  if (!username) return "community";
  const key = username.replace(/^@/, "").toLowerCase();
  const hit = allowlist.find((a) => a.handle.toLowerCase() === key);
  return hit?.tier ?? "community";
}
