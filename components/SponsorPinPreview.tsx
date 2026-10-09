/**
 * Sheet al tocar un pin de Aliado/Refugio.
 * Sin Compartir: no hay ruta pública /p/ para negocios (solo ficha local).
 */
import { useEffect, useRef } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SponsoredZone } from "../lib/alerty/types";
import { useAlertyTheme } from "../lib/useAlertyTheme";

const BACKDROP_GUARD_MS = 450;

type Props = {
  zone: SponsoredZone;
  onClose: () => void;
};

export function SponsorPinPreview({ zone, onClose }: Props) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const openedAtRef = useRef(Date.now());
  const isRefugio = zone.type === "refugio";
  const accent = isRefugio ? theme.colors.success : theme.colors.accent;

  useEffect(() => {
    openedAtRef.current = Date.now();
  }, [zone.id]);

  const requestClose = () => {
    if (Date.now() - openedAtRef.current < BACKDROP_GUARD_MS) return;
    onClose();
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={requestClose} />
      <View style={styles.modalSheet} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Ionicons
              name={isRefugio ? "shield-checkmark" : "star"}
              size={14}
              color="#fff"
            />
            <Text style={styles.badgeText}>{isRefugio ? "Refugio" : "Aliado"}</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={18} color={theme.colors.textMuted} />
          </Pressable>
          <Text style={styles.name}>{zone.name}</Text>
          <Text style={styles.description}>{zone.description}</Text>
          <Text style={styles.hint}>
            Ficha del negocio en el mapa. No hay enlace público para compartir (solo
            avisos y pulsos de comunidad tienen /p/…).
          </Text>
          <Pressable onPress={onClose} style={styles.closeLink}>
            <Text style={styles.closeLinkText}>Cerrar</Text>
          </Pressable>
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
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      borderColor: theme.colors.border,
      padding: 16,
      gap: 8,
      overflow: "hidden",
    },
    badge: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.pill,
    },
    badgeText: {
      color: "#fff",
      fontSize: 12,
      fontFamily: theme.fonts.heading,
    },
    closeBtn: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.05)",
    },
    name: {
      fontSize: 17,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      marginTop: 4,
      paddingRight: 36,
    },
    description: {
      fontSize: 14,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
    hint: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      lineHeight: 15,
      marginTop: 4,
    },
    closeLink: { alignSelf: "center", paddingVertical: 6 },
    closeLinkText: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
  });
