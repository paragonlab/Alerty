import { useCallback, useMemo, useState } from "react";
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
import { AlertCard } from "../../components/AlertCard";
import { CommunityPostCard } from "../../components/CommunityPostCard";
import { CommunityPostPreview } from "../../components/CommunityPostPreview";
import { VideoReelsList } from "../../components/VideoReelsList";
import { TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { requireSession } from "../../lib/alerty/session";
import {
  getTimeFilterWindowLabel,
  isAlertInWindow,
  isCommunityInWindow,
  shouldSuppressAlert,
  videoTimeFilter,
} from "../../lib/alerty/utils";
import type { AlertItem, CommunityPost } from "../../lib/alerty/types";

type FeedRow =
  | { kind: "alert"; item: AlertItem }
  | { kind: "community"; item: CommunityPost };

export default function FeedScreen() {
  const router = useRouter();
  const {
    alerts,
    communityPosts,
    timeFilter,
    setTimeFilter,
    activeCategories,
    feedViewMode: viewMode,
    setFeedViewMode: setViewMode,
    openReels,
    reelsInitialAlertId,
    realtimeStarted,
    alertsLoaded,
    communityLoaded,
  } = useAlertyStore();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const [previewPost, setPreviewPost] = useState<CommunityPost | null>(null);

  const baseFilteredAlerts = useMemo(
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

  // Los "otros ángulos" solo se muestran como Pulsos — fuera del feed para
  // no duplicar la tarjeta del reporte original.
  const filteredAlerts = useMemo(
    () => baseFilteredAlerts.filter((a) => !a.parentAlertId),
    [baseFilteredAlerts],
  );

  const filteredCommunity = useMemo(
    () =>
      communityPosts.filter((post) => isCommunityInWindow(post, timeFilter)),
    [communityPosts, timeFilter],
  );

  const videoAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          alert.status === "active" &&
          activeCategories.includes(alert.category) &&
          isAlertInWindow(alert, videoTimeFilter(timeFilter)) &&
          !shouldSuppressAlert(alert) &&
          alert.media.some((m) => m.type === "video"),
      ),
    [alerts, activeCategories, timeFilter],
  );

  // Lista para los Pulsos. Garantiza que el video tocado esté incluido aunque
  // quede fuera de la ventana de tiempo / filtros del feed.
  const reelsAlerts = useMemo(() => {
    if (!reelsInitialAlertId) return videoAlerts;
    if (videoAlerts.some((a) => a.id === reelsInitialAlertId)) return videoAlerts;
    const target = alerts.find(
      (a) => a.id === reelsInitialAlertId && a.media.some((m) => m.type === "video"),
    );
    return target ? [target, ...videoAlerts] : videoAlerts;
  }, [videoAlerts, reelsInitialAlertId, alerts]);

  const feedItems = useMemo(() => {
    type Timed = { at: number; row: FeedRow };
    const timed: Timed[] = [
      ...filteredAlerts.map((item) => ({
        at: new Date(item.createdAt).getTime(),
        row: { kind: "alert" as const, item },
      })),
      ...filteredCommunity.map((item) => ({
        at: new Date(item.createdAt).getTime(),
        row: { kind: "community" as const, item },
      })),
    ].sort((a, b) => b.at - a.at);

    return timed.map(({ row }) => row);
  }, [filteredAlerts, filteredCommunity]);

  const renderItem = useCallback(
    ({ item }: { item: FeedRow }) => {
      if (item.kind === "alert") {
        return (
          <AlertCard
            alert={item.item}
            onPress={() => router.push(`/alert/${item.item.id}`)}
            onPressVideo={() => openReels(item.item.id)}
          />
        );
      }
      return (
        <CommunityPostCard
          post={item.item}
          onPress={() => setPreviewPost(item.item)}
        />
      );
    },
    [router, openReels],
  );

  const keyExtractor = useCallback((item: FeedRow) => {
    if (item.kind === "community") return `c-${item.item.source}-${item.item.id}`;
    return item.item.id;
  }, []);

  const ListHeader = (
    <View style={styles.listHeader}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Pulsos</Text>
          <View style={[styles.livePill, realtimeStarted && styles.livePillOn]}>
            <View style={[styles.liveDot, realtimeStarted && styles.liveDotOn]} />
            <Text style={[styles.livePillText, realtimeStarted && styles.livePillTextOn]}>
              {realtimeStarted ? "EN VIVO" : "LOCAL"}
            </Text>
          </View>
        </View>
        <Text style={styles.subtitle}>
          Lo que está pasando cerca: reportes, comunidad y noticieros.
        </Text>
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
      <Text style={styles.windowCaption}>
        {getTimeFilterWindowLabel(timeFilter)} · reportes, comunidad y noticieros
      </Text>
    </View>
  );

  const feedSettled = alertsLoaded && communityLoaded;
  const ListEmpty = !feedSettled ? (
    <View style={styles.emptyState}>
      <ActivityIndicator color={theme.colors.accent} />
      <Text style={styles.emptySubtitle}>Cargando pulsos…</Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <Ionicons name="shield-outline" size={42} color={theme.colors.border} />
      <Text style={styles.emptyTitle}>Nadie ha reportado aún en esta ventana</Text>
      <Text style={styles.emptySubtitle}>
        Sé el primero en avisar a tu colonia. Un reporte anónimo puede ayudar a quien está cerca.
      </Text>
      <Pressable
        style={styles.emptyCta}
        onPress={() => {
          void requireSession("/report").then((ok) => {
            if (ok) router.push("/report" as any);
          });
        }}
      >
        <Ionicons name="warning" size={16} color="#fff" />
        <Text style={styles.emptyCtaText}>NUEVO PULSO</Text>
      </Pressable>
      <Text style={styles.emptyHint}>
        O amplía el filtro de tiempo / revisa categorías en Ajustes.
      </Text>
    </View>
  );

  if (viewMode === "reels") {
    return (
      <View style={styles.reelsRoot}>
        {reelsAlerts.length === 0 ? (
          <SafeAreaView style={styles.emptyReelsContainer}>
            <Pressable onPress={() => setViewMode("list")} style={styles.reelsBackBtn} hitSlop={10}>
              <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.75)" />
              <Text style={styles.reelsBackLabel}>Lista</Text>
            </Pressable>
            <View style={styles.emptyReels}>
              <Ionicons name="videocam-off-outline" size={52} color="rgba(255,255,255,0.2)" />
              <Text style={styles.emptyReelsTitle}>Sin videos en este período</Text>
              <Text style={styles.emptyReelsSubtitle}>
                No hay videos en las últimas {videoTimeFilter(timeFilter) === "7d" ? "7 días" : "24 horas"}.
                Publica una alerta con video o revisa más tarde.
              </Text>
            </View>
          </SafeAreaView>
        ) : (
          <VideoReelsList
            alerts={reelsAlerts}
            initialAlertId={reelsInitialAlertId}
            onClose={() => setViewMode("list")}
          />
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
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      </SafeAreaView>
      <View style={styles.modePillWrap} pointerEvents="box-none">
        <View style={styles.modePill} pointerEvents="auto">
          <View style={[styles.modePillBtn, styles.modePillBtnActive]}>
            <Ionicons name="list" size={13} color="#fff" />
            <Text style={[styles.modePillText, { color: "#fff" }]}>LISTA</Text>
          </View>
          <Pressable style={styles.modePillBtn} onPress={() => openReels(null)}>
            <Ionicons name="film" size={13} color="rgba(255,255,255,0.45)" />
            <Text style={styles.modePillText}>VIDEOS</Text>
          </Pressable>
        </View>
      </View>
      {previewPost ? (
        <CommunityPostPreview post={previewPost} onClose={() => setPreviewPost(null)} />
      ) : null}
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
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: 4,
  },
  livePillOn: {
    backgroundColor: theme.colors.accentSoft,
    borderColor: theme.colors.accent + "55",
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  liveDotOn: {
    backgroundColor: theme.colors.accent,
  },
  livePillText: {
    fontSize: 10,
    fontFamily: theme.fonts.heading,
    letterSpacing: 1,
    color: theme.colors.textMuted,
  },
  livePillTextOn: {
    color: theme.colors.accent,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
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
  windowCaption: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    lineHeight: 15,
    marginTop: -4,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 28,
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
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    backgroundColor: theme.colors.reportAction,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    minHeight: 48,
  },
  emptyCtaText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: theme.fonts.heading,
    letterSpacing: 1.2,
  },
  emptyHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    textAlign: "center",
    marginTop: 4,
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
