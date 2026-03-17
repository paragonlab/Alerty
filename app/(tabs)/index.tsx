import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { GlassView, GlassContainer } from "expo-glass-effect";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlowMarker } from "../../components/GlowMarker";
import { SOSButton } from "../../components/SOSButton";
import { CULIACAN_CENTER } from "../../lib/alerty/constants";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { supabase } from "../../lib/supabase";
import {
  formatRelativeTime,
  getIntensityColor,
  getPulseDuration,
  isAlertInWindow,
  shouldSuppressAlert,
} from "../../lib/alerty/utils";

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);
  const isWeb = Platform.OS === "web";

  const { 
    alerts, 
    timeFilter, 
    activeCategories, 
    lowConnection, 
    showHeatmap, 
    setShowHeatmap,
    sosWarningAccepted,
    setSosWarningAccepted,
    addAlert,
    themeMode,
    currentUser,
  } = useAlertyStore();

  const theme = useAlertyTheme();
  const isDark = themeMode === "darkHighVisibility";

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "active" &&
          activeCategories.includes(alert.category) &&
          isAlertInWindow(alert, timeFilter) &&
          !shouldSuppressAlert(alert),
      ),
    [alerts, activeCategories, timeFilter],
  );

  const heatmapPoints = useMemo(() => {
    return filteredAlerts.map(alert => ({
      latitude: alert.lat,
      longitude: alert.lng,
      weight: getPulseDuration(alert.createdAt) <= 1200 ? 3 : 1
    }));
  }, [filteredAlerts]);

  const criticalCount = useMemo(
    () => filteredAlerts.filter((alert) => getPulseDuration(alert.createdAt) <= 1200).length,
    [filteredAlerts],
  );

  const handleCenterLocation = async () => {
    try {
      if (isWeb) {
        Alert.alert("Mapa", "La ubicación en tiempo real está disponible en iOS y Android.");
        return;
      }
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa ubicación para centrar el mapa.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      Alert.alert("Ubicación", "No se pudo obtener la ubicación actual.");
    } finally {
      setLocating(false);
    }
  };

  const styles = createStyles(theme, themeMode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        {isWeb ? (
          <View style={styles.webMap}>
            <Ionicons name="map" size={28} color={theme.colors.textMuted} />
            <Text style={[styles.webMapText, { color: theme.colors.textMuted }]}>
              El mapa interactivo está disponible en iOS y Android.
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            initialRegion={CULIACAN_CENTER}
            showsUserLocation
            showsMyLocationButton={false}
            pitchEnabled={false}
            zoomEnabled={true}
            rotateEnabled={false}
            provider={PROVIDER_GOOGLE}
            userInterfaceStyle={isDark ? "dark" : "light"}
          >
            {showHeatmap && !isWeb && (
              <Heatmap
                points={heatmapPoints}
                radius={40}
                opacity={0.7}
                gradient={{
                  colors: [theme.colors.mapYellow, theme.colors.mapOrange, theme.colors.mapRed],
                  startPoints: [0.2, 0.5, 0.8],
                  colorMapSize: 256
                }}
              />
            )}
            {!showHeatmap && filteredAlerts.map((alert) => (
              <Marker
                key={alert.id}
                coordinate={{ latitude: alert.lat, longitude: alert.lng }}
                tracksViewChanges={!lowConnection}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push(`/alert/${alert.id}`);
                }}
              >
                <GlowMarker
                  category={alert.category}
                  color={getIntensityColor(alert.createdAt)}
                  duration={getPulseDuration(alert.createdAt)}
                  hasMedia={alert.media.length > 0}
                  isVerified={alert.user.isVerified}
                  lowConnection={lowConnection}
                />
              </Marker>
            ))}
          </MapView>
        )}

        {/* Top Header Overlays */}
        <LinearGradient
          colors={[isDark ? "rgba(0,0,0,0.9)" : "rgba(246,242,234,0.98)", "transparent"]}
          style={styles.headerOverlay}
          pointerEvents="none"
        />

        <GlassView 
          colorScheme={isDark ? "dark" : "light"} 
          glassEffectStyle="regular" 
          tintColor={isDark ? "rgba(255, 82, 82, 0.05)" : "rgba(229, 57, 53, 0.05)"}
          style={styles.headerCard}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.15)", "rgba(255,255,255,0.05)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.cityLabel}>Culiacán, Sinaloa</Text>
            <Text style={styles.subLabel}>Alertas verificadas en tiempo real</Text>
          </View>

          <Pressable
            style={styles.headerLocationButton}
            onPress={handleCenterLocation}
            disabled={locating}
          >
            <Ionicons name="locate" size={20} color={theme.colors.text} />
          </Pressable>

          <View style={styles.statSeparator} />

          <View style={styles.statWrap}>
            <Text style={styles.statValue}>{filteredAlerts.length}</Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          <View style={styles.statWrap}>
            <Text style={styles.statValue}>{criticalCount}</Text>
            <Text style={styles.statLabel}>Críticas</Text>
          </View>
        </GlassView>

        {/* Floating overlays or other elements can go here if needed */}

        {/* Live Ticker */}
        {filteredAlerts[0] ? (
          <GlassView
            colorScheme={isDark ? "dark" : "light"}
            glassEffectStyle="regular"
            tintColor="rgba(255, 255, 255, 0.02)"
            style={styles.liveTicker}
          >
            <LinearGradient
              colors={["rgba(255,255,255,0.1)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="pulse" size={16} color={theme.colors.reportAction} />
            <Text style={styles.liveText} numberOfLines={1}>
              Última alerta: {formatRelativeTime(filteredAlerts[0].createdAt)} · {filteredAlerts[0].description ?? "Sin descripción"}
            </Text>
          </GlassView>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: any, themeMode: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    flex: 1,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
  },
  headerCard: {
    position: "absolute",
    top: 54, // Adjusted for notch/safe area visibility
    left: 16,
    right: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: theme.radius.xl,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.85)" : "rgba(18,18,18,0.8)",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
    zIndex: 20,
  },
  headerLocationButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  heatmapToggleContainer: {
    position: "absolute",
    top: 96,
    left: 16,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  heatmapButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.7)" : "rgba(26,26,26,0.6)",
  },
  heatmapButtonActive: {
    backgroundColor: theme.colors.reportAction,
  },
  cityLabel: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: theme.fonts.heading,
  },
  subLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 4,
  },
  statWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: "rgba(0,0,0,0.05)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  statValue: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
  liveTicker: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.85)" : "rgba(18,18,18,0.85)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  liveText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  webMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: theme.colors.surfaceAlt,
  },
  webMapText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    textAlign: "center",
    maxWidth: 220,
  },
});
