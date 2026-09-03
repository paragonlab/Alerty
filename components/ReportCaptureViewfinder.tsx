import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
  type FlashMode,
} from "expo-camera";
import { Video, ResizeMode } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { CaptureResult } from "./InAppCamera";

type CaptureMode = "photo" | "video" | "voice";

export type ReportCaptureHandle = {
  capture: () => Promise<void>;
  isRecording: () => boolean;
  hasPreview: () => boolean;
};

type Props = {
  captureMode: CaptureMode;
  style?: StyleProp<ViewStyle>;
  voiceContent?: React.ReactNode;
  isVoiceRecording?: boolean;
  voiceSeconds?: number;
  onCaptured: (result: CaptureResult) => void;
};

/**
 * Live in-app camera pane for the report flow.
 * Parent owns shutter / mode / gallery; this owns preview, flash, flip, permissions.
 */
export const ReportCaptureViewfinder = forwardRef<ReportCaptureHandle, Props>(
  function ReportCaptureViewfinder(
    { captureMode, style, voiceContent, isVoiceRecording, voiceSeconds = 0, onCaptured },
    ref,
  ) {
    const cameraRef = useRef<CameraView>(null);
    const [camPermission, requestCamPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    const [facing, setFacing] = useState<CameraType>("back");
    const [flash, setFlash] = useState<FlashMode>("off");
    const [isRecording, setIsRecording] = useState(false);
    const [recSeconds, setRecSeconds] = useState(0);
    const [preview, setPreview] = useState<CaptureResult | null>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const recordingLock = useRef(false);
    const isRecordingRef = useRef(false);
    const previewRef = useRef<CaptureResult | null>(null);

    useEffect(() => {
      isRecordingRef.current = isRecording;
    }, [isRecording]);
    useEffect(() => {
      previewRef.current = preview;
    }, [preview]);

    useEffect(() => {
      return () => {
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        if (recordingLock.current) {
          try {
            cameraRef.current?.stopRecording();
          } catch {
            /* ignore */
          }
        }
      };
    }, []);

    useEffect(() => {
      if (captureMode !== "video" && isRecording) {
        cameraRef.current?.stopRecording();
      }
      if (captureMode === "voice") {
        setPreview(null);
      }
    }, [captureMode, isRecording]);

    const clearRecTimer = () => {
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      setRecSeconds(0);
    };

    const takePhoto = async () => {
      if (Platform.OS === "web" || !cameraRef.current || !cameraReady || busy || isRecording) return;
      setBusy(true);
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.85,
          shutterSound: true,
        });
        if (photo?.uri) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPreview({ uri: photo.uri, type: "image" });
        }
      } catch (err) {
        console.warn("takePictureAsync", err);
        Alert.alert("No se pudo capturar", "Intenta de nuevo o elige una foto de la galería.");
      } finally {
        setBusy(false);
      }
    };

    const startVideo = async () => {
      if (
        Platform.OS === "web" ||
        !cameraRef.current ||
        !cameraReady ||
        busy ||
        recordingLock.current
      ) {
        return;
      }
      if (!micPermission?.granted) {
        const result = await requestMicPermission();
        if (!result.granted) {
          Alert.alert(
            "Micrófono necesario",
            result.canAskAgain
              ? "Para grabar video con audio necesitamos acceso al micrófono."
              : "Activa el micrófono en Ajustes para grabar con sonido.",
            result.canAskAgain
              ? undefined
              : [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
                ],
          );
          return;
        }
      }
      setBusy(true);
      recordingLock.current = true;
      try {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsRecording(true);
        setRecSeconds(0);
        recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
        const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
        if (video?.uri) {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setPreview({ uri: video.uri, type: "video" });
        }
      } catch (err) {
        console.warn("recordAsync", err);
        Alert.alert("No se pudo grabar", "Intenta de nuevo o elige un video de la galería.");
      } finally {
        clearRecTimer();
        setIsRecording(false);
        recordingLock.current = false;
        setBusy(false);
      }
    };

    const stopVideo = () => {
      if (!isRecording) return;
      cameraRef.current?.stopRecording();
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const capture = async () => {
      if (captureMode === "voice") return;
      if (previewRef.current) return;
      if (Platform.OS === "web") {
        Alert.alert(
          "Usa la app móvil",
          "La cámara en vivo está en iOS y Android. En la web puedes adjuntar desde la galería.",
        );
        return;
      }
      if (!camPermission?.granted) {
        const result = await requestCamPermission();
        if (!result.granted) {
          Alert.alert(
            "Sin acceso a la cámara",
            result.canAskAgain
              ? "Necesitamos la cámara para capturar evidencia del incidente."
              : "Activa la cámara en Ajustes para reportar con foto o video.",
            result.canAskAgain
              ? undefined
              : [
                  { text: "Cancelar", style: "cancel" },
                  { text: "Abrir ajustes", onPress: () => void Linking.openSettings() },
                ],
          );
          return;
        }
        // Preview montará en el siguiente render; el usuario vuelve a tocar el obturador.
        return;
      }
      if (captureMode === "photo") {
        await takePhoto();
      } else if (isRecordingRef.current) {
        stopVideo();
      } else {
        await startVideo();
      }
    };

    useImperativeHandle(ref, () => ({
      capture,
      isRecording: () => isRecordingRef.current,
      hasPreview: () => !!previewRef.current,
    }));

    const confirmPreview = () => {
      if (!preview) return;
      onCaptured(preview);
      setPreview(null);
    };

    const showLiveCamera =
      Platform.OS !== "web" && captureMode !== "voice" && !!camPermission?.granted && !preview;

    const timerLabel =
      captureMode === "voice" && isVoiceRecording
        ? `${Math.floor(voiceSeconds / 60)}:${String(voiceSeconds % 60).padStart(2, "0")}`
        : `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;

    const isCapturing = isRecording || !!isVoiceRecording;

    return (
      <View style={[styles.viewfinder, style]}>
        {showLiveCamera && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash={flash}
            mode={captureMode === "video" ? "video" : "picture"}
            mute={false}
            onCameraReady={() => setCameraReady(true)}
            onMountError={() => {
              setCameraReady(false);
              Alert.alert(
                "Cámara no disponible",
                "No pudimos iniciar la cámara. Puedes adjuntar evidencia desde la galería.",
              );
            }}
          />
        )}

        {preview && (
          <>
            {preview.type === "image" ? (
              <Image
                source={{ uri: preview.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : (
              <Video
                source={{ uri: preview.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
            )}
            <View style={styles.previewBar}>
              <Pressable style={styles.previewBtn} onPress={() => setPreview(null)} hitSlop={8}>
                <Ionicons name="refresh" size={16} color="#fff" />
                <Text style={styles.previewBtnText}>Repetir</Text>
              </Pressable>
              <Pressable
                style={[styles.previewBtn, styles.previewBtnPrimary]}
                onPress={confirmPreview}
                hitSlop={8}
              >
                <Ionicons name="checkmark" size={16} color="#001a07" />
                <Text style={[styles.previewBtnText, { color: "#001a07" }]}>Usar</Text>
              </Pressable>
            </View>
          </>
        )}

        {!preview && captureMode === "voice" && isVoiceRecording && voiceContent}

        {!preview && !showLiveCamera && captureMode !== "voice" && (
          <View style={styles.fallback}>
            {Platform.OS === "web" ? (
              <>
                <Ionicons name="phone-portrait-outline" size={28} color="rgba(255,255,255,0.3)" />
                <Text style={styles.fallbackText}>Cámara en la app móvil</Text>
                <Text style={styles.fallbackSub}>En la web usa Galería para adjuntar evidencia.</Text>
              </>
            ) : !camPermission?.granted ? (
              <Pressable
                style={styles.permBtn}
                onPress={() => {
                  if (camPermission && !camPermission.canAskAgain) {
                    void Linking.openSettings();
                  } else {
                    void requestCamPermission();
                  }
                }}
              >
                <Ionicons name="camera-outline" size={28} color="rgba(255,255,255,0.45)" />
                <Text style={styles.fallbackText}>Permitir cámara</Text>
                <Text style={styles.fallbackSub}>
                  {camPermission && !camPermission.canAskAgain
                    ? "Ábrela en Ajustes del sistema"
                    : "Para capturar evidencia del incidente"}
                </Text>
              </Pressable>
            ) : (
              <Ionicons
                name={captureMode === "video" ? "videocam" : "camera"}
                size={32}
                color="rgba(255,255,255,0.25)"
              />
            )}
          </View>
        )}

        {!preview && captureMode === "voice" && !isVoiceRecording && (
          <View style={styles.fallback}>
            <Ionicons name="mic" size={32} color="rgba(255,255,255,0.25)" />
          </View>
        )}

        {!preview && (
          <>
            <View style={[styles.corner, styles.cornerTL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerTR]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBL]} pointerEvents="none" />
            <View style={[styles.corner, styles.cornerBR]} pointerEvents="none" />

            <View style={[styles.recChip, isCapturing && styles.recChipActive]} pointerEvents="none">
              {isCapturing && <View style={styles.recDot} />}
              <Text style={styles.recText}>
                {isCapturing
                  ? "REC"
                  : captureMode === "video"
                    ? "VIDEO"
                    : captureMode === "photo"
                      ? "FOTO"
                      : "VOZ"}
              </Text>
            </View>

            {isCapturing && (
              <View style={styles.vfTimer} pointerEvents="none">
                <Text style={styles.vfTimerText}>{timerLabel}</Text>
              </View>
            )}

            {showLiveCamera && (
              <View style={styles.camTools}>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() =>
                    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"))
                  }
                  hitSlop={8}
                  accessibilityLabel="Flash"
                >
                  <Ionicons
                    name={
                      flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline"
                    }
                    size={16}
                    color={flash !== "off" ? "#F59E0B" : "#fff"}
                  />
                </Pressable>
                <Pressable
                  style={styles.toolBtn}
                  onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
                  hitSlop={8}
                  disabled={isRecording}
                  accessibilityLabel="Voltear cámara"
                >
                  <Ionicons name="camera-reverse-outline" size={16} color="#fff" />
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  viewfinder: {
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: "#0d0605",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  corner: {
    position: "absolute",
    width: 18,
    height: 18,
    borderColor: "rgba(255,255,255,0.8)",
    borderWidth: 2,
  },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0 },
  recChip: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 999,
  },
  recChipActive: { backgroundColor: "rgba(255,0,0,0.85)" },
  recDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  recText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.6,
    color: "#fff",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  vfTimer: {
    position: "absolute",
    bottom: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  vfTimerText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  camTools: {
    position: "absolute",
    top: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  fallbackText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  fallbackSub: {
    fontSize: 11,
    color: "rgba(255,255,255,0.35)",
    fontFamily: "SpaceGrotesk_500Medium",
    textAlign: "center",
    lineHeight: 16,
  },
  permBtn: { alignItems: "center", gap: 8, padding: 12 },
  previewBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    gap: 10,
  },
  previewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  previewBtnPrimary: {
    backgroundColor: "#00FF41",
    borderColor: "#00FF41",
  },
  previewBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
