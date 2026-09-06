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
import {
  GO_DEST_LABEL,
  GO_OUT_LABEL,
  RISK_RADIUS_KM,
  buildHeatPoints,
  buildRiskGridFromPoints,
  riskColor,
  scoreAtPoints,
  toAlertHeatPoint,
  toCommunityHeatPoint,
  type RiskAssessment,
} from "../../lib/alerty/risk";
import {
  nearestCuliacanPlace,
  resolveCommunityMapPoint,
  resolveDestinationQuery,
  suggestDestinationPlaces,
} from "../../lib/alerty/coloniaGeocode";
import { shareZonePulse } from "../../lib/alerty/share";
import { GlassView } from "expo-glass-effect";
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
import { CATEGORY_LABELS, CULIACAN_CENTER, TIME_FILTER_PILL_LABEL, TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { supabase } from "../../lib/supabase";
import type { AlertCategory, CommunityPost } from "../../lib/alerty/types";
import {
  calculateDistance,
  getCategoryPinColor,
  getIntensityColor,
  getPulseDuration,
  getTimeFilterWindowLabel,
  isAlertInWindow,
  isCommunityInWindow,
  shouldSuppressAlert,
} from "../../lib/alerty/utils";

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const [locating, setLocating] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showGrid, setShowGrid] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [searching, setSearching] = useState(false);
  const [riskResult, setRiskResult] = useState<{
    assessment: RiskAssessment;
    label: string;
    destination?: boolean;
    lat: number;
    lng: number;
  } | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<CommunityPost | null>(null);
  const [timeMenuOpen, setTimeMenuOpen] = useState(false);
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
      communityPosts.filter((post) => isCommunityInWindow(post, timeFilter)),
    [communityPosts, timeFilter],
  );

  // Mapa: geo persistida, o pin de ciudad para RSS sin colonia.
  const mapCommunity = useMemo(
    () =>
      filteredCommunity.flatMap((post) => {
        const point = resolveCommunityMapPoint(post);
        if (!point) return [];
        return [{
          ...post,
          lat: point.lat,
          lng: point.lng,
          placeLabel: point.placeLabel,
        }];
      }),
    [filteredCommunity],
  );

  const heatSources = useMemo(
    () => [
      ...filteredAlerts.flatMap((alert) => {
        const point = toAlertHeatPoint(alert);
        return point ? [point] : [];
      }),
      ...mapCommunity.flatMap((post) => {
        const point = toCommunityHeatPoint(post);
        return point ? [point] : [];
      }),
    ],
    [filteredAlerts, mapCommunity],
  );

  const heatmapPoints = useMemo(() => buildHeatPoints(heatSources), [heatSources]);

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

  const riskGrid = useMemo(
    () => (showGrid ? buildRiskGridFromPoints(heatSources, CULIACAN_CENTER) : []),
    [showGrid, heatSources],
  );

  const verdictPoint = userLocation ?? {
    latitude: CULIACAN_CENTER.latitude,
    longitude: CULIACAN_CENTER.longitude,
  };

  const zoneAssessment = useMemo(
    () => scoreAtPoints(heatSources, verdictPoint.latitude, verdictPoint.longitude),
    [heatSources, verdictPoint.latitude, verdictPoint.longitude],
  );

  const zonePlaceLabel = useMemo(() => {
    const place = nearestCuliacanPlace(verdictPoint.latitude, verdictPoint.longitude);
    if (place) return place.name;
    return userLocation ? "Tu zona" : "Culiacán";
  }, [verdictPoint.latitude, verdictPoint.longitude, userLocation]);

  const nearbyPulseCount = useMemo(
    () =>
      heatSources.filter(
        (point) =>
          calculateDistance(
            verdictPoint.latitude,
            verdictPoint.longitude,
            point.lat,
            point.lng,
          ) <= RISK_RADIUS_KM,
      ).length,
    [heatSources, verdictPoint.latitude, verdictPoint.longitude],
  );

  const destinationSuggestions = useMemo(
    () => suggestDestinationPlaces(searchText, 6),
    [searchText],
  );
  const showDestinationSuggestions = useMemo(() => {
    if (destinationSuggestions.length === 0) return false;
    const exactOnly =
      destinationSuggestions.length === 1 &&
      destinationSuggestions[0].name.localeCompare(searchText.trim(), "es", { sensitivity: "accent" }) === 0;
    return !exactOnly || searchFocused;
  }, [destinationSuggestions, searchFocused, searchText]);

  const handleShareZone = async (
    assessment: RiskAssessment,
    placeLabel: string,
    pulseCount: number,
    destination?: boolean,
  ) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await shareZonePulse(
        assessment,
        placeLabel,
        pulseCount,
        getTimeFilterWindowLabel(timeFilter),
        destination,
      );
    } catch {
      /* usuario canceló */
    }
  };

  useEffect(() => {
    if (isWeb) {
      if (typeof navigator === "undefined" || !navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
          setUserLocation(coords);
          useAlertyStore.getState().setUserCoords(coords);
        },
        () => {},
        { enableHighAccuracy: false, maximumAge: 60_000, timeout: 8000 },
      );
      return;
    }
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({});
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setUserLocation(coords);
        useAlertyStore.getState().setUserCoords(coords);
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
      const coords = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      setUserLocation(coords);
      useAlertyStore.getState().setUserCoords(coords);
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

  const runRiskCheck = (lat: number, lng: number, label: string, destination = false) => {
    setSelectedCommunity(null);
    setRiskResult({ assessment: scoreAtPoints(heatSources, lat, lng), label, destination, lat, lng });
  };

  const openRelatedPulse = (category: AlertCategory) => {
    if (!riskResult) return;
    const { lat, lng } = riskResult;
    const alerts = filteredAlerts
      .filter((alert) => alert.category === category)
      .map((alert) => ({
        kind: "alert" as const,
        id: alert.id,
        dist: calculateDistance(lat, lng, alert.lat, alert.lng),
      }));
    const posts = mapCommunity
      .filter((post) => post.categoryGuess === category)
      .map((post) => ({
        kind: "community" as const,
        post,
        dist: calculateDistance(lat, lng, post.lat, post.lng),
      }));
    const ranked = [...alerts, ...posts].sort((a, b) => a.dist - b.dist);
    const best = ranked.find((row) => row.dist <= RISK_RADIUS_KM) ?? ranked[0];
    if (!best) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (best.kind === "alert") {
      router.push(`/alert/${best.id}`);
      return;
    }
    setRiskResult(null);
    setSelectedCommunity(best.post);
  };

  const goToDestination = (lat: number, lng: number, label: string) => {
    setSearchText(label);
    setSearchFocused(false);
    searchInputRef.current?.blur();
    mapRef.current?.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    });
    runRiskCheck(lat, lng, label, true);
  };

  const handleMapPick = (e: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
    const coord = e?.nativeEvent?.coordinate;
    if (!coord) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const place = nearestCuliacanPlace(coord.latitude, coord.longitude);
    goToDestination(coord.latitude, coord.longitude, place?.name ?? "Este punto en el mapa");
  };

  const handleSearch = async () => {
    const query = searchText.trim();
    if (!query || searching) return;
    const local = resolveDestinationQuery(query);
    if (local) {
      goToDestination(local.lat, local.lng, local.placeLabel);
      return;
    }
    const top = suggestDestinationPlaces(query, 1)[0];
    if (top) {
      goToDestination(top.lat, top.lng, top.name);
      return;
    }
    if (isWeb) {
      Alert.alert(
        "Sin resultados",
        "No encontramos esa colonia. Elige una sugerencia o toca el mapa.",
      );
      return;
    }
    setSearching(true);
    try {
      const results = await Location.geocodeAsync(`${query}, Culiacán, Sinaloa`);
      if (!results.length) {
        Alert.alert("Sin resultados", "No encontramos esa dirección. Elige una colonia o toca el mapa.");
        return;
      }
      const { latitude, longitude } = results[0];
      goToDestination(latitude, longitude, query);
    } catch {
      Alert.alert("Búsqueda", "No se pudo buscar la dirección. Intenta de nuevo.");
    } finally {
      setSearching(false);
    }
  };

  const toggleHeat = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowHeatmap(!showHeatmap);
  };

  const toggleGrid = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowGrid(!showGrid);
  };

  const headerStatusText = riskResult
    ? `${(riskResult.destination ? GO_DEST_LABEL : GO_OUT_LABEL)[riskResult.assessment.level]} · ${riskResult.label}`
    : nearbyAlert
      ? `Alerta cerca · ${CATEGORY_LABELS[nearbyAlert.alert.category]} · ${
          nearbyAlert.dist < 1
            ? `${Math.round(nearbyAlert.dist * 1000)} m`
            : `${nearbyAlert.dist.toFixed(1)} km`
        }`
      : `${GO_OUT_LABEL[zoneAssessment.level]} · ${zonePlaceLabel}`;

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
            onPress={handleMapPick}
            onLongPress={handleMapPick}
          >
            {showHeatmap && heatmapPoints.length > 0 && (
              <Heatmap
                points={heatmapPoints}
                radius={48}
                opacity={0.68}
                gradient={{
                  colors: [theme.colors.mapYellow, theme.colors.mapOrange, theme.colors.mapRed],
                  startPoints: [0.2, 0.5, 0.8],
                  colorMapSize: 256
                }}
              />
            )}
            {showGrid && <RiskGrid cells={riskGrid} />}
            {filteredAlerts.map((alert) => (
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
            {mapCommunity.map((post) => (
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
            {sponsoredZones.map((zone) => (
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

        <View style={styles.headerStack}>
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
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cityLabel}>Culiacán, Sinaloa</Text>
              </View>
              <View style={styles.headerTools}>
                <Pressable
                  style={styles.headerTool}
                  onPress={handleCenterLocation}
                  disabled={locating}
                  accessibilityLabel="Mi ubicación"
                >
                  <Ionicons name="locate" size={18} color={theme.colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.headerTool, showHeatmap && styles.headerToolActive]}
                  onPress={toggleHeat}
                  accessibilityLabel="Mapa de calor"
                >
                  <Ionicons name="flame" size={16} color={showHeatmap ? "#FFFFFF" : theme.colors.text} />
                </Pressable>
                <Pressable
                  style={[styles.headerTool, showGrid && styles.headerToolActive]}
                  onPress={toggleGrid}
                  accessibilityLabel="Zonas por cuadrantes"
                >
                  <Ionicons name="grid" size={16} color={showGrid ? "#FFFFFF" : theme.colors.text} />
                </Pressable>
              </View>
            </View>

            <Pressable
              style={styles.zoneStrip}
              onPress={() => {
                if (riskResult || !nearbyAlert) return;
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push(`/alert/${nearbyAlert.alert.id}`);
              }}
              accessibilityLabel={
                riskResult
                  ? `${(riskResult.destination ? GO_DEST_LABEL : GO_OUT_LABEL)[riskResult.assessment.level]} ${riskResult.label}`
                  : nearbyAlert
                    ? `Alerta cerca: ${CATEGORY_LABELS[nearbyAlert.alert.category]}`
                    : `${GO_OUT_LABEL[zoneAssessment.level]} en ${zonePlaceLabel}`
              }
            >
              <View
                style={[
                  styles.zoneDot,
                  {
                    backgroundColor: riskResult
                      ? riskColor(riskResult.assessment.level, theme.colors)
                      : nearbyAlert
                        ? theme.colors.mapOrange
                        : riskColor(zoneAssessment.level, theme.colors),
                  },
                ]}
              >
                <Ionicons
                  name={
                    riskResult
                      ? riskResult.assessment.level === "tranquila"
                        ? "shield-checkmark"
                        : "warning"
                      : nearbyAlert
                        ? "warning"
                        : "shield-checkmark"
                  }
                  size={11}
                  color="#fff"
                />
              </View>
              <Text
                style={[
                  styles.zoneStripText,
                  {
                    color: riskResult
                      ? riskColor(riskResult.assessment.level, theme.colors)
                      : nearbyAlert
                        ? theme.colors.mapOrange
                        : riskColor(zoneAssessment.level, theme.colors),
                  },
                ]}
                numberOfLines={1}
              >
                {headerStatusText}
              </Text>
              {riskResult ? (
                <>
                  <Pressable
                    onPress={() => {
                      void handleShareZone(
                        riskResult.assessment,
                        riskResult.label,
                        riskResult.assessment.count,
                        riskResult.destination,
                      );
                    }}
                    hitSlop={8}
                    accessibilityLabel="Compartir zona"
                  >
                    <Ionicons name="share-outline" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={() => setRiskResult(null)}
                    hitSlop={8}
                    accessibilityLabel="Cerrar destino"
                  >
                    <Ionicons name="close" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                </>
              ) : nearbyAlert ? (
                <Ionicons name="chevron-forward" size={14} color={theme.colors.textMuted} />
              ) : (
                <Pressable
                  onPress={() => {
                    void handleShareZone(zoneAssessment, zonePlaceLabel, nearbyPulseCount);
                  }}
                  hitSlop={8}
                  accessibilityLabel="Compartir zona"
                >
                  <Ionicons name="share-outline" size={14} color={theme.colors.textMuted} />
                </Pressable>
              )}
            </Pressable>

            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color={theme.colors.textMuted} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Colonia o toca el mapa…"
                placeholderTextColor={theme.colors.textMuted}
                value={searchText}
                onChangeText={(text) => {
                  setSearchText(text);
                  setSearchFocused(true);
                }}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => {
                  setTimeout(() => setSearchFocused(false), 180);
                }}
                onSubmitEditing={handleSearch}
                onKeyPress={(e) => {
                  if (e.nativeEvent.key === "Enter") void handleSearch();
                }}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="words"
              />
              {searching ? (
                <ActivityIndicator size="small" color={theme.colors.accent} />
              ) : searchText.length > 0 ? (
                <Pressable
                  onPress={() => void handleSearch()}
                  hitSlop={8}
                  accessibilityLabel="Consultar destino"
                >
                  <Ionicons name="arrow-forward-circle" size={22} color={theme.colors.accent} />
                </Pressable>
              ) : null}
            </View>

            {riskResult ? (
              <View style={styles.destMeta}>
                {riskResult.assessment.count === 0 ? (
                  <Text style={styles.destEmpty}>Sin pulsos cerca · mantente atento</Text>
                ) : (
                  <View style={styles.destChips}>
                    {riskResult.assessment.byCategory.map((c) => (
                      <Pressable
                        key={c.category}
                        style={styles.destChip}
                        onPress={() => openRelatedPulse(c.category)}
                        accessibilityLabel={`Ver pulso de ${CATEGORY_LABELS[c.category]}`}
                      >
                        <Text style={styles.destChipText}>
                          {CATEGORY_LABELS[c.category]} · {c.count}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            ) : null}
          </GlassView>

          {showDestinationSuggestions ? (
            <View style={styles.suggestList}>
              {destinationSuggestions.map((place) => (
                <Pressable
                  key={place.name}
                  style={styles.suggestRow}
                  accessibilityLabel={`Ir a ${place.name}`}
                  onPress={() => goToDestination(place.lat, place.lng, place.name)}
                >
                  <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
                  <Text style={styles.suggestText}>{place.name}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>

        {/* Horario: mismo timeFilter que Feed — overlay compacto, no bloquea gestos del mapa */}
        <View style={[styles.timeFilterWrap, isWeb && styles.timeFilterWrapWeb]} pointerEvents="box-none">
          {timeMenuOpen ? (
            <View style={styles.timeFilterCard} pointerEvents="auto">
              <Pressable
                style={styles.timeMenuHeader}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTimeMenuOpen(false);
                }}
                accessibilityLabel="Cerrar horario"
              >
                <Ionicons name="time-outline" size={16} color={theme.colors.text} />
                <Text style={styles.timeWindowCaption}>
                  Horario · {getTimeFilterWindowLabel(timeFilter)}
                </Text>
                <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
              </Pressable>
              <View style={styles.timeFilterRow}>
                {TIME_FILTERS.map((filter) => {
                  const active = timeFilter === filter;
                  return (
                    <Pressable
                      key={filter}
                      style={[styles.timePill, active && styles.timePillActive]}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setTimeFilter(filter);
                        setTimeMenuOpen(false);
                      }}
                      hitSlop={4}
                      accessibilityLabel={`Ver ${TIME_FILTER_PILL_LABEL[filter]}`}
                    >
                      <Text style={[styles.timePillText, active && styles.timePillTextActive]}>
                        {TIME_FILTER_PILL_LABEL[filter]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <Pressable
              style={styles.timeFilterCollapsed}
              onPress={() => {
                void Haptics.selectionAsync();
                setTimeMenuOpen(true);
              }}
              accessibilityLabel={`Horario: ${getTimeFilterWindowLabel(timeFilter)}. Abrir ventana de tiempo`}
              pointerEvents="auto"
            >
              <Ionicons name="time-outline" size={16} color={theme.colors.text} />
              <Text style={styles.timeCollapsedText}>
                Horario · {TIME_FILTER_PILL_LABEL[timeFilter]}
              </Text>
              <Ionicons name="chevron-up" size={14} color={theme.colors.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Empty state overlay (también en web: un mapa vacío se ve “roto”) */}
        {filteredAlerts.length === 0 && mapCommunity.length === 0 && (
          <View style={styles.emptyOverlay} pointerEvents="none">
            <Ionicons name="shield-outline" size={28} color={theme.colors.textMuted} />
            <Text style={styles.emptyText}>Sin pulsos en esta área</Text>
          </View>
        )}

        {selectedCommunity ? (
          <CommunityPostPreview
            post={selectedCommunity}
            onClose={() => setSelectedCommunity(null)}
          />
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
    height: 260,
  },
  headerStack: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    zIndex: 20,
  },
  headerCard: {
    padding: 12,
    gap: 10,
    borderRadius: theme.radius.xl,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.85)" : "rgba(18,18,18,0.8)",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  zoneStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  zoneDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  zoneStripText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  headerTools: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTool: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: themeMode === "light" ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  headerToolActive: {
    backgroundColor: theme.colors.reportAction,
    borderColor: theme.colors.reportAction,
  },
  destMeta: {
    gap: 6,
  },
  destEmpty: {
    fontSize: 11,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
  },
  destChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  destChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  destChipText: {
    fontSize: 11,
    fontFamily: theme.fonts.body,
    color: theme.colors.text,
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
  searchBar: {
    height: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.95)" : "rgba(18,18,18,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestList: {
    marginTop: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.96)" : "rgba(18,18,18,0.94)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  suggestText: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    paddingVertical: 0,
  },
  timeFilterWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 118,
    zIndex: 18,
  },
  timeFilterWrapWeb: {
    bottom: 20,
  },
  timeFilterCard: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.xl,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.96)" : "rgba(18,18,18,0.92)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    gap: 6,
    maxWidth: 420,
  },
  timeFilterCollapsed: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.96)" : "rgba(18,18,18,0.92)",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeCollapsedText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  timeFilterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  timePill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timePillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent,
  },
  timePillText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  timePillTextActive: {
    color: "#FFFFFF",
    fontFamily: theme.fonts.heading,
  },
  timeWindowCaption: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
    paddingHorizontal: 2,
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
