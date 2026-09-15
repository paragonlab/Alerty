import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useAlertyStore } from "../lib/alerty/store";
import { requireSession } from "../lib/alerty/session";
import { useAlertyTheme } from "../lib/useAlertyTheme";

/**
 * Confirmar o desmentir una noticia de X o RSS. Pulso es una fuente
 * informativa: los vecinos corrigen lo que ven. Un voto por persona.
 */
export function CommunityVoteBar({ postId, dark = false }: { postId: string; dark?: boolean }) {
  const theme = useAlertyTheme();
  const { communityVotes, myCommunityVotes, voteCommunity } = useAlertyStore();
  const counts = communityVotes[postId] ?? { confirm: 0, deny: 0 };
  const mine = myCommunityVotes[postId];

  const cast = async (vote: "confirm" | "deny") => {
    if (mine) return;
    if (!(await requireSession())) return;
    void Haptics.selectionAsync();
    void voteCommunity(postId, vote);
  };

  const btn = dark
    ? styles.btnDark
    : [styles.btn, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceAlt ?? "transparent" }];
  const label = dark ? styles.textDark : [styles.text, { color: theme.colors.text }];

  return (
    <View style={styles.row}>
      <Pressable
        style={[btn, mine === "confirm" && styles.confirmOn]}
        onPress={() => void cast("confirm")}
        disabled={Boolean(mine)}
        accessibilityLabel={`Confirmo esta noticia (${counts.confirm})`}
      >
        <Ionicons
          name={mine === "confirm" ? "checkmark-circle" : "checkmark-circle-outline"}
          size={15}
          color={mine === "confirm" ? "#FFFFFF" : "#1F9D6E"}
        />
        <Text style={[label, mine === "confirm" && styles.textOn]}>Confirmo · {counts.confirm}</Text>
      </Pressable>
      <Pressable
        style={[btn, mine === "deny" && styles.denyOn]}
        onPress={() => void cast("deny")}
        disabled={Boolean(mine)}
        accessibilityLabel={`Desmiento esta noticia (${counts.deny})`}
      >
        <Ionicons
          name={mine === "deny" ? "close-circle" : "close-circle-outline"}
          size={15}
          color={mine === "deny" ? "#FFFFFF" : "#D9342B"}
        />
        <Text style={[label, mine === "deny" && styles.textOn]}>Desmiento · {counts.deny}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnDark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  text: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  textDark: {
    fontSize: 12,
    color: "#FFFFFF",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  confirmOn: {
    backgroundColor: "#1F9D6E",
    borderColor: "#1F9D6E",
  },
  denyOn: {
    backgroundColor: "#D9342B",
    borderColor: "#D9342B",
  },
  textOn: {
    color: "#FFFFFF",
  },
});
