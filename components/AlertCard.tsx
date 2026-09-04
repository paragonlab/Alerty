import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_ICONS, CATEGORY_LABELS, REPUTATION_LEVELS } from "../lib/alerty/constants";
import { formatRelativeTime, getAlertAgeMinutes, getIntensityColor } from "../lib/alerty/utils";
import type { AlertItem } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type AlertCardProps = {
  alert: AlertItem;
  onPress?: () => void;
  onPressVideo?: () => void;
};

const CRITICAL_CATEGORIES = new Set([
  "sos",
  "balacera",
  "enfrentamiento",
  "narcobloqueo",
]);

export function AlertCard({ alert, onPress, onPressVideo }: AlertCardProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const color = getIntensityColor(alert.createdAt);
  const ageMin = getAlertAgeMinutes(alert.createdAt);
  const isCritical =
    CRITICAL_CATEGORIES.has(alert.category) || alert.upvotes >= 8;
  const isFresh = ageMin <= 20;

  const levelKey = (alert.user.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
  const levelInfo = REPUTATION_LEVELS[levelKey];

  const primaryText = alert.title ?? alert.description ?? "Sin descripción";
  const secondaryText = alert.title && alert.description ? alert.description : null;
  const hasVideo = alert.media.some((m) => m.type === "video");
  const hasAudio = alert.media.some((m) => m.type === "audio");

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isCritical && styles.cardCritical,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.accentBar, { backgroundColor: color }, isCritical && styles.accentBarCritical]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={[styles.categoryPill, { borderColor: color + "60", backgroundColor: color + "12" }]}>
              <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={11} color={color} />
              <Text style={[styles.categoryText, { color }]}>{CATEGORY_LABELS[alert.category]}</Text>
            </View>
            {isCritical && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>CRÍTICO</Text>
              </View>
            )}
            {isFresh && !isCritical && (
              <View style={[styles.freshBadge, { borderColor: color + "50", backgroundColor: color + "18" }]}>
                <Text style={[styles.freshBadgeText, { color }]}>AHORA</Text>
              </View>
            )}
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
        </View>

        <Text style={[styles.titleText, isCritical && styles.titleCritical]} numberOfLines={2}>
          {primaryText}
        </Text>

        {secondaryText ? (
          <Text style={styles.descriptionText} numberOfLines={1}>{secondaryText}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>{alert.neighborhood ?? "Culiacán"}</Text>
          <View style={styles.metaDivider} />
          <View style={styles.userSection}>
            <Text style={styles.metaText} numberOfLines={1}>{alert.user.username}</Text>
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
          <View style={styles.votePill}>
            <Ionicons name="thumbs-up" size={11} color={alert.upvotes > 0 ? theme.colors.success : theme.colors.textMuted} />
            <Text style={[styles.voteText, alert.upvotes > 0 && { color: theme.colors.success }]}>
              {alert.upvotes}
            </Text>
          </View>
          {alert.downvotes > 0 && (
            <View style={styles.votePill}>
              <Ionicons name="thumbs-down" size={11} color={theme.colors.textMuted} />
              <Text style={styles.voteText}>{alert.downvotes}</Text>
            </View>
          )}
          {alert.media.length > 0 && !hasVideo && (
            <View style={styles.mediaPill}>
              <Ionicons name={hasAudio ? "mic" : "camera"} size={11} color={theme.colors.textMuted} />
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

      {hasVideo && (
        <Pressable style={styles.videoThumb} onPress={onPressVideo ?? onPress}>
          <View style={styles.videoThumbPlay}>
            <Ionicons name="play" size={16} color="#fff" />
          </View>
          <View style={styles.videoThumbBadge}>
            <Ionicons name="film" size={8} color="#FF6B3A" />
            <Text style={styles.videoThumbBadgeText}>VIDEO</Text>
          </View>
        </Pressable>
      )}
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
  cardCritical: {
    borderColor: theme.colors.danger + "55",
    backgroundColor: theme.colors.surface,
  },
  cardPressed: {
    opacity: 0.75,
  },
  accentBar: {
    width: 4,
    borderTopLeftRadius: theme.radius.xl,
    borderBottomLeftRadius: theme.radius.xl,
  },
  accentBarCritical: {
    width: 5,
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
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    flexWrap: "wrap",
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
  criticalBadge: {
    backgroundColor: "rgba(182,64,47,0.14)",
    borderWidth: 1,
    borderColor: "rgba(182,64,47,0.45)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  criticalBadgeText: {
    color: theme.colors.danger,
    fontSize: 9,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.8,
  },
  freshBadge: {
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  freshBadgeText: {
    fontSize: 9,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.8,
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
  titleCritical: {
    fontSize: 16,
    lineHeight: 22,
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
  videoThumb: {
    width: 78,
    backgroundColor: "#16110E",
    borderLeftWidth: 1,
    borderLeftColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  videoThumbPlay: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,107,58,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoThumbBadge: {
    position: "absolute",
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  videoThumbBadgeText: {
    color: "#FF6B3A",
    fontSize: 8,
    fontFamily: theme.fonts.heading,
    letterSpacing: 0.6,
  },
});
