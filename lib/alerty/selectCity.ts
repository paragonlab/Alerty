/**
 * Cambio de ciudad de producto: preferencia local + sync users.city_id + feeds.
 */
import { isSupabaseConfigured, supabase } from "../supabase";
import { CITIES, type CitySlug } from "./city";
import { persistCityPreference } from "./cityPreference";
import { useAlertyStore } from "./store";

/** Actualiza users.city_id si hay sesión (columna de #44). Fallos no bloquean. */
export async function syncUserCityId(cityId: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { error } = await supabase
      .from("users")
      .update({ city_id: cityId })
      .eq("id", session.user.id);
    if (error) {
      // Columna ausente en entornos sin migración #44, o RLS: no tumbar el picker.
      console.warn("syncUserCityId failed", error.message);
    }
  } catch (err) {
    console.warn("syncUserCityId failed", err);
  }
}

/**
 * Selecciona ciudad activa: memoria + AsyncStorage (+ ?city= en web),
 * sync de perfil si hay sesión, y recarga de feeds de esa ciudad.
 */
export async function selectCity(slug: CitySlug): Promise<void> {
  await persistCityPreference(slug);
  await syncUserCityId(CITIES[slug].id);

  const store = useAlertyStore.getState();
  void store.loadAlertsFromSupabase();
  void store.loadSponsoredZones();
  void store.loadCommunityPosts({ refreshNews: true });
  void store.loadWatchedZones();
}
