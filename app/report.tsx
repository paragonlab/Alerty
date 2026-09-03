import { useEffect, useRef, useState, useMemo } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { ALERT_CATEGORIES, CATEGORY_ICONS, CATEGORY_LABELS, CULIACAN_CENTER } from "../lib/alerty/constants";
import { useAlertyStore } from "../lib/alerty/store";
import { Sounds } from "../lib/sounds";
import { supabase } from "../lib/supabase";
import { uploadMediaBatch } from "../lib/upload";
import type { AlertCategory, AlertMedia } from "../lib/alerty/types";
import { calculateDistance } from "../lib/alerty/utils";
import {
  ReportCaptureViewfinder,
  type ReportCaptureHandle,
} from "../components/ReportCaptureViewfinder";
import type { CaptureResult } from "../components/InAppCamera";

// Categories shown in the 3-column grid (exclude SOS – that's the long-press)
const GRID_CATS = ALERT_CATEGORIES.filter((c) => c !== "sos");

// ── Step indicator (captura → detalles; éxito sin dots) ───────────────────────
function StepDots({ current }: { current: number }) {
  return (
    <View style={S.stepDots}>
      {[1, 2].map((n) => (
        <View
          key={n}
          style={[
            S.stepDot,
            n < current && S.stepDotPlayed,
            n === current && S.stepDotActive,
          ]}
        />
      ))}
    </View>
  );
}

// ── Context chips ─────────────────────────────────────────────────────────────
function ContextChips({ locationLabel }: { locationLabel: string }) {
  return (
    <View style={S.chips}>
      <View style={S.chipLoc}>
        <Ionicons name="location" size={11} color="#6BE0FF" />
        <Text style={S.chipLocText}>{locationLabel.toUpperCase()}</Text>
      </View>
      <View style={S.chipAnon}>
        <Ionicons name="eye-off" size={11} color="#66FF8C" />
        <Text style={S.chipAnonText}>ANÓNIMO</Text>
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addAlert, currentUser, alerts } = useAlertyStore();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [captureMode, setCaptureMode] = useState<"video" | "photo" | "voice">("video");
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [title, setTitle] = useState("");
  const [sourceTag, setSourceTag] = useState<"veo" | "escucho" | "contaron">("veo");
  const [media, setMedia] = useState<AlertMedia[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("Mi ubicación");
  const [submitting, setSubmitting] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveAnims = useRef(Array.from({ length: 18 }, () => new Animated.Value(0.06))).current;
  const waveLoopsRef = useRef<Animated.CompositeAnimation[]>([]);
  const captureRef = useRef<ReportCaptureHandle>(null);

  // Animations
  const shutterPulse = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;
  const successHalo = useRef(new Animated.Value(0)).current;

  // Computed
  const vigias = useMemo(() => Math.max(380, alerts.length * 12 + 200), [alerts.length]);
  const nearbyAlert = useMemo(() => {
    if (!userLocation) return null;
    return (
      alerts.find(
        (a) =>
          a.status === "active" &&
          calculateDistance(userLocation.latitude, userLocation.longitude, a.lat, a.lng) < 0.2,
      ) ?? null
    );
  }, [alerts, userLocation]);

  useEffect(() => {
    void getLocation();
    const shutLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shutterPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shutterPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    shutLoop.start();
    return () => {
      shutLoop.stop();
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      waveLoopsRef.current.forEach((l) => l.stop());
      recording?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (step !== 3) return;
    const scaleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successScale, { toValue: 1.04, duration: 1000, useNativeDriver: true }),
        Animated.timing(successScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successHalo, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(successHalo, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    scaleLoop.start();
    haloLoop.start();
    return () => { scaleLoop.stop(); haloLoop.stop(); };
  }, [step]);

  const shutterScale = shutterPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const haloScale = successHalo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] });
  const haloOpacity = successHalo.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.15, 0] });

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserLocation(coords);
        try {
          const [place] = await Location.reverseGeocodeAsync(coords);
          if (place) {
            setLocationLabel(place.district ?? place.subregion ?? place.city ?? "Mi ubicación");
          }
        } catch {}
      } else {
        setUserLocation({ latitude: CULIACAN_CENTER.latitude, longitude: CULIACAN_CENTER.longitude });
        setLocationLabel("Culiacán");
      }
    } catch {
      setUserLocation({ latitude: CULIACAN_CENTER.latitude, longitude: CULIACAN_CENTER.longitude });
      setLocationLabel("Culiacán");
    }
    setLocationLoading(false);
  }

  async function handleGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Sin acceso a la galería",
        "Necesitamos permiso para adjuntar fotos o videos ya guardados. Puedes activarlo en Ajustes.",
        Platform.OS === "web"
          ? undefined
          : [
              { text: "Cancelar", style: "cancel" },
              { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
            ],
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
      allowsMultipleSelection: Platform.OS !== "web",
      selectionLimit: 4,
    });
    if (result.canceled) return;
    const picked: AlertMedia[] = result.assets.map((a) => ({
      id: a.assetId ?? `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      url: a.uri,
      type: (a.type === "video" ? "video" : "image") as "image" | "video",
    }));
    setMedia((prev) => [...prev, ...picked]);
    if (step === 1) setStep(2);
  }

  function handleInAppCaptured(result: CaptureResult) {
    setMedia((prev) => [
      ...prev,
      {
        id: `cap-${Date.now()}`,
        url: result.uri,
        type: result.type,
      },
    ]);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setStep(2);
  }

  async function handleShutter() {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (captureMode === "voice") {
      if (isRecording) {
        await handleStopRecording();
        setStep(2);
      } else {
        await handleStartRecording();
      }
      return;
    }

    if (captureRef.current?.hasPreview()) return;
    await captureRef.current?.capture();
  }

  function startWave() {
    waveLoopsRef.current.forEach((l) => l.stop());
    waveLoopsRef.current = waveAnims.map((anim, i) => {
      const peak = 0.2 + (i % 5) * 0.14 + (i % 3) * 0.08;
      const dur = 160 + (i * 61) % 340;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: peak, duration: dur, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.06 + (i % 4) * 0.02, duration: Math.round(dur * 0.75), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return loop;
    });
  }

  function stopWave() {
    waveLoopsRef.current.forEach((l) => l.stop());
    waveLoopsRef.current = [];
    waveAnims.forEach((anim) =>
      Animated.timing(anim, { toValue: 0.06, duration: 250, useNativeDriver: true }).start(),
    );
  }

  async function handleStartRecording() {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Sin acceso al micrófono",
          "Necesitamos el micrófono para grabar audio como evidencia.",
          Platform.OS === "web"
            ? undefined
            : [
                { text: "Cancelar", style: "cancel" },
                { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
              ],
        );
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setRecSeconds(0);
      recIntervalRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
      startWave();
    } catch (e) {
      console.error("start recording", e);
      Alert.alert("No se pudo grabar", "Revisa el permiso del micrófono e intenta de nuevo.");
    }
  }

  async function handleStopRecording() {
    if (!recording) return;
    try {
      setIsRecording(false);
      stopWave();
      if (recIntervalRef.current) { clearInterval(recIntervalRef.current); recIntervalRef.current = null; }
      await recording.stopAndUnloadAsync();
      const tmpUri = recording.getURI();
      setRecording(null);
      if (tmpUri) {
        const dest = `${FileSystem.documentDirectory}rec-${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: tmpUri, to: dest });
        setMedia((prev) => [...prev, { id: `audio-${Date.now()}`, url: dest, type: "audio" }]);
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      console.error("stop recording", e);
    }
  }

  async function handleSubmit() {
    if (!category) { Alert.alert("Falta categoría", "Selecciona el tipo de incidente."); return; }
    const coords =
      userLocation ??
      { latitude: CULIACAN_CENTER.latitude, longitude: CULIACAN_CENTER.longitude };
    if (!userLocation) {
      setUserLocation(coords);
    }
    setSubmitting(true);
    const newAlert = {
      id: `local-${Date.now()}`,
      category,
      lat: coords.latitude,
      lng: coords.longitude,
      title: title.trim() || `${CATEGORY_LABELS[category]} · ${locationLabel}`,
      description: `Cómo lo sé: ${sourceTag}`,
      createdAt: new Date().toISOString(),
      status: "active" as const,
      media,
      upvotes: 0,
      downvotes: 0,
      neighborhood: locationLabel,
      user: currentUser,
    };
    addAlert(newAlert as any);
    try {
      if (supabase) {
        const { data: ud } = await supabase.auth.getUser();
        const { data: inserted } = await supabase
          .from("alerts")
          .insert({
            user_id: ud.user?.id,
            category,
            lat: coords.latitude,
            lng: coords.longitude,
            title: newAlert.title,
            description: newAlert.description,
            status: "active",
          })
          .select("id")
          .single();
        if (inserted?.id) {
          const alertId = inserted.id;
          void supabase.functions
            .invoke("notify-on-alert", { body: { type: "alert", alertId } })
            .catch(() => {});
          if (media.length > 0) {
            void (async () => {
              const uploaded = await uploadMediaBatch(media);
              if (uploaded.length > 0 && supabase) {
                await supabase.from("media").insert(
                  uploaded.map((m) => ({
                    alert_id: alertId,
                    media_url: m.url,
                    media_type: m.type,
                  })),
                );
              }
            })().catch(() => {});
          }
        }
      }
    } catch {}
    void Sounds.success();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitting(false);
    setStep(3);
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderStep1() {
    const camRecording = captureRef.current?.isRecording() ?? false;
    const isCapturing = isRecording || camRecording;

    return (
      <>
        <ReportCaptureViewfinder
          ref={captureRef}
          captureMode={captureMode}
          isVoiceRecording={isRecording}
          voiceSeconds={recSeconds}
          onCaptured={handleInAppCaptured}
          voiceContent={
            <View style={S.waveformWrap}>
              {waveAnims.map((anim, i) => (
                <Animated.View key={i} style={[S.wavebar, { transform: [{ scaleY: anim }] }]} />
              ))}
            </View>
          }
        />

        {/* Mode selector */}
        <View style={S.modeRow}>
          {(["video", "photo", "voice"] as const).map((mode) => (
            <Pressable
              key={mode}
              style={[S.modeBtn, captureMode === mode && S.modeBtnActive]}
              onPress={() => {
                if (isCapturing) return;
                setCaptureMode(mode);
              }}
              accessibilityLabel={mode === "video" ? "Modo video" : mode === "photo" ? "Modo foto" : "Modo voz"}
            >
              <Ionicons
                name={mode === "video" ? "videocam" : mode === "photo" ? "camera" : "mic"}
                size={14}
                color={captureMode === mode ? "#fff" : "rgba(255,255,255,0.5)"}
              />
              <Text style={[S.modeBtnText, captureMode === mode && S.modeBtnTextActive]}>
                {mode === "video" ? "VIDEO" : mode === "photo" ? "FOTO" : "VOZ"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Shutter row */}
        <View style={S.shutterRow}>
          <Pressable style={S.shutterSide} onPress={handleGallery} accessibilityLabel="Abrir galería">
            <View style={S.shutterSideBtn}>
              <Ionicons name="images-outline" size={18} color="#fff" />
            </View>
            <Text style={S.shutterSideLabel}>GALERÍA</Text>
          </Pressable>

          <Pressable
            onPress={handleShutter}
            onLongPress={() => {
              if (captureMode === "video" && !captureRef.current?.isRecording()) {
                void captureRef.current?.capture();
              }
            }}
            delayLongPress={280}
            accessibilityLabel={
              captureMode === "photo"
                ? "Tomar foto"
                : captureMode === "voice"
                  ? isRecording
                    ? "Detener grabación"
                    : "Grabar audio"
                  : captureRef.current?.isRecording()
                    ? "Detener video"
                    : "Grabar video"
            }
          >
            <View style={S.shutterRing}>
              <Animated.View
                style={[
                  S.shutterInner,
                  isCapturing && S.shutterInnerRec,
                  captureMode === "video" && !isCapturing && S.shutterInnerVideo,
                  { transform: [{ scale: shutterScale }] },
                ]}
              />
            </View>
          </Pressable>

          <View style={S.shutterSide} />
        </View>

        <Text style={S.captureHint}>
          {Platform.OS === "web"
            ? "En la web usa Galería · la cámara en vivo está en la app"
            : captureMode === "photo"
              ? "Toca para foto · confirma con Usar"
              : captureMode === "video"
                ? "Toca o mantén para grabar · máx. 60 s"
                : isRecording
                  ? "Toca de nuevo para detener"
                  : "Toca para grabar audio"}
        </Text>

        <Pressable style={S.skipBtn} onPress={() => setStep(2)}>
          <Text style={S.skipBtnText}>Continuar sin evidencia</Text>
          <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.35)" />
        </Pressable>
      </>
    );
  }

  function renderStep2() {
    const previewMedia = media[0];
    return (
      <>
        {/* Evidence row */}
        {media.length > 0 ? (
          <View style={S.evidenceRow}>
            <View style={S.evidenceThumb}>
              {previewMedia?.type === "image" ? (
                <Image source={{ uri: previewMedia.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Ionicons
                  name={previewMedia?.type === "audio" ? "mic" : "videocam"}
                  size={16}
                  color="rgba(255,255,255,0.55)"
                />
              )}
              {previewMedia?.type === "video" && (
                <View style={S.evidenceThumbPlay}>
                  <View style={S.evidencePlayTriangle} />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.evidenceLabel}>
                {previewMedia?.type === "audio" ? "Audio" : previewMedia?.type === "video" ? "Video" : "Foto"}
                {media.length > 1 ? ` +${media.length - 1}` : ""}
              </Text>
              <Text style={S.evidenceSub}>Listo · {media.length} archivo{media.length > 1 ? "s" : ""}</Text>
            </View>
            <Pressable style={S.evidenceAdd} onPress={() => setStep(1)} accessibilityLabel="Agregar más evidencia">
              <Ionicons name="add" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        ) : (
          <Pressable style={[S.evidenceRow, { justifyContent: "center", gap: 8 }]} onPress={() => setStep(1)}>
            <Ionicons name="camera-outline" size={18} color="rgba(255,255,255,0.35)" />
            <Text style={S.evidenceSub}>Toca para agregar evidencia</Text>
          </Pressable>
        )}

        <Text style={S.sheetLabel}>¿Qué está pasando?</Text>

        <View style={S.catGrid}>
          {GRID_CATS.map((cat) => (
            <Pressable
              key={cat}
              style={[S.catCell, category === cat && S.catCellActive]}
              onPress={() => { void Haptics.selectionAsync(); setCategory(cat); }}
            >
              <Ionicons
                name={(CATEGORY_ICONS[cat] ?? "alert-circle") as any}
                size={18}
                color={category === cat ? "#FF6060" : "rgba(255,255,255,0.65)"}
              />
              <Text style={[S.catLabel, category === cat && S.catLabelActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          style={S.titleInput}
          placeholder={category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Describe brevemente lo que pasa..."}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          selectionColor="#FF6B3A"
        />

        <Text style={S.sheetLabel}>Cómo sabes</Text>
        <View style={S.tagRow}>
          {([
            ["veo", "eye", "Lo veo"],
            ["escucho", "ear-outline", "Lo escucho"],
            ["contaron", "chatbubble-outline", "Me contaron"],
          ] as const).map(([val, icon, label]) => (
            <Pressable
              key={val}
              style={[S.tag, sourceTag === val && S.tagActive]}
              onPress={() => setSourceTag(val)}
            >
              <Ionicons name={icon as any} size={11} color={sourceTag === val ? "#6BE0FF" : "rgba(255,255,255,0.55)"} />
              <Text style={[S.tagText, sourceTag === val && S.tagTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={S.trustBlock}>
          <Ionicons name="shield-checkmark" size={18} color="#66FF8C" />
          <View style={{ flex: 1 }}>
            <Text style={S.trustText}>
              {userLocation ? "Tu reporte usa tu ubicación actual." : "Se usará Culiacán como referencia."}
            </Text>
            <Text style={S.trustSub}>Identidad anónima · sin metadatos personales.</Text>
          </View>
        </View>
      </>
    );
  }

  function renderStep3() {
    const displayTitle = title.trim() || (category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Sin título");

    return (
      <>
        <View style={S.successWrap}>
          <Animated.View
            pointerEvents="none"
            style={[S.successHaloRing, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
          />
          <Animated.View style={[S.successMark, { transform: [{ scale: successScale }] }]}>
            <Ionicons name="checkmark" size={38} color="#001a07" />
          </Animated.View>
          <Text style={S.successTitle}>{vigias.toLocaleString()} vigías ya lo están viendo.</Text>
          <Text style={S.successSub}>
            Tu alerta llegó a {locationLabel}. Recibirás notificaciones cuando confirmen o desmientan.
          </Text>
        </View>

        <View style={S.previewCard}>
          <View style={S.previewHead}>
            {media[0]?.type === "image" ? (
              <Image source={{ uri: media[0].url }} style={S.previewThumb} resizeMode="cover" />
            ) : (
              <View style={S.previewThumb}>
                <Ionicons
                  name={media[0]?.type === "video" ? "videocam" : media[0]?.type === "audio" ? "mic" : "alert-circle"}
                  size={18}
                  color="rgba(255,255,255,0.4)"
                  style={{ alignSelf: "center", marginTop: 26 }}
                />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <View style={S.previewCat}>
                <Ionicons name={(category ? CATEGORY_ICONS[category] : "alert-circle") as any} size={10} color="#FF6060" />
                <Text style={S.previewCatText}>{category ? CATEGORY_LABELS[category].toUpperCase() : "INCIDENTE"}</Text>
              </View>
              <Text style={S.previewTitle} numberOfLines={2}>{displayTitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="shield-checkmark" size={11} color="#66FF8C" />
                <Text style={[S.previewMeta, { color: "#66FF8C", fontWeight: "700" }]}>0/8 confirmaciones</Text>
                <Text style={S.previewMeta}>· ahora</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={S.successActions}>
          <Pressable style={S.successActionSec} onPress={() => router.replace("/(tabs)/")}>
            <Ionicons name="map" size={14} color="#fff" />
            <Text style={S.successActionSecText}>Ver en mapa</Text>
          </Pressable>
          <Pressable style={S.successActionPri} onPress={() => router.back()}>
            <Ionicons name="eye-outline" size={14} color="#fff" />
            <Text style={S.successActionPriText}>Seguir alerta</Text>
          </Pressable>
        </View>
      </>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  const isStep3 = step === 3;

  if (locationLoading) {
    return (
      <View style={[S.root, { alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 32 }]}>
        <LinearGradient colors={["rgba(40,15,8,0.92)", "rgba(0,0,0,0.97)"]} style={StyleSheet.absoluteFill} />
        <View style={S.locLoadingIcon}>
          <Ionicons name="location" size={30} color="#6BE0FF" />
        </View>
        <Text style={S.locLoadingTitle}>OBTENIENDO UBICACIÓN</Text>
        <Text style={S.locLoadingSub}>
          Necesitamos saber dónde ocurre el incidente para que tu reporte llegue a las personas correctas.
        </Text>
        <Pressable
          style={S.locSkipBtn}
          onPress={() => {
            if (!userLocation) {
              setUserLocation({
                latitude: CULIACAN_CENTER.latitude,
                longitude: CULIACAN_CENTER.longitude,
              });
              setLocationLabel("Culiacán");
            }
            setLocationLoading(false);
          }}
        >
          <Text style={S.locSkipText}>Continuar sin GPS</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={S.root}>
      {/* Dark blurred backdrop */}
      <LinearGradient
        colors={["rgba(40,15,8,0.92)", "rgba(0,0,0,0.97)"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Nearby alert context widget */}
      {nearbyAlert && !isStep3 && (
        <SafeAreaView style={S.safeTop} edges={["top"]}>
          <Pressable
            style={({ pressed }) => [S.nearbyWidget, pressed && S.nearbyWidgetPressed]}
            onPress={() => router.push(`/alert/${nearbyAlert.id}` as any)}
          >
            <View style={S.nearbyDot}>
              <Ionicons
                name={(CATEGORY_ICONS[nearbyAlert.category] ?? "alert-circle") as any}
                size={18}
                color="#FF6060"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.nearbyTag}>ALERTA ABIERTA · CERCA</Text>
              <Text style={S.nearbyTitle} numberOfLines={1}>
                {CATEGORY_LABELS[nearbyAlert.category]} · {nearbyAlert.neighborhood ?? locationLabel}
              </Text>
            </View>
            <View style={S.nearbyAportarBtn}>
              <Text style={S.nearbyAportar}>APORTAR</Text>
              <Ionicons name="chevron-forward" size={11} color="#66FF8C" />
            </View>
          </Pressable>
        </SafeAreaView>
      )}

      {/* Sheet — deja espacio arriba para no encimarse con el widget de alerta cercana */}
      <SafeAreaView
        style={[
          S.safeSheet,
          nearbyAlert && !isStep3 && { paddingTop: insets.top + 78 },
        ]}
        edges={["bottom"]}
      >
        <View style={S.sheet}>
          {/* Handle */}
          <View style={S.handle} />

          {/* Head */}
          {isStep3 ? (
            <View style={S.sheetHead}>
              <Text style={S.sheetTitle}>Reporte enviado</Text>
              <View style={S.chipAnon}>
                <Ionicons name="eye-off" size={11} color="#66FF8C" />
                <Text style={S.chipAnonText}>ANÓNIMO</Text>
              </View>
            </View>
          ) : (
            <View style={S.sheetHead}>
              <Text style={S.sheetTitle}>{step === 2 ? "Detalles" : "Reportar"}</Text>
              <StepDots current={step} />
              <Pressable style={S.closeBtn} onPress={() => router.back()} hitSlop={8}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* Location chips (steps 1–2) */}
          {step <= 2 && <ContextChips locationLabel={locationLabel} />}

          {/* Step content */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={S.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </ScrollView>

          {/* CTA — step 2 envía directo (sin paso de revisión) */}
          {step === 2 && (
            <View style={S.ctaWrap}>
              <Pressable
                style={[S.cta, (!category || submitting) && S.ctaDisabled]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                <LinearGradient
                  colors={["#FF6B3A", "#E84F1F"]}
                  style={StyleSheet.absoluteFill}
                />
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text style={S.ctaText}>{submitting ? "ENVIANDO..." : "ENVIAR ALERTA"}</Text>
              </Pressable>
              <Text style={S.ctaHelper}>Tu identidad permanece anónima · 0 metadatos personales</Text>
            </View>
          )}
        </View>
      </SafeAreaView>

    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#050202" },

  // Location loading screen
  locLoadingIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(0,224,255,0.1)",
    borderWidth: 1, borderColor: "rgba(0,224,255,0.35)",
    alignItems: "center", justifyContent: "center",
  },
  locLoadingTitle: {
    fontSize: 13, fontWeight: "700", letterSpacing: 2,
    color: "#6BE0FF", fontFamily: "SpaceGrotesk_700Bold",
  },
  locLoadingSub: {
    fontSize: 13, color: "rgba(255,255,255,0.4)", textAlign: "center",
    lineHeight: 19, fontFamily: "SpaceGrotesk_500Medium",
  },
  locSkipBtn: {
    marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  locSkipText: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "SpaceGrotesk_500Medium" },
  safeTop: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 },
  safeSheet: { flex: 1, justifyContent: "flex-end" },

  // Nearby widget
  nearbyWidget: {
    flexDirection: "row", alignItems: "center", gap: 10,
    margin: 14, marginTop: 8,
    padding: 10, paddingHorizontal: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  nearbyWidgetPressed: { opacity: 0.7 },
  nearbyDot: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1a0c05",
    borderWidth: 1, borderColor: "rgba(255,96,96,0.3)",
    alignItems: "center", justifyContent: "center",
  },
  nearbyTag: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, color: "#FF6060" },
  nearbyTitle: { fontSize: 12, fontWeight: "700", color: "#fff" },
  nearbyAportarBtn: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(102,255,140,0.12)",
    borderWidth: 1, borderColor: "rgba(102,255,140,0.3)",
  },
  nearbyAportar: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#66FF8C" },

  // Sheet
  sheet: {
    backgroundColor: "#0F0B08",
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    borderTopWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 14, paddingBottom: 8,
    flex: 1, maxHeight: "93%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -24 }, shadowOpacity: 0.7, shadowRadius: 20,
    elevation: 30,
  },
  handle: {
    width: 44, height: 5, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center", marginVertical: 10,
  },
  sheetHead: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2, marginBottom: 10,
  },
  sheetTitle: {
    fontSize: 17, fontWeight: "700", letterSpacing: -0.3, color: "#fff", fontFamily: "SpaceGrotesk_700Bold",
  },
  closeBtn: {
    width: 28, height: 28, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  stepDots: { flexDirection: "row", gap: 4, marginLeft: "auto" },
  stepDot: { width: 18, height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.15)" },
  stepDotActive: { backgroundColor: "#FF4500", shadowColor: "#FF4500", shadowOpacity: 0.5, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  stepDotPlayed: { backgroundColor: "rgba(255,107,58,0.5)" },

  // Chips
  chips: { flexDirection: "row", gap: 6, marginBottom: 10 },
  chipLoc: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999, fontSize: 10,
    backgroundColor: "rgba(0,224,255,0.14)",
    borderWidth: 1, borderColor: "rgba(0,224,255,0.4)",
  },
  chipLocText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#6BE0FF", fontFamily: "SpaceGrotesk_700Bold" },
  chipAnon: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0,255,65,0.16)",
    borderWidth: 1, borderColor: "rgba(0,255,65,0.4)",
  },
  chipAnonText: { fontSize: 10, fontWeight: "700", letterSpacing: 1, color: "#66FF8C", fontFamily: "SpaceGrotesk_700Bold" },

  scrollContent: { gap: 12, paddingBottom: 8 },

  // Mode selector
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999, padding: 3, alignSelf: "center",
  },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 16, paddingVertical: 10,
    minHeight: 40,
    borderRadius: 999,
  },
  modeBtnActive: {
    backgroundColor: "#FF4500",
    shadowColor: "#FF4500", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  modeBtnText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.5)", fontFamily: "SpaceGrotesk_700Bold" },
  modeBtnTextActive: { color: "#fff" },

  // Shutter row
  shutterRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 6, paddingTop: 4,
  },
  shutterSide: { alignItems: "center", gap: 4, flex: 1 },
  shutterSideBtn: {
    width: 44, height: 44, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  shutterSideLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)", fontFamily: "SpaceGrotesk_700Bold" },
  shutterRing: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 3, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  shutterInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#FF0000",
    shadowColor: "#FF0000", shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  shutterInnerVideo: { backgroundColor: "#FF3030" },
  shutterInnerRec: { width: 28, height: 28, borderRadius: 6, backgroundColor: "#FF6060" },
  captureHint: {
    textAlign: "center",
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    fontFamily: "SpaceGrotesk_500Medium",
    paddingHorizontal: 12,
  },
  skipBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "center", paddingVertical: 10, minHeight: 40,
  },
  skipBtnText: { fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "SpaceGrotesk_500Medium" },

  // Evidence row (step 2)
  evidenceRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  evidenceThumb: {
    width: 44, height: 56, borderRadius: 8,
    backgroundColor: "#1a0c05",
    alignItems: "center", justifyContent: "center",
    flexShrink: 0, overflow: "hidden",
  },
  evidenceThumbPlay: { position: "absolute" },
  evidencePlayTriangle: {
    width: 0, height: 0,
    borderLeftWidth: 8, borderTopWidth: 5, borderBottomWidth: 5,
    borderLeftColor: "#fff", borderTopColor: "transparent", borderBottomColor: "transparent",
  },
  evidenceLabel: { fontSize: 12, fontWeight: "700", color: "#fff", fontFamily: "SpaceGrotesk_700Bold" },
  evidenceSub: { fontSize: 10.5, color: "rgba(255,255,255,0.6)", marginTop: 2, fontFamily: "SpaceGrotesk_500Medium" },
  evidenceAdd: {
    width: 36, height: 56, borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },

  // Label
  sheetLabel: {
    fontSize: 9, fontWeight: "800", letterSpacing: 1.8,
    color: "rgba(255,255,255,0.5)", textTransform: "uppercase",
    fontFamily: "SpaceGrotesk_700Bold", marginTop: 4,
  },

  // Category grid
  catGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catCell: {
    width: "31.5%", alignItems: "center", gap: 4,
    paddingVertical: 12, paddingHorizontal: 4,
    minHeight: 64,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
  },
  catCellActive: {
    backgroundColor: "rgba(255,0,0,0.16)",
    borderColor: "rgba(255,0,0,0.5)",
    shadowColor: "#FF0000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  catLabel: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.4, color: "rgba(255,255,255,0.65)", textAlign: "center", fontFamily: "SpaceGrotesk_700Bold" },
  catLabelActive: { color: "#FF6060" },

  // Title input
  titleInput: {
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontSize: 13, color: "#fff",
    fontFamily: "SpaceGrotesk_500Medium",
  },

  // Source tags
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  tagActive: {
    backgroundColor: "rgba(0,224,255,0.14)",
    borderColor: "rgba(0,224,255,0.5)",
  },
  tagText: { fontSize: 10.5, fontWeight: "700", color: "rgba(255,255,255,0.6)", fontFamily: "SpaceGrotesk_700Bold" },
  tagTextActive: { color: "#6BE0FF" },

  // Preview card (éxito)
  previewCard: {
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
  },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  previewThumb: {
    width: 56, height: 70, borderRadius: 10, flexShrink: 0,
    backgroundColor: "#1a0c05",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  previewCat: {
    flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start",
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
    backgroundColor: "rgba(255,0,0,0.2)", borderWidth: 1, borderColor: "rgba(255,0,0,0.5)",
  },
  previewCatText: { fontSize: 9.5, fontWeight: "700", letterSpacing: 0.4, color: "#FF6060", fontFamily: "SpaceGrotesk_700Bold" },
  previewTitle: { fontSize: 13, fontWeight: "700", color: "#fff", letterSpacing: -0.1, lineHeight: 18, fontFamily: "SpaceGrotesk_700Bold" },
  previewMeta: { fontSize: 10.5, color: "rgba(255,255,255,0.6)", fontFamily: "SpaceGrotesk_500Medium" },

  // Trust block
  trustBlock: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 10, paddingHorizontal: 12,
    backgroundColor: "rgba(0,255,65,0.06)",
    borderWidth: 1, borderColor: "rgba(0,255,65,0.25)",
    borderRadius: 12,
  },
  trustText: { fontSize: 11, color: "rgba(0,255,65,0.85)", fontFamily: "SpaceGrotesk_700Bold" },
  trustSub: { fontSize: 10, color: "rgba(0,255,65,0.65)", marginTop: 1, fontFamily: "SpaceGrotesk_500Medium" },

  // CTA
  ctaWrap: { paddingTop: 8, paddingBottom: 4, gap: 6 },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 16, minHeight: 52, borderRadius: 14, overflow: "hidden",
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 13, fontWeight: "800", letterSpacing: 1.6, color: "#fff", fontFamily: "SpaceGrotesk_700Bold" },
  ctaHelper: { textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "SpaceGrotesk_500Medium" },

  // Success (step 4)
  successWrap: { alignItems: "center", gap: 14, paddingVertical: 16, paddingHorizontal: 12 },
  successHaloRing: {
    position: "absolute",
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 2, borderColor: "rgba(0,255,65,0.5)",
  },
  successMark: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: "#00FF41",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#00FF41", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  successTitle: { fontSize: 22, fontWeight: "700", color: "#fff", textAlign: "center", letterSpacing: -0.4, fontFamily: "SpaceGrotesk_700Bold" },
  successSub: { fontSize: 12.5, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 18, fontFamily: "SpaceGrotesk_500Medium" },
  successActions: { flexDirection: "row", gap: 8 },
  successActionSec: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    padding: 12, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  successActionSecText: { fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 1, fontFamily: "SpaceGrotesk_700Bold" },
  successActionPri: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    padding: 12, borderRadius: 12,
    backgroundColor: "#FF4500",
  },
  successActionPriText: { fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 1, fontFamily: "SpaceGrotesk_700Bold" },

  // Audio waveform
  waveformWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 20,
    height: 72,
  },
  wavebar: {
    width: 3,
    height: 64,
    borderRadius: 2,
    backgroundColor: "#FF4500",
    shadowColor: "#FF4500",
    shadowOpacity: 0.6,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
});
