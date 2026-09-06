import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import {
  GO_OUT_LABEL,
  RISK_LABEL,
  riskColor,
  type RiskAssessment,
  type RiskLevel,
} from "../lib/alerty/risk";

const ICON: Record<RiskLevel, keyof typeof Ionicons.glyphMap> = {
  tranquila: "shield-checkmark",
  moderada: "alert-circle",
  alta: "warning",
  critica: "warning",
};

export function ZonePulseBar({
  assessment,
  placeLabel,
  pulseCount,
  windowLabel,
  onShare,
}: {
  assessment: RiskAssessment;
  placeLabel: string;
  pulseCount: number;
  windowLabel: string;
  onShare: () => void;
}) {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const color = riskColor(assessment.level, theme.colors);
  const pulses =
    pulseCount === 0
      ? `Sin pulsos cerca · ${windowLabel}`
      : `${pulseCount} ${pulseCount === 1 ? "pulso" : "pulsos"} cerca · ${windowLabel}`;

  return (
    <View style={[styles.bar, { borderColor: color }]}>
      <View style={[styles.iconWrap, { backgroundColor: color }]}>
        <Ionicons name={ICON[assessment.level]} size={18} color="#fff" />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.verdict, { color }]}>{GO_OUT_LABEL[assessment.level]}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {RISK_LABEL[assessment.level]} · {placeLabel}
        </Text>
        <Text style={styles.pulses} numberOfLines={1}>
          {pulses} · comunidad y noticieros
        </Text>
      </View>
      <Pressable style={styles.share} onPress={onShare} hitSlop={8} accessibilityLabel="Compartir zona">
        <Ionicons name="share-outline" size={18} color={theme.colors.text} />
        <Text style={styles.shareLabel}>Enviar</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    bar: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 120,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.surface,
      borderWidth: 1.5,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
      elevation: 10,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
    },
    copy: {
      flex: 1,
      minWidth: 0,
      gap: 1,
    },
    verdict: {
      fontSize: 16,
      fontFamily: theme.fonts.heading,
    },
    meta: {
      fontSize: 12,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
    },
    pulses: {
      fontSize: 11,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
    },
    share: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.surfaceAlt,
    },
    shareLabel: {
      fontSize: 10,
      fontFamily: theme.fonts.body,
      color: theme.colors.text,
    },
  });
