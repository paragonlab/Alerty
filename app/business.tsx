import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams, useRouter } from "expo-router";
import { lightTheme as theme } from "../lib/theme";
import { supabase } from "../lib/supabase";

type ZoneType = "refugio" | "anuncio";

export default function BusinessOnboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; zone_id?: string }>();
  const styles = createStyles();

  // Si el negocio vuelve de Stripe con status=success, mostramos confirmación
  useEffect(() => {
    if (params.status === "success") {
      Alert.alert(
        "¡Inscripción completada!",
        "Hemos recibido tu pago. Tu pin aparecerá en el mapa una vez que nuestro equipo lo revise.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } else if (params.status === "cancel") {
      Alert.alert("Pago cancelado", "Puedes intentarlo de nuevo cuando quieras.");
    }
  }, [params.status]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<ZoneType>("refugio");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "No se pudo acceder a tu ubicación.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicación.");
    } finally {
      setLocationLoading(false);
    }
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const validCoords =
    !isNaN(parsedLat) && !isNaN(parsedLng) &&
    parsedLat >= -90 && parsedLat <= 90 &&
    parsedLng >= -180 && parsedLng <= 180;

  const canSubmit =
    name.trim().length >= 3 &&
    description.trim().length >= 10 &&
    validEmail &&
    validCoords &&
    !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout-b2b", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim(),
          owner_email: email.trim(),
          type,
          lat: parsedLat,
          lng: parsedLng,
        },
      });
      if (error) throw error;
      const url = (data as any)?.url as string | undefined;
      if (!url) throw new Error("No se obtuvo URL de pago");

      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.location.href = url;
      } else {
        await WebBrowser.openBrowserAsync(url);
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo iniciar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient colors={["#F6F2EA", "#EFE4D2", "#F6F2EA"]} style={styles.gradient}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Tu negocio en Alerty</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>Aparece en el mapa</Text>
            <Text style={styles.subtitle}>
              Negocios, farmacias, refugios y comercios pueden destacar su ubicación
              como zona segura o aliada para la comunidad.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Tipo de pin</Text>
            <View style={styles.typeRow}>
              <Pressable
                style={[styles.typeButton, type === "refugio" && styles.typeButtonActive]}
                onPress={() => setType("refugio")}
              >
                <Ionicons
                  name="shield-checkmark"
                  size={16}
                  color={type === "refugio" ? "#fff" : theme.colors.success}
                />
                <Text style={[styles.typeText, type === "refugio" && styles.typeTextActive]}>
                  Refugio Seguro
                </Text>
              </Pressable>
              <Pressable
                style={[styles.typeButton, type === "anuncio" && styles.typeButtonActive]}
                onPress={() => setType("anuncio")}
              >
                <Ionicons
                  name="star"
                  size={16}
                  color={type === "anuncio" ? "#fff" : theme.colors.accent}
                />
                <Text style={[styles.typeText, type === "anuncio" && styles.typeTextActive]}>
                  Patrocinado
                </Text>
              </Pressable>
            </View>

            <Text style={styles.label}>Nombre del negocio</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ej. Farmacias del Ahorro – Centro"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              maxLength={80}
            />

            <Text style={styles.label}>Descripción corta</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. Zona segura abierta 24h con personal capacitado."
              placeholderTextColor={theme.colors.textMuted}
              style={[styles.input, styles.inputMulti]}
              multiline
              maxLength={200}
            />

            <Text style={styles.label}>Email de contacto</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="negocio@ejemplo.com"
              placeholderTextColor={theme.colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Text style={styles.label}>Ubicación</Text>
            <View style={styles.coordsRow}>
              <TextInput
                value={lat}
                onChangeText={setLat}
                placeholder="Latitud"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                keyboardType="decimal-pad"
              />
              <TextInput
                value={lng}
                onChangeText={setLng}
                placeholder="Longitud"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                keyboardType="decimal-pad"
              />
            </View>
            {Platform.OS !== "web" && (
              <Pressable
                style={styles.locationButton}
                onPress={handleUseCurrentLocation}
                disabled={locationLoading}
              >
                {locationLoading ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <>
                    <Ionicons name="location" size={14} color={theme.colors.text} />
                    <Text style={styles.locationButtonText}>Usar mi ubicación actual</Text>
                  </>
                )}
              </Pressable>
            )}

            <View style={styles.priceBox}>
              <Text style={styles.priceLabel}>Plan mensual</Text>
              <Text style={styles.priceAmount}>
                Suscripción recurrente. Cancela cuando quieras.
              </Text>
            </View>

            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Continuar al pago</Text>
              )}
            </Pressable>

            <Text style={styles.legalText}>
              Al continuar aceptas que tu pin aparecerá en el mapa mientras tu suscripción esté activa.
              El equipo de Alerty revisa cada inscripción antes de publicarla.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const createStyles = () => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  gradient: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  closeButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  hero: { alignItems: "center", gap: 8, marginTop: 8, marginBottom: 8 },
  heroIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.colors.accent + "18",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: theme.colors.accent + "40",
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xxl,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  label: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
    marginTop: 6,
  },
  input: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  inputMulti: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  coordsRow: { flexDirection: "row", gap: 8 },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  locationButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  typeButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  typeText: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  typeTextActive: { color: "#fff" },
  priceBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  priceLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  priceAmount: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 2,
  },
  submitButton: {
    marginTop: 6,
    backgroundColor: theme.colors.accent,
    paddingVertical: 14,
    borderRadius: theme.radius.pill,
    alignItems: "center",
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  legalText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    lineHeight: 16,
    marginTop: 4,
    textAlign: "center",
  },
});
