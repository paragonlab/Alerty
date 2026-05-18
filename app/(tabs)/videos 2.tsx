// Este archivo ya no es una tab — la experiencia de Reels vive dentro del Feed.
// Se mantiene como ruta accesible por si se necesita en el futuro.
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function VideosRedirect() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.3)" />
        <Text style={styles.title}>Los videos están en el Feed</Text>
        <Text style={styles.subtitle}>
          Abre el Feed y toca el botón "Reels" para ver los videos en pantalla completa.
        </Text>
        <Pressable style={styles.button} onPress={() => router.replace("/(tabs)/feed")}>
          <Text style={styles.buttonText}>Ir al Feed</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  inner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 32,
  },
  title: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 20,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    lineHeight: 21,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  buttonText: {
    color: "white",
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
