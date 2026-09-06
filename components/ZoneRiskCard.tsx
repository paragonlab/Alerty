// Tarjeta de resultado: muestra qué tan peligrosa es una zona consultada
// (por dirección buscada o por un punto tocado en el mapa).
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { CATEGORY_LABELS } from "../lib/alerty/constants";
import { GO_DEST_LABEL, GO_OUT_LABEL, RISK_LABEL, RISK_RADIUS_KM, riskColor, type RiskAssessment, type RiskLevel } from "../lib/alerty/risk";

const ICON: Record<RiskLevel, keyof typeof Ionicons.glyphMap> = {
  tranquila: "shield-checkmark",
  moderada: "alert-circle",
  alta: "warning",
  critica: "warning",
};

const RADIUS_M = Math.round(RISK_RADIUS_KM * 1000);

export function ZoneRiskCard({
  assessment,
  label,
  pulseCount,
  destination,
  onShare,
  onClose,
}: {
  assessment: RiskAssessment;
  label: string;
  pulseCount?: number;
  destination?: boolean;
  onShare?: () => void;
  onClose: () => void;
}) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const color = riskColor(assessment.level, theme.colors);
  const pulses = pulseCount ?? assessment.count;

  return (
    <View style={[styles.card, { borderColor: color }]}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Ionicons name={ICON[assessment.level]} size={18} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.level, { color }]}>
            {destination ? GO_DEST_LABEL[assessment.level] : GO_OUT_LABEL[assessment.level]}
          </Text>
          <Text style={styles.place} numberOfLines={1}>
            {destination ? `Ir a ${label}` : `${RISK_LABEL[assessment.level]} · ${label}`}
          </Text>
        </View>
        {onShare ? (
          <Pressable onPress={onShare} hitSlop={10} style={styles.close} accessibilityLabel="Compartir zona">
            <Ionicons name="share-outline" size={18} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
          <Ionicons name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {assessment.count === 0 ? (
        <Text style={styles.empty}>
          Sin reportes recientes en un radio de {RADIUS_M} m. Mantente atento de todos modos.
        </Text>
      ) : (
        <>
          <Text style={styles.summary}>
            {pulses} {pulses === 1 ? "pulso" : "pulsos"} en un radio de {RADIUS_M} m · comunidad y noticieros
          </Text>
          <View style={styles.chips}>
            {assessment.byCategory.map((c) => (
              <View key={c.category} style={styles.chip}>
                <Text style={styles.chipText}>
                  {CATEGORY_LABELS[c.category]} · {c.count}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
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
      padding: 14,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      gap: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    level: {
      fontSize: 15,
      fontFamily: theme.fonts.heading,
    },
    place: {
      fontSize: 12,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      marginTop: 1,
    },
    close: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    summary: {
      fontSize: 13,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
    empty: {
      fontSize: 13,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      lineHeight: 18,
    },
    chips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
    },
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: theme.radius.pill,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    chipText: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
  });
