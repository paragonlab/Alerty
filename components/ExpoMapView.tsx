import MapViewRN, {
  Marker,
  Heatmap,
  Polygon,
  Circle,
  Polyline,
  PROVIDER_GOOGLE,
  type MapViewProps as RNMapViewProps,
} from "react-native-maps";
import { forwardRef } from "react";

type MapViewProps = RNMapViewProps & {
  /** Solo web (Leaflet/TomTom); ignorado en nativo. */
  trafficTileUrl?: string | null;
  trafficAttribution?: string;
};

const MapView = forwardRef<MapViewRN, MapViewProps>(function MapView(props, ref) {
  const { trafficTileUrl: _t, trafficAttribution: _a, ...rest } = props;
  return <MapViewRN ref={ref} {...rest} />;
});

export default MapView;
export { MapView, Marker, Heatmap, Polygon, Circle, Polyline, PROVIDER_GOOGLE };
export type { MapViewProps };
