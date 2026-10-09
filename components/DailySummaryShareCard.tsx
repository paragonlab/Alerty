import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { DailyShareStats } from "../lib/alerty/dailyShare";
import { shareDailySummary } from "../lib/alerty/share";
import { useAlertyTheme } from "../lib/useAlertyTheme";

type Props = {
  stats: DailyShareStats;
};

export function DailySummaryShareCard({ stats }: Props) {
  const theme = useAlertyTheme();

  return (
    <View style={[styles.wrap, { borderColor: theme.colors.border }]}>
      <LinearGradient
        colors={["#F6F2EA", "#EFE6D7"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={styles.brand}>PULSO</Text>
        <Text style={styles.title}>Así estuvo {stats.cityName} hoy</Text>
        <Text style={styles.tone}>{stats.toneLabel}</Text>
        <Text style={styles.count}>
          {stats.total} {stats.total === 1 ? "aviso" : "avisos"} en la comunidad
        </Text>
        <View style={styles.cats}>
          {stats.byCategory.slice(0, 4).map((row) => (
            <Text key={row.label} style={styles.cat}>
              · {row.label}: {row.count}
            </Text>
          ))}
        </View>
        {(stats.cleared > 0 || stats.allies > 0) && (
          <View style={styles.good}>
            {stats.cleared > 0 ? (
              <Text style={styles.goodText}>
                {stats.cleared === 1
                  ? "1 zona ya se despejó"
                  : `${stats.cleared} zonas ya se despejaron`}
              </Text>
            ) : null}
            {stats.allies > 0 ? (
              <Text style={styles.goodText}>
                {stats.allies === 1
                  ? "1 aliado/refugio cerca"
                  : `${stats.allies} aliados/refugios cerca`}
              </Text>
            ) : null}
          </View>
        )}
        <Pressable
          style={styles.shareBtn}
          onPress={() => void shareDailySummary(stats)}
          accessibilityLabel="Compartir resumen del día"
        >
          <Ionicons name="share-social-outline" size={16} color="#F6F2EA" />
          <Text style={styles.shareText}>Compartir resumen</Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  card: {
    padding: 18,
    gap: 6,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 1.2,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#1B1A17",
  },
  title: {
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#1B1A17",
    marginTop: 4,
  },
  tone: {
    fontSize: 14,
    fontFamily: "SpaceGrotesk_500Medium",
    color: "#6A6257",
  },
  count: {
    fontSize: 15,
    fontFamily: "SpaceGrotesk_500Medium",
    color: "#1B1A17",
    marginTop: 8,
  },
  cats: { marginTop: 4, gap: 2 },
  cat: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
    color: "#6A6257",
  },
  good: { marginTop: 10, gap: 2 },
  goodText: {
    fontSize: 13,
    fontFamily: "SpaceGrotesk_500Medium",
    color: "#1F9D6E",
  },
  shareBtn: {
    marginTop: 14,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1B1A17",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  shareText: {
    color: "#F6F2EA",
    fontSize: 13,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
