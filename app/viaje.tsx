/**
 * Modo viaje · Antes de salir
 * Origen y destino libres (México), chips Sinaloa, recientes y TomTom.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { formatRelativeTime } from "../lib/alerty/utils";
import { trackEvent } from "../lib/analytics";
import { shareTravelSummary } from "../lib/alerty/share";
import { getCurrentCoords } from "../lib/alerty/geolocation";
import { searchTripPlaces } from "../lib/alerty/tomtomPlaces";
import {
  fetchTomtomTravelInsights,
  POI_SECTION_ORDER,
  poiSectionIcon,
  poiSectionLabel,
  type TomtomPoi,
  type TomtomTravelInsights,
} from "../lib/alerty/tomtomTravel";
import {
  buildTravelSummary,
  collectPulsesNearPolyline,
  collectTravelPulses,
  isTravelModeEnabled,
  resolveCorridor,
  travelShareMessage,
  type TravelPulse,
  type TravelSummary,
  type TravelWindow,
} from "../lib/alerty/travel/travelMode";
import {
  loadRecentTrips,
  saveRecentTrip,
  swapTrip,
  travelDirectionFromTrip,
  TRIP_ROUTE_CHIPS,
  type RecentTrip,
  type TripPlace,
} from "../lib/alerty/travel/tripPlaces";

const DEFAULT_ORIGIN: TripPlace = TRIP_ROUTE_CHIPS[0].origin;
const DEFAULT_DEST: TripPlace = TRIP_ROUTE_CHIPS[0].destination;

export default function ViajeScreen() {
  const router = useRouter();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const { alerts, communityPosts, setTravelMapOverlay, userCoords, setUserCoords } =
    useAlertyStore();

  const [origin, setOrigin] = useState<TripPlace | null>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<TripPlace | null>(DEFAULT_DEST);
  const [originText, setOriginText] = useState(DEFAULT_ORIGIN.name);
  const [destText, setDestText] = useState(DEFAULT_DEST.name);
  const [originSuggestions, setOriginSuggestions] = useState<TripPlace[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<TripPlace[]>([]);
  const [activeField, setActiveField] = useState<"origin" | "dest" | null>(null);
  const [recent, setRecent] = useState<RecentTrip[]>([]);
  const [window, setWindow] = useState<TravelWindow>("6h");
  const [summary, setSummary] = useState<TravelSummary | null>(null);
  const [insights, setInsights] = useState<TomtomTravelInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [locating, setLocating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const originTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isTravelModeEnabled()) {
      router.replace("/(tabs)" as any);
      return;
    }
    void trackEvent({ event_type: "travel_mode_open", metadata: { freeform: true } });
    void loadRecentTrips().then(setRecent);
  }, []);

  const runSearch = useCallback((field: "origin" | "dest", q: string) => {
    const timer = field === "origin" ? originTimer : destTimer;
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 3) {
      if (field === "origin") setOriginSuggestions([]);
      else setDestSuggestions([]);
      return;
    }
    timer.current = setTimeout(() => {
      void searchTripPlaces(q).then((list) => {
        if (field === "origin") setOriginSuggestions(list);
        else setDestSuggestions(list);
      });
    }, 320);
  }, []);

  useEffect(() => {
    if (!origin || !destination) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);
    void (async () => {
      const direction = travelDirectionFromTrip(origin, destination);
      const tt = await fetchTomtomTravelInsights({
        origin,
        destination,
        direction,
        fromLabel: origin.name === "Mi ubicación" ? "Mi ubicación" : null,
        window,
      });
      if (cancelled) return;

      if (tt.error && tt.message) {
        setErrorMsg(tt.message);
      }

      const polyline =
        tt.route?.points?.map((p) => ({
          latitude: p.lat,
          longitude: p.lng,
        })) ?? [];

      let pulses: TravelPulse[] = [];
      if (direction) {
        const corridor = await resolveCorridor({
          direction,
          routing: { provider: "tomtom" },
        });
        pulses = collectTravelPulses({
          alerts,
          communityPosts,
          direction,
          window,
          bundle: corridor.bundle,
        });
      } else if (polyline.length >= 2) {
        pulses = collectPulsesNearPolyline({
          alerts,
          communityPosts,
          window,
          polyline,
          destinationName: destination.name,
        });
      }

      // Fusiona pulsos del servidor (cualquier ciudad) sin duplicar id
      const seen = new Set(pulses.map((p) => p.id));
      for (const sp of tt.pulses ?? []) {
        if (seen.has(sp.id)) continue;
        pulses.push({
          id: sp.id,
          kind: "community",
          category: sp.category,
          title: sp.title,
          placeLabel: sp.placeLabel,
          createdAt: sp.createdAt,
          status: sp.status === "resolved" ? "resolved" : "active",
          lat: sp.lat,
          lng: sp.lng,
          onCorridor: true,
          inDestination: false,
        });
        seen.add(sp.id);
      }

      const next = buildTravelSummary({
        direction: direction ?? "custom",
        originName: origin.name,
        destinationName: destination.name,
        window,
        pulses,
      });

      setSummary(next);
      setInsights(tt);
      setLoading(false);
      void saveRecentTrip(origin, destination).then(setRecent);
    })();
    return () => {
      cancelled = true;
    };
  }, [alerts, communityPosts, origin, destination, window]);

  const flipTrip = () => {
    const swapped = swapTrip(origin, destination);
    setOrigin(swapped.origin);
    setDestination(swapped.destination);
    setOriginText(swapped.origin?.name ?? "");
    setDestText(swapped.destination?.name ?? "");
    setOriginSuggestions([]);
    setDestSuggestions([]);
  };

  const useMyLocation = async () => {
    setLocating(true);
    try {
      let coords = userCoords;
      if (!coords) {
        coords = await getCurrentCoords();
        setUserCoords(coords);
      }
      const place: TripPlace = {
        name: "Mi ubicación",
        lat: coords.latitude,
        lng: coords.longitude,
      };
      setOrigin(place);
      setOriginText(place.name);
      setOriginSuggestions([]);
      setActiveField(null);
    } catch {
      setErrorMsg("No pudimos usar tu ubicación. Revisa el permiso y vuelve a intentar.");
    } finally {
      setLocating(false);
    }
  };

  const pickPlace = (field: "origin" | "dest", place: TripPlace) => {
    if (field === "origin") {
      setOrigin(place);
      setOriginText(place.name);
      setOriginSuggestions([]);
    } else {
      setDestination(place);
      setDestText(place.name);
      setDestSuggestions([]);
    }
    setActiveField(null);
  };

  const applyChip = (chip: (typeof TRIP_ROUTE_CHIPS)[number]) => {
    setOrigin(chip.origin);
    setDestination(chip.destination);
    setOriginText(chip.origin.name);
    setDestText(chip.destination.name);
    setOriginSuggestions([]);
    setDestSuggestions([]);
  };

  const applyRecent = (trip: RecentTrip) => {
    setOrigin(trip.origin);
    setDestination(trip.destination);
    setOriginText(trip.origin.name);
    setDestText(trip.destination.name);
  };

  const onShare = async () => {
    if (!summary) return;
    setSharing(true);
    try {
      let msg = travelShareMessage(summary);
      if (insights?.route?.travelTimeMinutes != null) {
        msg += `\nETA ~${insights.route.travelTimeMinutes} min`;
        if (insights.route.trafficDelayMinutes) {
          msg += ` (+${insights.route.trafficDelayMinutes} min por tráfico)`;
        }
      }
      for (const d of insights?.delays?.slice(0, 3) ?? []) {
        msg += `\n+${d.extraMinutes} min ${d.label}`;
      }
      if (insights?.attribution) msg += `\n${insights.attribution}`;
      await shareTravelSummary(msg);
      void trackEvent({ event_type: "travel_mode_share", metadata: { window } });
    } finally {
      setSharing(false);
    }
  };

  const onShowMap = () => {
    if (!origin || !destination) return;
    const direction = travelDirectionFromTrip(origin, destination);
    if (direction) {
      setTravelMapOverlay(true, direction);
      void trackEvent({ event_type: "travel_mode_show_map", metadata: { direction } });
      router.replace("/(tabs)" as any);
    }
  };

  const destLabel = summary?.destinationName ?? destination?.name ?? "destino";
  const canShowMap =
    origin && destination ? Boolean(travelDirectionFromTrip(origin, destination)) : false;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityLabel="Cerrar Modo viaje"
          style={styles.iconBtn}
        >
          <Ionicons name="close" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Antes de salir</Text>
        <Pressable
          onPress={() => void onShare()}
          disabled={!summary || sharing}
          hitSlop={12}
          accessibilityLabel="Compartir resumen"
          style={styles.iconBtn}
        >
          <Ionicons name="share-outline" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={styles.inputsBlock}>
        <PlaceField
          label="Origen"
          value={originText}
          onChangeText={(t) => {
            setOriginText(t);
            setOrigin(null);
            setActiveField("origin");
            runSearch("origin", t);
          }}
          onFocus={() => setActiveField("origin")}
          suggestions={activeField === "origin" ? originSuggestions : []}
          onPick={(p) => pickPlace("origin", p)}
          theme={theme}
          styles={styles}
        />
        <View style={styles.midRow}>
          <Pressable
            onPress={() => void useMyLocation()}
            style={styles.myLocBtn}
            accessibilityLabel="Usar mi ubicación"
            disabled={locating}
          >
            <Ionicons name="locate-outline" size={16} color={theme.colors.accent} />
            <Text style={[styles.myLocText, { color: theme.colors.accent }]}>
              {locating ? "Buscando…" : "Mi ubicación"}
            </Text>
          </Pressable>
          <Pressable
            onPress={flipTrip}
            style={styles.swapBtn}
            accessibilityLabel="Invertir origen y destino"
          >
            <Ionicons name="swap-vertical" size={22} color={theme.colors.accent} />
          </Pressable>
        </View>
        <PlaceField
          label="Destino"
          value={destText}
          onChangeText={(t) => {
            setDestText(t);
            setDestination(null);
            setActiveField("dest");
            runSearch("dest", t);
          }}
          onFocus={() => setActiveField("dest")}
          suggestions={activeField === "dest" ? destSuggestions : []}
          onPick={(p) => pickPlace("dest", p)}
          theme={theme}
          styles={styles}
        />
      </View>

      <Text style={[styles.roadHint, { color: theme.colors.textMuted }]}>
        Elige de dónde sales y a dónde vas. Te contamos el tráfico y lo que vecinos
        reportaron cerca del camino.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {TRIP_ROUTE_CHIPS.map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => applyChip(chip)}
            style={[styles.chip, { borderColor: theme.colors.border }]}
          >
            <Text style={[styles.chipText, { color: theme.colors.text }]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {recent.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {recent.map((t, i) => (
            <Pressable
              key={`${t.savedAt}-${i}`}
              onPress={() => applyRecent(t)}
              style={[styles.chip, styles.recentChip, { borderColor: theme.colors.border }]}
            >
              <Ionicons name="time-outline" size={12} color={theme.colors.textMuted} />
              <Text style={[styles.chipText, { color: theme.colors.textMuted }]}>
                {t.origin.name.split(",")[0]} → {t.destination.name.split(",")[0]}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.windowRow}>
        {(["6h", "24h"] as TravelWindow[]).map((w) => {
          const on = window === w;
          return (
            <Pressable
              key={w}
              onPress={() => setWindow(w)}
              style={[
                styles.windowPill,
                {
                  backgroundColor: on ? theme.colors.text : theme.colors.surfaceAlt,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={{
                  color: on ? theme.colors.background : theme.colors.text,
                  fontFamily: "SpaceGrotesk_500Medium",
                  fontSize: 13,
                }}
              >
                {w === "6h" ? "6 horas" : "24 horas"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {errorMsg ? (
        <Text style={[styles.errorText, { color: theme.colors.textMuted }]}>{errorMsg}</Text>
      ) : null}

      {!origin || !destination ? (
        <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
          Escribe origen y destino (mín. 3 letras) o elige un viaje frecuente.
        </Text>
      ) : loading || !summary ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={summary.pulses}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <Text style={[styles.headline, { color: theme.colors.text }]}>
                {summary.headline}
              </Text>
              <Text style={[styles.blurb, { color: theme.colors.textMuted }]}>
                {summary.blurb}
              </Text>

              {insights?.route?.travelTimeMinutes != null ? (
                <View style={[styles.insightBox, { borderColor: theme.colors.border }]}>
                  <Text style={[styles.insightTitle, { color: theme.colors.text }]}>
                    ETA ~{insights.route.travelTimeMinutes} min
                    {insights.route.trafficDelayMinutes
                      ? ` · +${insights.route.trafficDelayMinutes} min por tráfico`
                      : ""}
                  </Text>
                  <Text style={[styles.insightSub, { color: theme.colors.textMuted }]}>
                    {insights.route.summary}
                    {insights.route.lengthKm ? ` · ${insights.route.lengthKm} km` : ""}
                    {insights.mock ? " · demo" : ""}
                  </Text>
                  {insights.route.alternates?.map((alt, i) => (
                    <Text
                      key={i}
                      style={[styles.insightSub, { color: theme.colors.textMuted }]}
                    >
                      Alterna: {alt.summary} · ~{alt.travelTimeMinutes} min
                    </Text>
                  ))}
                </View>
              ) : null}

              {(insights?.delays?.length ?? 0) > 0 ? (
                <View style={styles.delayRow}>
                  {insights!.delays.map((d) => (
                    <View
                      key={d.id}
                      style={[styles.delayChip, { borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.delayNum, { color: theme.colors.text }]}>
                        +{d.extraMinutes} min
                      </Text>
                      <Text style={[styles.delayLabel, { color: theme.colors.textMuted }]}>
                        {d.label}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {insights?.pois
                ? POI_SECTION_ORDER.map((key) => {
                    const list = insights.pois[key] ?? [];
                    if (!list.length) return null;
                    return (
                      <View key={key} style={styles.poiBlock}>
                        <View style={styles.poiTitleRow}>
                          <Ionicons
                            name={poiSectionIcon(key)}
                            size={16}
                            color={theme.colors.accent}
                          />
                          <Text style={[styles.poiTitle, { color: theme.colors.text }]}>
                            {poiSectionLabel(key)}
                          </Text>
                        </View>
                        {list.slice(0, 4).map((p, i) => (
                          <PoiLine key={`${key}-${i}`} poi={p} theme={theme} styles={styles} />
                        ))}
                      </View>
                    );
                  })
                : null}

              {insights?.attribution ? (
                <Text style={[styles.attr, { color: theme.colors.textMuted }]}>
                  {insights.attribution}
                </Text>
              ) : null}

              {summary.byCategory.length > 0 ? (
                <View style={styles.counts}>
                  {summary.byCategory.slice(0, 6).map((row) => (
                    <View
                      key={row.category}
                      style={[styles.countChip, { borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.countNum, { color: theme.colors.text }]}>
                        {row.count}
                      </Text>
                      <Text style={[styles.countLabel, { color: theme.colors.textMuted }]}>
                        {row.label}
                      </Text>
                    </View>
                  ))}
                  {summary.cleared > 0 ? (
                    <View style={[styles.countChip, styles.clearedChip]}>
                      <Text style={styles.clearedNum}>{summary.cleared}</Text>
                      <Text style={styles.clearedLabel}>Ya se despejó</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
              <View style={styles.ctaRow}>
                {canShowMap ? (
                  <Pressable
                    style={[styles.ctaPrimary, { backgroundColor: theme.colors.text }]}
                    onPress={onShowMap}
                  >
                    <Ionicons name="map-outline" size={18} color={theme.colors.background} />
                    <Text style={[styles.ctaPrimaryText, { color: theme.colors.background }]}>
                      Ver corredor en el mapa
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.ctaSecondary, { borderColor: theme.colors.border }]}
                  onPress={() => void onShare()}
                  disabled={sharing}
                >
                  <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                  <Text style={[styles.ctaSecondaryText, { color: theme.colors.text }]}>
                    Compartir
                  </Text>
                </Pressable>
              </View>
            </View>
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.colors.textMuted }]}>
              No hay pulsos en esta ventana cerca del camino ni en {destLabel}.
            </Text>
          }
          renderItem={({ item }) => <PulseRow pulse={item} styles={styles} theme={theme} />}
        />
      )}
    </SafeAreaView>
  );
}

function PlaceField({
  label,
  value,
  onChangeText,
  onFocus,
  suggestions,
  onPick,
  theme,
  styles,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  onFocus: () => void;
  suggestions: TripPlace[];
  onPick: (p: TripPlace) => void;
  theme: ReturnType<typeof useAlertyTheme>;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        placeholder={label === "Origen" ? "¿De dónde sales?" : "¿A dónde vas?"}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.fieldInput,
          {
            color: theme.colors.text,
            backgroundColor: theme.colors.surfaceAlt,
            borderColor: theme.colors.border,
          },
        ]}
        autoCorrect={false}
        autoCapitalize="words"
      />
      {suggestions.length > 0 ? (
        <View
          style={[
            styles.suggestBox,
            { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          ]}
        >
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.lat}-${s.lng}-${i}`}
              onPress={() => onPick(s)}
              style={styles.suggestRow}
            >
              <Ionicons name="location-outline" size={14} color={theme.colors.textMuted} />
              <Text
                style={[styles.suggestText, { color: theme.colors.text }]}
                numberOfLines={2}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PoiLine({
  poi,
  styles,
  theme,
}: {
  poi: TomtomPoi;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useAlertyTheme>;
}) {
  const isAliado = Boolean(poi.aliado || poi.source === "aliado");
  return (
    <View style={styles.poiLineRow}>
      {isAliado && poi.logoUrl ? (
        <Image source={{ uri: poi.logoUrl }} style={styles.poiLogo} />
      ) : null}
      <View style={styles.poiLineBody}>
        <Text style={[styles.poiLine, { color: theme.colors.text }]} numberOfLines={2}>
          {isAliado ? "" : "· "}
          {poi.name}
          {poi.distKm != null ? ` · ${poi.distKm} km` : ""}
        </Text>
        {isAliado ? (
          <Text style={styles.poiBadge}>{poi.badge || "Aliado Pulso"}</Text>
        ) : null}
        {isAliado && poi.promo ? (
          <Text style={[styles.poiPromo, { color: theme.colors.textMuted }]} numberOfLines={2}>
            {poi.promo}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function PulseRow({
  pulse,
  styles,
  theme,
}: {
  pulse: TravelPulse;
  styles: ReturnType<typeof createStyles>;
  theme: ReturnType<typeof useAlertyTheme>;
}) {
  const cat =
    CATEGORY_LABELS[pulse.category as keyof typeof CATEGORY_LABELS] ?? pulse.category;
  return (
    <View
      style={[
        styles.pulseRow,
        { borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
      ]}
    >
      <View style={styles.pulseTop}>
        <Text style={[styles.pulseCat, { color: theme.colors.accent }]}>{cat}</Text>
        <Text style={[styles.pulseTime, { color: theme.colors.textMuted }]}>
          {formatRelativeTime(pulse.createdAt)}
        </Text>
      </View>
      <Text style={[styles.pulseTitle, { color: theme.colors.text }]}>{pulse.title}</Text>
      <Text style={[styles.pulsePlace, { color: theme.colors.textMuted }]}>
        {pulse.placeLabel}
        {pulse.status === "resolved" ? " · ya se despejó" : ""}
      </Text>
    </View>
  );
}

function createStyles(theme: ReturnType<typeof useAlertyTheme>) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: "SpaceGrotesk_700Bold",
    },
    iconBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    inputsBlock: { paddingHorizontal: 16, gap: 6, zIndex: 2 },
    fieldWrap: { gap: 4, zIndex: 3 },
    fieldLabel: {
      fontSize: 11,
      fontFamily: "SpaceGrotesk_500Medium",
      marginLeft: 4,
    },
    fieldInput: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      fontFamily: "SpaceGrotesk_500Medium",
    },
    suggestBox: {
      borderWidth: 1,
      borderRadius: 12,
      marginTop: 4,
      overflow: "hidden",
    },
    suggestRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    suggestText: {
      flex: 1,
      fontSize: 13,
      fontFamily: "SpaceGrotesk_400Regular",
      lineHeight: 18,
    },
    midRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 4,
    },
    myLocBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
    myLocText: { fontSize: 13, fontFamily: "SpaceGrotesk_500Medium" },
    swapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    roadHint: {
      marginTop: 10,
      paddingHorizontal: 18,
      fontSize: 13,
      fontFamily: "SpaceGrotesk_400Regular",
      lineHeight: 18,
    },
    chipsRow: {
      paddingHorizontal: 16,
      paddingTop: 10,
      gap: 8,
      flexDirection: "row",
      alignItems: "center",
    },
    chip: {
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    recentChip: { flexDirection: "row", alignItems: "center", gap: 4 },
    chipText: { fontSize: 12, fontFamily: "SpaceGrotesk_500Medium" },
    errorText: {
      paddingHorizontal: 18,
      marginTop: 6,
      fontSize: 13,
      fontFamily: "SpaceGrotesk_400Regular",
      lineHeight: 18,
    },
    insightBox: {
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    insightTitle: {
      fontSize: 15,
      fontFamily: "SpaceGrotesk_700Bold",
    },
    insightSub: {
      fontSize: 12,
      fontFamily: "SpaceGrotesk_400Regular",
      lineHeight: 17,
    },
    delayRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    delayChip: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    delayNum: { fontSize: 14, fontFamily: "SpaceGrotesk_700Bold" },
    delayLabel: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 2 },
    poiBlock: { gap: 6, marginTop: 4 },
    poiTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    poiTitle: { fontSize: 13, fontFamily: "SpaceGrotesk_700Bold" },
    poiLineRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    poiLogo: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#E8E4DC" },
    poiLineBody: { flex: 1, gap: 2 },
    poiLine: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", lineHeight: 17 },
    poiBadge: {
      alignSelf: "flex-start",
      fontSize: 10,
      fontFamily: "SpaceGrotesk_700Bold",
      color: "#1F9D6E",
      textTransform: "uppercase",
      letterSpacing: 0.3,
    },
    poiPromo: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", lineHeight: 15 },
    attr: { fontSize: 11, fontFamily: "SpaceGrotesk_400Regular", marginTop: 4 },
    windowRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 14,
      marginBottom: 8,
    },
    windowPill: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
    },
    loading: { flex: 1, alignItems: "center", justifyContent: "center" },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    summaryCard: {
      marginTop: 8,
      marginBottom: 16,
      gap: 10,
    },
    headline: {
      fontSize: 20,
      fontFamily: "SpaceGrotesk_700Bold",
      lineHeight: 26,
    },
    blurb: {
      fontSize: 14,
      fontFamily: "SpaceGrotesk_400Regular",
      lineHeight: 20,
    },
    counts: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    countChip: {
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      minWidth: 72,
    },
    countNum: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold" },
    countLabel: { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", marginTop: 2 },
    clearedChip: {
      backgroundColor: "rgba(31,157,110,0.12)",
      borderColor: "rgba(31,157,110,0.35)",
    },
    clearedNum: { fontSize: 16, fontFamily: "SpaceGrotesk_700Bold", color: "#1F9D6E" },
    clearedLabel: {
      fontSize: 11,
      fontFamily: "SpaceGrotesk_500Medium",
      color: "#1F9D6E",
      marginTop: 2,
    },
    ctaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
    ctaPrimary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
    },
    ctaPrimaryText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
    ctaSecondary: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1,
    },
    ctaSecondaryText: { fontSize: 14, fontFamily: "SpaceGrotesk_500Medium" },
    empty: {
      textAlign: "center",
      marginTop: 24,
      fontSize: 14,
      fontFamily: "SpaceGrotesk_400Regular",
      paddingHorizontal: 12,
    },
    pulseRow: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
    },
    pulseTop: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
    pulseCat: { fontSize: 12, fontFamily: "SpaceGrotesk_700Bold", textTransform: "uppercase" },
    pulseTime: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular" },
    pulseTitle: { fontSize: 15, fontFamily: "SpaceGrotesk_500Medium", lineHeight: 21 },
    pulsePlace: { fontSize: 12, fontFamily: "SpaceGrotesk_400Regular", marginTop: 6 },
  });
}
