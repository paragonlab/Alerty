import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyStore } from "../lib/alerty/store";

const X_BLUE = "#1D9BF0";
const X_DARK = "#0F1419";

type CommunityMarkerProps = {
  isDemo?: boolean;
  /** Sentinel para el colector del mapa web (ExpoMapView.web). */
  markerKind?: "community";
};

/** Pin estático para posts de X — distinto de GlowMarker (alertas ciudadanas). */
export function CommunityMarker({ isDemo, markerKind = "community" }: CommunityMarkerProps) {
  const themeMode = useAlertyStore((s) => s.themeMode);
  const isDark = themeMode === "darkHighVisibility";

  return (
    <View style={styles.wrap} accessibilityLabel={markerKind}>
      <View
        style={[
          styles.pin,
          {
            backgroundColor: isDark ? X_BLUE : X_DARK,
            borderColor: isDark ? "#fff" : X_BLUE,
          },
        ]}
      >
        <Ionicons name="logo-twitter" size={12} color="#fff" />
      </View>
      {isDemo ? (
        <View style={styles.demoBadge}>
          <Text style={styles.demoText}>D</Text>
        </View>
      ) : null}
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
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 4,
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
  },
  demoText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
});
