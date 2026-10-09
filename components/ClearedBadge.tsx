import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  /** compact para chips en cards */
  compact?: boolean;
};

export function ClearedBadge({ compact }: Props) {
  const theme = useAlertyTheme();
  return (
    <View
      style={[
        styles.badge,
        compact && styles.compact,
        { backgroundColor: theme.colors.success + "18", borderColor: theme.colors.success + "55" },
      ]}
    >
      <Ionicons name="checkmark-circle" size={compact ? 12 : 14} color={theme.colors.success} />
      <Text style={[styles.text, compact && styles.textCompact, { color: theme.colors.success }]}>
        Ya se despejó
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  compact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  textCompact: {
    fontSize: 10,
  },
});
