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

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

/** Pause fancy pulse rings when many pins (mobile Safari). */
const PULSE_SIMPLIFY_AT = 36;

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

export function Heatmap(_props: unknown) {
  return null;
}

export function Polygon(_props: unknown) {
  return null;
}

export const PROVIDER_GOOGLE = "google";

let mapsLoad: Promise<void> | null = null;
let stylesInjected = false;

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

function ensurePulseStyles() {
  if (typeof document === "undefined" || stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.setAttribute("data-pulso-glow-markers", "1");
  style.textContent = `
@keyframes pulso-halo {
  0%, 100% { transform: scale(0.85); opacity: var(--pulso-halo-min, 0.45); }
  50% { transform: scale(1.1); opacity: var(--pulso-halo-max, 0.75); }
}
@keyframes pulso-ring {
  0% { transform: scale(0.7); opacity: 0.9; }
  60% { opacity: 0.25; }
  100% { transform: scale(3.6); opacity: 0; }
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
`;
  document.head.appendChild(style);
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

  if (!staticPulse) {
    el.innerHTML = `
      <div class="pulso-pin__halo"></div>
      <div class="pulso-pin__ring"></div>
      ${simplify ? "" : '<div class="pulso-pin__ring pulso-pin__ring--delayed"></div>'}
      <div class="pulso-pin__dot">${coreInner}</div>
    `;
  } else {
    el.innerHTML = `
      <div class="pulso-pin__halo"></div>
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
  el.setAttribute("aria-label", meta.icon === "shield" ? "Zona segura" : "Patrocinado");
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
  onLongPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  pitchEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  provider?: unknown;
};

const ExpoMapView = forwardRef<MapHandle, MapViewProps>(function ExpoMapView(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<OverlayHandle[]>([]);
  const longPressTimer = useRef<number | null>(null);
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

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      const map = mapRef.current;
      if (!map || !region) return;
      map.panTo({ lat: region.latitude, lng: region.longitude });
      map.setZoom(regionToZoom(region.latitudeDelta));
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        ensurePulseStyles();
        const g = (window as any).google;
        const region = props.initialRegion ?? {
          latitude: 24.8091,
          longitude: -107.394,
          latitudeDelta: 0.16,
        };
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

        const emitLongPress = (latLng: any) => {
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
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
          const latLng = e.latLng;
          longPressTimer.current = window.setTimeout(() => emitLongPress(latLng), 550);
        });
        map.addListener("mouseup", () => {
          cancelLongPressRef.current();
        });
        map.addListener("dragstart", () => {
          cancelLongPressRef.current();
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

        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (String(err?.message) === "missing-key") {
          setError("Falta EXPO_PUBLIC_GOOGLE_MAPS_KEY en Vercel.");
        } else {
          setError("No se pudo cargar Google Maps.");
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
      overlaysRef.current.forEach((o) => o.setMap(null));
      overlaysRef.current = [];
    };
    // Map instance is created once; region/theme updates aren't remounted on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const g = typeof window !== "undefined" ? (window as any).google : null;
    if (!map || !g?.maps || !ready) return;

    ensurePulseStyles();
    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];

    const markers = collectMarkerProps(props.children);
    const alertCount = markers.filter((m) => m.meta.kind === "alert").length;
    const simplify = alertCount >= PULSE_SIMPLIFY_AT;

    markers.forEach((p) => {
      const position = { lat: p.coordinate.latitude, lng: p.coordinate.longitude };
      let content: HTMLDivElement;
      if (p.meta.kind === "sponsor") {
        content = buildSponsorPinElement(p.meta);
      } else if (p.meta.kind === "community") {
        content = buildCommunityPinElement(p.meta);
      } else {
        content = buildAlertPinElement(p.meta, simplify);
      }
      const overlay = createHtmlOverlay(
        g,
        map,
        position,
        content,
        p.onPress,
        () => cancelLongPressRef.current(),
      );
      overlaysRef.current.push(overlay);
    });
  }, [props.children, ready]);

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
