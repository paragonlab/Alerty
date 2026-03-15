import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type MapViewRef } from "../../components/MapView";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlowMarker } from "../../components/GlowMarker";
import { useTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { CULIACAN_CENTER } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import {
  formatRelativeTime,
  getCategoryColor,
  getPulseDuration,
  isAlertInWindow,
  shouldSuppressAlert,
} from "../../lib/alerty/utils";

export default function MapScreen() {
  const router = useRouter();
  const theme = useTheme();
  const mapRef = useRef<MapViewRef | null>(null);
  const [locating, setLocating] = useState(false);
  const isWeb = Platform.OS === "web";

  const { alerts, timeFilter, activeCategories, lowConnection } = useAlertyStore();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const headerGradient = useMemo(
    () =>
      theme.mode === "dark"
        ? ["rgba(11,15,20,0.9)", "rgba(11,15,20,0.6)", "rgba(11,15,20,0)"]
        : ["rgba(255,241,242,0.9)", "rgba(255,227,230,0.6)", "rgba(255,241,242,0)"],
    [theme.mode],
  );

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

  const handleAddAlert = (event: {
    nativeEvent: { coordinate: { latitude: number; longitude: number } };
  }) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: "/report",
      params: { lat: String(latitude), lng: String(longitude) },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={CULIACAN_CENTER}
          showsUserLocation
          showsMyLocationButton={false}
          pitchEnabled={false}
          rotateEnabled={false}
          mapStyle={theme.mode}
          onLongPress={handleAddAlert}
        >
          {filteredAlerts.map((alert) => {
            const markerColor = getCategoryColor(alert.category, theme);
            const pulseDuration = getPulseDuration(alert.createdAt);
            if (isWeb) {
              return (
                <Marker
                  key={alert.id}
                  coordinate={{ latitude: alert.lat, longitude: alert.lng }}
                  tracksViewChanges={!lowConnection}
                  color={markerColor}
                  pulseDuration={pulseDuration}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    router.push(`/alert/${alert.id}`);
                  }}
                />
              );
            }
            return (
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
                  color={markerColor}
                  duration={pulseDuration}
                  hasMedia={alert.media.length > 0}
                  isVerified={alert.user.isVerified}
                  lowConnection={lowConnection}
                />
              </Marker>
            );
          })}
        </MapView>

        <LinearGradient colors={headerGradient} style={styles.headerOverlay} pointerEvents="none" />

        <View style={styles.headerCard}>
          <View>
            <Text style={styles.cityLabel}>Culiacán, Sinaloa</Text>
            <Text style={styles.subLabel}>Alertas verificadas en tiempo real</Text>
          </View>
          <View style={styles.statWrap}>
            <Text style={styles.statValue}>{filteredAlerts.length}</Text>
            <Text style={styles.statLabel}>Activas</Text>
          </View>
          <View style={styles.statWrap}>
            <Text style={styles.statValue}>{criticalCount}</Text>
            <Text style={styles.statLabel}>Críticas</Text>
          </View>
        </View>

        {filteredAlerts[0] ? (
          <View style={styles.liveTicker}>
            <Ionicons name="pulse" size={16} color={theme.colors.accent} />
            <Text style={styles.liveText} numberOfLines={1}>
              Última alerta: {formatRelativeTime(filteredAlerts[0].createdAt)} · {filteredAlerts[0].description ?? "Sin descripción"}
            </Text>
          </View>
        ) : null}

        <View style={styles.fabColumn}>
          <Pressable
            style={styles.fabSecondary}
            onPress={handleCenterLocation}
            disabled={locating}
          >
            <Ionicons name="locate" size={20} color={theme.colors.text} />
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      top: 16,
      left: 16,
      right: 16,
      padding: 14,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
      ...theme.effects.glassCard,
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
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.effects.glassPill,
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
      bottom: 118,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...theme.effects.glassPill,
    },
    liveText: {
      flex: 1,
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: theme.fonts.body,
    },
    fabColumn: {
      position: "absolute",
      right: 16,
      bottom: 24,
      gap: 12,
      alignItems: "flex-end",
    },
    fabSecondary: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      ...theme.effects.glassPill,
    },
  });
