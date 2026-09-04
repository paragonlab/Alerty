import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Heatmap, Marker, PROVIDER_GOOGLE } from "../../components/ExpoMapView";
import { RiskGrid } from "../../components/RiskGrid";
import { ZoneRiskCard } from "../../components/ZoneRiskCard";
import { buildRiskGrid, scoreAt, type RiskAssessment } from "../../lib/alerty/risk";
import { GlassView, GlassContainer } from "expo-glass-effect";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { GlowMarker } from "../../components/GlowMarker";
import { CommunityMarker } from "../../components/CommunityMarker";
import { CommunityPostPreview } from "../../components/CommunityPostPreview";
import { SOSButton } from "../../components/SOSButton";
import { CATEGORY_LABELS, CULIACAN_CENTER, TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { supabase } from "../../lib/supabase";
import type { CommunityPost } from "../../lib/alerty/types";
import {
  calculateDistance,
  formatRelativeTime,
  getCategoryPinColor,
  getIntensityColor,
  getPulseDuration,
  getTimeFilterWindowLabel,
  isAlertInWindow,
  isCreatedAtInWindow,
  shouldSuppressAlert,
} from "../../lib/alerty/utils";

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [riskResult, setRiskResult] = useState<{ assessment: RiskAssessment; label: string } | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityPost | null>(null);
  const isWeb = Platform.OS === "web";

  const {
    alerts,
    communityPosts,
    timeFilter,
    setTimeFilter,
    activeCategories,
    lowConnection,
    showHeatmap,
    setShowHeatmap,
    sosWarningAccepted,
    setSosWarningAccepted,
    addAlert,
    themeMode,
    currentUser,
    sponsoredZones,
  } = useAlertyStore();

  const theme = useAlertyTheme();
  const isDark = themeMode === "darkHighVisibility";

  const filteredAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "active" &&
          !alert.parentAlertId &&
          activeCategories.includes(alert.category) &&
          isAlertInWindow(alert, timeFilter) &&
          !shouldSuppressAlert(alert),
      ),
    [alerts, activeCategories, timeFilter],
  );

  const filteredCommunity = useMemo(
    () =>
      communityPosts.filter((post) => isCreatedAtInWindow(post.createdAt, timeFilter)),
    [communityPosts, timeFilter],
  );

  // Mapa: solo pines con geo real o place bbox (lat/lng no nulos). Feed puede tener más.
  const mapCommunity = useMemo(
    () =>
      filteredCommunity.flatMap((post) => {
        if (
          typeof post.lat !== "number" ||
          typeof post.lng !== "number" ||
          !Number.isFinite(post.lat) ||
          !Number.isFinite(post.lng)
        ) {
          return [];
        }
        return [{ ...post, lat: post.lat, lng: post.lng }];
      }),
    [filteredCommunity],
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

  // Alerta activa más cercana dentro de 500m del usuario
  const nearbyAlert = useMemo(() => {
    if (!userLocation) return null;
    const withDist = filteredAlerts
      .map((alert) => ({
        alert,
        dist: calculateDistance(userLocation.latitude, userLocation.longitude, alert.lat, alert.lng),
      }))
      .filter((x) => x.dist <= 0.5)
      .sort((a, b) => a.dist - b.dist);
    return withDist[0] ?? null;
  }, [userLocation, filteredAlerts]);

  const isPremium = Boolean(currentUser.isPremium);

  // Para el riesgo usamos todas las alertas activas (sin filtro de categoría ni
  // ventana de tiempo) — no queremos ocultar peligro por las preferencias del feed.
  const riskAlerts = useMemo(
    () => alerts.filter(
      (alert) => alert.status === "active" && !alert.parentAlertId && !shouldSuppressAlert(alert),
    ),
    [alerts],
  );

  const riskGrid = useMemo(
    () => (showGrid ? buildRiskGrid(riskAlerts, CULIACAN_CENTER) : []),
    [showGrid, riskAlerts],
  );

  useEffect(() => {
    if (isWeb) return;
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {}
    })();
  }, []);

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
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });
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

  const runRiskCheck = (lat: number, lng: number, label: string) => {
    setSelectedCommunity(null);
    setRiskResult({ assessment: scoreAt(riskAlerts, lat, lng), label });
  };

  const handleMapLongPress = (e: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
    const coord = e?.nativeEvent?.coordinate;
    if (!coord) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    runRiskCheck(coord.latitude, coord.longitude, "Punto seleccionado en el mapa");
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query || searching) return;
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(query);
      if (!results.length) {
        Alert.alert("Sin resultados", "No encontramos esa dirección. Intenta con otra.");
        return;
      }
      const { latitude, longitude } = results[0];
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      runRiskCheck(latitude, longitude, query);
    } catch {
      Alert.alert("Búsqueda", "No se pudo buscar la dirección. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  };

  // El mapa de calor y los cuadrantes de riesgo son features de Pulso Plus.
  const selectLayer = (layer: "markers" | "heat" | "grid") => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (layer !== "markers" && !isPremium) {
      router.push("/premium");
      return;
    }
    setShowHeatmap(layer === "heat");
    setShowGrid(layer === "grid");
  };

  const styles = createStyles(theme, themeMode);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <MapView
            ref={mapRef}
            style={[StyleSheet.absoluteFill, isWeb && styles.webMapHost]}
            initialRegion={CULIACAN_CENTER}
            showsUserLocation
            showsMyLocationButton={false}
            pitchEnabled={false}
            zoomEnabled={true}
            rotateEnabled={false}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            userInterfaceStyle={isDark ? "dark" : "light"}
            onLongPress={handleMapLongPress}
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
            {showGrid && <RiskGrid cells={riskGrid} />}
            {!showHeatmap && !showGrid && filteredAlerts.map((alert) => (
              <Marker
                key={alert.id}
                coordinate={{ latitude: alert.lat, longitude: alert.lng }}
                tracksViewChanges={!lowConnection}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedCommunity(null);
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
                  avatarUrl={alert.user.avatarUrl}
                />
              </Marker>
            ))}

            {/* Posts de comunidad desde X — pin estático, no GlowMarker; solo con geo usable */}
            {!showHeatmap && !showGrid && mapCommunity.map((post) => (
              <Marker
                key={`x-${post.id}`}
                coordinate={{ latitude: post.lat, longitude: post.lng }}
                tracksViewChanges={Boolean(post.authorAvatarUrl || post.mediaUrl)}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setRiskResult(null);
                  setSelectedCommunity(post);
                }}
              >
                <CommunityMarker
                  isDemo={post.isDemo}
                  markerKind="community"
                  categoryGuess={post.categoryGuess}
                  color={getCategoryPinColor(post.categoryGuess)}
                  authorAvatarUrl={post.authorAvatarUrl}
                  mediaUrl={post.mediaUrl}
                  source={post.source}
                />
              </Marker>
            ))}
            
            {/* Zonas Patrocinadas */}
            {!showHeatmap && !showGrid && sponsoredZones.map((zone) => (
              <Marker
                key={zone.id}
                coordinate={{ latitude: zone.lat, longitude: zone.lng }}
                tracksViewChanges={false}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    zone.type === "refugio" ? "🛡️ Zona Segura" : "⭐ Patrocinado", 
                    `${zone.name}\n\n${zone.description}`
                  );
                }}
              >
                <View style={[
                  styles.sponsorMarker, 
                  zone.type === "refugio" ? styles.sponsorRefugio : styles.sponsorAnuncio
                ]}>
                  <Ionicons 
                    name={zone.type === "refugio" ? "shield-checkmark" : "star"} 
                    size={16} 
                    color="#fff" 
                  />
                </View>
              </Marker>
            ))}
          </MapView>

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

        {/* Buscador de zona: dime si una dirección es peligrosa */}
        {!isWeb && (
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color={theme.colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Busca una dirección o colonia…"
              placeholderTextColor={theme.colors.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searching ? (
              <ActivityIndicator size="small" color={theme.colors.accent} />
            ) : searchText.length > 0 ? (
              <Pressable onPress={handleSearch} hitSlop={8}>
                <Ionicons name="arrow-forward-circle" size={22} color={theme.colors.accent} />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Selector de capa del mapa (calor y cuadrantes son Plus) */}
        {!isWeb && (
          <View style={styles.layerSelector}>
            {([
              { key: "markers", icon: "location" },
              { key: "heat", icon: "flame" },
              { key: "grid", icon: "grid" },
            ] as const).map((item) => {
              const active =
                item.key === "markers"
                  ? !showHeatmap && !showGrid
                  : item.key === "heat"
                    ? showHeatmap
                    : showGrid;
              const locked = item.key !== "markers" && !isPremium;
              return (
                <Pressable
                  key={item.key}
                  style={[styles.layerButton, active && styles.layerButtonActive]}
                  onPress={() => selectLayer(item.key)}
                >
                  <Ionicons
                    name={item.icon}
                    size={18}
                    color={active ? "#FFFFFF" : theme.colors.textMuted}
                  />
                  {locked && (
                    <View style={styles.layerLock}>
                      <Ionicons name="lock-closed" size={9} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Horario: mismo timeFilter que Feed — overlay compacto, no bloquea gestos del mapa */}
        <View style={[styles.timeFilterWrap, isWeb && styles.timeFilterWrapWeb]} pointerEvents="box-none">
          <View style={styles.timeFilterRow} pointerEvents="auto">
            {TIME_FILTERS.map((filter) => {
              const active = timeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  style={[styles.timePill, active && styles.timePillActive]}
                  onPress={() => {
                    void Haptics.selectionAsync();
                    setTimeFilter(filter);
                  }}
                  hitSlop={4}
                >
                  <Text style={[styles.timePillText, active && styles.timePillTextActive]}>
                    {filter.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.timeWindowCaption} pointerEvents="none">
            Ventana: {getTimeFilterWindowLabel(timeFilter)} · no caducan en DB
          </Text>
        </View>

        {/* Empty state overlay (también en web: un mapa vacío se ve “roto”) */}
        {filteredAlerts.length === 0 && mapCommunity.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Ionicons name="shield-outline" size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Sin alertas en esta área</Text>
          </View>
        )}

        {/* Tarjeta de riesgo de zona — prioridad sobre banner y ticker */}
        {riskResult ? (
          <ZoneRiskCard
            assessment={riskResult.assessment}
            label={riskResult.label}
            onClose={() => setRiskResult(null)}
          />
        ) : selectedCommunity ? (
          <CommunityPostPreview
            post={selectedCommunity}
            onClose={() => setSelectedCommunity(null)}
          />
        ) : nearbyAlert ? (
          <Pressable
            style={styles.proximityBanner}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/alert/${nearbyAlert.alert.id}`);
            }}
          >
            <View style={styles.proximityIcon}>
              <Ionicons name="warning" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.proximityTitle}>Alerta activa cerca de ti</Text>
              <Text style={styles.proximitySub} numberOfLines={1}>
                {CATEGORY_LABELS[nearbyAlert.alert.category]} · a{" "}
                {nearbyAlert.dist < 1
                  ? `${Math.round(nearbyAlert.dist * 1000)} m`
                  : `${nearbyAlert.dist.toFixed(1)} km`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </Pressable>
        ) : filteredAlerts[0] ? (
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
    position: "relative",
    minHeight: 0,
  },
  webMapHost: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    minHeight: 320,
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
  sponsorMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  sponsorRefugio: {
    backgroundColor: theme.colors.success,
  },
  sponsorAnuncio: {
    backgroundColor: theme.colors.accent,
  },
  statSeparator: {
    width: 1,
    height: 30,
    backgroundColor: theme.colors.border,
    opacity: 0.5,
  },
  searchBar: {
    position: "absolute",
    top: 156,
    left: 16,
    right: 16,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.95)" : "rgba(18,18,18,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 20,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    paddingVertical: 0,
  },
  layerSelector: {
    position: "absolute",
    top: 214,
    right: 16,
    borderRadius: theme.radius.pill,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    zIndex: 20,
  },
  layerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.85)" : "rgba(26,26,26,0.7)",
  },
  layerButtonActive: {
    backgroundColor: theme.colors.reportAction,
  },
  layerLock: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  timeFilterWrap: {
    position: "absolute",
    left: 16,
    bottom: 188,
    zIndex: 18,
    maxWidth: "72%",
    gap: 4,
  },
  timeFilterWrapWeb: {
    bottom: 24,
  },
  timeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.92)" : "rgba(18,18,18,0.88)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timePillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  timePillText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.4,
  },
  timePillTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  timeWindowCaption: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.body,
    paddingHorizontal: 2,
    textShadowColor: themeMode === "light" ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
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
  proximityBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: theme.radius.xl,
    backgroundColor: "#E84F1F",
    shadowColor: "#E84F1F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
  proximityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  proximityTitle: {
    color: "#fff",
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  proximitySub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 1,
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
  emptyOverlay: {
    position: "absolute",
    alignSelf: "center",
    bottom: 160,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.92)" : "rgba(18,18,18,0.92)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
});
