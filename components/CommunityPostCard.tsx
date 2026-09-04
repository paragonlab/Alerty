import { Pressable, StyleSheet, Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "../lib/alerty/utils";
import type { CommunityPost } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type CommunityPostCardProps = {
  post: CommunityPost;
  onPress?: () => void;
};

const X_ACCENT = "#1D9BF0";
const NEWS_ACCENT = "#0D9488";

export function CommunityPostCard({ post, onPress }: CommunityPostCardProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const accent = post.source === "rss" ? NEWS_ACCENT : X_ACCENT;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Publicación de ${post.authorHandle}`}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            {post.source === "rss" || post.trustTier === "news" ? (
              <View style={[styles.sourcePill, { borderColor: NEWS_ACCENT + "55", backgroundColor: NEWS_ACCENT + "14" }]}>
                <Ionicons name="newspaper-outline" size={11} color={NEWS_ACCENT} />
                <Text style={[styles.sourceText, { color: NEWS_ACCENT }]}>Noticia</Text>
              </View>
            ) : (
              <View style={styles.sourcePill}>
                <Ionicons name="logo-twitter" size={11} color={X_ACCENT} />
                <Text style={styles.sourceText}>Desde X</Text>
              </View>
            )}
            {post.trustTier === "medio" ? (
              <View style={styles.medioPill}>
                <Text style={styles.medioText}>Medio</Text>
              </View>
            ) : null}
            {post.trustTier === "oficial" ? (
              <View style={styles.oficialPill}>
                <Text style={styles.oficialText}>Oficial</Text>
              </View>
            ) : null}
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

        {post.mediaUrl ? (
          <Image
            source={{ uri: post.mediaUrl }}
            style={styles.thumb}
            resizeMode="cover"
            accessibilityLabel="Vista previa de media"
          />
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
          <Text style={styles.metaText}>{post.placeLabel}</Text>
          <View style={styles.metaDivider} />
          <Text style={styles.metaText}>{post.authorHandle}</Text>
        </View>

        <View style={styles.footerRow}>
          <Ionicons name="eye-outline" size={12} color={accent} />
          <Text style={[styles.linkText, { color: accent }]}>Ver en Pulso</Text>
          {post.isDemo ? (
            <Text style={styles.demoHint}>Muestra · no es contenido en vivo</Text>
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
    medioPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "#6366F118",
      borderWidth: 1,
      borderColor: "#6366F166",
    },
    medioText: {
      color: "#4F46E5",
      fontSize: 11,
      fontFamily: theme.fonts.heading,
    },
    oficialPill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: "#05966918",
      borderWidth: 1,
      borderColor: "#05966966",
    },
    oficialText: {
      color: "#047857",
      fontSize: 11,
      fontFamily: theme.fonts.heading,
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
    thumb: {
      width: "100%",
      height: 140,
      borderRadius: theme.radius.md ?? 10,
      backgroundColor: theme.colors.surfaceAlt ?? "#eee",
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
