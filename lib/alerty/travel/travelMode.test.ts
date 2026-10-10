/**
 * Run: npx tsx lib/alerty/travel/travelMode.test.ts
 */
import {
  CORRIDOR_BUFFER_KM,
  buildTravelSummary,
  collectTravelPulses,
  distanceToPolylineKm,
  isInDestinationCity,
  isNearCorridor,
  resolveCorridor,
  travelShareMessage,
} from "./travelMode";
import { getMexico15BundleCoordinates } from "./corridorMexico15";
import type { AlertItem, CommunityPost } from "../types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function baseAlert(partial: Partial<AlertItem> & Pick<AlertItem, "id" | "lat" | "lng" | "category">): AlertItem {
  return {
    user: {
      id: "u1",
      username: "vecino",
      isVerified: false,
      trustScore: 1,
      level: "vecino",
      followersCount: 0,
    },
    title: partial.title ?? "Aviso de prueba",
    description: "",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    status: partial.status ?? "active",
    media: [],
    upvotes: 0,
    downvotes: 0,
    neighborhood: partial.neighborhood ?? "Carretera",
    ...partial,
  };
}

function basePost(
  partial: Partial<CommunityPost> & Pick<CommunityPost, "id" | "lat" | "lng">,
): CommunityPost {
  return {
    source: "x",
    externalId: "x1",
    authorHandle: "medio",
    text: partial.text ?? "Tráfico lento en la 15",
    url: "https://example.com",
    placeLabel: partial.placeLabel ?? "México 15",
    createdAt: partial.createdAt ?? new Date().toISOString(),
    fetchedAt: partial.createdAt ?? new Date().toISOString(),
    categoryGuess: partial.categoryGuess ?? "bloqueo",
    isDemo: true,
    trustTier: "community",
    ...partial,
  };
}

async function run() {
  const bundle = getMexico15BundleCoordinates();
  assert(bundle.length >= 8, "bundle tiene puntos");

  // Punto sobre Culiacán (inicio del corredor)
  assert(isNearCorridor(24.8091, -107.394, bundle, CORRIDOR_BUFFER_KM), "CUL cerca del corredor");
  // Mazatlán centro
  assert(isNearCorridor(23.2494, -106.4111, bundle, CORRIDOR_BUFFER_KM), "MZT cerca del corredor");
  // Lejos (Durango)
  assert(!isNearCorridor(24.0, -104.65, bundle, CORRIDOR_BUFFER_KM), "Durango fuera");

  assert(isInDestinationCity(23.25, -106.42, "mazatlan"), "MZT destino");
  assert(!isInDestinationCity(24.81, -107.39, "mazatlan"), "CUL no es destino MZT");

  const d = distanceToPolylineKm({ latitude: 24.55, longitude: -107.45 }, bundle);
  assert(d < CORRIDOR_BUFFER_KM, `punto mid-corredor d=${d}`);

  const corridor = await resolveCorridor({ direction: "culiacan_to_mazatlan" });
  assert(corridor.source === "static", "MVP estático");
  assert(corridor.lines.length === 2, "libre + cuota");

  const now = Date.now();
  const alerts: AlertItem[] = [
    baseAlert({
      id: "a1",
      lat: 24.55,
      lng: -107.45,
      category: "bloqueo",
      title: "Lento en la 15",
      createdAt: new Date(now - 2 * 3600_000).toISOString(),
    }),
    baseAlert({
      id: "a2",
      lat: 23.25,
      lng: -106.42,
      category: "accidente",
      title: "Choque menor en Mazatlán",
      neighborhood: "Centro",
      status: "resolved",
      createdAt: new Date(now - 3 * 3600_000).toISOString(),
    }),
    baseAlert({
      id: "a-op",
      lat: 24.55,
      lng: -107.45,
      category: "operativo",
      title: "Operativo",
      createdAt: new Date(now - 30 * 60_000).toISOString(), // < 2h → excluido
    }),
    baseAlert({
      id: "a-far",
      lat: 24.0,
      lng: -104.65,
      category: "robo",
      title: "Lejos",
      createdAt: new Date(now - 1 * 3600_000).toISOString(),
    }),
  ];

  const posts: CommunityPost[] = [
    basePost({
      id: "c1",
      lat: 23.9,
      lng: -106.95,
      text: "Precaución en la cuota",
      categoryGuess: "bloqueo",
      createdAt: new Date(now - 4 * 3600_000).toISOString(),
    }),
  ];

  const pulses = collectTravelPulses({
    alerts,
    communityPosts: posts,
    direction: "culiacan_to_mazatlan",
    window: "24h",
    bundle: corridor.bundle,
  });

  assert(pulses.some((p) => p.id === "a1"), "incluye bloqueo corredor");
  assert(pulses.some((p) => p.id === "a2"), "incluye destino");
  assert(pulses.some((p) => p.id === "c1"), "incluye community");
  assert(!pulses.some((p) => p.id === "a-op"), "operativo <2h fuera");
  assert(!pulses.some((p) => p.id === "a-far"), "fuera del buffer fuera");

  const opReady = collectTravelPulses({
    alerts: [
      baseAlert({
        id: "a-op2",
        lat: 24.55,
        lng: -107.45,
        category: "operativo",
        neighborhood: "Mazatlán",
        createdAt: new Date(now - 3 * 3600_000).toISOString(),
      }),
    ],
    communityPosts: [],
    direction: "culiacan_to_mazatlan",
    window: "24h",
    bundle: corridor.bundle,
  });
  const op = opReady.find((p) => p.id === "a-op2");
  assert(op, "operativo listo tras delay");
  assert(op!.lat === null && op!.lng === null, "operativo sin coords");
  assert(op!.placeLabel.includes("Tramo") || op!.placeLabel.includes("Mazatlán"), "lugar amplio");

  const summary = buildTravelSummary({
    direction: "culiacan_to_mazatlan",
    window: "6h",
    pulses,
  });
  assert(summary.originName === "Culiacán", "origen");
  assert(summary.destinationName === "Mazatlán", "destino");
  assert(summary.cleared >= 1, "cuenta despejados");
  assert(!summary.blurb.toLowerCase().includes("ruta segura"), "no promete ruta segura");
  assert(summary.blurb.includes("comunidad"), "copy comunidad");

  const msg = travelShareMessage(summary);
  assert(msg.includes("Antes de salir"), "share título");
  assert(msg.includes("Culiacán"), "share origen");
  assert(msg.includes("Mazatlán"), "share destino");

  console.log("travelMode.test.ts OK", {
    pulses: pulses.length,
    cleared: summary.cleared,
    lines: corridor.lines.map((l) => l.id),
  });
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
