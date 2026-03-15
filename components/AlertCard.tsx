import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { formatRelativeTime, getCategoryColor } from "../lib/alerty/utils";
import type { AlertItem } from "../lib/alerty/types";

type AlertCardProps = {
  alert: AlertItem;
  onPress?: () => void;
};

export function AlertCard({ alert, onPress }: AlertCardProps) {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const color = getCategoryColor(alert.category, theme);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.headerRow}>
        <View style={[styles.categoryPill, { borderColor: color }]}>
          <View style={[styles.categoryDot, { backgroundColor: color }]} />
          <Text style={styles.categoryText}>{CATEGORY_LABELS[alert.category]}</Text>
        </View>
        <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
      </View>

      <Text style={styles.titleText} numberOfLines={2}>
        {alert.description ?? "Sin descripción"}
      </Text>

      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{alert.neighborhood ?? "Culiacán"}</Text>
        <View style={styles.metaDivider} />
        <Text style={styles.metaText}>{alert.user.username}</Text>
        {alert.user.isVerified ? (
          <Ionicons name="checkmark-circle" size={14} color={theme.colors.mapVerified} />
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <View style={styles.votePill}>
          <Ionicons name="thumbs-up" size={12} color={theme.colors.textMuted} />
          <Text style={styles.voteText}>{alert.upvotes}</Text>
        </View>
        <View style={styles.votePill}>
          <Ionicons name="thumbs-down" size={12} color={theme.colors.textMuted} />
          <Text style={styles.voteText}>{alert.downvotes}</Text>
        </View>
        {alert.media.length > 0 ? (
          <View style={styles.mediaPill}>
            <Ionicons name="camera" size={12} color={theme.colors.textMuted} />
            <Text style={styles.voteText}>{alert.media.length}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      gap: 10,
      ...theme.effects.glassCard,
    },
    headerRow: {
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
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.surfaceAlt,
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
      fontFamily: theme.fonts.mono,
    },
    titleText: {
      color: theme.colors.text,
      fontSize: 15,
      fontFamily: theme.fonts.heading,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.body,
    },
    metaDivider: {
      width: 4,
      height: 4,
      borderRadius: 999,
      backgroundColor: theme.colors.border,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    votePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...theme.effects.glassPill,
    },
    mediaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.surfaceAlt,
      borderRadius: theme.radius.pill,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 10,
      paddingVertical: 6,
      ...theme.effects.glassPill,
    },
    voteText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.body,
    },
  });
