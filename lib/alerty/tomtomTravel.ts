/**
 * Cliente de insights TomTom (vía edge function tomtom-travel).
 * Key de API nunca en el cliente — solo EXPO_PUBLIC_TOMTOM_KEY para tiles.
 */

import { supabase } from "../supabase";
import type { TravelDirection } from "./travel/travelMode";

export type TomtomDelay = { id: string; label: string; extraMinutes: number };

export type TomtomRouteInfo = {
  source: string;
  summary: string;
  travelTimeMinutes: number | null;
  trafficDelayMinutes: number | null;
  lengthKm: number | null;
  alternates: Array<{
    summary: string;
    travelTimeMinutes: number;
    trafficDelayMinutes: number;
  }>;
};

export type TomtomPoi = { name: string; lat: number; lng: number; distKm: number };

export type TomtomTravelInsights = {
  mock: boolean;
  attribution: string;
  delays: TomtomDelay[];
  route: TomtomRouteInfo | null;
  pois: Record<string, TomtomPoi[]>;
};

const POI_LABELS: Record<string, string> = {
  gas_station: "Gasolineras",
  hospital: "Hospitales",
  pharmacy: "Farmacias",
  toll: "Casetas / plazas",
};

export function poiSectionLabel(key: string): string {
  return POI_LABELS[key] || key;
}

/** Fallback local si la edge no responde (screenshots / offline). */
export function mockTravelInsights(direction: TravelDirection): TomtomTravelInsights {
  return {
    mock: true,
    attribution: "Datos de tráfico © TomTom",
    delays: [
      { id: "elota", label: "cerca de Elota", extraMinutes: 12 },
      { id: "dimas", label: "cerca de Dimas", extraMinutes: 5 },
    ],
    route: {
      source: "mock",
      summary: "México 15D · con tráfico (demo)",
      travelTimeMinutes: 168,
      trafficDelayMinutes: 18,
      lengthKm: 218,
      alternates: [
        { summary: "México 15 libre", travelTimeMinutes: 195, trafficDelayMinutes: 10 },
      ],
    },
    pois: {
      gas_station: [
        { name: "Gasolinera demo · Costa Rica", lat: 24.55, lng: -107.44, distKm: 0.4 },
      ],
      hospital: [
        { name: "Hospital demo · Villa Unión", lat: 23.3, lng: -106.36, distKm: 1.2 },
      ],
      pharmacy: [{ name: "Farmacia demo · Dimas", lat: 23.72, lng: -106.78, distKm: 0.8 }],
      toll: [{ name: "Caseta demo · 15D", lat: 24.4, lng: -107.4, distKm: 0.2 }],
    },
  };
}

export async function fetchTomtomTravelInsights(opts: {
  direction: TravelDirection;
  origin?: { lat: number; lng: number } | null;
  fromLabel?: string | null;
}): Promise<TomtomTravelInsights> {
  if (!supabase) {
    return mockTravelInsights(opts.direction);
  }
  try {
    const { data, error } = await supabase.functions.invoke("tomtom-travel", {
      body: {
        direction: opts.direction,
        origin: opts.origin ?? undefined,
        fromLabel: opts.fromLabel ?? undefined,
      },
    });
    if (error || !data) {
      return mockTravelInsights(opts.direction);
    }
    return {
      mock: Boolean(data.mock),
      attribution: data.attribution || "Datos de tráfico © TomTom",
      delays: Array.isArray(data.delays) ? data.delays : [],
      route: data.route ?? null,
      pois: data.pois && typeof data.pois === "object" ? data.pois : {},
    };
  } catch {
    return mockTravelInsights(opts.direction);
  }
}
