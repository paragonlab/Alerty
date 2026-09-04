import { useEffect, useRef, useState, useMemo, type ReactNode } from "react";
import {
  Alert,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  Share,
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

// Categories shown in the 3-column grid (exclude SOS – that's the long-press)
const GRID_CATS = ALERT_CATEGORIES.filter((c) => c !== "sos");

function mapCommunityGuess(guess?: string | null): AlertCategory | null {
  if (!guess) return null;
  return (ALERT_CATEGORIES as readonly string[]).includes(guess)
    ? (guess as AlertCategory)
    : null;
}

const SUBMIT_AUTH_TIMEOUT_MS = 8_000;
const SUBMIT_INSERT_TIMEOUT_MS = 12_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Tiempo de espera agotado al ${label}. Revisa tu conexión.`));
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Cede un par de frames para que React pinte ENVIANDO... antes del await de red. */
function yieldToPaint(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    } else {
      setTimeout(resolve, 32);
    }
  });
}

/**
 * CTA del flujo Reportar.
 * En web usamos <button> nativo: Pressable + LinearGradient absoluteFill a veces
 * traga el tap en iPhone Safari (sobre todo cerca del chrome inferior).
 */
function ReportCta({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  const gradient = (
    <LinearGradient
      colors={["#FF6B3A", "#E84F1F"]}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );

  if (Platform.OS === "web") {
    return (
      // Native <button> keeps iOS Safari clicks reliable near the browser chrome.
      <button
        type="button"
        disabled={Boolean(disabled)}
        aria-busy={disabled || undefined}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) onPress();
        }}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
          boxSizing: "border-box",
          padding: 16,
          border: "none",
          borderRadius: 14,
          overflow: "hidden",
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.5 : 1,
          background: "transparent",
          appearance: "none",
          WebkitAppearance: "none",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
          font: "inherit",
          color: "inherit",
          margin: 0,
          zIndex: 2,
          minHeight: 52,
        }}
      >
        {gradient}
        {children}
      </button>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={[S.cta, disabled && S.ctaDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      {gradient}
      {children}
    </Pressable>
  );
}

// ── Step indicator (captura → detalles; el envío salta la revisión vacía) ─────
function StepDots({ current, total = 2 }: { current: number; total?: number }) {
  return (
    <View style={S.stepDots}>
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
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
  const { addAlert, currentUser, alerts, pendingCommunityConfirm, setPendingCommunityConfirm } =
    useAlertyStore();

  // Web: categoría primero (cámara/galería limitadas). Nativo: captura → detalles → enviado.
  const [step, setStep] = useState<1 | 2 | 3 | 4>(Platform.OS === "web" ? 2 : 1);
  const [captureMode, setCaptureMode] = useState<"video" | "photo" | "voice">("video");
  const [category, setCategory] = useState<AlertCategory | null>(null);
  const [title, setTitle] = useState("");
  const [sourceTag, setSourceTag] = useState<"veo" | "escucho" | "contaron">("veo");
  const [media, setMedia] = useState<AlertMedia[]>([]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [usingFallbackLocation, setUsingFallbackLocation] = useState(false);
  const [locationLabel, setLocationLabel] = useState("Mi ubicación");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef = useRef(false);
  const waveAnims = useRef(Array.from({ length: 18 }, () => new Animated.Value(0.06))).current;
  const waveLoopsRef = useRef<Animated.CompositeAnimation[]>([]);

  // Prefill best-effort desde "Confirmar en Pulso" (post comunidad / noticia).
  useEffect(() => {
    if (!pendingCommunityConfirm) return;
    const mapped = mapCommunityGuess(pendingCommunityConfirm.categoryGuess);
    if (mapped) setCategory(mapped);
    if (pendingCommunityConfirm.text) {
      setTitle(pendingCommunityConfirm.text.slice(0, 120));
    }
    if (pendingCommunityConfirm.placeLabel) {
      setLocationLabel(pendingCommunityConfirm.placeLabel);
    }
    setSourceTag("contaron");
    setStep(2);
    setPendingCommunityConfirm(null);
  }, [pendingCommunityConfirm, setPendingCommunityConfirm]);

  // Animations
  const recDotAnim = useRef(new Animated.Value(1)).current;
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
    const recLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(recDotAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        Animated.timing(recDotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    const shutLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shutterPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(shutterPulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    recLoop.start();
    shutLoop.start();
    return () => {
      recLoop.stop();
      shutLoop.stop();
      if (recIntervalRef.current) clearInterval(recIntervalRef.current);
      waveLoopsRef.current.forEach((l) => l.stop());
      recording?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (step !== 4) return;
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

  function applyCuliacanFallback() {
    setUserLocation({
      latitude: CULIACAN_CENTER.latitude,
      longitude: CULIACAN_CENTER.longitude,
    });
    setUsingFallbackLocation(true);
    setLocationLabel("Culiacán (sin GPS)");
  }

  /** En web Alert.alert suele ser fácil de pasar por alto; también mostramos el error en la UI. */
  function notifyUser(title: string, message: string) {
    setFormError(`${title}: ${message}`);
    if (Platform.OS !== "web") {
      Alert.alert(title, message);
    }
  }

  async function handleShareSent() {
    const displayTitle =
      title.trim() || (category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Alerta");
    const shareUrl = "https://alerty-two.vercel.app";
    const message = `🚨 Alerta en Pulso: ${displayTitle}\n📍 ${locationLabel}\n\nYa la ven ~${vigias.toLocaleString()} vigías. Ábrela en el mapa: ${shareUrl}`;
    try {
      await Share.share(
        Platform.OS === "web"
          ? { message, title: "Alerta en Pulso", url: shareUrl }
          : { message },
      );
    } catch {
      /* usuario canceló */
    }
  }

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
        setUserLocation(coords);
        setUsingFallbackLocation(false);
        try {
          const [place] = await Location.reverseGeocodeAsync(coords);
          if (place) {
            setLocationLabel(place.district ?? place.subregion ?? place.city ?? "Mi ubicación");
          }
        } catch {}
        setLocationLoading(false);
        return;
      }
    } catch {}
    applyCuliacanFallback();
    setLocationLoading(false);
  }

  async function handleGallery() {
    if (Platform.OS === "web") return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permiso requerido", "Necesitamos acceso a tu galería."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.8,
    });
    if (result.canceled) return;
    const picked: AlertMedia[] = result.assets.map((a) => ({
      id: a.assetId ?? `local-${Date.now()}`,
      url: a.uri,
      type: (a.type === "video" ? "video" : "image") as "image" | "video",
    }));
    setMedia((prev) => [...prev, ...picked]);
    if (step === 1) setStep(2);
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

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Necesitamos acceso a la cámara para capturar evidencia.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: captureMode === "video" ? "videos" : "images",
        quality: 0.85,
        videoMaxDuration: 60,
      });
      if (!result.canceled) {
        const picked: AlertMedia[] = result.assets.map((a) => ({
          id: `cap-${Date.now()}`,
          url: a.uri,
          type: (a.type === "video" ? "video" : "image") as "image" | "video",
        }));
        setMedia((prev) => [...prev, ...picked]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (step === 1) setStep(2);
      }
    } catch {
      await handleGallery();
    }
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
      if (status !== "granted") { Alert.alert("Permiso", "Necesitamos el micrófono para grabar."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      setRecording(rec);
      setIsRecording(true);
      setRecSeconds(0);
      recIntervalRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
      startWave();
    } catch (e) {
      console.error("start recording", e);
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
    if (submittingRef.current) return;
    setFormError(null);
    if (!category) {
      notifyUser("Falta categoría", "Elige el tipo de incidente para publicar.");
      return;
    }
    const coords = userLocation ?? {
      latitude: CULIACAN_CENTER.latitude,
      longitude: CULIACAN_CENTER.longitude,
    };
    const placeLabel = userLocation ? locationLabel : "Culiacán (sin GPS)";
    if (!userLocation) {
      applyCuliacanFallback();
    }

    submittingRef.current = true;
    setSubmitting(true);
    // Pintar ENVIANDO... antes de cualquier red (iOS Safari a veces no muestra el estado si el await empieza al instante).
    await yieldToPaint();

    const newAlert = {
      id: `local-${Date.now()}`,
      category,
      lat: coords.latitude,
      lng: coords.longitude,
      title: title.trim() || `${CATEGORY_LABELS[category]} · ${placeLabel}`,
      description: `Cómo lo sé: ${sourceTag}`,
      createdAt: new Date().toISOString(),
      status: "active" as const,
      media,
      upvotes: 0,
      downvotes: 0,
      neighborhood: placeLabel,
      user: currentUser,
    };

    let savedLocally = false;
    try {
      addAlert(newAlert as any);
      savedLocally = true;
    } catch (err) {
      submittingRef.current = false;
      setSubmitting(false);
      const detail =
        err && typeof err === "object" && "message" in err && typeof (err as { message: unknown }).message === "string"
          ? (err as { message: string }).message
          : "Intenta de nuevo en unos segundos.";
      notifyUser("No se pudo enviar la alerta", detail);
      return;
    }

    // Red: no bloquear el éxito local. Timeouts evitan botones “muertos” si Safari cuelga auth/insert.
    if (supabase) {
      try {
        const { data: ud } = await withTimeout(
          supabase.auth.getUser(),
          SUBMIT_AUTH_TIMEOUT_MS,
          "verificar sesión",
        );
        const { data: inserted, error: insertError } = await withTimeout(
          supabase
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
            .single(),
          SUBMIT_INSERT_TIMEOUT_MS,
          "guardar en la red",
        );
        if (insertError) {
          console.warn("supabase alert insert failed", insertError);
        } else if (inserted?.id) {
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
      } catch (netErr) {
        console.warn("supabase submit skipped after local save", netErr);
      }
    }

    try {
      void Sounds.success();
    } catch {}
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    submittingRef.current = false;
    setSubmitting(false);
    if (savedLocally) {
      setStep(4);
    } else {
      notifyUser("No se pudo enviar la alerta", "Intenta de nuevo en unos segundos.");
    }
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderStep1() {
    const isCapturing = isRecording;
    const timer = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;

    return (
      <>
        {/* Viewfinder */}
        <View style={S.viewfinder}>
          <View style={[S.corner, S.cornerTL]} />
          <View style={[S.corner, S.cornerTR]} />
          <View style={[S.corner, S.cornerBL]} />
          <View style={[S.corner, S.cornerBR]} />
          <View style={[S.recChip, isCapturing && S.recChipActive]}>
            {isCapturing && <Animated.View style={[S.recDot, { opacity: recDotAnim }]} />}
            <Text style={S.recText}>{isCapturing ? "REC" : captureMode === "video" ? "VIDEO" : captureMode === "photo" ? "FOTO" : "VOZ"}</Text>
          </View>
          {isCapturing && (
            <View style={S.vfTimer}>
              <Text style={S.vfTimerText}>{timer}</Text>
            </View>
          )}
          {captureMode === "voice" && isRecording ? (
            <View style={S.waveformWrap}>
              {waveAnims.map((anim, i) => (
                <Animated.View key={i} style={[S.wavebar, { transform: [{ scaleY: anim }] }]} />
              ))}
            </View>
          ) : (
            <View style={S.vfHint}>
              <Ionicons
                name={captureMode === "video" ? "videocam" : captureMode === "photo" ? "camera" : "mic"}
                size={32}
                color="rgba(255,255,255,0.25)"
              />
            </View>
          )}
        </View>

        {/* Mode selector */}
        <View style={S.modeRow}>
          {(["video", "photo", "voice"] as const).map((mode) => (
            <Pressable
              key={mode}
              style={[S.modeBtn, captureMode === mode && S.modeBtnActive]}
              onPress={() => setCaptureMode(mode)}
            >
              <Ionicons
                name={mode === "video" ? "videocam" : mode === "photo" ? "camera" : "mic"}
                size={13}
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
          <Pressable style={S.shutterSide} onPress={handleGallery}>
            <View style={S.shutterSideBtn}>
              <Ionicons name="images-outline" size={16} color="#fff" />
            </View>
            <Text style={S.shutterSideLabel}>GALERÍA</Text>
          </Pressable>

          <Pressable onPress={handleShutter}>
            <View style={S.shutterRing}>
              <Animated.View
                style={[
                  S.shutterInner,
                  isCapturing && S.shutterInnerRec,
                  { transform: [{ scale: shutterScale }] },
                ]}
              />
            </View>
          </Pressable>

          <View style={S.shutterSide} />
        </View>

        <Pressable style={S.skipBtn} onPress={() => setStep(2)}>
          <Text style={S.skipBtnText}>Continuar sin evidencia · más rápido</Text>
          <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.45)" />
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
              <Ionicons name={previewMedia?.type === "audio" ? "mic" : previewMedia?.type === "video" ? "videocam" : "image"} size={14} color="rgba(255,255,255,0.5)" style={{ position: "absolute" }} />
              <View style={S.evidenceThumbPlay}>
                <View style={S.evidencePlayTriangle} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={S.evidenceLabel}>
                {previewMedia?.type === "audio" ? "Audio" : previewMedia?.type === "video" ? "Video" : "Foto"}
                {media.length > 1 ? ` +${media.length - 1}` : ""}
              </Text>
              <Text style={S.evidenceSub}>Listo · {media.length} archivo{media.length > 1 ? "s" : ""}</Text>
            </View>
            {Platform.OS !== "web" && (
              <Pressable style={S.evidenceAdd} onPress={handleGallery}>
                <Ionicons name="add" size={16} color="rgba(255,255,255,0.6)" />
              </Pressable>
            )}
          </View>
        ) : Platform.OS === "web" ? (
          <View style={[S.evidenceRow, { justifyContent: "center", gap: 8 }]}>
            <Ionicons name="phone-portrait-outline" size={18} color="rgba(255,255,255,0.35)" />
            <Text style={S.evidenceSub}>Evidencia con foto/video: usa la app móvil</Text>
          </View>
        ) : (
          <Pressable style={[S.evidenceRow, { justifyContent: "center", gap: 8 }]} onPress={() => setStep(1)}>
            <Ionicons name="camera-outline" size={18} color="rgba(255,255,255,0.35)" />
            <Text style={S.evidenceSub}>Opcional: toca para agregar evidencia</Text>
          </Pressable>
        )}

        {/* Category label */}
        <Text style={S.sheetLabel}>¿Qué está pasando?</Text>
        <Text style={S.sheetHint}>Elige una categoría para publicar. El título es opcional.</Text>

        {/* Category grid */}
        <View style={S.catGrid}>
          {GRID_CATS.map((cat) => (
            <Pressable
              key={cat}
              style={[S.catCell, category === cat && S.catCellActive]}
              onPress={() => { void Haptics.selectionAsync(); setCategory(cat); setFormError(null); }}
            >
              <Ionicons
                name={(CATEGORY_ICONS[cat] ?? "alert-circle") as any}
                size={20}
                color={category === cat ? "#FF6060" : "rgba(255,255,255,0.65)"}
              />
              <Text style={[S.catLabel, category === cat && S.catLabelActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Title input */}
        <TextInput
          style={S.titleInput}
          placeholder={category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Describe brevemente (opcional)…"}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          selectionColor="#FF6B3A"
        />

        {/* Source tag */}
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

        {/* Compact social payoff preview (reemplaza el paso de revisión) */}
        <View style={S.reachHint}>
          <Ionicons name="people-outline" size={16} color="#6BE0FF" />
          <Text style={S.reachHintText}>
            Tu alerta llegará a ~{vigias.toLocaleString()} vigías cerca de {locationLabel}.
          </Text>
        </View>
      </>
    );
  }

  function renderStep3() {
    const displayTitle = title.trim() || (category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Sin título");
    const isNearby = Boolean(userLocation) && !usingFallbackLocation;

    return (
      <>
        <Text style={S.sheetLabel}>Así se verá en la red</Text>

        {/* Preview card */}
        <View style={S.previewCard}>
          <View style={S.previewHead}>
            <View style={S.previewThumb} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={S.previewCat}>
                <Ionicons name={(category ? CATEGORY_ICONS[category] : "alert-circle") as any} size={10} color="#FF6060" />
                <Text style={S.previewCatText}>{category ? CATEGORY_LABELS[category].toUpperCase() : "INCIDENTE"}</Text>
              </View>
              <Text style={S.previewTitle} numberOfLines={2}>{displayTitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.55)" />
                <Text style={S.previewMeta}>{locationLabel} · Ahora</Text>
              </View>
            </View>
          </View>
        </View>

        {usingFallbackLocation && (
          <View style={S.fallbackBanner}>
            <Ionicons name="navigate-outline" size={16} color="#6BE0FF" />
            <View style={{ flex: 1 }}>
              <Text style={S.fallbackBannerText}>
                Sin GPS: la alerta se publicará en el centro de Culiacán.
              </Text>
            </View>
          </View>
        )}

        <Text style={S.sheetLabel}>Distribución</Text>

        {/* Distribution cells */}
        <View style={S.distRow}>
          <View style={S.distCell}>
            <Text style={S.distNum}>{vigias.toLocaleString()}</Text>
            <Text style={S.distLabel}>VIGÍAS A 5 KM</Text>
          </View>
          <View style={S.distCell}>
            <Text style={S.distNum}>8</Text>
            <Text style={S.distLabel}>CONF. PARA VERIFICAR</Text>
          </View>
        </View>

        {/* Geo trust bonus */}
        {isNearby && (
          <View style={S.trustBlock}>
            <Ionicons name="shield-checkmark" size={18} color="#66FF8C" />
            <View style={{ flex: 1 }}>
              <Text style={S.trustText}>
                Estás en el lugar del evento.
              </Text>
              <Text style={S.trustSub}>Tu reporte pesa 5× en confirmaciones cercanas.</Text>
            </View>
          </View>
        )}
      </>
    );
  }

  function renderStep4() {
    const displayTitle = title.trim() || (category ? `${CATEGORY_LABELS[category]} · ${locationLabel}` : "Sin título");

    return (
      <>
        {/* Success mark */}
        <View style={S.successWrap}>
          {/* Halo ring */}
          <Animated.View
            pointerEvents="none"
            style={[S.successHaloRing, { transform: [{ scale: haloScale }], opacity: haloOpacity }]}
          />
          {/* Main circle */}
          <Animated.View style={[S.successMark, { transform: [{ scale: successScale }] }]}>
            <Ionicons name="checkmark" size={38} color="#001a07" />
          </Animated.View>
          <Text style={S.successEyebrow}>PUBLICADA</Text>
          <Text style={S.successTitle}>
            Tu alerta llegó a {vigias.toLocaleString()} vigías
          </Text>
          <Text style={S.successSub}>
            Ya está visible cerca de {locationLabel}. Cuando alguien confirme, te avisamos.
          </Text>
        </View>

        {/* Preview card */}
        <View style={S.previewCard}>
          <View style={S.previewHead}>
            <View style={S.previewThumb} />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={S.previewCat}>
                <Ionicons name={(category ? CATEGORY_ICONS[category] : "alert-circle") as any} size={10} color="#FF6060" />
                <Text style={S.previewCatText}>{category ? CATEGORY_LABELS[category].toUpperCase() : "INCIDENTE"}</Text>
              </View>
              <Text style={S.previewTitle} numberOfLines={2}>{displayTitle}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Ionicons name="people" size={11} color="#6BE0FF" />
                <Text style={[S.previewMeta, { color: "#6BE0FF", fontWeight: "700" }]}>
                  ~{vigias.toLocaleString()} vigías
                </Text>
                <Text style={S.previewMeta}>· ahora</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={S.confirmNudge}>
          Pide a vecinos cercanos que confirmen en el feed — 8 votos la marcan como verificada.
        </Text>

        {/* Actions */}
        <View style={S.successActionsCol}>
          <ReportCta onPress={() => router.replace("/(tabs)/")}>
            <Ionicons name="map" size={16} color="#fff" />
            <Text style={S.ctaText}>VER EN EL MAPA</Text>
          </ReportCta>
          <View style={S.successActions}>
            <Pressable style={S.successActionSec} onPress={() => { void handleShareSent(); }}>
              <Ionicons name="share-outline" size={14} color="#fff" />
              <Text style={S.successActionSecText}>Compartir</Text>
            </Pressable>
            <Pressable style={S.successActionPri} onPress={() => router.replace("/(tabs)/feed")}>
              <Ionicons name="list" size={14} color="#fff" />
              <Text style={S.successActionPriText}>Ver en feed</Text>
            </Pressable>
          </View>
        </View>
      </>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────

  const isStep4 = step === 4;

  if (locationLoading) {
    return (
      <View style={[S.root, { alignItems: "center", justifyContent: "center", gap: 20, paddingHorizontal: 32 }]}>
        <LinearGradient colors={["rgba(40,15,8,0.92)", "rgba(0,0,0,0.97)"]} style={StyleSheet.absoluteFill} />
        <View style={S.locLoadingIcon}>
          <Ionicons name="location" size={30} color="#6BE0FF" />
        </View>
        <Text style={S.locLoadingTitle}>OBTENIENDO UBICACIÓN</Text>
        <Text style={S.locLoadingSub}>
          Para que tu alerta llegue a quienes están cerca. Si tarda, puedes continuar sin GPS.
        </Text>
        <Pressable
          style={S.locSkipBtn}
          onPress={() => {
            applyCuliacanFallback();
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
      {nearbyAlert && !isStep4 && (
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
          nearbyAlert && !isStep4 && { paddingTop: insets.top + 78 },
        ]}
        edges={["bottom"]}
      >
        <View style={S.sheet}>
          {/* Handle */}
          <View style={S.handle} />

          {/* Head */}
          {isStep4 ? (
            <View style={S.sheetHead}>
              <Text style={S.sheetTitle}>Alerta en la red</Text>
              <View style={S.chipAnon}>
                <Ionicons name="eye-off" size={11} color="#66FF8C" />
                <Text style={S.chipAnonText}>ANÓNIMO</Text>
              </View>
            </View>
          ) : (
            <View style={S.sheetHead}>
              <Text style={S.sheetTitle}>
                {step === 3 ? "Revisa" : step === 1 ? "Evidencia" : "Reportar"}
              </Text>
              <StepDots current={step === 1 ? 1 : 2} total={2} />
              <Pressable style={S.closeBtn} onPress={() => router.back()}>
                <Ionicons name="close" size={14} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* Location chips (steps 1–2) */}
          {step <= 2 && <ContextChips locationLabel={locationLabel} />}

          {usingFallbackLocation && step <= 3 && (
            <View style={S.fallbackHint}>
              <Ionicons name="information-circle-outline" size={13} color="#6BE0FF" />
              <Text style={S.fallbackHintText}>Ubicación aproximada: centro de Culiacán</Text>
            </View>
          )}

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
            {step === 4 && renderStep4()}
          </ScrollView>

          {/* CTA — detalles: enviar directo (revisión opcional) */}
          {step === 2 && (
            <View style={[S.ctaWrap, Platform.OS === "web" && S.ctaWrapWeb]}>
              {formError ? <Text style={S.formError}>{formError}</Text> : null}
              <ReportCta
                disabled={!category || submitting}
                onPress={() => {
                  void handleSubmit();
                }}
              >
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={S.ctaText}>{submitting ? "ENVIANDO…" : "ENVIAR ALERTA"}</Text>
              </ReportCta>
              <Pressable
                style={S.reviewLink}
                disabled={!category || submitting}
                onPress={() => {
                  setFormError(null);
                  if (!category) {
                    notifyUser("Falta categoría", "Elige el tipo de incidente para continuar.");
                    return;
                  }
                  setStep(3);
                }}
              >
                <Text style={S.reviewLinkText}>Revisar antes de enviar</Text>
              </Pressable>
              <Text style={S.ctaHelper}>Anónimo · sin datos personales</Text>
            </View>
          )}

          {step === 3 && (
            <View style={[S.ctaWrap, Platform.OS === "web" && S.ctaWrapWeb]}>
              {formError ? <Text style={S.formError}>{formError}</Text> : null}
              <ReportCta
                disabled={submitting}
                onPress={() => {
                  void handleSubmit();
                }}
              >
                <Ionicons name="paper-plane" size={18} color="#fff" />
                <Text style={S.ctaText}>{submitting ? "ENVIANDO…" : "ENVIAR ALERTA"}</Text>
              </ReportCta>
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
  fallbackHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  fallbackHintText: {
    fontSize: 11,
    color: "rgba(107,224,255,0.85)",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  fallbackBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: "rgba(0,224,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(0,224,255,0.28)",
    borderRadius: 12,
  },
  fallbackBannerText: {
    fontSize: 11,
    color: "rgba(107,224,255,0.9)",
    fontFamily: "SpaceGrotesk_500Medium",
    lineHeight: 16,
  },
  formError: {
    fontSize: 12,
    color: "#FF8A80",
    textAlign: "center",
    fontFamily: "SpaceGrotesk_500Medium",
    lineHeight: 17,
    paddingHorizontal: 4,
  },
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

  // Viewfinder (step 1)
  viewfinder: {
    aspectRatio: 1, borderRadius: 18,
    backgroundColor: "#0d0605",
    overflow: "hidden",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.06)",
  },
  corner: { position: "absolute", width: 18, height: 18, borderColor: "rgba(255,255,255,0.8)", borderWidth: 2 },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  recChip: {
    position: "absolute", top: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999,
  },
  recChipActive: {
    backgroundColor: "rgba(255,0,0,0.85)",
  },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  recText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.6, color: "#fff", fontFamily: "SpaceGrotesk_700Bold" },
  vfTimer: {
    position: "absolute", bottom: 10, alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  vfTimerText: { fontSize: 12, fontWeight: "700", color: "#fff", fontFamily: "SpaceGrotesk_700Bold" },
  vfHint: { alignItems: "center", justifyContent: "center" },
  camPermBtn: { alignItems: "center", gap: 10 },
  camPermText: { fontSize: 12, color: "rgba(255,255,255,0.45)", fontFamily: "SpaceGrotesk_500Medium" },

  // Mode selector
  modeRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 999, padding: 3, alignSelf: "center",
  },
  modeBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 6,
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
    width: 36, height: 36, borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  shutterSideLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.6)", fontFamily: "SpaceGrotesk_700Bold" },
  shutterRing: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 3, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  shutterInner: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "#FF0000",
    shadowColor: "#FF0000", shadowOpacity: 0.7, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  shutterInnerRec: { backgroundColor: "#FF6060" },
  skipBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    alignSelf: "center", paddingVertical: 8,
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
  sheetHint: {
    fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: -4,
    fontFamily: "SpaceGrotesk_500Medium", lineHeight: 17,
  },

  // Category grid
  catGrid: { display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catCell: {
    width: "31.5%", alignItems: "center", gap: 5,
    paddingVertical: 12, paddingHorizontal: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    minHeight: 64,
  },
  catCellActive: {
    backgroundColor: "rgba(255,0,0,0.16)",
    borderColor: "rgba(255,0,0,0.5)",
    shadowColor: "#FF0000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  catLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, color: "rgba(255,255,255,0.65)", textAlign: "center", fontFamily: "SpaceGrotesk_700Bold" },
  catLabelActive: { color: "#FF6060" },

  // Title input
  titleInput: {
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    fontSize: 14, color: "#fff",
    fontFamily: "SpaceGrotesk_500Medium",
    minHeight: 48,
  },

  // Source tags
  tagRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  tag: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
    minHeight: 36,
  },
  tagActive: {
    backgroundColor: "rgba(0,224,255,0.14)",
    borderColor: "rgba(0,224,255,0.5)",
  },
  tagText: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.6)", fontFamily: "SpaceGrotesk_700Bold" },
  tagTextActive: { color: "#6BE0FF" },

  reachHint: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, paddingHorizontal: 12,
    backgroundColor: "rgba(0,224,255,0.08)",
    borderWidth: 1, borderColor: "rgba(0,224,255,0.22)",
    borderRadius: 12,
  },
  reachHintText: {
    flex: 1, fontSize: 12, color: "rgba(107,224,255,0.95)",
    fontFamily: "SpaceGrotesk_500Medium", lineHeight: 17,
  },

  // Preview card (steps 3 & 4)
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

  // Distribution (step 3)
  distRow: { flexDirection: "row", gap: 6 },
  distCell: {
    flex: 1, padding: 10,
    backgroundColor: "rgba(0,224,255,0.08)",
    borderWidth: 1, borderColor: "rgba(0,224,255,0.22)",
    borderRadius: 10,
  },
  distNum: { fontSize: 16, fontWeight: "700", color: "#6BE0FF", letterSpacing: -0.1, fontFamily: "SpaceGrotesk_700Bold" },
  distLabel: { fontSize: 9.5, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", color: "rgba(107,224,255,0.7)", marginTop: 2, fontFamily: "SpaceGrotesk_700Bold" },

  // Trust block (step 3)
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
  ctaWrap: { paddingTop: 8, paddingBottom: 4, gap: 8, zIndex: 20, position: "relative" },
  ctaWrapWeb: {
    // Extra aire sobre el chrome de Safari iPhone para que el tap no caiga en la barra del browser.
    paddingBottom: 18,
  },
  cta: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    padding: 16, borderRadius: 14, overflow: "hidden",
    minHeight: 52,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { fontSize: 14, fontWeight: "800", letterSpacing: 1.6, color: "#fff", fontFamily: "SpaceGrotesk_700Bold" },
  ctaHelper: { textAlign: "center", fontSize: 10.5, color: "rgba(255,255,255,0.4)", fontFamily: "SpaceGrotesk_500Medium" },
  reviewLink: { alignItems: "center", paddingVertical: 4 },
  reviewLinkText: {
    fontSize: 12, color: "rgba(255,255,255,0.45)",
    fontFamily: "SpaceGrotesk_500Medium", textDecorationLine: "underline",
  },

  // Success (step 4)
  successWrap: { alignItems: "center", gap: 12, paddingVertical: 16, paddingHorizontal: 12 },
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
  successEyebrow: {
    fontSize: 11, fontWeight: "800", letterSpacing: 2,
    color: "#00FF41", fontFamily: "SpaceGrotesk_700Bold",
  },
  successTitle: { fontSize: 22, fontWeight: "700", color: "#fff", textAlign: "center", letterSpacing: -0.4, fontFamily: "SpaceGrotesk_700Bold" },
  successSub: { fontSize: 13, color: "rgba(255,255,255,0.6)", textAlign: "center", lineHeight: 19, fontFamily: "SpaceGrotesk_500Medium" },
  confirmNudge: {
    fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "center",
    lineHeight: 17, fontFamily: "SpaceGrotesk_500Medium", paddingHorizontal: 8,
  },
  successActionsCol: { gap: 10 },
  successActions: { flexDirection: "row", gap: 8 },
  successActionSec: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    padding: 14, borderRadius: 12, minHeight: 48,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.1)",
  },
  successActionSecText: { fontSize: 12, fontWeight: "700", color: "#fff", letterSpacing: 1, fontFamily: "SpaceGrotesk_700Bold" },
  successActionPri: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    padding: 14, borderRadius: 12, minHeight: 48,
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
