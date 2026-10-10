/**
 * Modo viaje · Antes de salir
 * Preset Culiacán ↔ Mazatlán, corredor estático México 15/15D, sin routing API.
 */
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
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
import {
  buildTravelSummary,
  collectTravelPulses,
  isTravelModeEnabled,
  resolveCorridor,
  travelShareMessage,
  type TravelDirection,
  type TravelPulse,
  type TravelSummary,
  type TravelWindow,
} from "../lib/alerty/travel/travelMode";

export default function ViajeScreen() {
  const router = useRouter();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const { alerts, communityPosts, setTravelMapOverlay } = useAlertyStore();

  const [direction, setDirection] = useState<TravelDirection>("culiacan_to_mazatlan");
  const [window, setWindow] = useState<TravelWindow>("6h");
  const [summary, setSummary] = useState<TravelSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!isTravelModeEnabled()) {
      router.replace("/(tabs)" as any);
      return;
    }
    void trackEvent({ event_type: "travel_mode_open", metadata: { direction, window } });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const corridor = await resolveCorridor({ direction });
      if (cancelled) return;
      const pulses = collectTravelPulses({
        alerts,
        communityPosts,
        direction,
        window,
        bundle: corridor.bundle,
      });
      const next = buildTravelSummary({ direction, window, pulses });
      setSummary(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [alerts, communityPosts, direction, window]);

  const flipDirection = () => {
    setDirection((d) =>
      d === "culiacan_to_mazatlan" ? "mazatlan_to_culiacan" : "culiacan_to_mazatlan",
    );
  };

  const onShare = async () => {
    if (!summary) return;
    setSharing(true);
    try {
      await shareTravelSummary(travelShareMessage(summary));
      void trackEvent({ event_type: "travel_mode_share", metadata: { direction, window } });
    } finally {
      setSharing(false);
    }
  };

  const onShowMap = () => {
    setTravelMapOverlay(true, direction);
    void trackEvent({ event_type: "travel_mode_show_map", metadata: { direction } });
    router.replace("/(tabs)" as any);
  };

  const origin = summary?.originName ?? "Culiacán";
  const destination = summary?.destinationName ?? "Mazatlán";

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
          <Ionicons
            name="share-outline"
            size={22}
            color={theme.colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.routeRow}>
        <View style={[styles.cityChip, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Text style={[styles.cityChipLabel, { color: theme.colors.textMuted }]}>Origen</Text>
          <Text style={[styles.cityChipValue, { color: theme.colors.text }]}>{origin}</Text>
        </View>
        <Pressable
          onPress={flipDirection}
          style={styles.swapBtn}
          accessibilityLabel="Invertir origen y destino"
        >
          <Ionicons name="swap-horizontal" size={22} color={theme.colors.accent} />
        </Pressable>
        <View style={[styles.cityChip, { backgroundColor: theme.colors.surfaceAlt }]}>
          <Text style={[styles.cityChipLabel, { color: theme.colors.textMuted }]}>Destino</Text>
          <Text style={[styles.cityChipValue, { color: theme.colors.text }]}>{destination}</Text>
        </View>
      </View>

      <Text style={[styles.roadHint, { color: theme.colors.textMuted }]}>
        Corredor México 15 / 15D · lo que la comunidad reportó cerca del camino
      </Text>

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
              <Text style={{ color: on ? theme.colors.background : theme.colors.text, fontFamily: "SpaceGrotesk_500Medium", fontSize: 13 }}>
                {w === "6h" ? "6 horas" : "24 horas"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading || !summary ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.colors.accent} />
        </View>
      ) : (
        <FlatList
          data={summary.pulses}
          keyExtractor={(item) => `${item.kind}-${item.id}`}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.summaryCard}>
              <Text style={[styles.headline, { color: theme.colors.text }]}>{summary.headline}</Text>
              <Text style={[styles.blurb, { color: theme.colors.textMuted }]}>{summary.blurb}</Text>
              {summary.byCategory.length > 0 ? (
                <View style={styles.counts}>
                  {summary.byCategory.slice(0, 6).map((row) => (
                    <View
                      key={row.category}
                      style={[styles.countChip, { borderColor: theme.colors.border }]}
                    >
                      <Text style={[styles.countNum, { color: theme.colors.text }]}>{row.count}</Text>
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
                <Pressable
                  style={[styles.ctaPrimary, { backgroundColor: theme.colors.text }]}
                  onPress={onShowMap}
                >
                  <Ionicons name="map-outline" size={18} color={theme.colors.background} />
                  <Text style={[styles.ctaPrimaryText, { color: theme.colors.background }]}>
                    Ver corredor en el mapa
                  </Text>
                </Pressable>
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
              No hay pulsos en esta ventana cerca del camino ni en {destination}.
            </Text>
          }
          renderItem={({ item }) => <PulseRow pulse={item} styles={styles} theme={theme} />}
        />
      )}
    </SafeAreaView>
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
    <View style={[styles.pulseRow, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
      <View style={styles.pulseTop}>
        <Text style={[styles.pulseCat, { color: theme.colors.accent }]}>{cat}</Text>
        <Text style={[styles.pulseTime, { color: theme.colors.textMuted }]}>
          {formatRelativeTime(pulse.createdAt)}
        </Text>
      </View>
      <Text style={[styles.pulseTitle, { color: theme.colors.text }]} numberOfLines={3}>
        {pulse.title}
      </Text>
      <Text style={[styles.pulsePlace, { color: theme.colors.textMuted }]}>
        {pulse.placeLabel}
        {pulse.onCorridor ? " · cerca del camino" : ""}
        {pulse.inDestination ? " · ciudad destino" : ""}
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
    routeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      marginTop: 4,
    },
    cityChip: {
      flex: 1,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    cityChipLabel: {
      fontSize: 11,
      fontFamily: "SpaceGrotesk_500Medium",
      marginBottom: 2,
    },
    cityChipValue: {
      fontSize: 16,
      fontFamily: "SpaceGrotesk_700Bold",
    },
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
    clearedLabel: { fontSize: 11, fontFamily: "SpaceGrotesk_500Medium", color: "#1F9D6E", marginTop: 2 },
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
