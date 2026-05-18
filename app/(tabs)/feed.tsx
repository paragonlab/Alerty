import { useCallback, useMemo } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AlertCard } from "../../components/AlertCard";
import { VideoReelsList } from "../../components/VideoReelsList";
import { TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { isAlertInWindow, shouldSuppressAlert } from "../../lib/alerty/utils";
import type { AlertItem, SponsoredZone } from "../../lib/alerty/types";
import { AdCard } from "../../components/AdCard";

export default function FeedScreen() {
  const router = useRouter();
  const { alerts, timeFilter, setTimeFilter, activeCategories, sponsoredZones, feedViewMode: viewMode, setFeedViewMode: setViewMode } = useAlertyStore();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);

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

  const videoAlerts = useMemo(
    () => filteredAlerts.filter((a) => a.media.some((m) => m.type === "video")),
    [filteredAlerts],
  );

  const total24h = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "active" &&
          activeCategories.includes(alert.category) &&
          isAlertInWindow(alert, "24h"),
      ).length,
    [alerts, activeCategories],
  );

  const verifiedCount = useMemo(
    () => filteredAlerts.filter((alert) => alert.user.isVerified).length,
    [filteredAlerts],
  );

  const feedItems = useMemo(() => {
    const items: (AlertItem | SponsoredZone)[] = [];
    let adIndex = 0;

    filteredAlerts.forEach((alert, index) => {
      items.push(alert);
      if ((index + 1) % 5 === 0 && sponsoredZones[adIndex]) {
        items.push(sponsoredZones[adIndex]);
        adIndex = (adIndex + 1) % sponsoredZones.length;
      }
    });
    return items;
  }, [filteredAlerts, sponsoredZones]);

  const renderItem = useCallback(
    ({ item }: { item: AlertItem | SponsoredZone }) => {
      if ("category" in item) {
        return (
          <AlertCard
            alert={item as AlertItem}
            onPress={() => router.push(`/alert/${item.id}`)}
          />
        );
      } else {
        return (
          <AdCard
            zone={item as SponsoredZone}
            onPress={() => { router.push("/(tabs)"); }}
          />
        );
      }
    },
    [router],
  );

  const keyExtractor = useCallback((item: AlertItem | SponsoredZone) => item.id, []);

  const ListHeader = (
    <View style={styles.listHeader}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Feed</Text>
          <View style={styles.liveDot} />
        </View>
        <Text style={styles.subtitle}>Reportes en tiempo real de la comunidad.</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{filteredAlerts.length}</Text>
          <Text style={styles.statLabel}>En ventana</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{total24h}</Text>
          <Text style={styles.statLabel}>Últimas 24h</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{verifiedCount}</Text>
          <Text style={styles.statLabel}>Verificados</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {TIME_FILTERS.map((filter) => {
          const active = timeFilter === filter;
          return (
            <Pressable
              key={filter}
              style={[styles.filterPill, active && styles.filterPillActive]}
              onPress={() => setTimeFilter(filter)}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>
                {filter.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const ListEmpty = (
    <View style={styles.emptyState}>
      <Ionicons name="shield-outline" size={42} color={theme.colors.border} />
      <Text style={styles.emptyTitle}>Sin alertas en esta ventana</Text>
      <Text style={styles.emptySubtitle}>
        Amplía el filtro de tiempo o revisa tus categorías activas en Ajustes.
      </Text>
    </View>
  );

  if (viewMode === "reels") {
    return (
      <View style={styles.reelsRoot}>
        {videoAlerts.length === 0 ? (
          <SafeAreaView style={styles.emptyReelsContainer}>
            <Pressable onPress={() => setViewMode("list")} style={styles.reelsBackBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.75)" />
              <Text style={styles.reelsBackLabel}>Volver</Text>
            </Pressable>
            <View style={styles.emptyReels}>
              <Ionicons name="videocam-off-outline" size={52} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyReelsTitle}>Sin videos en este período</Text>
              <Text style={styles.emptyReelsSubtitle}>
                Cambia el filtro de tiempo o publica una alerta con video.
              </Text>
            </View>
          </SafeAreaView>
        ) : (
          <VideoReelsList alerts={videoAlerts} onClose={() => setViewMode("list")} />
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={feedItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      </SafeAreaView>
      <View style={styles.modePillWrap} pointerEvents="box-none">
        <View style={styles.modePill} pointerEvents="auto">
          <View style={[styles.modePillBtn, styles.modePillBtnActive]}>
            <Ionicons name="list" size={13} color="#fff" />
            <Text style={[styles.modePillText, { color: "#fff" }]}>LISTA</Text>
          </View>
          <Pressable style={styles.modePillBtn} onPress={() => setViewMode("reels")}>
            <Ionicons name="film" size={13} color="rgba(255,255,255,0.45)" />
            <Text style={styles.modePillText}>REELS</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 160,
  },
  listHeader: {
    gap: 14,
    paddingTop: 4,
    paddingBottom: 14,
  },
  header: {
    marginTop: 8,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modePillWrap: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  modePill: {
    flexDirection: "row",
    padding: 4,
    backgroundColor: "rgba(10,10,10,0.82)",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 12,
  },
  modePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modePillBtnActive: {
    backgroundColor: "#FF4500",
    shadowColor: "#FF4500",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  modePillText: {
    fontSize: 11,
    fontWeight: "700" as const,
    letterSpacing: 1.1,
    color: "rgba(255,255,255,0.45)",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontFamily: theme.fonts.heading,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.accent,
    marginTop: 4,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 3,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 20,
    fontFamily: theme.fonts.heading,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterPill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  filterPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    letterSpacing: 0.5,
  },
  filterTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    textAlign: "center",
  },
  emptySubtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    textAlign: "center",
    lineHeight: 20,
  },
  // Reels mode
  reelsRoot: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: -100,
    zIndex: 100,
    backgroundColor: "#090909",
  },
  emptyReelsContainer: {
    flex: 1,
    backgroundColor: "#090909",
  },
  reelsBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  reelsBackLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  emptyReels: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  emptyReelsTitle: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 20,
    fontFamily: theme.fonts.heading,
    textAlign: "center",
  },
  emptyReelsSubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 14,
    fontFamily: theme.fonts.body,
    textAlign: "center",
    lineHeight: 21,
  },
});
