import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { AlertCard } from "../../components/AlertCard";
import { useTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { isAlertInWindow, shouldSuppressAlert } from "../../lib/alerty/utils";

export default function FeedScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { alerts, timeFilter, setTimeFilter, activeCategories } = useAlertyStore();
  const styles = useMemo(() => createStyles(theme), [theme]);

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

  const severityCounts = useMemo(() => {
    const dangerCategories = ["balacera", "narcobloqueo", "enfrentamiento", "detonaciones"];
    const safeCategories = ["zona segura", "captura"];
    return filteredAlerts.reduce(
      (acc, alert) => {
        if (dangerCategories.includes(alert.category)) acc.danger += 1;
        else if (safeCategories.includes(alert.category)) acc.safe += 1;
        else acc.caution += 1;
        return acc;
      },
      { danger: 0, caution: 0, safe: 0 },
    );
  }, [filteredAlerts]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Alertas</Text>
          <Text style={styles.subtitle}>Culiacán, Sinaloa</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.mapRed }]} />
            <Text style={styles.statValue}>{severityCounts.danger}</Text>
            <Text style={styles.statLabel}>Peligro</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.mapOrange }]} />
            <Text style={styles.statValue}>{severityCounts.caution}</Text>
            <Text style={styles.statLabel}>Precaución</Text>
          </View>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.colors.success }]} />
            <Text style={styles.statValue}>{severityCounts.safe}</Text>
            <Text style={styles.statLabel}>Seguro</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {TIME_FILTERS.map((filter) => {
            const active = timeFilter === filter;
            const label = filter === "todo" ? "Todo" : filter;
            return (
              <Pressable
                key={filter}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setTimeFilter(filter)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.list}>
          <Text style={styles.countText}>{filteredAlerts.length} alertas</Text>
          {filteredAlerts.length === 0 ? (
            <Text style={styles.emptyText}>
              No hay alertas en este rango. Ajusta los filtros para ver más.
            </Text>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onPress={() => router.push(`/alert/${alert.id}`)}
              />
            ))
          )}
        </View>
      </ScrollView>
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
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontFamily: theme.fonts.heading,
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
    padding: 12,
    gap: 4,
    ...theme.effects.glassCard,
  },
  statValue: {
    color: theme.colors.text,
    fontSize: 18,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
    ...theme.effects.glassPill,
  },
  filterPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  filterTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  list: {
    gap: 12,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  });
