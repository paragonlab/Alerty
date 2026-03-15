import type { ComponentProps } from "react";
import MapView, { Marker as RNMarker } from "react-native-maps";

type MarkerProps = ComponentProps<typeof RNMarker> & {
  color?: string;
  pulseDuration?: number;
};

const Marker = ({ color, pulseDuration, ...rest }: MarkerProps) => (
  <RNMarker {...rest} />
);

type MapProps = ComponentProps<typeof MapView> & {
  mapStyle?: "light" | "dark";
};

const ThemedMapView = ({ mapStyle, ...rest }: MapProps) => <MapView {...rest} />;

export type MapViewRef = MapView;
export { Marker };
export default ThemedMapView;
