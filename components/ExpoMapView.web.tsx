import React from "react";
import { View, Text, StyleSheet } from "react-native";

const ExpoMapView = React.forwardRef((props: any, ref: any) => {
  return (
    <View style={[props.style, styles.container]}>
      <Text style={styles.text}>Mapa no disponible en web.</Text>
    </View>
  );
});

export const MapView = ExpoMapView;
export const Marker = () => null;
export const Heatmap = () => null;
export const PROVIDER_GOOGLE = "google";

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f0f0f0",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  text: {
    color: "#666",
    textAlign: "center",
  },
});

export default ExpoMapView;
