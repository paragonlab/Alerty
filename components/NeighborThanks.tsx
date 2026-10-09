import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { neighborThanksLine } from "../lib/alerty/neighborThanks";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  username?: string | null;
  notifiedCount?: number | null;
};

export function NeighborThanks({ username, notifiedCount }: Props) {
  const theme = useAlertyTheme();
  const line = neighborThanksLine({
    username,
    notifiedCount: notifiedCount ?? 0,
  });
  if (!line) return null;

  return (
    <View
      style={[
        styles.row,
        { backgroundColor: theme.colors.surfaceAlt, borderColor: theme.colors.border },
      ]}
    >
      <Ionicons name="heart-outline" size={14} color={theme.colors.accent} />
      <Text style={[styles.text, { color: theme.colors.text }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    lineHeight: 18,
  },
});
