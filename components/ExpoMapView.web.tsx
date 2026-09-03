import React, {
  Children,
  createElement,
  forwardRef,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta?: number;
  longitudeDelta?: number;
};

type MapHandle = {
  animateToRegion: (region: Region, duration?: number) => void;
};

type MarkerProps = {
  coordinate: { latitude: number; longitude: number };
  onPress?: () => void;
  children?: React.ReactNode;
  tracksViewChanges?: boolean;
};

export function Marker(_props: MarkerProps) {
  return null;
}

export function Heatmap(_props: unknown) {
  return null;
}

export function Polygon(_props: unknown) {
  return null;
}

export const PROVIDER_GOOGLE = "google";

let mapsLoad: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("no window"));
  }
  const g = (window as any).google;
  if (g?.maps?.Map) return Promise.resolve();
  if (!API_KEY) {
    return Promise.reject(new Error("missing-key"));
  }
  if (mapsLoad) return mapsLoad;
  mapsLoad = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-pulso-gmaps]");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("script-error")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(API_KEY)}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.setAttribute("data-pulso-gmaps", "1");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("script-error"));
    document.head.appendChild(script);
  });
  return mapsLoad;
}

function regionToZoom(delta?: number) {
  if (!delta || delta <= 0) return 13;
  const zoom = Math.round(Math.log2(360 / delta));
  return Math.min(18, Math.max(8, zoom));
}

function readBackgroundColor(style: unknown): string | null {
  if (!style) return null;
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i -= 1) {
      const found = readBackgroundColor(style[i]);
      if (found) return found;
    }
    return null;
  }
  if (typeof style === "object" && style !== null && "backgroundColor" in style) {
    const bg = (style as { backgroundColor?: unknown }).backgroundColor;
    return typeof bg === "string" ? bg : null;
  }
  return null;
}

function markerColor(children: React.ReactNode): string {
  let color = "#E53935";
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { color?: string; style?: unknown };
    if (typeof props.color === "string") {
      color = props.color;
      return;
    }
    const fromStyle = readBackgroundColor(props.style);
    if (fromStyle) color = fromStyle;
  });
  return color;
}

/** Flatten fragments/arrays/conditionals and collect Marker-like props by `coordinate`. */
function collectMarkerProps(node: React.ReactNode, out: MarkerProps[] = []): MarkerProps[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as MarkerProps & { children?: React.ReactNode };
    const coord = props?.coordinate;
    if (
      coord &&
      typeof coord.latitude === "number" &&
      typeof coord.longitude === "number" &&
      Number.isFinite(coord.latitude) &&
      Number.isFinite(coord.longitude)
    ) {
      out.push(props);
      return;
    }
    if (props?.children != null) {
      collectMarkerProps(props.children, out);
    }
  });
  return out;
}

const DARK_STYLES = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
];

type MapViewProps = {
  children?: React.ReactNode;
  style?: unknown;
  initialRegion?: Region;
  userInterfaceStyle?: "dark" | "light";
  onLongPress?: (e: { nativeEvent: { coordinate: { latitude: number; longitude: number } } }) => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  pitchEnabled?: boolean;
  zoomEnabled?: boolean;
  rotateEnabled?: boolean;
  provider?: unknown;
};

const ExpoMapView = forwardRef<MapHandle, MapViewProps>(function ExpoMapView(props, ref) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const longPressTimer = useRef<number | null>(null);
  const onLongPressRef = useRef(props.onLongPress);
  onLongPressRef.current = props.onLongPress;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region: Region) => {
      const map = mapRef.current;
      if (!map || !region) return;
      map.panTo({ lat: region.latitude, lng: region.longitude });
      map.setZoom(regionToZoom(region.latitudeDelta));
    },
  }));

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !hostRef.current) return;
        const g = (window as any).google;
        const region = props.initialRegion ?? {
          latitude: 24.8091,
          longitude: -107.394,
          latitudeDelta: 0.16,
        };
        const map = new g.maps.Map(hostRef.current, {
          center: { lat: region.latitude, lng: region.longitude },
          zoom: regionToZoom(region.latitudeDelta),
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          clickableIcons: false,
          styles: props.userInterfaceStyle === "dark" ? DARK_STYLES : [],
        });
        mapRef.current = map;

        const emitLongPress = (latLng: any) => {
          onLongPressRef.current?.({
            nativeEvent: {
              coordinate: { latitude: latLng.lat(), longitude: latLng.lng() },
            },
          });
        };

        map.addListener("rightclick", (e: any) => {
          if (e?.latLng) emitLongPress(e.latLng);
        });
        map.addListener("mousedown", (e: any) => {
          if (!e?.latLng) return;
          if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
          const latLng = e.latLng;
          longPressTimer.current = window.setTimeout(() => emitLongPress(latLng), 550);
        });
        map.addListener("mouseup", () => {
          if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        });
        map.addListener("dragstart", () => {
          if (longPressTimer.current) {
            window.clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        });

        const triggerResize = () => {
          if (!mapRef.current || !hostRef.current) return;
          g.maps.event.trigger(mapRef.current, "resize");
          const center = mapRef.current.getCenter?.();
          if (center) mapRef.current.setCenter(center);
        };

        // RN-web parents often report 0×0 on first paint; refresh tiles once sized.
        requestAnimationFrame(triggerResize);
        if (typeof ResizeObserver !== "undefined" && hostRef.current) {
          resizeObserver = new ResizeObserver(() => triggerResize());
          resizeObserver.observe(hostRef.current);
        }

        setReady(true);
      })
      .catch((err) => {
        if (cancelled) return;
        if (String(err?.message) === "missing-key") {
          setError("Falta EXPO_PUBLIC_GOOGLE_MAPS_KEY en Vercel.");
        } else {
          setError("No se pudo cargar Google Maps.");
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    };
    // Map instance is created once; region/theme updates aren't remounted on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const g = typeof window !== "undefined" ? (window as any).google : null;
    if (!map || !g?.maps || !ready) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const markers = collectMarkerProps(props.children);
    markers.forEach((p) => {
      const color = markerColor(p.children);
      const marker = new g.maps.Marker({
        map,
        position: { lat: p.coordinate.latitude, lng: p.coordinate.longitude },
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      if (p.onPress) marker.addListener("click", () => p.onPress?.());
      markersRef.current.push(marker);
    });
  }, [props.children, ready]);

  if (error) {
    return (
      <View style={[styles.fallback, props.style as object]}>
        <Text style={styles.fallbackTitle}>Mapa no disponible</Text>
        <Text style={styles.fallbackText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.fill, props.style as object]}>
      {createElement("div", {
        ref: hostRef,
        style: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
          minHeight: 320,
        },
      })}
    </View>
  );
});

export const MapView = ExpoMapView;
export default ExpoMapView;

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 320,
    overflow: "hidden",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1a1a1a",
    padding: 24,
    gap: 8,
    minHeight: 320,
  },
  fallbackTitle: { color: "#fff", fontSize: 16, fontWeight: "600" },
  fallbackText: { color: "#aaa", fontSize: 13, textAlign: "center" },
});
