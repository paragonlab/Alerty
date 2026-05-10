import { ALERT_CATEGORIES, CULIACAN_NEIGHBORHOODS, REPUTATION_LEVELS } from "./constants";
import type { AlertItem, AlertUser } from "./types";

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

export const mockSponsoredZones: import("./types").SponsoredZone[] = [
  {
    id: "sponsor-1",
    name: "Farmacias del Ahorro - Centro",
    description: "Zona Segura Activa. Personal capacitado y circuito cerrado. Abierto 24h.",
    lat: 24.8080,
    lng: -107.3945,
    type: "refugio",
  },
  {
    id: "sponsor-2",
    name: "Plaza Forum Culiacán",
    description: "Refugio seguro patrocinado. Cuenta con seguridad privada y protocolos de emergencia.",
    lat: 24.8142,
    lng: -107.4042,
    type: "refugio",
  },
  {
    id: "sponsor-3",
    name: "Gasolinera Chevron Tres Ríos",
    description: "Área iluminada con vigilancia. Negocio operando con normalidad.",
    lat: 24.8210,
    lng: -107.4100,
    type: "anuncio",
  }
];
