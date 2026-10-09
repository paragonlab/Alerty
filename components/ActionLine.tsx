import { StyleSheet, Text } from "react-native";
import { actionLineFor } from "../lib/alerty/actionLines";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  category: string;
  /** override opcional */
  text?: string;
};

export function ActionLine({ category, text }: Props) {
  const theme = useAlertyTheme();
  const line = text ?? actionLineFor(category);
  return (
    <Text style={[styles.line, { color: theme.colors.textMuted }]} numberOfLines={2}>
      {line}
    </Text>
  );
}

const styles = StyleSheet.create({
  line: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    lineHeight: 18,
  },
});
