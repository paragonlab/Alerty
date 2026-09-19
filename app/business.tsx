import { useEffect, useRef, useState } from "react";
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
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "../components/ExpoMapView";
import { DestinationPin } from "../components/DestinationPin";
import { lightTheme as theme } from "../lib/theme";
import { supabase } from "../lib/supabase";
import { safeBack } from "../lib/alerty/nav";
import { ALIADO_PRICE_LABEL } from "../lib/alerty/circulo";
import { CULIACAN_CENTER } from "../lib/alerty/constants";
import { getCurrentCoords } from "../lib/alerty/geolocation";
import { addressFromCoords } from "../lib/alerty/geocode";
import { placeIcon, searchCuliacanPlaces, type PlaceResult } from "../lib/alerty/placeSearch";
import { calculateDistance } from "../lib/alerty/utils";
import { uploadAliadoProof } from "../lib/upload";
import { requireSession } from "../lib/alerty/session";

type ZoneType = "refugio" | "anuncio";
type Punto = { latitude: number; longitude: number };

/**
 * Hasta dónde se acepta un "estoy en el negocio". El GPS urbano falla decenas
 * de metros; más allá de esto ya no respalda nada.
 */
const RADIO_EN_SITIO_M = 150;

export default function BusinessOnboarding() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string; zone_id?: string }>();
  const styles = createStyles();

  // En iPhone y Android no se cobra ni se manda a pagar fuera: App Review 3.1.1
  // prohíbe llevar a otro medio de pago, y un pin que se ve dentro de la app no
  // entra en la excepción de apps de campañas publicitarias (3.1.3g). La
  // política de pagos de Google Play tampoco exime la venta B2B. Ahí el negocio
  // deja su solicitud y la venta se cierra por fuera.
  const isStore = Platform.OS !== "web";

  // Si el negocio vuelve de Stripe con status=success, mostramos confirmación
  useEffect(() => {
    if (params.status === "success") {
      Alert.alert(
        "¡Inscripción completada!",
        "Hemos recibido tu pago. Tu pin aparecerá en el mapa una vez que nuestro equipo lo revise.",
        [{ text: "OK", onPress: () => safeBack(router) }],
      );
    } else if (params.status === "cancel") {
      Alert.alert("Pago cancelado", "Puedes intentarlo de nuevo cuando quieras.");
    }
  }, [params.status]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [type, setType] = useState<ZoneType>("refugio");
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);

  // Dónde está el negocio: manda el pin, la dirección es su forma legible.
  const [point, setPoint] = useState<Punto | null>(null);
  const [address, setAddress] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const mapRef = useRef<any>(null);

  // Respaldo de que el lugar es suyo: estar ahí, o un documento.
  const [onSite, setOnSite] = useState<{ at: string; distanceM: number } | null>(null);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [proofKind, setProofKind] = useState<"fachada" | "recibo">("fachada");

  const moverPin = async (next: Punto) => {
    setPoint(next);
    setOnSite(null);
    mapRef.current?.animateToRegion?.(
      { ...next, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      400,
    );
    const found = await addressFromCoords(next.latitude, next.longitude);
    if (found) setAddress(found);
  };

  const handleMapPress = (e: any) => {
    const c = e?.nativeEvent?.coordinate;
    if (!c) return;
    void moverPin({ latitude: c.latitude, longitude: c.longitude });
  };

  const handleSearch = async () => {
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      setResults(await searchCuliacanPlaces(query));
    } catch {
      Alert.alert("Búsqueda", "No se pudo buscar la dirección. Pon el pin en el mapa.");
    } finally {
      setSearching(false);
    }
  };

  const handlePickResult = (place: PlaceResult) => {
    setResults([]);
    setQuery("");
    setAddress(place.name + ", " + place.detail);
    setPoint({ latitude: place.lat, longitude: place.lng });
    setOnSite(null);
    mapRef.current?.animateToRegion?.(
      { latitude: place.lat, longitude: place.lng, latitudeDelta: 0.008, longitudeDelta: 0.008 },
      400,
    );
  };

  /** "Estoy en el negocio": solo respalda si el GPS coincide con el pin. */
  const handleUseCurrentLocation = async () => {
    setLocationLoading(true);
    try {
      const pos = await getCurrentCoords();
      if (!point) {
        await moverPin({ latitude: pos.latitude, longitude: pos.longitude });
        setOnSite({ at: new Date().toISOString(), distanceM: 0 });
        return;
      }
      const metros = Math.round(
        calculateDistance(pos.latitude, pos.longitude, point.latitude, point.longitude) * 1000,
      );
      if (metros > RADIO_EN_SITIO_M) {
        setOnSite(null);
        Alert.alert(
          "Estás lejos del pin",
          "El GPS te ubica a " + metros + " m del punto que marcaste. Muévelo a donde estás, o hazlo desde el negocio.",
        );
        return;
      }
      setOnSite({ at: new Date().toISOString(), distanceM: metros });
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicación.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePickProof = async () => {
    const abrirGaleria = async () => {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (!result.canceled) setProofUri(result.assets[0].uri);
    };
    if (Platform.OS === "web") {
      await abrirGaleria();
      return;
    }
    Alert.alert("Comprobante", "¿De dónde lo tomamos?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Tomar foto",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") {
            Alert.alert("Permiso requerido", "Necesitamos la cámara para la foto.");
            return;
          }
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled) setProofUri(result.assets[0].uri);
        },
      },
      { text: "Elegir de la galería", onPress: abrirGaleria },
    ]);
  };

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const respaldado = onSite !== null || proofUri !== null;

  const canSubmit =
    name.trim().length >= 3 &&
    description.trim().length >= 10 &&
    validEmail &&
    point !== null &&
    respaldado &&
    !loading;

  /**
   * Deja el expediente del negocio: dónde dice estar y con qué lo respalda. Se
   * guarda en los dos caminos —solicitud en las tiendas, pago en la web— para
   * que el comprobante nunca dependa de que el cobro salga bien.
   */
  const guardarSolicitud = async (): Promise<string | null> => {
    if (!supabase || !point) return "No hay conexión.";
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return "Entra con tu cuenta para enviar la solicitud.";

    let proofPath: string | null = null;
    if (proofUri) {
      proofPath = await uploadAliadoProof(proofUri, uid);
      if (!proofPath) return "No se pudo subir el comprobante. Inténtalo de nuevo.";
    }

    const { error } = await supabase.from("aliado_leads").insert({
      user_id: uid,
      name: name.trim(),
      description: description.trim(),
      contact_email: email.trim(),
      type,
      lat: point.latitude,
      lng: point.longitude,
      address: address.trim() || null,
      proof_url: proofPath,
      proof_kind: proofPath ? proofKind : null,
      location_verified_at: onSite?.at ?? null,
      location_distance_m: onSite?.distanceM ?? null,
    });
    return error ? error.message : null;
  };

  /** En las tiendas: solicitud, sin precio ni pago. */
  const handleLead = async () => {
    if (!canSubmit || !supabase) return;
    if (!(await requireSession("/business"))) return;
    setLoading(true);
    try {
      const error = await guardarSolicitud();
      if (error) throw new Error(error);
      Alert.alert(
        "Solicitud enviada",
        "Revisamos tu negocio y te contactamos por correo.",
        [{ text: "OK", onPress: () => safeBack(router) }],
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "No se pudo enviar la solicitud.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || !supabase || !point) return;
    if (isStore) {
      void handleLead();
      return;
    }
    if (!(await requireSession("/business"))) return;
    setLoading(true);
    try {
      const guardado = await guardarSolicitud();
      if (guardado) throw new Error(guardado);
      const { data, error } = await supabase.functions.invoke("stripe-checkout-b2b", {
        method: "POST",
        body: {
          name: name.trim(),
          description: description.trim(),
          owner_email: email.trim(),
          type,
          lat: point.latitude,
          lng: point.longitude,
        },
      });
      if (error) throw error;
      const url = (data as any)?.url as string | undefined;
      if (!url) throw new Error("No se obtuvo URL de pago");
      if (typeof window !== "undefined") window.location.href = url;
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
          <Pressable onPress={() => safeBack(router)} style={styles.closeButton} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Tu negocio en Pulso</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={28} color={theme.colors.accent} />
            </View>
            <Text style={styles.title}>Aliado en el mapa</Text>
            <Text style={styles.subtitle}>
              Farmacia abierta, gasolinera, clínica u OXXO. Un pin útil: aquí hay gente,
              puedes parar. No es un anuncio en la lista de Pulsos.
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
                  Refugio
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
                  Aliado
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

            <Text style={styles.label}>Dónde está</Text>
            <Text style={styles.help}>
              Busca la dirección o toca el mapa para dejar el pin en la puerta del negocio.
            </Text>
            <View style={styles.searchRow}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                placeholder="Calle, colonia o nombre del lugar"
                placeholderTextColor={theme.colors.textMuted}
                style={[styles.input, { flex: 1 }]}
                returnKeyType="search"
              />
              <Pressable
                style={styles.searchButton}
                onPress={handleSearch}
                disabled={searching || query.trim().length < 3}
                accessibilityLabel="Buscar la dirección"
              >
                {searching ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <Ionicons name="search" size={16} color={theme.colors.text} />
                )}
              </Pressable>
            </View>

            {results.map((place) => (
              <Pressable
                key={place.name + place.lat + place.lng}
                style={styles.result}
                onPress={() => handlePickResult(place)}
              >
                <Ionicons
                  name={placeIcon(place.kind) as any}
                  size={16}
                  color={theme.colors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultName}>{place.name}</Text>
                  <Text style={styles.resultDetail}>{place.detail}</Text>
                </View>
              </Pressable>
            ))}

            <View style={styles.mapBox}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={CULIACAN_CENTER}
                onPress={handleMapPress}
              >
                {point ? (
                  <Marker coordinate={point} anchor={{ x: 0.5, y: 1 }}>
                    <DestinationPin markerKind="destination" color={theme.colors.accent} />
                  </Marker>
                ) : null}
              </MapView>
              {!point ? (
                <View style={styles.mapHint} pointerEvents="none">
                  <Text style={styles.mapHintText}>Toca el mapa para poner tu pin</Text>
                </View>
              ) : null}
            </View>

            {address ? (
              <Text style={styles.addressText}>
                <Ionicons name="location" size={12} color={theme.colors.textMuted} /> {address}
              </Text>
            ) : null}

            <Text style={styles.label}>Comprueba que el negocio es tuyo</Text>
            <Text style={styles.help}>
              Con una de las dos basta. Esto no se publica: lo revisa el equipo de Pulso.
            </Text>

            <Pressable
              style={[styles.proofOption, onSite ? styles.proofOptionDone : null]}
              onPress={handleUseCurrentLocation}
              disabled={locationLoading}
            >
              <Ionicons
                name={onSite ? "checkmark-circle" : "location"}
                size={18}
                color={onSite ? theme.colors.success : theme.colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.proofTitle}>Estoy en el negocio ahora</Text>
                <Text style={styles.proofHelp}>
                  {onSite
                    ? "Confirmado: tu ubicación coincide con el pin (" + onSite.distanceM + " m)."
                    : "Tomamos tu ubicación y la comparamos con el pin que marcaste."}
                </Text>
              </View>
              {locationLoading ? (
                <ActivityIndicator size="small" color={theme.colors.text} />
              ) : null}
            </Pressable>

            <Pressable
              style={[styles.proofOption, proofUri ? styles.proofOptionDone : null]}
              onPress={handlePickProof}
            >
              <Ionicons
                name={proofUri ? "checkmark-circle" : "document-attach-outline"}
                size={18}
                color={proofUri ? theme.colors.success : theme.colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.proofTitle}>Subir un comprobante</Text>
                <Text style={styles.proofHelp}>
                  {proofUri
                    ? "Adjuntado. Toca para cambiarlo."
                    : "Foto de la fachada con el negocio visible, o un recibo a su nombre."}
                </Text>
              </View>
            </Pressable>

            {proofUri ? (
              <View style={styles.typeRow}>
                <Pressable
                  style={[styles.typeButton, proofKind === "fachada" && styles.typeButtonActive]}
                  onPress={() => setProofKind("fachada")}
                >
                  <Text
                    style={[styles.typeText, proofKind === "fachada" && styles.typeTextActive]}
                  >
                    Fachada
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.typeButton, proofKind === "recibo" && styles.typeButtonActive]}
                  onPress={() => setProofKind("recibo")}
                >
                  <Text
                    style={[styles.typeText, proofKind === "recibo" && styles.typeTextActive]}
                  >
                    Recibo
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!isStore ? (
              <View style={styles.priceBox}>
                <Text style={styles.priceLabel}>{ALIADO_PRICE_LABEL}</Text>
                <Text style={styles.priceAmount}>
                  Una sucursal en el mapa. Cancela cuando quieras.
                </Text>
              </View>
            ) : null}

            <Pressable
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  {isStore ? "Enviar solicitud" : "Continuar al pago"}
                </Text>
              )}
            </Pressable>

            <Text style={styles.legalText}>
              {isStore
                ? "Pulso revisa cada Aliado antes de publicarlo. Te contactamos por correo para ver los detalles."
                : "El pin aparece en el mapa mientras la suscripción esté activa. Pulso revisa cada Aliado antes de publicarlo."}
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
  help: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    lineHeight: 17,
    marginTop: -4,
  },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  searchButton: {
    width: 42,
    height: 42,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceAlt,
  },
  resultName: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  resultDetail: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
  mapBox: {
    height: 220,
    borderRadius: theme.radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
    justifyContent: "flex-end",
  },
  map: { ...StyleSheet.absoluteFillObject },
  mapHint: {
    margin: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignSelf: "center",
  },
  mapHintText: { color: "#fff", fontSize: 12, fontFamily: theme.fonts.heading },
  addressText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    lineHeight: 17,
  },
  proofOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  proofOptionDone: { borderColor: theme.colors.success },
  proofTitle: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  proofHelp: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    lineHeight: 16,
    marginTop: 2,
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
