import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
import { CATEGORY_LABELS, REPUTATION_LEVELS } from "../lib/alerty/constants";
import { formatRelativeTime, getIntensityColor } from "../lib/alerty/utils";
import type { AlertItem } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type AlertCardProps = {
  alert: AlertItem;
  onPress?: () => void;
};

export function AlertCard({ alert, onPress }: AlertCardProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const color = getIntensityColor(alert.createdAt);

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
        <View style={styles.userSection}>
          <Text style={styles.metaText}>{alert.user.username}</Text>
          {alert.user.isVerified && (
            <Ionicons name="checkmark-circle" size={12} color={theme.colors.accent} />
          )}
          {(() => {
            const levelKey = (alert.user.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
            const levelInfo = REPUTATION_LEVELS[levelKey];
            return (
              <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "15" }]}>
                <Ionicons name={levelInfo.icon as any} size={8} color={levelInfo.color} />
                <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
              </View>
            );
          })()}
        </View>
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

const createStyles = (theme: any) => StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
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
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 9,
    fontFamily: theme.fonts.heading,
    textTransform: "uppercase",
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
  },
  voteText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
});
