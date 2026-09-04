import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatRelativeTime } from "../lib/alerty/utils";
import type { CommunityPost } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

const X_ACCENT = "#1D9BF0";

const CATEGORY_GUESS_LABELS: Record<string, string> = {
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo",
  robo: "Robo",
  accidente: "Accidente",
  alerta: "Alerta",
};

type CommunityPostPreviewProps = {
  post: CommunityPost;
  onClose: () => void;
};

/** Preview tipo tarjeta al tocar un pin de comunidad en el mapa (web + native). */
export function CommunityPostPreview({ post, onClose }: CommunityPostPreviewProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const categoryLabel = post.categoryGuess
    ? CATEGORY_GUESS_LABELS[post.categoryGuess] ?? post.categoryGuess
    : null;

  const openOnX = () => {
    void Linking.openURL(post.url);
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.accentBar} />
      <View style={styles.inner}>
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            <View style={styles.sourcePill}>
              <Ionicons name="logo-twitter" size={12} color={X_ACCENT} />
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
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.handle} numberOfLines={1}>
          {post.authorName ? `${post.authorName} · ` : ""}
          {post.authorHandle}
        </Text>

        {categoryLabel ? (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText}>{categoryLabel}</Text>
          </View>
        ) : null}

        <Text style={styles.body} numberOfLines={5}>
          {post.text}
        </Text>

        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={12} color={theme.colors.textMuted} />
          <Text style={styles.metaText} numberOfLines={1}>
            {post.placeLabel}
          </Text>
          <View style={styles.dot} />
          <Text style={styles.metaText}>{formatRelativeTime(post.createdAt)}</Text>
        </View>

        {post.isDemo ? (
          <Text style={styles.demoHint}>
            Muestra · no es un tweet en vivo ni una alerta ciudadana de Pulso.
          </Text>
        ) : (
          <Text style={styles.sourceHint}>Fuente: X / Comunidad — no es alerta ciudadana de Pulso.</Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={openOnX}
            accessibilityRole="link"
            accessibilityLabel="Abrir en X"
          >
            <Ionicons name="open-outline" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Abrir en X</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            onPress={onClose}
          >
            <Text style={styles.secondaryBtnText}>Cerrar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    card: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 120,
      flexDirection: "row",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.22,
      shadowRadius: 14,
      elevation: 12,
      zIndex: 30,
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
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
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
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.05)",
    },
    handle: {
      color: theme.colors.text,
      fontSize: 14,
      fontFamily: theme.fonts.heading,
    },
    categoryChip: {
      alignSelf: "flex-start",
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: X_ACCENT + "18",
      borderWidth: 1,
      borderColor: X_ACCENT + "40",
    },
    categoryText: {
      color: X_ACCENT,
      fontSize: 11,
      fontFamily: theme.fonts.heading,
    },
    body: {
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
      flexShrink: 1,
    },
    dot: {
      width: 3,
      height: 3,
      borderRadius: 2,
      backgroundColor: theme.colors.border,
      marginHorizontal: 4,
    },
    demoHint: {
      color: "#B45309",
      fontSize: 11,
      fontFamily: theme.fonts.body,
      lineHeight: 15,
    },
    sourceHint: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
      lineHeight: 15,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: X_ACCENT,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.md ?? 10,
    },
    primaryBtnText: {
      color: "#fff",
      fontSize: 13,
      fontFamily: theme.fonts.heading,
    },
    secondaryBtn: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radius.md ?? 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryBtnText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    btnPressed: {
      opacity: 0.88,
    },
  });
