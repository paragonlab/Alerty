import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { useRouter } from "expo-router";
import { getCurrentCoords } from "../lib/alerty/geolocation";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";
import { suggestDestinationPlaces } from "../lib/alerty/coloniaGeocode";
import { canAddCirculoZone, CIRCULO_PRICE_LABEL, circuloZoneLimit } from "../lib/alerty/circulo";
import { safeBack } from "../lib/alerty/nav";

export default function CirculoScreen() {
  const router = useRouter();
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const { currentUser, watchedZones, addWatchedZone, deleteWatchedZone } = useAlertyStore();
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const isPremium = Boolean(currentUser.isPremium);
  const limit = circuloZoneLimit(isPremium);
  const canAdd = canAddCirculoZone(watchedZones.length, isPremium);
  const suggestions = useMemo(() => suggestDestinationPlaces(query, 6), [query]);

  const saveZone = async (nextLabel: string, lat: number, lng: number) => {
    if (!canAdd) {
      router.push("/premium");
      return;
    }
    setSaving(true);
    const { error } = await addWatchedZone({ label: nextLabel, lat, lng });
    setSaving(false);
    if (error === "limit") {
      router.push("/premium");
      return;
    }
    if (error) {
      Alert.alert("No se guardó", error);
      return;
    }
    setLabel("");
    setQuery("");
  };

  const handlePickPlace = async (name: string, lat: number, lng: number) => {
    const zoneLabel = label.trim() || name;
    await saveZone(zoneLabel, lat, lng);
  };

  const handleUseLocation = async () => {
    setLocating(true);
    try {
      const pos = await getCurrentCoords();
      const zoneLabel = label.trim() || "Aquí";
      await saveZone(zoneLabel, pos.latitude, pos.longitude);
    } catch {
      Alert.alert("Error", "No se pudo obtener la ubicación.");
    } finally {
      setLocating(false);
    }
  };

  const handleDelete = (id: string, zoneLabel: string) => {
    Alert.alert("Quitar zona", `¿Dejar de vigilar ${zoneLabel}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => {
          void deleteWatchedZone(id);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router)} style={styles.closeButton} hitSlop={12}>
          <Ionicons name="close" size={24} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          keyboardDismissMode="on-drag"
        >
          <Text style={styles.title}>Círculo</Text>
          <Text style={styles.subtitle}>
            Te avisamos si se pone pesado cerca de una zona. El mapa sigue gratis.
          </Text>
          <Text style={styles.counter}>
            {watchedZones.length} de {limit} zonas
          </Text>

          {canAdd ? (
            <View style={styles.addCard}>
              <Text style={styles.addTitle}>Agregar zona</Text>
              <TextInput
                value={label}
                onChangeText={setLabel}
                placeholder="Nombre: casa, escuela, mamá"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
                maxLength={40}
              />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar colonia"
                placeholderTextColor={theme.colors.textMuted}
                style={styles.input}
              />
              {suggestions.map((place) => (
                <Pressable
                  key={place.name}
                  style={styles.suggestion}
                  onPress={() => void handlePickPlace(place.name, place.lat, place.lng)}
                  disabled={saving}
                >
                  <Ionicons name="location-outline" size={16} color={theme.colors.accent} />
                  <Text style={styles.suggestionText}>{place.name}</Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.locationButton}
                onPress={() => void handleUseLocation()}
                disabled={locating || saving}
              >
                {locating ? (
                  <ActivityIndicator size="small" color={theme.colors.text} />
                ) : (
                  <>
                    <Ionicons name="navigate-outline" size={16} color={theme.colors.text} />
                    <Text style={styles.locationText}>Usar mi ubicación</Text>
                  </>
                )}
              </Pressable>
            </View>
          ) : (
            <Pressable style={styles.upgrade} onPress={() => router.push("/premium")}>
              <Text style={styles.upgradeTitle}>Más zonas con Círculo</Text>
              <Text style={styles.upgradeDesc}>
                Hasta 5 colonias. {CIRCULO_PRICE_LABEL}. Cancela cuando quieras.
              </Text>
            </Pressable>
          )}

          {watchedZones.map((zone) => (
            <View key={zone.id} style={styles.zoneRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.zoneLabel}>{zone.label}</Text>
                <Text style={styles.zoneMeta}>
                  {zone.lat.toFixed(4)}, {zone.lng.toFixed(4)}
                </Text>
              </View>
              <Pressable onPress={() => handleDelete(zone.id, zone.label)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.colors.surface },
    header: { flexDirection: "row", justifyContent: "flex-end", padding: 16 },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: theme.colors.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    container: { paddingHorizontal: 24, paddingBottom: 160, gap: 12 },
    title: { fontSize: 28, fontFamily: theme.fonts.heading, color: theme.colors.text },
    subtitle: {
      fontSize: 14,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      lineHeight: 20,
    },
    counter: {
      fontSize: 13,
      fontFamily: theme.fonts.heading,
      color: theme.colors.accent,
      marginBottom: 4,
    },
    zoneRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surfaceAlt,
    },
    zoneLabel: { fontSize: 16, fontFamily: theme.fonts.heading, color: theme.colors.text },
    zoneMeta: { fontSize: 12, fontFamily: theme.fonts.body, color: theme.colors.textMuted, marginTop: 2 },
    addCard: {
      marginTop: 8,
      padding: 16,
      gap: 10,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    addTitle: { fontSize: 15, fontFamily: theme.fonts.heading, color: theme.colors.text },
    input: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.colors.text,
      fontFamily: theme.fonts.body,
      fontSize: 15,
    },
    suggestion: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    suggestionText: { fontSize: 14, fontFamily: theme.fonts.body, color: theme.colors.text },
    locationButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 10,
    },
    locationText: { fontSize: 14, fontFamily: theme.fonts.heading, color: theme.colors.text },
    upgrade: {
      marginTop: 8,
      padding: 16,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.colors.accentSoft,
    },
    upgradeTitle: { fontSize: 16, fontFamily: theme.fonts.heading, color: theme.colors.text },
    upgradeDesc: {
      fontSize: 13,
      fontFamily: theme.fonts.body,
      color: theme.colors.textMuted,
      marginTop: 4,
    },
  });
