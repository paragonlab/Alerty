/**
 * Diccionario de colonias/zonas de Culiacán para geocode textual (edge functions).
 * Misma lista semántica que lib/alerty/constants.ts — mantener alineada al editar.
 */
export const CULIACAN_PLACES: Array<{ name: string; lat: number; lng: number; aliases?: string[] }> = [
  { name: "Las Quintas", lat: 24.8099, lng: -107.3874 },
  { name: "Tres Ríos", lat: 24.821, lng: -107.4032, aliases: ["Tres Rios", "Tresrios"] },
  { name: "Centro", lat: 24.8057, lng: -107.3946, aliases: ["centro de Culiacán", "centro de Culiacan"] },
  { name: "Chapultepec", lat: 24.8175, lng: -107.3783 },
  { name: "La Campiña", lat: 24.8003, lng: -107.4023, aliases: ["La Campina"] },
  { name: "Barrancos", lat: 24.7733, lng: -107.4116 },
  { name: "Humaya", lat: 24.8264, lng: -107.4154 },
  { name: "Infonavit Humaya", lat: 24.836, lng: -107.417 },
  { name: "Stase", lat: 24.7937, lng: -107.3922 },
  { name: "Universidad", lat: 24.8255, lng: -107.3659 },
  { name: "Bachigualato", lat: 24.7581, lng: -107.4471 },
  { name: "Los Pinos", lat: 24.8116, lng: -107.3634 },
  { name: "La Conquista", lat: 24.8457, lng: -107.3743 },
  { name: "Azteca", lat: 24.7989, lng: -107.4311 },
  { name: "Guadalupe", lat: 24.7997, lng: -107.4068 },
  { name: "Las Flores", lat: 24.7905, lng: -107.3842 },
  { name: "Villa Universidad", lat: 24.8351, lng: -107.3869 },
  { name: "6 de Enero", lat: 24.7863, lng: -107.3972, aliases: ["6 de enero"] },
  { name: "Loma de Rodriguera", lat: 24.8574, lng: -107.4161 },
  { name: "Boulevares", lat: 24.8189, lng: -107.4109 },
  { name: "Devísadero", lat: 24.79, lng: -107.39, aliases: ["Devisadero"] },
  { name: "Jardin", lat: 24.802, lng: -107.39, aliases: ["Jardín"] },
];

export function geocodeCuliacanText(text: string): { lat: number; lng: number; placeLabel: string } | null {
  const hay = text.toLowerCase();
  for (const place of CULIACAN_PLACES) {
    const names = [place.name, ...(place.aliases ?? [])];
    for (const n of names) {
      if (hay.includes(n.toLowerCase())) {
        return { lat: place.lat, lng: place.lng, placeLabel: place.name };
      }
    }
  }
  return null;
}
