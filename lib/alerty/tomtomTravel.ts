/**
 * Cliente de insights TomTom (vía edge function tomtom-travel).
 * Key de API nunca en el cliente — solo EXPO_PUBLIC_TOMTOM_KEY para tiles.
 */

import { supabase } from "../supabase";
import type { TravelDirection } from "./travel/travelMode";
import type { TripPlace } from "./travel/tripPlaces";

export type TomtomDelay = { id: string; label: string; extraMinutes: number };

export type TomtomRouteInfo = {
  source: string;
  summary: string;
  travelTimeMinutes: number | null;
  trafficDelayMinutes: number | null;
  lengthKm: number | null;
  points?: Array<{ lat: number; lng: number }>;
  alternates: Array<{
    summary: string;
    travelTimeMinutes: number;
    trafficDelayMinutes: number;
  }>;
};

export type TomtomPoi = {
  name: string;
  lat: number;
  lng: number;
  distKm: number;
  source?: "tomtom" | "aliado";
  aliado?: boolean;
  badge?: string;
  logoUrl?: string | null;
  promo?: string | null;
  id?: string;
};

export type TomtomTravelPulse = {
  id: string;
  kind: "community" | "alert";
  category: string;
  title: string;
  placeLabel: string;
  createdAt: string;
  status?: string;
  lat: number | null;
  lng: number | null;
  onCorridor: boolean;
  inDestination: boolean;
};

export type TomtomTravelInsights = {
  mock: boolean;
  attribution: string;
  delays: TomtomDelay[];
  route: TomtomRouteInfo | null;
  pois: Record<string, TomtomPoi[]>;
  pulses?: TomtomTravelPulse[];
  originName?: string | null;
  destinationName?: string | null;
  error?: string;
  message?: string;
};

const POI_LABELS: Record<string, string> = {
  gas_station: "Gasolineras",
  ev_charging: "Cargador eléctrico",
  hospital: "Hospitales",
  pharmacy: "Farmacias",
  toll: "Casetas / plazas",
};

export const POI_SECTION_ORDER = [
  "gas_station",
  "ev_charging",
  "hospital",
  "pharmacy",
  "toll",
] as const;

export function poiSectionLabel(key: string): string {
  return POI_LABELS[key] || key;
}

export function poiSectionIcon(
  key: string,
): "water" | "flash" | "medkit" | "medical" | "trail-sign" | "location" {
  switch (key) {
    case "gas_station":
      return "water";
    case "ev_charging":
      return "flash";
    case "hospital":
      return "medkit";
    case "pharmacy":
      return "medical";
    case "toll":
      return "trail-sign";
    default:
      return "location";
  }
}

export function mockTravelInsights(
  origin: TripPlace,
  destination: TripPlace,
): TomtomTravelInsights {
  return {
    mock: true,
    attribution: "Datos de tráfico © TomTom",
    delays: [{ id: "tramo", label: "en el camino", extraMinutes: 8 }],
    route: {
      source: "mock",
      summary: "Ruta con tráfico (demo)",
      travelTimeMinutes: 120,
      trafficDelayMinutes: 10,
      lengthKm: 150,
      points: [
        { lat: origin.lat, lng: origin.lng },
        { lat: destination.lat, lng: destination.lng },
      ],
      alternates: [],
    },
    pois: {
      gas_station: [
        {
          name: "Gasolinera demo",
          lat: origin.lat,
          lng: origin.lng,
          distKm: 0.4,
          source: "tomtom",
        },
      ],
      ev_charging: [],
      hospital: [],
      pharmacy: [
        {
          name: "Farmacia Aliada",
          lat: (origin.lat + destination.lat) / 2,
          lng: (origin.lng + destination.lng) / 2,
          distKm: 0.8,
          source: "aliado",
          aliado: true,
          badge: "Aliado Pulso",
          promo: "Descuento a vecinos Pulso",
        },
      ],
      toll: [],
    },
    pulses: [],
    originName: origin.name,
    destinationName: destination.name,
  };
}

export async function fetchTomtomTravelInsights(opts: {
  origin: TripPlace;
  destination: TripPlace;
  direction?: TravelDirection | null;
  fromLabel?: string | null;
  window?: "6h" | "24h";
}): Promise<TomtomTravelInsights> {
  if (!supabase) {
    return mockTravelInsights(opts.origin, opts.destination);
  }
  try {
    const { data, error } = await supabase.functions.invoke("tomtom-travel", {
      body: {
        origin: {
          lat: opts.origin.lat,
          lng: opts.origin.lng,
          name: opts.origin.name,
        },
        destination: {
          lat: opts.destination.lat,
          lng: opts.destination.lng,
          name: opts.destination.name,
        },
        direction: opts.direction || undefined,
        fromLabel: opts.fromLabel || null,
        window: opts.window || "6h",
      },
    });
    if (error || !data) {
      return mockTravelInsights(opts.origin, opts.destination);
    }
    const payload = data as TomtomTravelInsights & { error?: string; message?: string };
    if (payload.error) {
      return {
        ...mockTravelInsights(opts.origin, opts.destination),
        error: payload.error,
        message: payload.message,
        mock: true,
      };
    }
    return {
      mock: Boolean(payload.mock),
      attribution: payload.attribution || "Datos de tráfico © TomTom",
      delays: payload.delays || [],
      route: payload.route || null,
      pois: payload.pois || {},
      pulses: payload.pulses || [],
      originName: payload.originName || opts.origin.name,
      destinationName: payload.destinationName || opts.destination.name,
    };
  } catch {
    return mockTravelInsights(opts.origin, opts.destination);
  }
}
