import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { activeColoniaTagline } from "../lib/alerty/brandCopy";
import { shareApp } from "../lib/alerty/share";
import { useAlertyTheme } from "../lib/useAlertyTheme";

/** Comparte la app con tagline de la ciudad activa. */
export function ShareAppButton() {
  const theme = useAlertyTheme();
  const tagline = activeColoniaTagline();

  return (
    <Pressable
      style={[styles.btn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
      onPress={() => void shareApp()}
      accessibilityLabel={`Compartir Pulso: ${tagline}`}
    >
      <Ionicons name="share-outline" size={16} color={theme.colors.accent} />
      <Text style={[styles.text, { color: theme.colors.text }]} numberOfLines={1}>
        Compartir Pulso
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  text: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    flexShrink: 1,
  },
});
