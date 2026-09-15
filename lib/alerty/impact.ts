import { isSupabaseConfigured, supabase } from "../supabase";

const recorded = new Set<string>();

/**
 * Registra que este usuario vio un pulso, una vez por pulso. Solo alimenta el
 * aviso "lo vieron N" que recibe el autor; no ordena ni destaca nada.
 */
export async function recordAlertView(alertId: string): Promise<void> {
  if (recorded.has(alertId) || !isSupabaseConfigured || !supabase) return;
  recorded.add(alertId);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    await supabase
      .from("alert_views")
      .upsert(
        { alert_id: alertId, viewer_id: userId },
        { onConflict: "alert_id,viewer_id", ignoreDuplicates: true },
      );
  } catch {}
}
