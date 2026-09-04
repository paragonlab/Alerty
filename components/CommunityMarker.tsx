import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getCategoryPinColor } from "../lib/alerty/utils";
import type { CommunitySource } from "../lib/alerty/types";

type CommunityMarkerProps = {
  isDemo?: boolean;
  /** Sentinel para el colector del mapa web (ExpoMapView.web). */
  markerKind?: "community";
  categoryGuess?: string | null;
  /** Color explícito; si falta, se deriva de categoryGuess. */
  color?: string;
  authorAvatarUrl?: string | null;
  mediaUrl?: string | null;
  source?: CommunitySource;
};

/**
 * Pin estático cuadrado para X / RSS — distinto de GlowMarker (circular + pulso).
 * Color por categoryGuess / riesgo; avatar → media → icono de fuente.
 */
export function CommunityMarker({
  isDemo,
  markerKind = "community",
  categoryGuess,
  color,
  authorAvatarUrl,
  mediaUrl,
  source = "x",
}: CommunityMarkerProps) {
  const pinColor = color ?? getCategoryPinColor(categoryGuess);
  const imageUrl = authorAvatarUrl || mediaUrl || null;
  const fallbackIcon =
    source === "rss" ? ("newspaper-outline" as const) : ("logo-twitter" as const);

  return (
    <View style={styles.wrap} accessibilityLabel={markerKind}>
      <View
        style={[
          styles.pin,
          {
            backgroundColor: imageUrl ? "#111" : pinColor,
            borderColor: pinColor,
          },
        ]}
      >
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.avatar} />
        ) : (
          <Ionicons name={fallbackIcon} size={12} color="#fff" />
        )}
      </View>
      {isDemo ? (
        <View style={styles.demoBadge}>
          <Text style={styles.demoText}>D</Text>
        </View>
      ) : null}
      {/* Chip de fuente para no confundir con alerta ciudadana */}
      <View style={[styles.sourceChip, { backgroundColor: pinColor }]}>
        <Ionicons
          name={source === "rss" ? "newspaper" : "logo-twitter"}
          size={7}
          color="#fff"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  demoBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
    zIndex: 2,
  },
  demoText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  sourceChip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
});
