import { StyleSheet, View } from "react-native";

/**
 * Pin del punto que se tocó en el mapa o se buscó. La punta marca el lugar
 * (Marker con anchor abajo al centro). `markerKind` lo usa el mapa web
 * (ExpoMapView.web) para dibujarlo con su propio HTML.
 */
export function DestinationPin({ color }: { color: string; markerKind?: "destination" }) {
  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { backgroundColor: color }]}>
        <View style={styles.dot} />
      </View>
      <View style={[styles.tip, { borderTopColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    width: 34,
  },
  head: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 5,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FFFFFF",
  },
  tip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 12,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
