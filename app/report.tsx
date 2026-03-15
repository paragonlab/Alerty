import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "../lib/theme";
import { ALERT_CATEGORIES, CATEGORY_LABELS, CULIACAN_CENTER } from "../lib/alerty/constants";
import { useAlertyStore } from "../lib/alerty/store";
import type { AlertCategory, AlertItem, AlertMedia } from "../lib/alerty/types";
import { supabase } from "../lib/supabase";

export default function ReportScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState({
    latitude: CULIACAN_CENTER.latitude,
    longitude: CULIACAN_CENTER.longitude,
  });
  const [media, setMedia] = useState<AlertMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const isWeb = Platform.OS === "web";
  const addAlert = useAlertyStore((state) => state.addAlert);

  const previewMedia = useMemo(() => media.slice(0, 3), [media]);

  const handlePickMedia = async () => {
    if (isWeb) {
      Alert.alert("Multimedia", "Adjuntos disponibles en la app móvil.");
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para adjuntar evidencia.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
      allowsMultipleSelection: true,
    });

    if (result.canceled) return;

    const picked: AlertMedia[] = result.assets.map((asset) => ({
      id: asset.assetId ?? `local-${Date.now()}-${asset.uri}`,
      url: asset.uri,
      type: (asset.type === "video" ? "video" : "image") as "image" | "video",
    }));

    setMedia((prev) => [...prev, ...picked]);
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert("Falta categoría", "Selecciona el tipo de incidente.");
      return;
    }

    setSubmitting(true);
    const newAlert: AlertItem = {
      id: `local-${Date.now()}`,
      category,
      lat: location.latitude,
      lng: location.longitude,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
      status: "active",
      media,
      upvotes: 0,
      downvotes: 0,
      neighborhood: "Culiacán",
      user: {
        id: "local-user",
        username: "@tu_reporte",
        avatarUrl: null,
        isVerified: false,
        trustScore: 0.5,
        followersCount: 0,
      },
    };

    addAlert(newAlert);

    try {
      if (supabase) {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;

        const { data: alertRow, error } = await supabase
          .from("alerts")
          .insert({
            user_id: userId,
            category,
            lat: location.latitude,
            lng: location.longitude,
            description: description.trim() || null,
            status: "active",
          })
          .select()
          .single();

        if (error) {
          console.warn("Supabase insert failed", error);
        } else if (alertRow && media.length > 0) {
          await supabase.from("media").insert(
            media.map((item) => ({
              alert_id: alertRow.id,
              media_url: item.url,
              media_type: item.type,
            })),
          );
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      Alert.alert("Reporte", "Tu alerta se guardó localmente. Intentaremos sincronizarla.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUseMyLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Activa ubicación para usar tu posición actual.");
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      });
      mapRef.current?.animateToRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error) {
      Alert.alert("Ubicación", "No se pudo obtener tu ubicación.");
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Nuevo reporte</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.sectionTitle}>Categoría</Text>
        <View style={styles.categoryWrap}>
          {ALERT_CATEGORIES.map((item) => {
            const active = item === category;
            return (
              <Pressable
                key={item}
                style={[styles.categoryPill, active && styles.categoryPillActive]}
                onPress={() => setCategory(item)}
              >
                <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                  {CATEGORY_LABELS[item]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Ubicación exacta</Text>
        <View style={styles.mapCard}>
          {isWeb ? (
            <View style={styles.webMap}>
              <Ionicons name="map" size={24} color={theme.colors.textMuted} />
              <Text style={styles.webMapText}>
                Ajuste de ubicación disponible en la app móvil.
              </Text>
            </View>
          ) : (
            <>
              <MapView
                ref={mapRef}
                style={StyleSheet.absoluteFill}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <Marker
                  coordinate={location}
                  draggable
                  onDragEnd={(event) => setLocation(event.nativeEvent.coordinate)}
                />
              </MapView>
              <View style={styles.mapOverlay}>
                <Text style={styles.mapHint}>Arrastra el pin para ajustar</Text>
              </View>
              <Pressable
                style={styles.locationButton}
                onPress={handleUseMyLocation}
                disabled={locating}
              >
                <Ionicons name="locate" size={16} color={theme.colors.text} />
              </Pressable>
            </>
          )}
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Evidencia multimedia</Text>
          <Pressable style={styles.mediaButton} onPress={handlePickMedia}>
            <Ionicons name="images" size={16} color={theme.colors.text} />
            <Text style={styles.mediaButtonText}>Adjuntar</Text>
          </Pressable>
        </View>

        {media.length > 0 ? (
          <View style={styles.mediaRow}>
            {previewMedia.map((item) => (
              <Image key={item.id} source={{ uri: item.url }} style={styles.mediaThumb} />
            ))}
            {media.length > previewMedia.length ? (
              <View style={styles.moreMedia}>
                <Text style={styles.moreMediaText}>+{media.length - previewMedia.length}</Text>
              </View>
            ) : null}
          </View>
        ) : (
          <Text style={styles.helperText}>Opcional: agrega foto o video.</Text>
        )}

        <Text style={styles.sectionTitle}>Descripción</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Detalles adicionales (opcional)"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          <Text style={styles.submitText}>{submitting ? "Enviando..." : "Publicar alerta"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerSpacer: {
    width: 32,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text,
    fontSize: 18,
    fontFamily: theme.fonts.heading,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  categoryPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  categoryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  categoryTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  mapCard: {
    height: 200,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  webMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  webMapText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    textAlign: "center",
    maxWidth: 200,
  },
  locationButton: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: theme.radius.pill,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  mapHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  mediaButtonText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  mediaRow: {
    flexDirection: "row",
    gap: 8,
  },
  mediaThumb: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
  },
  moreMedia: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surfaceAlt,
  },
  moreMediaText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  textInput: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    fontFamily: theme.fonts.body,
  },
  submitButton: {
    marginTop: 12,
    height: 54,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
});
