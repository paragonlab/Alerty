import { PulsoPin } from "./PulsoPin";
import type { CommunitySource } from "../lib/alerty/types";

type CommunityMarkerProps = {
  isDemo?: boolean;
  /** Sentinel para el colector del mapa web (ExpoMapView.web). */
  markerKind?: "community";
  categoryGuess?: string | null;
  /** Color explícito; si falta, se deriva de categoryGuess en el SVG. */
  color?: string;
  authorAvatarUrl?: string | null;
  mediaUrl?: string | null;
  authorName?: string | null;
  source?: CommunitySource;
  /** Fuentes adicionales del cluster (+N en el pin). */
  extraSources?: number;
  showName?: boolean;
  intensity?: number;
  showGlow?: boolean;
};

/**
 * Pin Pulso (X / RSS) estilo Waze — distinto del pin ciudadano.
 */
export function CommunityMarker({
  isDemo,
  markerKind = "community",
  categoryGuess,
  authorAvatarUrl,
  authorName,
  source = "x",
  extraSources = 0,
  showName = false,
}: CommunityMarkerProps) {
  return (
    <PulsoPin
      markerKind={markerKind}
      isDemo={isDemo}
      categoryGuess={categoryGuess}
      authorAvatarUrl={authorAvatarUrl}
      authorName={authorName}
      source={source}
      extraSources={extraSources}
      showName={showName}
    />
  );
}
