import { useMemo } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { CATEGORY_LABELS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { formatRelativeTime, getCategoryColor } from "../../lib/alerty/utils";

export default function AlertDetailScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, voteAlert } = useAlertyStore();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const alert = useMemo(() => alerts.find((item) => item.id === id), [alerts, id]);

  if (!alert) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Detalle</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Alerta no encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const categoryColor = getCategoryColor(alert.category, theme);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Detalle</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryPill, { borderColor: categoryColor }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <Text style={styles.categoryText}>{CATEGORY_LABELS[alert.category]}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
        </View>

        <Text style={styles.description}>{alert.description ?? "Sin descripción."}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Zona</Text>
            <Text style={styles.metaValue}>{alert.neighborhood ?? "Culiacán"}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Estado</Text>
            <Text style={styles.metaValue}>{alert.status === "active" ? "Activo" : "Resuelto"}</Text>
          </View>
        </View>

        <View style={styles.authorCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{alert.user.username.slice(1, 3).toUpperCase()}</Text>
          </View>
          <View style={styles.authorMeta}>
            <View style={styles.authorRow}>
              <Text style={styles.authorName}>{alert.user.username}</Text>
              {alert.user.isVerified ? (
                <Ionicons name="checkmark-circle" size={14} color={theme.colors.mapVerified} />
              ) : null}
            </View>
            <Text style={styles.authorSub}>Trust Score: {Math.round(alert.user.trustScore * 100)}%</Text>
            <Text style={styles.authorSub}>{alert.user.followersCount} seguidores</Text>
          </View>
        </View>

        {alert.media.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Evidencia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
              {alert.media.map((item) => (
                <Image key={item.id} source={{ uri: item.url }} style={styles.mediaThumb} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.voteRow}>
          <Pressable
            style={styles.voteButton}
            onPress={() => {
              voteAlert(alert.id, "upvote");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="thumbs-up" size={16} color={theme.colors.text} />
            <Text style={styles.voteText}>Validar · {alert.upvotes}</Text>
          </Pressable>
          <Pressable
            style={styles.voteButton}
            onPress={() => {
              voteAlert(alert.id, "downvote");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="thumbs-down" size={16} color={theme.colors.text} />
            <Text style={styles.voteText}>Desmentir · {alert.downvotes}</Text>
          </Pressable>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerSpacer: {
    width: 32,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...theme.effects.glassPill,
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: theme.fonts.heading,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  categoryDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
  },
  categoryText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  description: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    gap: 10,
  },
  metaCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    gap: 6,
    ...theme.effects.glassCard,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  authorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 12,
    ...theme.effects.glassCard,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  authorMeta: {
    flex: 1,
    gap: 2,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  authorName: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  authorSub: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
    marginBottom: 8,
  },
  mediaRow: {
    marginTop: 6,
  },
  mediaThumb: {
    width: 140,
    height: 100,
    borderRadius: theme.radius.md,
    marginRight: 10,
  },
  voteRow: {
    flexDirection: "row",
    gap: 10,
  },
  voteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 12,
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  voteText: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  });
