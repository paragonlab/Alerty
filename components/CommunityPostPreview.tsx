import { useMemo, useState } from "react";
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import { formatRelativeTime } from "../lib/alerty/utils";
import type { CommunityPost } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";

const X_ACCENT = "#1D9BF0";
const NEWS_ACCENT = "#0D9488";

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

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url) || /\/video\//i.test(url);
}

type CommunityPostPreviewProps = {
  post: CommunityPost;
  onClose: () => void;
};

/** Preview in-app del post (texto + media). Abrir externo es secundario. */
export function CommunityPostPreview({ post, onClose }: CommunityPostPreviewProps) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const setPendingCommunityConfirm = useAlertyStore((s) => s.setPendingCommunityConfirm);
  const [mediaFailed, setMediaFailed] = useState(false);

  const categoryLabel = post.categoryGuess
    ? CATEGORY_GUESS_LABELS[post.categoryGuess] ?? post.categoryGuess
    : null;

  const mediaUrl = post.mediaUrl && !mediaFailed ? post.mediaUrl : null;
  const mediaIsVideo = mediaUrl ? isVideoUrl(mediaUrl) : false;

  const trustBadges = useMemo(() => {
    const badges: Array<{ key: string; label: string; tone: "x" | "news" | "medio" | "oficial" | "demo" }> = [];
    if (post.isDemo) badges.push({ key: "demo", label: "DEMO", tone: "demo" });
    if (post.source === "rss" || post.trustTier === "news") {
      badges.push({ key: "news", label: "Noticia", tone: "news" });
    } else {
      badges.push({ key: "x", label: "Desde X", tone: "x" });
    }
    if (post.trustTier === "medio") badges.push({ key: "medio", label: "Medio", tone: "medio" });
    if (post.trustTier === "oficial") badges.push({ key: "oficial", label: "Oficial", tone: "oficial" });
    badges.push({ key: "com", label: "Comunidad", tone: "x" });
    return badges;
  }, [post]);

  const openExternal = () => {
    void Linking.openURL(post.url);
  };

  const confirmInPulso = () => {
    setPendingCommunityConfirm({
      text: post.text.slice(0, 280),
      categoryGuess: post.categoryGuess,
      placeLabel: post.placeLabel,
      lat: post.lat,
      lng: post.lng,
      sourceUrl: post.url,
    });
    onClose();
    router.push("/report");
  };

  const body = (
    <View style={styles.card} accessibilityRole="summary">
      <View style={[styles.accentBar, { backgroundColor: post.source === "rss" ? NEWS_ACCENT : X_ACCENT }]} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} bounces={false}>
        <View style={styles.headerRow}>
          <View style={styles.badgeRow}>
            {trustBadges.map((b) => (
              <View
                key={b.key}
                style={[
                  styles.pill,
                  b.tone === "demo" && styles.demoPill,
                  b.tone === "news" && styles.newsPill,
                  b.tone === "medio" && styles.medioPill,
                  b.tone === "oficial" && styles.oficialPill,
                  b.tone === "x" && styles.xPill,
                ]}
              >
                {b.tone === "x" ? (
                  <Ionicons name="logo-twitter" size={11} color={X_ACCENT} />
                ) : null}
                <Text
                  style={[
                    styles.pillText,
                    b.tone === "demo" && styles.demoText,
                    b.tone === "news" && styles.newsText,
                    b.tone === "medio" && styles.medioText,
                    b.tone === "oficial" && styles.oficialText,
                    b.tone === "x" && styles.xText,
                  ]}
                >
                  {b.label}
                </Text>
              </View>
            ))}
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.handle} numberOfLines={2}>
          {post.authorName ? `${post.authorName} · ` : ""}
          {post.authorHandle}
        </Text>

        {categoryLabel ? (
          <View style={styles.categoryChip}>
            <Text style={styles.categoryText}>{categoryLabel}</Text>
          </View>
        ) : null}

        <Text style={styles.body}>{post.text}</Text>

        {mediaUrl ? (
          <View style={styles.mediaWrap}>
            {mediaIsVideo ? (
              <Video
                source={{ uri: mediaUrl }}
                style={styles.media}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                onError={() => setMediaFailed(true)}
              />
            ) : (
              <Image
                source={{ uri: mediaUrl }}
                style={styles.media}
                resizeMode="cover"
                onError={() => setMediaFailed(true)}
                accessibilityLabel="Imagen del post"
              />
            )}
          </View>
        ) : null}

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
            Muestra · no es contenido en vivo ni una alerta ciudadana de Pulso.
          </Text>
        ) : (
          <Text style={styles.sourceHint}>
            {post.source === "rss"
              ? "Fuente: noticia local — no es alerta ciudadana de Pulso."
              : "Fuente: X / Comunidad — no es alerta ciudadana de Pulso."}
          </Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.btnPressed]}
            onPress={confirmInPulso}
            accessibilityLabel="Confirmar en Pulso"
          >
            <Ionicons name="shield-checkmark-outline" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Confirmar en Pulso</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.btnPressed]}
            onPress={openExternal}
            accessibilityRole="link"
            accessibilityLabel={post.source === "rss" ? "Abrir noticia" : "Abrir en X"}
          >
            <Ionicons name="open-outline" size={16} color={post.source === "rss" ? NEWS_ACCENT : X_ACCENT} />
            <Text style={[styles.secondaryBtnText, { color: post.source === "rss" ? NEWS_ACCENT : X_ACCENT }]}>
              {post.source === "rss" ? "Abrir noticia" : "Abrir en X"}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={onClose} style={styles.closeLink}>
          <Text style={styles.closeLinkText}>Cerrar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.modalSheet} pointerEvents="box-none">
        {body}
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    modalSheet: {
      flex: 1,
      justifyContent: "flex-end",
      paddingHorizontal: 12,
      paddingBottom: 24,
    },
    card: {
      maxHeight: "88%",
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
    },
    accentBar: {
      width: 4,
    },
    scroll: {
      flexGrow: 0,
      flexShrink: 1,
    },
    inner: {
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
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    pillText: {
      fontSize: 11,
      fontFamily: theme.fonts.heading,
    },
    xPill: {
      borderColor: X_ACCENT + "55",
      backgroundColor: X_ACCENT + "14",
    },
    xText: { color: X_ACCENT },
    newsPill: {
      borderColor: NEWS_ACCENT + "66",
      backgroundColor: NEWS_ACCENT + "18",
    },
    newsText: { color: NEWS_ACCENT },
    medioPill: {
      borderColor: "#6366F166",
      backgroundColor: "#6366F118",
    },
    medioText: { color: "#4F46E5" },
    oficialPill: {
      borderColor: "#05966966",
      backgroundColor: "#05966918",
    },
    oficialText: { color: "#047857" },
    demoPill: {
      borderColor: "#F59E0B66",
      backgroundColor: "#F59E0B22",
    },
    demoText: {
      color: "#B45309",
      letterSpacing: 0.6,
      fontSize: 10,
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
    mediaWrap: {
      borderRadius: theme.radius.md ?? 10,
      overflow: "hidden",
      backgroundColor: theme.colors.surfaceAlt ?? "#111",
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    media: {
      width: "100%",
      height: 180,
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
      flexWrap: "wrap",
      alignItems: "center",
      gap: 10,
      marginTop: 4,
    },
    primaryBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.reportAction ?? "#E53935",
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
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: theme.radius.md ?? 10,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    secondaryBtnText: {
      fontSize: 13,
      fontFamily: theme.fonts.heading,
    },
    closeLink: {
      alignSelf: "center",
      paddingVertical: 6,
    },
    closeLinkText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    btnPressed: {
      opacity: 0.88,
    },
  });
