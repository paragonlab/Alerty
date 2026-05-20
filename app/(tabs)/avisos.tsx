import { useEffect, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAlertyStore } from "../../lib/alerty/store";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../../lib/alerty/constants";
import { formatRelativeTime } from "../../lib/alerty/utils";
import type { AlertItem } from "../../lib/alerty/types";

export default function AvisosScreen() {
  const theme = useAlertyTheme();
  const router = useRouter();
  const { alerts, clearUnreadAlerts } = useAlertyStore();
  const styles = createStyles(theme);

  useEffect(() => {
    clearUnreadAlerts();
  }, []);

  const notifications = useMemo(
    () =>
      [...alerts]
        .filter((a) => a.status === "active")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 30),
    [alerts],
  );

  const renderItem = ({ item }: { item: AlertItem }) => {
    const isCritical = item.category === "sos" || item.category === "balacera" || item.upvotes > 10;
    const iconName = (CATEGORY_ICONS[item.category] ?? "notifications-outline") as any;
    const label = CATEGORY_LABELS[item.category] ?? item.category;
    const hasMedia = item.media.length > 0;

    return (
      <Pressable
        style={styles.item}
        android_ripple={{ color: theme.colors.border }}
        onPress={() => router.push(`/alert/${item.id}` as any)}
      >
        <View style={[styles.iconWrap, isCritical && styles.iconWrapCritical]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isCritical ? "#FF3B3B" : theme.colors.textMuted}
          />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <Text style={styles.itemTitle}>{label.toUpperCase()}</Text>
            {isCritical && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>CRÍTICO</Text>
              </View>
            )}
            {hasMedia && (
              <View style={styles.mediaBadge}>
                <Ionicons name={item.media.some(m => m.type === "video") ? "film" : "camera"} size={9} color={theme.colors.textMuted} />
              </View>
            )}
          </View>
          <Text style={styles.itemDesc} numberOfLines={1}>
            {item.title ?? item.description ?? label}
          </Text>
          <View style={styles.itemMeta}>
            <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
            <Text style={styles.itemTime}>{item.neighborhood ?? "Culiacán"}</Text>
            <Text style={styles.itemDot}>·</Text>
            <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
            <Text style={styles.itemTime}>{formatRelativeTime(item.createdAt)}</Text>
            {item.upvotes > 0 && (
              <>
                <Text style={styles.itemDot}>·</Text>
                <Ionicons name="thumbs-up-outline" size={11} color={theme.colors.textMuted} />
                <Text style={styles.itemTime}>{item.upvotes}</Text>
              </>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Avisos</Text>
        <Text style={styles.subtitle}>Actividad reciente en tu zona</Text>
      </View>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={44} color={theme.colors.border} />
            <Text style={styles.emptyText}>Sin avisos activos</Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      gap: 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontFamily: theme.fonts.heading,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 160,
      paddingTop: 8,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 14,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    iconWrapCritical: {
      backgroundColor: "rgba(255,59,59,0.1)",
      borderColor: "rgba(255,59,59,0.3)",
    },
    itemBody: { flex: 1, gap: 4 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    itemTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    mediaBadge: {
      width: 18,
      height: 18,
      borderRadius: 5,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    criticalBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: "rgba(255,59,59,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,59,59,0.3)",
    },
    criticalBadgeText: {
      color: "#FF3B3B",
      fontSize: 8,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    itemDesc: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      lineHeight: 18,
    },
    itemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    itemTime: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
    },
    itemDot: {
      color: theme.colors.border,
      fontSize: 11,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      gap: 12,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontFamily: theme.fonts.body,
    },
  });
