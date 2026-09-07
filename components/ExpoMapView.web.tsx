import React, {
  Children,
  createElement,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import type { AlertCategory } from "../lib/alerty/types";
import { CATEGORY_ICONS } from "../lib/alerty/constants";
import { riskColor, type GridCell } from "../lib/alerty/risk";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

/** Pause fancy pulse rings when many pins (mobile Safari). */
const PULSE_SIMPLIFY_AT = 10;

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

type MapHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  onPress?: () => void;
  children?: React.ReactNode;
  tracksViewChanges?: boolean;
};

type AlertPinMeta = {
  kind: "alert";
  color: string;
  duration: number;
  category?: AlertCategory;
  hasMedia?: boolean;
  isVerified?: boolean;
  lowConnection?: boolean;
  avatarUrl?: string | null;
};

type SponsorPinMeta = {
  kind: "sponsor";
  color: string;
  icon: "shield" | "star";
};

type CommunityPinMeta = {
  kind: "community";
  isDemo: boolean;
  color: string;
  avatarUrl?: string | null;
  mediaUrl?: string | null;
  source?: "x" | "rss";
};

type PinMeta = AlertPinMeta | SponsorPinMeta | CommunityPinMeta;

type CollectedMarker = MarkerProps & { meta: PinMeta };

export function Marker(_props: MarkerProps) {
  return null;
}

export type HeatmapPoint = {
  latitude: number;
  longitude: number;
  weight?: number;
};

export type HeatmapProps = {
  points: HeatmapPoint[];
  radius?: number;
  opacity?: number;
  gradient?: {
    colors: string[];
    startPoints: number[];
    colorMapSize?: number;
  };
};

export function Heatmap(_props: HeatmapProps) {
  return null;
}

export type PolygonProps = {
  coordinates: { latitude: number; longitude: number }[];
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export function Polygon(_props: PolygonProps) {
  return null;
}

export type CircleProps = {
  center: { latitude: number; longitude: number };
  radius: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
};

export function Circle(_props: CircleProps) {
  return null;
}

export const PROVIDER_GOOGLE = "google";

let mapsLoad: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  const g = (window as any).google;
  if (g?.maps?.Map) return Promise.resolve();
  if (!API_KEY) {
    return Promise.reject(new Error("missing-key"));
  }
  if (mapsLoad) return mapsLoad;
  mapsLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-pulso-gmaps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script-error")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-pulso-gmaps", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script-error"));
    document.head.appendChild(script);
  });
  return mapsLoad;
}

let leafletLoad: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  if ((window as any).L?.map) return Promise.resolve();
  if (leafletLoad) return leafletLoad;
  leafletLoad = new Promise((resolve, reject) => {
    if (!document.querySelector("link[data-pulso-leaflet]")) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      css.setAttribute("data-pulso-leaflet", "1");
      document.head.appendChild(css);
    }
    const existing = document.querySelector("script[data-pulso-leaflet-js]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("leaflet-error")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-pulso-leaflet-js", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("leaflet-error"));
    document.head.appendChild(script);
  });
  return leafletLoad;
}

const GRID_THEME = {
  success: "#1F9D6E",
  mapYellow: "#E5C548",
  mapOrange: "#E9792F",
  mapRed: "#D9342B",
};

function ensurePulseStyles() {
  if (typeof document === "undefined") return;
  let style = document.querySelector("style[data-pulso-glow-markers]") as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("data-pulso-glow-markers", "1");
    document.head.appendChild(style);
  }
  style.textContent = `
@keyframes pulso-halo {
  0%, 100% { transform: scale(0.9); opacity: var(--pulso-halo-min, 0.2); }
  50% { transform: scale(1.05); opacity: var(--pulso-halo-max, 0.35); }
}
@keyframes pulso-ring {
  0% { transform: scale(0.8); opacity: 0.45; }
  70% { opacity: 0.12; }
  100% { transform: scale(1.7); opacity: 0; }
}
@keyframes pulso-beat {
  0%, 100% { opacity: 0; }
  8% { opacity: 0.55; }
  16% { opacity: 0; }
  24% { opacity: 0.25; }
  32% { opacity: 0; }
}
.pulso-pin {
  position: relative;
  width: 72px;
  height: 72px;
  margin-left: -36px;
  margin-top: -36px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  will-change: transform;
}
.pulso-pin__halo {
  position: absolute;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  background: var(--pulso-color);
  background: radial-gradient(circle, color-mix(in srgb, var(--pulso-color) 85%, white) 0%, var(--pulso-color) 55%, transparent 78%);
  animation: pulso-halo calc(var(--pulso-duration) * 1.6) ease-in-out infinite;
  pointer-events: none;
}
.pulso-pin__ring {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 2px solid var(--pulso-color);
  background: transparent;
  animation: pulso-ring var(--pulso-duration) ease-out infinite;
  pointer-events: none;
}
.pulso-pin__ring--delayed {
  animation-delay: calc(var(--pulso-duration) * 0.5);
}
.pulso-pin__dot {
  position: relative;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: var(--pulso-color);
  background: linear-gradient(160deg, color-mix(in srgb, var(--pulso-color) 70%, white) 0%, var(--pulso-color) 45%, color-mix(in srgb, var(--pulso-color) 75%, black) 100%);
  border: 2.5px solid #fff;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--pulso-color) 55%, transparent), 0 0 12px color-mix(in srgb, var(--pulso-color) 35%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.pulso-pin__highlight {
  position: absolute;
  top: 2px;
  left: 16%;
  right: 16%;
  height: 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.5);
  pointer-events: none;
}
.pulso-pin__heartbeat {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  background: #fff;
  opacity: 0;
  animation: pulso-beat calc(var(--pulso-duration)) ease-in-out infinite;
  pointer-events: none;
}
.pulso-pin__icon {
  position: relative;
  z-index: 2;
  width: 10px;
  height: 10px;
  color: #fff;
  display: block;
}
.pulso-pin__icon svg {
  width: 100%;
  height: 100%;
  display: block;
  fill: currentColor;
}
.pulso-pin__badges {
  position: absolute;
  top: 2px;
  right: 0;
  display: flex;
  gap: 2px;
  z-index: 4;
  pointer-events: none;
}
.pulso-pin__badge {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #fff;
  border: 1px solid rgba(0,0,0,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5A4C3B;
}
.pulso-pin__badge--verified { color: #2C7BE5; }
.pulso-pin--simple .pulso-pin__ring--delayed,
.pulso-pin--simple .pulso-pin__heartbeat {
  display: none;
}
.pulso-pin--static .pulso-pin__ring,
.pulso-pin--static .pulso-pin__heartbeat {
  display: none;
}
.pulso-pin--static .pulso-pin__halo {
  animation: none;
  opacity: 0.4;
  transform: scale(1);
}
.pulso-sponsor {
  position: relative;
  width: 32px;
  height: 32px;
  margin-left: -16px;
  margin-top: -16px;
  border-radius: 999px;
  background: var(--pulso-color);
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  color: #fff;
}
.pulso-sponsor svg {
  width: 16px;
  height: 16px;
  fill: currentColor;
}
.pulso-community {
  position: relative;
  width: 40px;
  height: 40px;
  margin-left: -20px;
  margin-top: -20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
}
.pulso-community__pin {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: var(--pulso-color, #0F1419);
  border: 2.5px solid var(--pulso-color, #1D9BF0);
  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  overflow: hidden;
  position: relative;
}
.pulso-community__pin svg {
  width: 12px;
  height: 12px;
  fill: currentColor;
}
.pulso-community__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.pulso-community__source {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: var(--pulso-color, #1D9BF0);
  border: 1px solid #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.pulso-community__source svg {
  width: 7px;
  height: 7px;
  fill: currentColor;
}
.pulso-community__demo {
  position: absolute;
  top: 0;
  right: 0;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: #F59E0B;
  border: 1px solid #fff;
  color: #fff;
  font-size: 8px;
  font-weight: 700;
  line-height: 12px;
  text-align: center;
  font-family: system-ui, sans-serif;
  z-index: 2;
}
.pulso-pin__avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
  display: block;
}
.pulso-pin__avatar-ring {
  position: absolute;
  inset: 0;
  border-radius: 999px;
  border: 2px solid var(--pulso-color);
  pointer-events: none;
  z-index: 3;
}
@media (prefers-reduced-motion: reduce) {
  .pulso-pin__halo,
  .pulso-pin__ring,
  .pulso-pin__heartbeat {
    animation: none !important;
  }
  .pulso-pin__halo { opacity: 0.5; transform: scale(1); }
  .pulso-pin__ring { display: none; }
}
.pulso-leaflet-pin {
  background: none !important;
  border: none !important;
}
.pulso-leaflet-pin .pulso-pin,
.pulso-leaflet-pin .pulso-community,
.pulso-leaflet-pin .pulso-sponsor {
  margin: 0 !important;
}
.pulso-leaflet-pin .pulso-pin {
  width: 48px;
  height: 48px;
}
.pulso-leaflet-pin .pulso-pin__dot {
  width: 16px;
  height: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
}
.leaflet-container {
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  font-family: inherit;
}
`;
}

function regionToZoom(delta?: number) {
  if (!delta || delta <= 0) return 13;
  const zoom = Math.round(Math.log2(360 / delta));
  return Math.min(18, Math.max(8, zoom));
}

function readBackgroundColor(style: unknown): string | null {
  if (!style) return null;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i -= 1) {
      const found = readBackgroundColor(style[i]);
      if (found) return found;
    }
    return null;
  }
  if (typeof style === "object" && style !== null && "backgroundColor" in style) {
    const bg = (style as { backgroundColor?: unknown }).backgroundColor;
    return typeof bg === "string" ? bg : null;
  }
  return null;
}

function isGlowLikeProps(props: Record<string, unknown>): boolean {
  return (
    typeof props.color === "string" &&
    typeof props.duration === "number" &&
    typeof props.category === "string"
  );
}

function findGlowProps(node: React.ReactNode): AlertPinMeta | null {
  let found: AlertPinMeta | null = null;
  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;
    const props = child.props as Record<string, unknown>;
    if (isGlowLikeProps(props)) {
      found = {
        kind: "alert",
        color: props.color as string,
        duration: props.duration as number,
        category: props.category as AlertCategory,
        hasMedia: Boolean(props.hasMedia),
        isVerified: Boolean(props.isVerified),
        lowConnection: Boolean(props.lowConnection),
        avatarUrl: typeof props.avatarUrl === "string" ? props.avatarUrl : null,
      };
      return;
    }
    if (props.children != null) {
      found = findGlowProps(props.children as React.ReactNode);
    }
  });
  return found;
}

function findSponsorMeta(node: React.ReactNode): SponsorPinMeta | null {
  let color: string | null = null;
  let icon: "shield" | "star" | null = null;

  const walk = (n: React.ReactNode) => {
    Children.forEach(n, (child) => {
      if (!isValidElement(child)) return;
      const props = child.props as {
        style?: unknown;
        name?: string;
        children?: React.ReactNode;
      };
      const bg = readBackgroundColor(props.style);
      if (bg) color = bg;
      if (typeof props.name === "string") {
        if (props.name.includes("shield")) icon = "shield";
        else if (props.name.includes("star")) icon = "star";
      }
      if (props.children != null) walk(props.children);
    });
  };
  walk(node);

  if (!color) return null;
  return { kind: "sponsor", color, icon: icon ?? "star" };
}

/** Detecta CommunityMarker vía markerKind / isDemo en props del elemento. */
function findCommunityMeta(node: React.ReactNode): CommunityPinMeta | null {
  let found: CommunityPinMeta | null = null;
  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;
    const props = child.props as {
      markerKind?: string;
      isDemo?: boolean;
      color?: string;
      categoryGuess?: string | null;
      authorAvatarUrl?: string | null;
      mediaUrl?: string | null;
      source?: "x" | "rss";
    };
    if (props.markerKind === "community" || "isDemo" in props) {
      found = {
        kind: "community",
        isDemo: Boolean(props.isDemo),
        color: typeof props.color === "string" ? props.color : "#1D9BF0",
        avatarUrl: typeof props.authorAvatarUrl === "string" ? props.authorAvatarUrl : null,
        mediaUrl: typeof props.mediaUrl === "string" ? props.mediaUrl : null,
        source: props.source === "rss" ? "rss" : "x",
      };
    }
  });
  return found;
}

function collectMarkerProps(node: React.ReactNode, out: CollectedMarker[] = []): CollectedMarker[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as MarkerProps & { children?: React.ReactNode };
    const coord = props?.coordinate;
    if (
      coord &&
      typeof coord.latitude === "number" &&
      typeof coord.longitude === "number" &&
      Number.isFinite(coord.latitude) &&
      Number.isFinite(coord.longitude)
    ) {
      const glow = findGlowProps(props.children);
      const community = findCommunityMeta(props.children);
      const meta: PinMeta =
        glow ??
        community ??
        findSponsorMeta(props.children) ?? {
          kind: "alert",
          color: "#E53935",
          duration: 1700,
        };
      out.push({ ...props, meta });
      return;
    }
    if (props?.children != null) {
      collectMarkerProps(props.children, out);
    }
  });
  return out;
}

function splitCssColor(color?: string): { color: string; opacity?: number } {
  if (!color) return { color: "#E53935" };
  if (/^#[0-9a-fA-F]{8}$/.test(color)) {
    return {
      color: color.slice(0, 7),
      opacity: parseInt(color.slice(7, 9), 16) / 255,
    };
  }
  return { color };
}

function aggregateHeatPoints(points: HeatmapPoint[]): HeatmapPoint[] {
  const bucket = 0.01;
  const cells = new Map<string, { lat: number; lng: number; weight: number }>();
  for (const p of points) {
    const lat = Math.round(p.latitude / bucket) * bucket;
    const lng = Math.round(p.longitude / bucket) * bucket;
    const key = `${lat},${lng}`;
    const cur = cells.get(key);
    const w = typeof p.weight === "number" && p.weight > 0 ? p.weight : 1;
    if (cur) cur.weight += w;
    else cells.set(key, { lat, lng, weight: w });
  }
  return [...cells.values()].map((c) => ({ latitude: c.lat, longitude: c.lng, weight: c.weight }));
}

function heatPixelRadius(weight: number): number {
  return Math.min(5, 3 + Math.sqrt(weight));
}

function metersForPixels(lat: number, zoom: number, px: number): number {
  const metersPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return Math.max(6, px * metersPerPx);
}

function collectHeatmap(node: React.ReactNode): HeatmapProps | null {
  let found: HeatmapProps | null = null;
  Children.forEach(node, (child) => {
    if (found || !isValidElement(child)) return;
    const props = child.props as HeatmapProps & { children?: React.ReactNode };
    if (Array.isArray(props.points)) {
      found = props;
      return;
    }
    if (props.children != null) {
      found = collectHeatmap(props.children);
    }
  });
  return found;
}

function collectPolygons(node: React.ReactNode, out: PolygonProps[] = []): PolygonProps[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as PolygonProps & { children?: React.ReactNode; cells?: GridCell[] };
    if (Array.isArray(props.coordinates) && props.coordinates.length >= 3) {
      out.push(props);
      return;
    }
    if (Array.isArray(props.cells)) {
      for (const cell of props.cells) {
        if (!Array.isArray(cell.coordinates) || cell.coordinates.length < 3) continue;
        const color = riskColor(cell.level, GRID_THEME);
        out.push({
          coordinates: cell.coordinates,
          fillColor: `${color}55`,
          strokeColor: `${color}AA`,
          strokeWidth: 1,
        });
      }
      return;
    }
    if (props.children != null) {
      collectPolygons(props.children, out);
    }
  });
  return out;
}

/** Minimal Ionicons-like SVGs for category identity on HTML overlays. */
const ICON_SVGS: Record<string, string> = {
  warning:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48c-16 0-31 9-39 24L36 404c-8 15-7 33 2 47s25 22 42 22h352c17 0 33-8 42-22s10-32 2-47L295 72c-8-15-23-24-39-24zm0 120c16 0 28 13 28 29v120c0 16-12 29-28 29s-28-13-28-29V197c0-16 12-29 28-29zm0 224a32 32 0 110-64 32 32 0 010 64z"/></svg>',
  "warning-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linejoin="round" d="M85.57 446.25h340.86a32 32 0 0028.17-47.17L284.18 82.58c-12.09-22.44-44.27-22.44-56.36 0L57.4 399.08a32 32 0 0028.17 47.17z"/><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" d="M256 192v96M256 360h.01"/></svg>',
  "car-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linejoin="round" d="M80 224l34.68-83.23A24 24 0 01136.24 128h239.52a24 24 0 0121.56 12.77L432 224m-352 0h352v144a16 16 0 01-16 16H96a16 16 0 01-16-16z"/><circle cx="144" cy="336" r="32" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="368" cy="336" r="32" fill="none" stroke="currentColor" stroke-width="32"/></svg>',
  "volume-high-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M126 192H56a8 8 0 00-8 8v112a8 8 0 008 8h70l132 96V96z"/><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M352 192c17 17 25 40 25 64s-8 47-25 64M400 144c32 32 48 74 48 112s-16 80-48 112"/></svg>',
  "nuclear-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><circle cx="256" cy="256" r="192" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="256" cy="256" r="40"/><path fill="none" stroke="currentColor" stroke-width="32" d="M256 96v80M256 336v80M96 256h80M336 256h80"/></svg>',
  "checkmark-circle-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" d="M448 256c0-106-86-192-192-192S64 150 64 256s86 192 192 192 192-86 192-192z"/><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M352 176L217.6 336 160 272"/></svg>',
  "hand-right-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M80 320V144a32 32 0 0164 0v112M144 256V80a32 32 0 0164 0v160M208 240V96a32 32 0 0164 0v160M272 224v-48a32 32 0 0164 0v176c0 64-48 96-96 96h-48c-64 0-112-40-128-96l-32-96a32 32 0 0160-20"/></svg>',
  "car-sport-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linejoin="round" d="M80 240l40-96h272l40 96M64 240h384v112a24 24 0 01-24 24H88a24 24 0 01-24-24z"/><circle cx="144" cy="336" r="24" fill="none" stroke="currentColor" stroke-width="32"/><circle cx="368" cy="336" r="24" fill="none" stroke="currentColor" stroke-width="32"/></svg>',
  "shield-checkmark-outline":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M256 48c-64 32-128 32-176 40v128c0 96 64 176 176 248 112-72 176-152 176-248V88c-48-8-112-8-176-40z"/><path fill="none" stroke="currentColor" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" d="M192 272l48 48 96-96"/></svg>',
  "alert-circle":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm0 304a24 24 0 1124-24 24 24 0 01-24 24zm20-72h-40V144h40z"/></svg>',
  flame:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M394.23 197.56a300.43 300.43 0 00-53.37-90C329.5 89.32 306.31 64 256 64c0 55.4-28.26 84.5-47.63 110.19-18 23.81-32.8 43.48-32.8 72.1 0 38.44 22.53 66.53 56.51 83.21-6.72-21-10.9-41.07-10.9-62.28 0-58.75 48.55-95.07 91.56-130.9 8.5-7 16.27-13.43 23.53-19.63 19.4 31.53 30.68 59.33 30.68 92.33 0 45.21-16 73-36.32 103.67-4.09 6.14-8.4 12.13-12.87 18.08-23.49 31.32-51.5 53.44-51.5 92.83 0 26.18 10.61 49 27.58 66.31C162.47 439 96 384.36 96 284.49c0-61.09 29.73-118.8 77.42-171.24C187.12 96.7 219.63 64 256 32c86.85 67.52 138.43 126 138.43 200.26 0 77.47-43.66 129-87.12 165.49 13.54-18.68 22.58-40.87 22.58-67.91 0-43.78-24.07-74.71-47.22-105.28z"/></svg>',
  water:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48s-144 160-144 256a144 144 0 00288 0C400 208 256 48 256 48zm0 336a80 80 0 01-80-80c0-44 48-112 80-152 32 40 80 108 80 152a80 80 0 01-80 80z"/></svg>',
  shield:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48c-64 32-128 32-176 40v128c0 96 64 176 176 248 112-72 176-152 176-248V88c-48-8-112-8-176-40z"/><path fill="#fff" d="M224 288l-40-40 22-22 18 18 72-72 22 22z"/></svg>',
  star:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48l55 150h158l-128 93 49 151-134-97-134 97 49-151-128-93h158z"/></svg>',
  twitter:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M389.2 48h70.6L305.6 224.2 487 464H345L233.7 318.6 106.5 464H35.8l164.9-188.5L26.8 48h145.6l100.5 132.9L389.2 48zm-24.8 373.8h39.1L151.1 88h-42l255.3 333.8z"/></svg>',
  newspaper:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M96 80v352a16 16 0 0016 16h288a16 16 0 0016-16V96a16 16 0 00-16-16H112a16 16 0 00-16 16zm48 48h224v48H144zm0 96h224v32H144zm0 80h144v32H144zM64 128v288a32 32 0 0032 32h16V112H80a16 16 0 00-16 16z"/></svg>',
  camera:
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M352 128l-24-48H184l-24 48H80v288h352V128zm-96 240a80 80 0 1180-80 80 80 0 01-80 80z"/></svg>',
  "checkmark-circle":
    '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M256 48C141.31 48 48 141.31 48 256s93.31 208 208 208 208-93.31 208-208S370.69 48 256 48zm99 167L236.29 334.29a16 16 0 01-22.62 0L157 277.66a16 16 0 1122.63-22.63l45.35 45.36L332.37 192.4A16 16 0 11355 215z"/></svg>',
};

function categoryIconSvg(category?: AlertCategory): string {
  const name = category ? CATEGORY_ICONS[category] : "alert-circle";
  return ICON_SVGS[name] ?? ICON_SVGS["alert-circle"];
}

function buildAlertPinElement(meta: AlertPinMeta, simplify: boolean): HTMLDivElement {
  const el = document.createElement("div");
  const staticPulse = Boolean(meta.lowConnection);
  const showAvatar = Boolean(meta.avatarUrl);
  el.className = `pulso-pin${staticPulse ? " pulso-pin--static" : ""}${simplify && !staticPulse ? " pulso-pin--simple" : ""}`;
  el.style.setProperty("--pulso-color", meta.color);
  el.style.setProperty("--pulso-duration", `${Math.max(700, meta.duration)}ms`);
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", meta.category ? `Alerta ${meta.category}` : "Alerta");

  const coreInner = showAvatar
    ? `<img class="pulso-pin__avatar" src="${escapeAttr(meta.avatarUrl!)}" alt="" /><span class="pulso-pin__avatar-ring"></span>`
    : `
        <div class="pulso-pin__highlight"></div>
        ${simplify || staticPulse ? "" : '<div class="pulso-pin__heartbeat"></div>'}
        <span class="pulso-pin__icon">${categoryIconSvg(meta.category)}</span>
      `;

  if (simplify || staticPulse) {
    el.innerHTML = `<div class="pulso-pin__dot">${coreInner}</div>`;
  } else {
    el.innerHTML = `
      <div class="pulso-pin__halo"></div>
      <div class="pulso-pin__ring"></div>
      <div class="pulso-pin__dot">${coreInner}</div>
    `;
  }

  const badges: string[] = [];
  if (meta.hasMedia) {
    badges.push(`<span class="pulso-pin__badge">${ICON_SVGS.camera}</span>`);
  }
  if (meta.isVerified) {
    badges.push(`<span class="pulso-pin__badge pulso-pin__badge--verified">${ICON_SVGS["checkmark-circle"]}</span>`);
  }
  if (badges.length) {
    const row = document.createElement("div");
    row.className = "pulso-pin__badges";
    row.innerHTML = badges.join("");
    el.appendChild(row);
  }

  return el;
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildSponsorPinElement(meta: SponsorPinMeta): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "pulso-sponsor";
  el.style.setProperty("--pulso-color", meta.color);
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  el.setAttribute("aria-label", meta.icon === "shield" ? "Refugio" : "Aliado");
  el.innerHTML = ICON_SVGS[meta.icon] ?? ICON_SVGS.star;
  return el;
}

function buildCommunityPinElement(meta: CommunityPinMeta): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "pulso-community";
  el.style.setProperty("--pulso-color", meta.color);
  el.setAttribute("role", "button");
  el.setAttribute("tabindex", "0");
  const isRss = meta.source === "rss";
  el.setAttribute(
    "aria-label",
    meta.isDemo
      ? isRss
        ? "Noticia (DEMO)"
        : "Post de X (DEMO)"
      : isRss
        ? "Noticia / Comunidad"
        : "Post de X / Comunidad",
  );
  const imageUrl = meta.avatarUrl || meta.mediaUrl || null;
  const fallback = isRss ? ICON_SVGS.newspaper : ICON_SVGS.twitter;
  const sourceIcon = isRss ? ICON_SVGS.newspaper : ICON_SVGS.twitter;
  const pinInner = imageUrl
    ? `<img class="pulso-community__avatar" src="${escapeAttr(imageUrl)}" alt="" />`
    : fallback;
  el.innerHTML = `
    <div class="pulso-community__pin">${pinInner}</div>
    <span class="pulso-community__source">${sourceIcon}</span>
    ${meta.isDemo ? '<span class="pulso-community__demo">D</span>' : ""}
  `;
  return el;
}

type OverlayHandle = {
  setMap: (map: unknown) => void;
};

/**
 * Pin HTML overlay.
 * - Cancels map long-press on pointerdown (map mousedown still arms the timer;
 *   pin stopPropagation often blocks map mouseup → ZoneRiskCard stole the preview).
 * - Fires onPress on click only (not pointerup) so the opening click cannot hit a
 *   freshly mounted Modal backdrop and immediately dismiss it.
 */
function createHtmlOverlay(
  g: any,
  map: any,
  position: { lat: number; lng: number },
  content: HTMLElement,
  onPress?: () => void,
  onPinInteract?: () => void,
): OverlayHandle {
  class PulsoOverlay extends g.maps.OverlayView {
    div: HTMLElement | null = null;
    listeners: Array<() => void> = [];

    onAdd() {
      this.div = content;
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(content);

      let lastFire = 0;
      const cancelMapGesture = (e: Event) => {
        e.stopPropagation();
        onPinInteract?.();
      };
      const fire = (e: Event) => {
        e.preventDefault?.();
        e.stopPropagation();
        onPinInteract?.();
        const now = Date.now();
        if (now - lastFire < 400) return;
        lastFire = now;
        onPress?.();
      };
      content.addEventListener("pointerdown", cancelMapGesture);
      content.addEventListener("mousedown", cancelMapGesture);
      content.addEventListener("touchstart", cancelMapGesture, { passive: true });
      content.addEventListener("click", fire);
      content.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fire(e);
        }
      });
      this.listeners.push(() => content.removeEventListener("pointerdown", cancelMapGesture));
      this.listeners.push(() => content.removeEventListener("mousedown", cancelMapGesture));
      this.listeners.push(() => content.removeEventListener("touchstart", cancelMapGesture));
      this.listeners.push(() => content.removeEventListener("click", fire));
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(new g.maps.LatLng(position.lat, position.lng));
      if (!point) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
      this.div.style.position = "absolute";
    }

    onRemove() {
      this.listeners.forEach((off) => off());
      this.listeners = [];
      this.div?.parentNode?.removeChild(this.div);
      this.div = null;
    }
  }

  const overlay = new PulsoOverlay() as unknown as OverlayHandle;
  overlay.setMap(map);
  return overlay;
}

const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

type MapViewProps = {
  children?: React.ReactNode;
  style?: unknown;
  initialRegion?: Region;
  userInterfaceStyle?: "dark" | "light";
  onPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  onLongPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  pitchEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  provider?: unknown;
};

function pinElement(meta: PinMeta, simplify: boolean): HTMLDivElement {
  if (meta.kind === "sponsor") return buildSponsorPinElement(meta);
  if (meta.kind === "community") return buildCommunityPinElement(meta);
  return buildAlertPinElement(meta, simplify);
}

const ExpoMapView = forwardRef<MapHandle, MapViewProps>(function ExpoMapView(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const engineRef = useRef<"google" | "leaflet" | null>(null);
  const overlaysRef = useRef<OverlayHandle[]>([]);
  const heatCirclesRef = useRef<any[]>([]);
  const polygonsRef = useRef<any[]>([]);
  const leafletGroupRef = useRef<any>(null);
  const longPressTimer = useRef<number | null>(null);
  const mapDraggedRef = useRef(false);
  const longPressFiredRef = useRef(false);
  const onPressRef = useRef(props.onPress);
  onPressRef.current = props.onPress;
  const onLongPressRef = useRef(props.onLongPress);
  onLongPressRef.current = props.onLongPress;
  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };
  const cancelLongPressRef = useRef(cancelLongPress);
  cancelLongPressRef.current = cancelLongPress;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mapEpoch, setMapEpoch] = useState(0);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      const map = mapRef.current;
      if (!map || !region) return;
      if (engineRef.current === "leaflet") {
        map.setView([region.latitude, region.longitude], regionToZoom(region.latitudeDelta));
        return;
      }
      map.panTo({ lat: region.latitude, lng: region.longitude });
      map.setZoom(regionToZoom(region.latitudeDelta));
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    const region = props.initialRegion ?? {
      latitude: 24.8091,
      longitude: -107.394,
      latitudeDelta: 0.16,
    };

    const startLeaflet = () =>
      loadLeaflet().then(() => {
        if (cancelled || !hostRef.current) return;
        ensurePulseStyles();
        hostRef.current.innerHTML = "";
        const L = (window as any).L;
        const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "&copy; OpenStreetMap",
          maxZoom: 19,
        }).addTo(map);
        map.setView([region.latitude, region.longitude], regionToZoom(region.latitudeDelta));
        mapRef.current = map;
        engineRef.current = "leaflet";

        map.on("contextmenu", (e: any) => {
          if (!e?.latlng) return;
          longPressFiredRef.current = true;
          onLongPressRef.current?.({
            nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } },
          });
        });
        map.on("mousedown", (e: any) => {
          if (!e?.latlng) return;
          mapDraggedRef.current = false;
          longPressFiredRef.current = false;
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
          const latlng = e.latlng;
          longPressTimer.current = window.setTimeout(() => {
            longPressFiredRef.current = true;
            onLongPressRef.current?.({
              nativeEvent: { coordinate: { latitude: latlng.lat, longitude: latlng.lng } },
            });
          }, 550);
        });
        map.on("dragstart", () => {
          mapDraggedRef.current = true;
          cancelLongPressRef.current();
        });
        map.on("mouseup", () => cancelLongPressRef.current());
        map.on("click", (e: any) => {
          if (!e?.latlng) return;
          if (mapDraggedRef.current || longPressFiredRef.current) return;
          onPressRef.current?.({
            nativeEvent: { coordinate: { latitude: e.latlng.lat, longitude: e.latlng.lng } },
          });
        });

        const triggerResize = () => map.invalidateSize();
        requestAnimationFrame(triggerResize);
        if (typeof ResizeObserver !== "undefined" && hostRef.current) {
          resizeObserver = new ResizeObserver(() => triggerResize());
          resizeObserver.observe(hostRef.current);
        }
        setMapEpoch((n) => n + 1);
        setReady(true);
      });

    const startGoogle = () =>
      loadGoogleMaps().then(() => {
        if (cancelled || !hostRef.current) return;
        ensurePulseStyles();
        const g = (window as any).google;
        const map = new g.maps.Map(hostRef.current, {
          center: { lat: region.latitude, lng: region.longitude },
          zoom: regionToZoom(region.latitudeDelta),
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: props.userInterfaceStyle === "dark" ? DARK_STYLES : [],
        });
        mapRef.current = map;
        engineRef.current = "google";

        const emitLongPress = (latLng: any) => {
          longPressFiredRef.current = true;
          onLongPressRef.current?.({
            nativeEvent: {
              coordinate: { latitude: latLng.lat(), longitude: latLng.lng() },
            },
          });
        };

        map.addListener("rightclick", (e: any) => {
          if (e?.latLng) emitLongPress(e.latLng);
        });
        map.addListener("mousedown", (e: any) => {
          if (!e?.latLng) return;
          mapDraggedRef.current = false;
          longPressFiredRef.current = false;
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
          const latLng = e.latLng;
          longPressTimer.current = window.setTimeout(() => emitLongPress(latLng), 550);
        });
        map.addListener("mouseup", () => {
          cancelLongPressRef.current();
        });
        map.addListener("dragstart", () => {
          mapDraggedRef.current = true;
          cancelLongPressRef.current();
        });
        map.addListener("click", (e: any) => {
          if (!e?.latLng) return;
          if (mapDraggedRef.current || longPressFiredRef.current) return;
          onPressRef.current?.({
            nativeEvent: {
              coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() },
            },
          });
        });

        const triggerResize = () => {
          if (!mapRef.current || !hostRef.current) return;
          g.maps.event.trigger(mapRef.current, "resize");
          const center = mapRef.current.getCenter?.();
          if (center) mapRef.current.setCenter(center);
        };

        requestAnimationFrame(triggerResize);
        if (typeof ResizeObserver !== "undefined" && hostRef.current) {
          resizeObserver = new ResizeObserver(() => triggerResize());
          resizeObserver.observe(hostRef.current);
        }

        setMapEpoch((n) => n + 1);
        setReady(true);
      });

    const boot = API_KEY
      ? startGoogle().catch(() => startLeaflet())
      : startLeaflet();

    boot.catch(() => {
      if (!cancelled) setError("No se pudo cargar el mapa.");
    });

    return () => {
      cancelled = true;
      setReady(false);
      resizeObserver?.disconnect();
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
      heatCirclesRef.current.forEach((c) => (c.setMap ?? c.circle?.setMap)?.(null));
      heatCirclesRef.current = [];
      polygonsRef.current.forEach((p) => p.setMap?.(null));
      polygonsRef.current = [];
      leafletGroupRef.current?.clearLayers?.();
      if (engineRef.current === "leaflet") {
        mapRef.current?.remove?.();
      }
    };
    // Map instance is created once; region/theme updates aren't remounted on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const engine = engineRef.current;
    if (!map || !ready || !engine) return;

    ensurePulseStyles();
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    heatCirclesRef.current.forEach((c) => (c.setMap ?? c.circle?.setMap)?.(null));
    heatCirclesRef.current = [];
    polygonsRef.current.forEach((p) => p.setMap?.(null));
    polygonsRef.current = [];
    leafletGroupRef.current?.clearLayers?.();

    const markers = collectMarkerProps(props.children);
    const polygons = collectPolygons(props.children);
    const heat = collectHeatmap(props.children);
    const alertCount = markers.filter((m) => m.meta.kind === "alert").length;
    const simplify = alertCount >= PULSE_SIMPLIFY_AT;
    const heatPoints = aggregateHeatPoints(
      (heat?.points ?? []).filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude)),
    );

    if (engine === "leaflet") {
      const L = (window as any).L;
      if (!L) return;
      const group = L.layerGroup().addTo(map);
      leafletGroupRef.current = group;

      heatPoints.forEach((p) => {
        const weight = typeof p.weight === "number" && p.weight > 0 ? p.weight : 1;
        group.addLayer(
          L.circleMarker([p.latitude, p.longitude], {
            radius: heatPixelRadius(weight),
            fillColor: "#E84F1F",
            fillOpacity: Math.min(0.18, 0.08 + 0.03 * Math.sqrt(weight)),
            stroke: false,
            interactive: false,
          }),
        );
      });

      polygons.forEach((poly) => {
        const fill = splitCssColor(poly.fillColor);
        const stroke = splitCssColor(poly.strokeColor);
        group.addLayer(
          L.polygon(
            poly.coordinates.map((c) => [c.latitude, c.longitude]),
            {
              fillColor: fill.color,
              fillOpacity: fill.opacity ?? 0.35,
              color: stroke.color,
              opacity: stroke.opacity ?? 0.7,
              weight: poly.strokeWidth ?? 1,
            },
          ),
        );
      });

      markers.forEach((p) => {
        const content = pinElement(p.meta, simplify);
        const size = p.meta.kind === "alert" ? 48 : p.meta.kind === "community" ? 40 : 32;
        const icon = L.divIcon({
          html: content.outerHTML,
          className: "pulso-leaflet-pin",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const marker = L.marker([p.coordinate.latitude, p.coordinate.longitude], {
          icon,
          keyboard: false,
        });
        if (p.onPress) {
          marker.on("click", (e: any) => {
            L.DomEvent.stopPropagation(e);
            p.onPress?.();
          });
        }
        group.addLayer(marker);
      });
      return;
    }

    const g = typeof window !== "undefined" ? (window as any).google : null;
    if (!g?.maps) return;

    markers.forEach((p) => {
      const overlay = createHtmlOverlay(
        g,
        map,
        { lat: p.coordinate.latitude, lng: p.coordinate.longitude },
        pinElement(p.meta, simplify),
        p.onPress,
        () => cancelLongPressRef.current(),
      );
      overlaysRef.current.push(overlay);
    });

    polygons.forEach((poly) => {
      const fill = splitCssColor(poly.fillColor);
      const stroke = splitCssColor(poly.strokeColor);
      const shape = new g.maps.Polygon({
        paths: poly.coordinates.map((c) => ({ lat: c.latitude, lng: c.longitude })),
        fillColor: fill.color,
        fillOpacity: fill.opacity ?? 0.35,
        strokeColor: stroke.color,
        strokeOpacity: stroke.opacity ?? 0.7,
        strokeWeight: poly.strokeWidth ?? 1,
        clickable: false,
      });
      shape.setMap(map);
      polygonsRef.current.push(shape);
    });

    const zoom = typeof map.getZoom === "function" ? map.getZoom() : 12;
    heatPoints.forEach((p) => {
      const weight = typeof p.weight === "number" && p.weight > 0 ? p.weight : 1;
      const circle = new g.maps.Circle({
        center: { lat: p.latitude, lng: p.longitude },
        radius: metersForPixels(p.latitude, zoom, heatPixelRadius(weight)),
        fillColor: "#E84F1F",
        fillOpacity: Math.min(0.18, 0.08 + 0.03 * Math.sqrt(weight)),
        strokeWeight: 0,
        clickable: false,
        map,
      });
      heatCirclesRef.current.push({ circle, lat: p.latitude, weight });
    });
    if (!map.__pulsoHeatZoom) {
      map.__pulsoHeatZoom = true;
      map.addListener("zoom_changed", () => {
        const z = map.getZoom?.() ?? 12;
        heatCirclesRef.current.forEach((item: { circle?: { setRadius: (n: number) => void }; lat?: number; weight?: number }) => {
          if (!item?.circle || item.lat == null) return;
          item.circle.setRadius(metersForPixels(item.lat, z, heatPixelRadius(item.weight ?? 1)));
        });
      });
    }
  }, [props.children, ready, mapEpoch]);

  if (error) {
    return (
      <View style={[styles.fallback, props.style as object]}>
        <Text style={styles.fallbackTitle}>Mapa no disponible</Text>
        <Text style={styles.fallbackText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, props.style as object]}>
      {createElement("div", {
        ref: hostRef,
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          minHeight: 320,
        },
      })}
    </View>
  );
});

export const MapView = ExpoMapView;
export default ExpoMapView;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 320,
    overflow: "hidden",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    padding: 24,
    gap: 8,
    minHeight: 320,
  },
  fallbackTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  fallbackText: { color: "#aaa", fontSize: 13, textAlign: "center" },
});
