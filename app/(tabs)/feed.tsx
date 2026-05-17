import { useCallback, useMemo, useState } from "react";
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
  const { alerts, timeFilter, setTimeFilter, activeCategories, sponsoredZones } = useAlertyStore();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const [viewMode, setViewMode] = useState<"list" | "reels">("list");

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
          <View style={{ flex: 1 }} />
          <Pressable
            style={styles.toggleButton}
            onPress={() => setViewMode("reels")}
            hitSlop={10}
          >
            <Ionicons name="videocam-outline" size={20} color={theme.colors.textMuted} />
            <Text style={styles.toggleLabel}>Reels</Text>
          </Pressable>
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
        <SafeAreaView edges={["top"]} style={styles.reelsTopBar}>
          <Text style={styles.reelsTitle}>Videos</Text>
          <Pressable
            style={styles.toggleButton}
            onPress={() => setViewMode("list")}
            hitSlop={10}
          >
            <Ionicons name="list-outline" size={20} color="rgba(255,255,255,0.75)" />
            <Text style={styles.reelsToggleLabel}>Lista</Text>
          </Pressable>
        </SafeAreaView>

        {videoAlerts.length === 0 ? (
          <View style={styles.emptyReels}>
            <Ionicons name="videocam-off-outline" size={52} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyReelsTitle}>Sin videos en este período</Text>
            <Text style={styles.emptyReelsSubtitle}>
              Cambia el filtro de tiempo o publica una alerta con video.
            </Text>
          </View>
        ) : (
          <VideoReelsList alerts={videoAlerts} />
        )}
      </View>
    );
  }

  return (
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
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  toggleLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
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
    flex: 1,
    backgroundColor: "#000",
  },
  reelsTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  reelsTitle: {
    color: "white",
    fontSize: 22,
    fontFamily: theme.fonts.heading,
  },
  reelsToggleLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
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
