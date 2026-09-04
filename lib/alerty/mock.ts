import { ALERT_CATEGORIES, CULIACAN_CENTER, CULIACAN_NEIGHBORHOODS, REPUTATION_LEVELS } from "./constants";
import type { AlertItem, AlertUser, CommunityPost } from "./types";

const randomPick = <T,>(values: readonly T[]): T =>
  values[Math.floor(Math.random() * values.length)];

const makeUser = (seed: number): AlertUser => {
  const verified = seed % 7 === 0;
  const trustScore = verified ? 92 : 55 + (seed % 35);
  const level =
    trustScore >= REPUTATION_LEVELS.HEROE.minScore
      ? "HEROE"
      : trustScore >= REPUTATION_LEVELS.PROTECTOR.minScore
        ? "PROTECTOR"
        : trustScore >= REPUTATION_LEVELS.VIGIA.minScore
          ? "VIGIA"
          : "CIUDADANO";

  return {
    id: `user-${seed}`,
    username: verified ? `@LineaDirecta${seed}` : `@ciudadano${seed}`,
    avatarUrl: null,
    isVerified: verified,
    trustScore,
    level,
    followersCount: verified ? 1200 + seed * 3 : 40 + seed * 2,
  };
};

export const baseAlerts: AlertItem[] = Array.from({ length: 20 }).map((_, index) => {
  const neighborhood = randomPick(CULIACAN_NEIGHBORHOODS);
  const createdAt = new Date(Date.now() - index * 9 * 60 * 1000).toISOString();
  const category = randomPick(ALERT_CATEGORIES);
  const user = makeUser(index + 1);
  const hasMedia = index % 3 === 0;

  return {
    id: `seed-${index + 1}`,
    user,
    category,
    lat: neighborhood.latitude + (Math.random() - 0.5) * 0.01,
    lng: neighborhood.longitude + (Math.random() - 0.5) * 0.01,
    neighborhood: neighborhood.name,
    description:
      index % 2 === 0
        ? `Reporte inicial en ${neighborhood.name}. Mantente atento.`
        : `Movilidad afectada cerca de ${neighborhood.name}.`,
    createdAt,
    status: "active",
    media: hasMedia
      ? [
          {
            id: `media-${index}`,
            url: "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80",
            type: "image",
          },
        ]
      : [],
    upvotes: Math.floor(Math.random() * 18) + 1,
    downvotes: Math.floor(Math.random() * 4),
  };
});

/** Posts DEMO de X — solo para UI sin token / sin Supabase. Nunca fingir que son live. */
export const demoCommunityPosts: CommunityPost[] = [
  {
    id: "demo-x-1",
    source: "x",
    externalId: "demo-culiacan-1",
    authorHandle: "@DemoPulsoX",
    authorName: "Demo Comunidad X",
    text: "DEMO — Ejemplo de post de X: reportan congestión y posible bloqueo cerca del centro de Culiacán. Esto NO es una alerta oficial de Pulso ni un tweet en vivo.",
    url: "https://x.com/DemoPulsoX/status/demo-culiacan-1",
    mediaUrl: null,
    lat: CULIACAN_CENTER.latitude,
    lng: CULIACAN_CENTER.longitude,
    placeLabel: "Culiacán (X)",
    createdAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    fetchedAt: new Date().toISOString(),
    categoryGuess: "bloqueo",
    isDemo: true,
    trustTier: "community",
  },
  {
    id: "demo-x-2",
    source: "x",
    externalId: "demo-culiacan-2",
    authorHandle: "@DemoPulsoX",
    authorName: "Demo Comunidad X",
    text: "DEMO — Ejemplo de post de X: vecinos comentan detonaciones lejanas por la zona de Las Quintas. Contenido de muestra, no en vivo.",
    url: "https://x.com/DemoPulsoX/status/demo-culiacan-2",
    mediaUrl: "https://images.unsplash.com/photo-1594819047050-99defca0ab4d?w=800",
    lat: 24.8125,
    lng: -107.388,
    placeLabel: "Las Quintas",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    fetchedAt: new Date().toISOString(),
    categoryGuess: "detonaciones",
    isDemo: true,
    trustTier: "community",
  },
  {
    id: "demo-x-3",
    source: "x",
    externalId: "demo-culiacan-3",
    authorHandle: "@DemoMedioLocal",
    authorName: "Demo Medio Local",
    text: "DEMO — Ejemplo de post de medio: accidente vial reportado cerca de Tres Ríos. Etiquetado como demo para no confundir con alertas ciudadanas.",
    url: "https://x.com/DemoMedioLocal/status/demo-culiacan-3",
    mediaUrl: null,
    lat: 24.818,
    lng: -107.401,
    placeLabel: "Tres Ríos",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    fetchedAt: new Date().toISOString(),
    categoryGuess: "accidente",
    isDemo: true,
    trustTier: "medio",
  },
  {
    id: "demo-rss-1",
    source: "rss",
    externalId: "demo-rss-culiacan-1",
    authorHandle: "@LineaDirectaMX",
    authorName: "Línea Directa",
    text: "DEMO — Noticia local de muestra: autoridades atienden reporte de bloqueo vial en la zona centro. No es una alerta ciudadana de Pulso.",
    url: "https://example.com/demo-noticia-culiacan",
    mediaUrl: null,
    lat: 24.8057,
    lng: -107.3946,
    placeLabel: "Centro",
    createdAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    fetchedAt: new Date().toISOString(),
    categoryGuess: "bloqueo",
    isDemo: true,
    trustTier: "news",
  },
];

export const createRandomAlert = (): AlertItem => {
  const neighborhood = randomPick(CULIACAN_NEIGHBORHOODS);
  const category = randomPick(ALERT_CATEGORIES);
  const seed = Math.floor(Math.random() * 1000);
  const user = makeUser(seed);
  const hasMedia = seed % 4 === 0;

  return {
    id: `live-${Date.now()}`,
    user,
    category,
    lat: neighborhood.latitude + (Math.random() - 0.5) * 0.008,
    lng: neighborhood.longitude + (Math.random() - 0.5) * 0.008,
    neighborhood: neighborhood.name,
    description: `Alerta reportada en ${neighborhood.name}.`,
    createdAt: new Date().toISOString(),
    status: "active",
    media: hasMedia
      ? [
          {
            id: `media-live-${seed}`,
            url: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=600&q=80",
            type: "image",
          },
        ]
      : [],
    upvotes: Math.floor(Math.random() * 6),
    downvotes: Math.floor(Math.random() * 2),
  };
};

