import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PinShape } from "../lib/alerty/types";

export type { PinShape };

/**
 * Pin de un Aliado. `markerKind` lo lee el mapa web para dibujar la misma
 * forma en HTML. La punta o la base queda abajo al centro (anchor 0.5, 1).
 */
export function SponsorPin({
  color,
  shape,
  logoUrl,
  markerKind: _markerKind,
}: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
  markerKind?: "sponsor";
}) {
  const mark = logoUrl ? (
    <Image source={{ uri: logoUrl }} style={styles.logo} />
  ) : (
    <Ionicons
      name={shape === "flag" ? "flag" : shape === "house" ? "home" : shape === "shield" ? "shield" : "location"}
      size={16}
      color="#fff"
    />
  );

  if (shape === "flag") {
    return (
      <View style={styles.box}>
        <View style={styles.pole} />
        <View style={[styles.flag, { backgroundColor: color }]}>{mark}</View>
      </View>
    );
  }

  if (shape === "house") {
    return (
      <View style={styles.box}>
        <View
          style={[
            styles.roof,
            { borderBottomColor: color },
          ]}
        />
        <View style={[styles.house, { backgroundColor: color }]}>{mark}</View>
      </View>
    );
  }

  if (shape === "shield") {
    return (
      <View style={styles.box}>
        <View style={[styles.shield, { backgroundColor: color }]}>{mark}</View>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <View style={[styles.head, { backgroundColor: color }]}>{mark}</View>
      <View style={[styles.tip, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 44,
    height: 52,
    alignItems: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  head: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  pole: {
    position: "absolute",
    left: 8,
    top: 2,
    width: 3,
    height: 46,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  flag: {
    position: "absolute",
    left: 11,
    top: 4,
    width: 28,
    height: 20,
    borderRadius: 2,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fff",
  },
  roof: {
    width: 0,
    height: 0,
    borderLeftWidth: 18,
    borderRightWidth: 18,
    borderBottomWidth: 14,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  house: {
    width: 32,
    height: 24,
    marginTop: -1,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: "#fff",
  },
  shield: {
    width: 34,
    height: 40,
    marginTop: 2,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 17,
    borderBottomRightRadius: 17,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
