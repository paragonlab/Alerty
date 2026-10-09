/**
 * Sheet al tocar un pin de alerta en el mapa.
 * Incluye el mismo flujo Compartir que feed/detalle (/p/<id>).
 */
import { useEffect, useRef } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../lib/alerty/constants";
import { displayTitle } from "../lib/alerty/displayTitle";
import { formatRelativeTime, getIntensityColor } from "../lib/alerty/utils";
import type { AlertItem } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { ActionLine } from "./ActionLine";
import { ClearedBadge } from "./ClearedBadge";
import { SharePulseButton } from "./SharePulseButton";

/** Ignore backdrop dismiss right after open (ghost click from map pin on web). */
const BACKDROP_GUARD_MS = 450;

type Props = {
  alert: AlertItem;
  onClose: () => void;
  onOpenDetail: () => void;
};

export function AlertPinPreview({ alert, onClose, onOpenDetail }: Props) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const openedAtRef = useRef(Date.now());
  const color = getIntensityColor(alert.createdAt);
  const title = displayTitle(alert.title ?? alert.description, CATEGORY_LABELS[alert.category]);

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, [alert.id]);

  const requestClose = () => {
    if (Date.now() - openedAtRef.current < BACKDROP_GUARD_MS) return;
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={requestClose} />
      <View style={styles.modalSheet} pointerEvents="box-none">
        <View style={styles.card} accessibilityRole="summary">
          <View style={[styles.accentBar, { backgroundColor: color }]} />
          <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} bounces={false}>
            <View style={styles.headerRow}>
              <View style={styles.headerLeft}>
                <View style={[styles.categoryPill, { borderColor: color + "60", backgroundColor: color + "12" }]}>
                  <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={12} color={color} />
                  <Text style={[styles.categoryText, { color }]}>{CATEGORY_LABELS[alert.category]}</Text>
                </View>
                {alert.status === "resolved" ? <ClearedBadge compact /> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Cerrar">
                <Ionicons name="close" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>

            <Text style={styles.title}>{title}</Text>
            <ActionLine category={alert.category} />

            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={theme.colors.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {alert.neighborhood ?? "Zona"}
              </Text>
              <View style={styles.dot} />
              <Text style={styles.metaText}>{formatRelativeTime(alert.createdAt)}</Text>
            </View>

            <SharePulseButton alert={alert} variant="full" />

            <View style={styles.actions}>
              <Pressable
                style={({ pressed }) => [styles.detailBtn, pressed && styles.btnPressed]}
                onPress={onOpenDetail}
                accessibilityLabel="Ver detalle del aviso"
              >
                <Text style={styles.detailBtnText}>Ver detalle</Text>
                <Ionicons name="chevron-forward" size={16} color="#fff" />
              </Pressable>
            </View>
            <Pressable onPress={onClose} style={styles.closeLink}>
              <Text style={styles.closeLinkText}>Cerrar</Text>
            </Pressable>
          </ScrollView>
        </View>
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
    accentBar: { width: 4 },
    scroll: { flexGrow: 0, flexShrink: 1 },
    inner: { padding: 14, gap: 10 },
    headerRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    headerLeft: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      flex: 1,
    },
    categoryPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
    },
    categoryText: {
      fontSize: 12,
      fontFamily: theme.fonts.heading,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.05)",
    },
    title: {
      color: theme.colors.text,
      fontSize: 17,
      lineHeight: 23,
      fontFamily: theme.fonts.heading,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    metaText: {
      color: theme.colors.textMuted,
      fontSize: 12,
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
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 2,
    },
    detailBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.colors.text,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: theme.radius.md ?? 10,
    },
    detailBtnText: {
      color: theme.colors.surface,
      fontSize: 13,
      fontFamily: theme.fonts.heading,
    },
    closeLink: { alignSelf: "center", paddingVertical: 6 },
    closeLinkText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    btnPressed: { opacity: 0.88 },
  });
