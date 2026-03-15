import type { ReactNode } from "react";
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Coordinate = {
  latitude: number;
  longitude: number;
};

type Region = Coordinate & {
  latitudeDelta?: number;
  longitudeDelta?: number;
};

export type MapViewRef = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MapViewProps = {
  children?: ReactNode;
  style?: unknown;
  initialRegion?: Region;
  onPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  onLongPress?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  mapStyle?: "light" | "dark";
  [key: string]: unknown;
};

type MarkerProps = {
  coordinate: Coordinate;
  onPress?: () => void;
  onDragEnd?: (event: { nativeEvent: { coordinate: Coordinate } }) => void;
  draggable?: boolean;
  children?: ReactNode;
  color?: string;
  pulseDuration?: number;
  tracksViewChanges?: boolean;
};

const ensureMarkerStyles = () => {
  if (typeof document === "undefined") return;
  if (document.getElementById("alerty-marker-styles")) return;
  const style = document.createElement("style");
  style.id = "alerty-marker-styles";
  style.innerHTML = `
    .alerty-marker {
      position: relative;
      width: 28px;
      height: 28px;
      border-radius: 999px;
    }
    .alerty-marker .alerty-heat {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      transform: translate(-50%, -50%);
      background: var(--alerty-color);
      opacity: 0.25;
      filter: blur(2px);
    }
    .alerty-marker .alerty-pulse {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 14px;
      height: 14px;
      border-radius: 999px;
      background: var(--alerty-color);
      transform: translate(-50%, -50%);
      opacity: 0.6;
      animation: alerty-pulse var(--alerty-duration) ease-out infinite;
      filter: blur(0.2px);
    }
    .alerty-marker .alerty-dot {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      transform: translate(-50%, -50%);
      background: var(--alerty-color);
      border: 2px solid rgba(255,255,255,0.9);
      box-shadow: 0 0 10px var(--alerty-color);
    }
    @keyframes alerty-pulse {
      0% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
      70% { transform: translate(-50%, -50%) scale(2.4); opacity: 0; }
      100% { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
};

const createMarkerIcon = (color: string, duration: number) =>
  L.divIcon({
    className: "alerty-marker",
    html: `<div class="alerty-heat" style="--alerty-color:${color};"></div><div class="alerty-pulse" style="--alerty-color:${color}; --alerty-duration:${duration}ms;"></div><div class="alerty-dot" style="--alerty-color:${color};"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const MapContext = createContext<L.Map | null>(null);

const getZoomFromRegion = (region?: Region) => {
  if (!region?.longitudeDelta) return 13;
  const zoom = Math.round(Math.log2(360 / region.longitudeDelta));
  return Math.min(18, Math.max(3, zoom));
};

const getCenter = (region?: Region): [number, number] => {
  if (!region) return [0, 0];
  return [region.latitude, region.longitude];
};

const MapView = forwardRef<MapViewRef, MapViewProps>(
  ({ children, style, initialRegion, onPress, onLongPress, mapStyle }: MapViewProps, ref) => {
    const mapRef = useRef<L.Map | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);

    useImperativeHandle(ref, () => ({
      animateToRegion: (region: Region) => {
        if (!mapRef.current) return;
        const zoom = getZoomFromRegion(region);
        mapRef.current.setView([region.latitude, region.longitude], zoom, { animate: true });
      },
    }));

    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        trackResize: false,
      });
      mapRef.current = map;
      setMapInstance(map);
      return () => {
        map.remove();
        mapRef.current = null;
        setMapInstance(null);
      };
    }, []);

    useEffect(() => {
      if (!mapInstance) return;
      const isDark = mapStyle === "dark";
      const url = isDark
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
      const attribution = isDark
        ? "&copy; OpenStreetMap contributors &copy; CARTO"
        : "&copy; OpenStreetMap contributors";

      if (tileLayerRef.current) {
        tileLayerRef.current.removeFrom(mapInstance);
      }
      const layer = L.tileLayer(url, { attribution });
      layer.addTo(mapInstance);
      tileLayerRef.current = layer;
    }, [mapInstance, mapStyle]);

    useEffect(() => {
      if (!initialRegion || !mapRef.current) return;
      const zoom = getZoomFromRegion(initialRegion);
      mapRef.current.setView([initialRegion.latitude, initialRegion.longitude], zoom);
    }, [initialRegion]);

    useEffect(() => {
      if (!mapRef.current) return;
      const map = mapRef.current;
      const handleClick = (event: L.LeafletMouseEvent) => {
        onPress?.({
          nativeEvent: {
            coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng },
          },
        });
      };
      const handleLongPress = (event: L.LeafletMouseEvent) => {
        event.originalEvent?.preventDefault?.();
        onLongPress?.({
          nativeEvent: {
            coordinate: { latitude: event.latlng.lat, longitude: event.latlng.lng },
          },
        });
      };

      if (onPress) map.on("click", handleClick);
      if (onLongPress) map.on("contextmenu", handleLongPress);

      return () => {
        if (onPress) map.off("click", handleClick);
        if (onLongPress) map.off("contextmenu", handleLongPress);
      };
    }, [onPress, onLongPress]);

    return (
      <View style={style}>
        <View ref={containerRef} style={styles.map} />
        <MapContext.Provider value={mapInstance}>{children}</MapContext.Provider>
      </View>
    );
  },
);

MapView.displayName = "MapView";

const Marker = ({
  coordinate,
  onPress,
  onDragEnd,
  draggable,
  color,
  pulseDuration,
}: MarkerProps) => {
  const map = useContext(MapContext);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!map) return;
    ensureMarkerStyles();
    const markerColor = color ?? "#E02B3C";
    const duration = pulseDuration ?? 1800;
    if (!markerRef.current) {
      markerRef.current = L.marker([coordinate.latitude, coordinate.longitude], {
        draggable: Boolean(draggable),
        icon: createMarkerIcon(markerColor, duration),
      }).addTo(map);
      if (onPress) {
        markerRef.current.on("click", onPress);
      }
      if (onDragEnd) {
        markerRef.current.on("dragend", (event) => {
          const latLng = (event.target as L.Marker).getLatLng();
          onDragEnd({
            nativeEvent: { coordinate: { latitude: latLng.lat, longitude: latLng.lng } },
          });
        });
      }
      return;
    }
    markerRef.current.setLatLng([coordinate.latitude, coordinate.longitude]);
    markerRef.current.dragging?.[draggable ? "enable" : "disable"]();
    markerRef.current.setIcon(createMarkerIcon(markerColor, duration));
  }, [map, coordinate, draggable, onPress, onDragEnd, color, pulseDuration]);

  useEffect(() => {
    return () => {
      if (markerRef.current && map) {
        markerRef.current.removeFrom(map);
      }
      markerRef.current = null;
    };
  }, [map]);

  return null;
};

const styles = StyleSheet.create({
  map: {
    height: "100%",
    width: "100%",
  },
});

export { Marker };
export default MapView;
