/**
 * El motivo real de una edge function que falla.
 *
 * supabase-js envuelve el fallo en un error cuyo mensaje siempre es
 * "Edge Function returned a non-2xx status code" y deja la respuesta real en
 * `context`. Sin abrirla, el vecino ve un texto que no dice nada y nosotros
 * tampoco sabemos qué se rompió.
 */
export async function edgeErrorMessage(error: unknown): Promise<string | null> {
  const res = (error as { context?: Response })?.context;
  if (!res || typeof res.clone !== "function") return null;
  try {
    const body = await res.clone().json();
    const detail = (body as { error?: unknown })?.error;
    return typeof detail === "string" ? detail : null;
  } catch {
    try {
      const text = await res.clone().text();
      return text.trim() ? text.trim().slice(0, 200) : null;
    } catch {
      return null;
    }
  }
}
