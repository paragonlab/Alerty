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
import { theme } from "../../lib/theme";
import { TIME_FILTERS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { isAlertInWindow, shouldSuppressAlert } from "../../lib/alerty/utils";

export default function FeedScreen() {
  const router = useRouter();
  const { alerts, timeFilter, setTimeFilter, activeCategories } = useAlertyStore();

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Feed comunitario</Text>
          <Text style={styles.subtitle}>
            Reportes cronológicos con validación colectiva.
          </Text>
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

        <View style={styles.list}>
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

const styles = StyleSheet.create({
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
