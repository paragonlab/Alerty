/**
 * Tipos compartidos del gazetteer por ciudad.
 * Los mapas de colonias viven en archivos por ciudad (culiacanPlaces / mazatlanPlaces).
 */

export type CityPlace = {
  name: string;
  lat: number;
  lng: number;
  aliases?: string[];
};

export type SyncCitySlug = "culiacan" | "mazatlan";
