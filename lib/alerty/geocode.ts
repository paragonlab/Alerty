import { Platform } from "react-native";
import * as Location from "expo-location";

/**
 * Punto del mapa → dirección legible, para que el negocio vea en palabras
 * dónde acaba de poner su pin. La búsqueda al revés (escribir y encontrar) ya
 * la hace `searchCuliacanPlaces`.
 *
 * En el teléfono usa el geocodificador del sistema, que no cuesta ni necesita
 * llave. En el navegador no existe, así que va a Nominatim, el mismo OSM de los
 * mapas de respaldo: gratis, con un límite de una consulta por segundo que aquí
 * sobra.
 */
export async function addressFromCoords(
  latitude: number,
  longitude: number,
): Promise<string | null> {
  if (Platform.OS !== "web") {
    try {
      const [hit] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (!hit) return null;
      const partes = [hit.street, hit.streetNumber, hit.district, hit.city].filter(Boolean);
      return partes.length > 0 ? partes.join(", ") : null;
    } catch {
      return null;
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
      { signal: ctrl.signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const row = (await res.json()) as { display_name?: string };
    return row.display_name ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
