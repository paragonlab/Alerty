import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_ICONS, CATEGORY_LABELS, REPUTATION_LEVELS } from "../lib/alerty/constants";
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

  const levelKey = (alert.user.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
  const levelInfo = REPUTATION_LEVELS[levelKey];

  const primaryText = alert.title ?? alert.description ?? "Sin descripción";
  const secondaryText = alert.title && alert.description ? alert.description : null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.accentBar, { backgroundColor: color }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={[styles.categoryPill, { borderColor: color + "60", backgroundColor: color + "12" }]}>
            <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={11} color={color} />
            <Text style={[styles.categoryText, { color }]}>{CATEGORY_LABELS[alert.category]}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
        </View>

        <Text style={styles.titleText} numberOfLines={2}>{primaryText}</Text>

        {secondaryText ? (
          <Text style={styles.descriptionText} numberOfLines={1}>{secondaryText}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{alert.neighborhood ?? "Culiacán"}</Text>
          <View style={styles.metaDivider} />
          <View style={styles.userSection}>
            <Text style={styles.metaText}>{alert.user.username}</Text>
            {alert.user.isVerified && (
              <Ionicons name="checkmark-circle" size={12} color={theme.colors.accent} />
            )}
            {alert.user.isPremium && (
              <Ionicons name="star" size={12} color="#F59E0B" />
            )}
            <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "22" }]}>
              <Ionicons name={levelInfo.icon as any} size={10} color={levelInfo.color} />
            </View>
          </View>
        </View>

        <View style={styles.footerRow}>
          {alert.upvotes > 0 && (
            <View style={styles.votePill}>
              <Ionicons name="thumbs-up" size={11} color={theme.colors.success} />
              <Text style={[styles.voteText, { color: theme.colors.success }]}>{alert.upvotes}</Text>
            </View>
          )}
          {alert.downvotes > 0 && (
            <View style={styles.votePill}>
              <Ionicons name="thumbs-down" size={11} color={theme.colors.textMuted} />
              <Text style={styles.voteText}>{alert.downvotes}</Text>
            </View>
          )}
          {alert.media.length > 0 && (
            <View style={styles.mediaPill}>
              <Ionicons name="camera" size={11} color={theme.colors.textMuted} />
              <Text style={styles.voteText}>{alert.media.length}</Text>
            </View>
          )}
          {(alert.updates?.length ?? 0) > 0 && (
            <View style={styles.mediaPill}>
              <Ionicons name="chatbubble-outline" size={11} color={theme.colors.textMuted} />
              <Text style={styles.voteText}>{alert.updates!.length}</Text>
            </View>
          )}
        </View>
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
    flexDirection: "row",
    overflow: "hidden",
  },
  cardPressed: {
    opacity: 0.75,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.xl,
    borderBottomLeftRadius: theme.radius.xl,
  },
  inner: {
    flex: 1,
    padding: 14,
    gap: 9,
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
    gap: 5,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 11,
    fontFamily: theme.fonts.heading,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.mono,
    flexShrink: 0,
  },
  titleText: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
    lineHeight: 21,
  },
  descriptionText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  userSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  metaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  metaDivider: {
    width: 3,
    height: 3,
    borderRadius: 999,
    backgroundColor: theme.colors.border,
  },
  levelBadge: {
    alignItems: "center",
    justifyContent: "center",
    padding: 3,
    borderRadius: 999,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  votePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  mediaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  voteText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
});
