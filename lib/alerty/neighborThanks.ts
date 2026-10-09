/**
 * Reconocimiento calmado al vecino que avisó — sin rankings ni “top reporteros”.
 */

export function neighborThanksLine(opts: {
  username: string | null | undefined;
  notifiedCount: number;
}): string | null {
  const n = Math.max(0, Math.floor(opts.notifiedCount));
  if (n < 1) return null;

  const raw = (opts.username ?? "").trim().replace(/^@/, "");
  const handle = raw ? `@${raw}` : "un vecino";
  const people = n === 1 ? "1 persona" : `${n} personas`;

  return `Gracias a ${handle} se avisó a ${people}`;
}

/** Variante corta para chips / banners. */
export function neighborThanksShort(opts: {
  username: string | null | undefined;
  notifiedCount: number;
}): string | null {
  const line = neighborThanksLine(opts);
  return line;
}
