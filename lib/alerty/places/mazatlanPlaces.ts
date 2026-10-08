/**
 * Gazetteer inicial de Mazatlán (cliente).
 * Mantener alineado con supabase/functions/_shared/places/mazatlanPlaces.ts
 */

import type { CityPlace } from "./types";

export const MAZATLAN_PLACES: CityPlace[] = [
  {
    name: "Centro",
    lat: 23.1994,
    lng: -106.4236,
    aliases: ["Centro Histórico", "Centro Historico", "centro de Mazatlán", "centro de Mazatlan", "zona centro"],
  },
  { name: "Olas Altas", lat: 23.1925, lng: -106.4258 },
  {
    name: "Zona Dorada",
    lat: 23.2395,
    lng: -106.455,
    aliases: ["Zona Dorada Mazatlán", "Zona Dorada Mazatlan", "Golden Zone"],
  },
  {
    name: "Marina",
    lat: 23.2708,
    lng: -106.4417,
    aliases: ["Marina Mazatlán", "Marina Mazatlan", "Marina El Cid"],
  },
  {
    name: "Sábalo",
    lat: 23.255,
    lng: -106.46,
    aliases: ["Sabalo", "Sábalo Country", "Sabalo Country", "Sábalo Country Club"],
  },
  { name: "Cerritos", lat: 23.312, lng: -106.485, aliases: ["Playa Cerritos"] },
  {
    name: "El Castillo",
    lat: 23.22,
    lng: -106.34,
    aliases: ["penal de El Castillo", "CERESO El Castillo"],
  },
  { name: "Playa Sur", lat: 23.18, lng: -106.42, aliases: ["Sur"] },
  { name: "Palos Prietos", lat: 23.21, lng: -106.43 },
  { name: "Francisco Villa", lat: 23.23, lng: -106.41 },
  {
    name: "Benito Juárez",
    lat: 23.225,
    lng: -106.4,
    aliases: ["Benito Juarez"],
  },
  {
    name: "Lomas de Mazatlán",
    lat: 23.24,
    lng: -106.42,
    aliases: ["Lomas de Mazatlan", "Lomas"],
  },
  { name: "El Venadillo", lat: 23.28, lng: -106.42, aliases: ["Venadillo"] },
  { name: "Urías", lat: 23.2, lng: -106.39, aliases: ["Urias"] },
  { name: "El Habal", lat: 23.16, lng: -106.38, aliases: ["Habal"] },
  {
    name: "Gutiérrez Nájera",
    lat: 23.215,
    lng: -106.415,
    aliases: ["Gutierrez Najera", "Gutiérrez Najera"],
  },
  { name: "Libertad", lat: 23.218, lng: -106.405 },
  {
    name: "Estero",
    lat: 23.265,
    lng: -106.43,
    aliases: ["Estero del Yugo", "El Estero"],
  },
  {
    name: "Aeropuerto",
    lat: 23.1614,
    lng: -106.2661,
    aliases: ["aeropuerto de Mazatlán", "aeropuerto de Mazatlan", "Gral. Rafael Buelna"],
  },
  {
    name: "Isla de la Piedra",
    lat: 23.182,
    lng: -106.395,
    aliases: ["Isla Piedra"],
  },
  {
    name: "Nuevo Mazatlán",
    lat: 23.29,
    lng: -106.47,
    aliases: ["Nuevo Mazatlan"],
  },
  { name: "Malecón", lat: 23.205, lng: -106.428, aliases: ["Malecon", "Paseo Olas Altas"] },
];

export const MAZATLAN_CITY_CENTER = { lat: 23.2494, lng: -106.4111 };
export const MAZATLAN_APPROX_LABEL = "Mazatlán (aproximado)";
