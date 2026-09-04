import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "../lib/alerty/utils";
import type { CommunityPost } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type CommunityPostCardProps = {
  post: CommunityPost;
};

const X_ACCENT = "#1D9BF0";

export function CommunityPostCard({ post }: CommunityPostCardProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);

  const openTweet = () => {
    void Linking.openURL(post.url);
  };

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={openTweet}
      accessibilityRole="link"
      accessibilityLabel={`Publicación de X de ${post.authorHandle}`}
    >
      <View style={styles.accentBar} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={styles.sourcePill}>
              <Ionicons name="logo-twitter" size={11} color={X_ACCENT} />
              <Text style={styles.sourceText}>Desde X</Text>
            </View>
            <View style={styles.communityPill}>
              <Text style={styles.communityText}>Comunidad</Text>
            </View>
            {post.isDemo ? (
              <View style={styles.demoPill}>
                <Text style={styles.demoText}>DEMO</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(post.createdAt)}</Text>
        </View>

        <Text style={styles.bodyText} numberOfLines={4}>
          {post.text}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{post.placeLabel}</Text>
          <View style={styles.metaDivider} />
          <Text style={styles.metaText}>{post.authorHandle}</Text>
        </View>

        <View style={styles.footerRow}>
          <Ionicons name="open-outline" size={12} color={X_ACCENT} />
          <Text style={styles.linkText}>Ver en X</Text>
          {post.isDemo ? (
            <Text style={styles.demoHint}>Muestra · no es X en vivo</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      flexDirection: "row",
      overflow: "hidden",
    },
    cardPressed: {
      opacity: 0.92,
    },
    accentBar: {
      width: 4,
      backgroundColor: X_ACCENT,
    },
    inner: {
      flex: 1,
      padding: 14,
      gap: 8,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    badgeRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    sourcePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: X_ACCENT + "55",
      backgroundColor: X_ACCENT + "14",
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    sourceText: {
      color: X_ACCENT,
      fontSize: 11,
      fontFamily: theme.fonts.heading,
    },
    communityPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: theme.colors.surfaceAlt ?? theme.colors.background,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    communityText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
    },
    demoPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "#F59E0B22",
      borderWidth: 1,
      borderColor: "#F59E0B66",
    },
    demoText: {
      color: "#B45309",
      fontSize: 10,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.6,
    },
    timeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
    },
    bodyText: {
      color: theme.colors.text,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.fonts.body,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
    },
    metaDivider: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      marginHorizontal: 4,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 2,
    },
    linkText: {
      color: X_ACCENT,
      fontSize: 12,
      fontFamily: theme.fonts.heading,
    },
    demoHint: {
      marginLeft: "auto",
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.body,
    },
  });
