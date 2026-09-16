import { useMemo } from "react";
import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_ICONS } from "../lib/alerty/constants";
import { getCategoryPinColor } from "../lib/alerty/utils";
import type { AlertCategory } from "../lib/alerty/types";

const TILE = 256;
const ZOOM = 16;
/** Mismas teselas que el mapa web; no piden llave. */
const TILE_URL = (z: number, x: number, y: number) =>
  `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

function tileCoords(lat: number, lng: number) {
  const n = 2 ** ZOOM;
  const latRad = (lat * Math.PI) / 180;
  const x = ((lng + 180) / 360) * n;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y, n };
}

/**
 * Fondo de mapa para los pulsos que no traen imagen: el lugar desde donde se
 * envió la alerta, con su pin. Voz y texto se ven así en Videos.
 */
export function MapBackdrop({
  lat,
  lng,
  category,
}: {
  lat: number;
  lng: number;
  category: AlertCategory;
}) {
  const { width, height } = Dimensions.get("window");
  const color = getCategoryPinColor(category);

  const tiles = useMemo(() => {
    const { x, y, n } = tileCoords(lat, lng);
    const centerX = x * TILE;
    const centerY = y * TILE;
    const cols = Math.ceil(width / TILE) + 2;
    const rows = Math.ceil(height / TILE) + 2;
    const firstX = Math.floor(x) - Math.floor(cols / 2);
    const firstY = Math.floor(y) - Math.floor(rows / 2);

    const out: { key: string; uri: string; left: number; top: number }[] = [];
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const tx = firstX + i;
        const ty = firstY + j;
        // Fuera del mundo en vertical no hay tesela; en horizontal da la vuelta.
        if (ty < 0 || ty >= n) continue;
        const wrappedX = ((tx % n) + n) % n;
        out.push({
          key: `${tx}-${ty}`,
          uri: TILE_URL(ZOOM, wrappedX, ty),
          left: tx * TILE - centerX + width / 2,
          top: ty * TILE - centerY + height / 2,
        });
      }
    }
    return out;
  }, [lat, lng, width, height]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          source={{ uri: tile.uri }}
          style={[styles.tile, { left: tile.left, top: tile.top }]}
        />
      ))}
      {/* El mapa es contexto, no protagonista: el texto va encima. */}
      <View style={[StyleSheet.absoluteFill, styles.scrim]} />
      <LinearGradient
        colors={[color + "3D", "transparent", color + "26"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.pinWrap, { left: width / 2 - 26, top: height / 2 - 26 }]}>
        <View style={[styles.pinHalo, { backgroundColor: color }]} />
        <View style={[styles.pin, { backgroundColor: color }]}>
          <Ionicons name={CATEGORY_ICONS[category] as any} size={18} color="#fff" />
        </View>
      </View>
      <Text style={styles.attribution}>© OpenStreetMap</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: "absolute",
    width: TILE,
    height: TILE,
  },
  scrim: {
    backgroundColor: "rgba(4,2,2,0.70)",
  },
  pinWrap: {
    position: "absolute",
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  pinHalo: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 999,
    opacity: 0.35,
  },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  attribution: {
    position: "absolute",
    right: 8,
    bottom: 4,
    fontSize: 9,
    color: "rgba(255,255,255,0.45)",
  },
});
