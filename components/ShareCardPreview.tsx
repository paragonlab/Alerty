/**
 * Vista previa de la tarjeta de compartir (mockup / UI in-app).
 * La imagen real para WhatsApp sale de /api/og + link /p/<id>.
 */
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { ShareCardModel } from "../lib/alerty/shareCard";

type Props = { model: ShareCardModel };

export function ShareCardPreview({ model }: Props) {
  return (
    <View style={[styles.frame, { borderColor: model.accent + "55" }]}>
      <LinearGradient colors={["#F6F2EA", "#EFE6D7"]} style={styles.card}>
        <View style={[styles.bar, { backgroundColor: model.accent }]} />
        <View style={styles.body}>
          <Text style={styles.brand}>PULSO</Text>
          <Text style={styles.city}>{model.cityName}</Text>
          <View style={[styles.pill, { backgroundColor: model.accent + "22" }]}>
            <Text style={[styles.pillText, { color: model.accent }]}>{model.categoryLabel}</Text>
          </View>
          <Text style={styles.headline} numberOfLines={3}>
            {model.headline}
          </Text>
          <Text style={styles.place}>📍 {model.placeLine}</Text>
          <Text style={styles.action} numberOfLines={2}>
            {model.actionLine}
          </Text>
          {model.cleared ? (
            <View style={styles.cleared}>
              <Text style={styles.clearedText}>Ya se despejó</Text>
            </View>
          ) : null}
          <Text style={styles.foot}>Informar para cuidarse</Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  card: { flexDirection: "row", minHeight: 200 },
  bar: { width: 6 },
  body: { flex: 1, padding: 16, gap: 6 },
  brand: {
    fontSize: 11,
    letterSpacing: 1.1,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#1B1A17",
  },
  city: { fontSize: 12, color: "#6A6257", fontFamily: "SpaceGrotesk_400Regular" },
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  pillText: { fontSize: 11, fontFamily: "SpaceGrotesk_700Bold" },
  headline: {
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    color: "#1B1A17",
    marginTop: 4,
  },
  place: { fontSize: 13, color: "#6A6257", fontFamily: "SpaceGrotesk_500Medium" },
  action: { fontSize: 14, color: "#1B1A17", fontFamily: "SpaceGrotesk_500Medium" },
  cleared: {
    alignSelf: "flex-start",
    backgroundColor: "#1F9D6E",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  clearedText: { color: "#fff", fontSize: 11, fontFamily: "SpaceGrotesk_700Bold" },
  foot: { marginTop: 8, fontSize: 11, color: "#6A6257", fontFamily: "SpaceGrotesk_400Regular" },
});
