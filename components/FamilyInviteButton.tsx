import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { shareFamilyInvite } from "../lib/alerty/share";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  zoneLabel: string;
  lat?: number | null;
  lng?: number | null;
};

export function FamilyInviteButton({ zoneLabel, lat, lng }: Props) {
  const theme = useAlertyTheme();

  return (
    <Pressable
      style={[styles.btn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
      onPress={() => void shareFamilyInvite({ zoneLabel, lat, lng })}
      accessibilityLabel="Avisarle a tu familia"
    >
      <Ionicons name="people-outline" size={16} color={theme.colors.accent} />
      <Text style={[styles.text, { color: theme.colors.text }]}>Avísale a tu familia</Text>
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
  },
});
