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
import MapView, { Marker, PROVIDER_GOOGLE } from "../components/ExpoMapView";
import { GlassView, GlassContainer } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { ALERT_CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS, CULIACAN_CENTER } from "../lib/alerty/constants";
import { useAlertyStore } from "../lib/alerty/store";
import type { AlertCategory, AlertItem, AlertMedia } from "../lib/alerty/types";
import { supabase } from "../lib/supabase";
import { calculateDistance } from "../lib/alerty/utils";

export default function ReportScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState({
    latitude: CULIACAN_CENTER.latitude,
    longitude: CULIACAN_CENTER.longitude,
  });
  const [media, setMedia] = useState<AlertMedia[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const isWeb = Platform.OS === "web";
  
  const { addAlert, getReportingRange, currentUser, themeMode } = useAlertyStore();
  const theme = useAlertyTheme();
  const isDark = themeMode === "darkHighVisibility";
  const styles = createStyles(theme, themeMode);
  const maxReportingDistance = getReportingRange();

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

  const handleStartRecording = async () => {
    try {
      if (isWeb) return;
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso", "Necesitamos acceso al micrófono para grabar el reporte.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const handleStopRecording = async () => {
    if (!recording) return;
    try {
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setAudioUri(uri);
      if (uri) {
        setMedia(prev => [...prev, {
          id: `audio-${Date.now()}`,
          url: uri,
          type: "audio"
        }]);
      }
      setRecording(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const handleSubmit = async () => {
    if (!category) {
      Alert.alert("Falta categoría", "Selecciona el tipo de incidente.");
      return;
    }

    setSubmitting(true);

    // Verify distance
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        const distance = calculateDistance(
          current.coords.latitude,
          current.coords.longitude,
          location.latitude,
          location.longitude
        );

        if (distance > maxReportingDistance) {
          Alert.alert(
            "Fuera de rango",
            `Debes estar a menos de ${maxReportingDistance}km del incidente para reportarlo. (Distancia actual: ${distance.toFixed(2)}km)`
          );
          setSubmitting(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Could not verify location for proximity check", err);
    }

    const newAlert: AlertItem = {
      id: `local-${Date.now()}`,
      category,
      lat: location.latitude,
      lng: location.longitude,
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
      status: "active",
      media,
      upvotes: 0,
      downvotes: 0,
      neighborhood: "Culiacán",
      user: currentUser,
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
            title: title.trim() || null,
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
      <GlassView 
        colorScheme={isDark ? "dark" : "light"} 
        glassEffectStyle="regular" 
        tintColor={isDark ? "rgba(0, 224, 255, 0.05)" : "rgba(44, 123, 229, 0.05)"}
        style={styles.header}
      >
        <LinearGradient
          colors={["rgba(255,255,255,0.15)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>Nuevo reporte</Text>
        <View style={styles.headerSpacer} />
      </GlassView>

      <ScrollView contentContainerStyle={styles.container}>
        <GlassView 
          colorScheme={isDark ? "dark" : "light"} 
          glassEffectStyle="regular" 
          style={styles.formGroupGlass}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0.1)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.sectionTitle}>Tipo de alerta *</Text>
          <View style={styles.categoryWrap}>
            {ALERT_CATEGORIES.map((item) => {
              const active = item === category;
              return (
                <Pressable
                  key={item}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setCategory(item)}
                >
                  <Ionicons 
                    name={CATEGORY_ICONS[item] as any} 
                    size={14} 
                    color={active ? theme.colors.text : theme.colors.textMuted} 
                  />
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {CATEGORY_LABELS[item]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Título *</Text>
          <TextInput
            style={styles.textInputSingle}
            placeholder="Ej: Balacera en zona centro"
            placeholderTextColor={theme.colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={100}
          />
        </GlassView>

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
                provider={PROVIDER_GOOGLE}
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

        {media.length > 0 && (
          <View style={styles.mediaRow}>
            {previewMedia.map((item) => (
              <Image key={item.id} source={{ uri: item.url }} style={styles.mediaThumb} />
            ))}
            {media.length > previewMedia.length && (
              <View style={styles.moreMedia}>
                <Text style={styles.moreMediaText}>+{media.length - previewMedia.length}</Text>
              </View>
            )}
          </View>
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

        <Text style={styles.sectionTitle}>Evidencia (Fotos / Video / Voz)</Text>
        <View style={styles.mediaActions}>
          <Pressable style={styles.mediaActionBtn} onPress={handlePickMedia}>
            <Ionicons name="images-outline" size={24} color={theme.colors.text} />
            <Text style={styles.mediaActionText}>Galería</Text>
          </Pressable>
          
          <Pressable 
            style={[styles.mediaActionBtn, isRecording && styles.mediaActionBtnActive]} 
            onLongPress={handleStartRecording}
            onPressOut={() => (isRecording ? handleStopRecording() : null)}
            delayLongPress={100}
          >
            <Ionicons 
              name={isRecording ? "stop-circle" : "mic-outline"} 
              size={24} 
              color={isRecording ? theme.colors.surface : theme.colors.text} 
            />
            <Text style={[styles.mediaActionText, isRecording && styles.mediaActionTextActive]}>
              {isRecording ? "Suelte para grabar" : "Hold para voz"}
            </Text>
          </Pressable>
        </View>

        {media.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaPreviewList}>
            {media.map((item) => (
              <View key={item.id} style={styles.mediaPreviewItem}>
                {item.type === "audio" ? (
                  <View style={styles.audioPreview}>
                    <Ionicons name="mic" size={20} color={theme.colors.accent} />
                  </View>
                ) : (
                  <Image source={{ uri: item.url }} style={styles.mediaPreviewThumb} />
                )}
                <Pressable 
                  style={styles.removeMedia} 
                  onPress={() => setMedia(prev => prev.filter(m => m.id !== item.id))}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.danger} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        )}

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

const createStyles = (theme: any, themeMode: string) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)",
    borderBottomWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
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
    paddingTop: 16,
    gap: 20,
  },
  formGroupGlass: {
    padding: 16,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.surface,
  },
  categoryPillActive: {
    borderColor: theme.colors.reportAction,
    backgroundColor: themeMode === "light" ? "#E3F2FD" : "rgba(0,224,255,0.1)",
  },
  categoryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  categoryTextActive: {
    color: themeMode === "light" ? theme.colors.reportAction : "#00E0FF",
    fontFamily: theme.fonts.heading,
  },
  mapCard: {
    height: 180,
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
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.9)" : "rgba(18,18,18,0.9)",
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
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.9)" : "rgba(18,18,18,0.9)",
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
  textInputSingle: {
    height: 52,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    fontFamily: theme.fonts.body,
  },
  textInput: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.surfaceAlt,
    fontFamily: theme.fonts.body,
    textAlignVertical: "top",
  },
  mediaActions: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  mediaActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    borderRadius: theme.radius.xl,
  },
  mediaActionBtnActive: {
    backgroundColor: theme.colors.danger,
    borderColor: theme.colors.danger,
  },
  mediaActionText: {
    fontSize: 14,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
  },
  mediaActionTextActive: {
    color: theme.colors.surface,
  },
  mediaPreviewList: {
    marginBottom: 10,
  },
  mediaPreviewItem: {
    marginRight: 10,
    position: "relative",
  },
  mediaPreviewThumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
  },
  audioPreview: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.reportAction,
  },
  removeMedia: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: theme.colors.surface,
    borderRadius: 99,
  },
  submitButton: {
    marginTop: 20,
    height: 56,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.reportAction,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: theme.colors.reportAction,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: theme.colors.surface,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    letterSpacing: 1,
  },
});
