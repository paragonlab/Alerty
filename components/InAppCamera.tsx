import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

export type CaptureResult = {
  uri: string;
  type: "image" | "video";
};

type CaptureMode = "photo" | "video";

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
  /** Prefer video when aportando a Pulsos. */
  initialMode?: CaptureMode;
  /** Limit available modes. Default: both. */
  allowedModes?: CaptureMode[];
};

/**
 * Full-screen in-app camera (foto + video) for native.
 * On web, shows a calm fallback — no CameraView mount that could crash.
 */
export function InAppCamera({
  visible,
  onClose,
  onCapture,
  initialMode = "photo",
  allowedModes = ["photo", "video"],
}: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [mode, setMode] = useState<CaptureMode>(
    allowedModes.includes(initialMode) ? initialMode : allowedModes[0] ?? "photo",
  );
  const [isRecording, setIsRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [preview, setPreview] = useState<CaptureResult | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingLock = useRef(false);

  useEffect(() => {
    if (!visible) {
      setPreview(null);
      setIsRecording(false);
      setCameraReady(false);
      setRecSeconds(0);
      recordingLock.current = false;
      if (recTimerRef.current) {
        clearInterval(recTimerRef.current);
        recTimerRef.current = null;
      }
      return;
    }
    setMode(allowedModes.includes(initialMode) ? initialMode : allowedModes[0] ?? "photo");
    // Only re-init when opening the modal, not when parent re-renders allowedModes array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, initialMode]);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) clearInterval(recTimerRef.current);
    };
  }, []);

  if (!visible) return null;

  if (Platform.OS === "web") {
    return (
      <Modal visible animationType="slide" statusBarTranslucent>
        <View style={styles.permissionContainer}>
          <SafeAreaView style={styles.permissionInner}>
            <Ionicons name="phone-portrait-outline" size={56} color="rgba(255,255,255,0.35)" />
            <Text style={styles.permissionTitle}>Usa la app móvil</Text>
            <Text style={styles.permissionSubtitle}>
              La captura con cámara en vivo está disponible en iOS y Android. En la web puedes adjuntar
              archivos desde tu dispositivo.
            </Text>
            <Pressable style={styles.permissionButton} onPress={onClose}>
              <Text style={styles.permissionButtonText}>Entendido</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  if (!camPermission) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent>
        <View style={styles.permissionContainer} />
      </Modal>
    );
  }

  if (!camPermission.granted) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent>
        <View style={styles.permissionContainer}>
          <SafeAreaView style={styles.permissionInner}>
            <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
            <Text style={styles.permissionSubtitle}>
              Necesitamos la cámara para capturar evidencia del incidente. Tu privacidad se respeta:
              solo se usa al reportar.
            </Text>
            {camPermission.canAskAgain ? (
              <Pressable style={styles.permissionButton} onPress={() => void requestCamPermission()}>
                <Text style={styles.permissionButtonText}>Permitir acceso</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.permissionButton}
                onPress={() => void Linking.openSettings()}
              >
                <Text style={styles.permissionButtonText}>Abrir ajustes</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} style={styles.permissionClose}>
              <Text style={styles.permissionCloseText}>Cancelar</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  const clearRecTimer = () => {
    if (recTimerRef.current) {
      clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecSeconds(0);
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isRecording || !cameraReady) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, shutterSound: true });
      if (!photo?.uri) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPreview({ uri: photo.uri, type: "image" });
    } catch (err) {
      console.warn("takePictureAsync failed", err);
      Alert.alert("No se pudo capturar", "Intenta de nuevo o elige una foto de la galería.");
    }
  };

  const handleStartVideo = async () => {
    if (!cameraRef.current || isRecording || recordingLock.current || !cameraReady) return;
    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) {
        Alert.alert(
          "Micrófono necesario",
          result.canAskAgain
            ? "Para grabar video con audio necesitamos acceso al micrófono."
            : "Activa el micrófono en Ajustes para grabar video con sonido.",
          result.canAskAgain
            ? undefined
            : [{ text: "Cancelar", style: "cancel" }, { text: "Abrir ajustes", onPress: () => void Linking.openSettings() }],
        );
        return;
      }
    }
    try {
      recordingLock.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds((s) => s + 1), 1000);
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      clearRecTimer();
      if (video?.uri) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setPreview({ uri: video.uri, type: "video" });
      }
    } catch (err) {
      console.warn("recordAsync failed", err);
      Alert.alert("No se pudo grabar", "Intenta de nuevo o elige un video de la galería.");
    } finally {
      clearRecTimer();
      setIsRecording(false);
      recordingLock.current = false;
    }
  };

  const handleStopVideo = () => {
    if (!isRecording) return;
    cameraRef.current?.stopRecording();
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleShutter = () => {
    if (mode === "photo") {
      void handleTakePhoto();
    } else if (isRecording) {
      handleStopVideo();
    } else {
      void handleStartVideo();
    }
  };

  const handleUse = () => {
    if (!preview) return;
    onCapture(preview);
    setPreview(null);
    onClose();
  };

  const cycleFlash = () =>
    setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"));

  const timer = `${Math.floor(recSeconds / 60)}:${String(recSeconds % 60).padStart(2, "0")}`;

  if (preview) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent>
        <View style={styles.container}>
          {preview.type === "image" ? (
            <Image source={{ uri: preview.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
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
          <SafeAreaView edges={["bottom"]} style={styles.previewActions}>
            <Pressable
              style={styles.retakeButton}
              onPress={() => setPreview(null)}
              accessibilityLabel="Repetir captura"
            >
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.retakeText}>Repetir</Text>
            </Pressable>
            <Pressable
              style={styles.useButton}
              onPress={handleUse}
              accessibilityLabel="Usar esta captura"
            >
              <Ionicons name="checkmark" size={22} color="#000" />
              <Text style={styles.useText}>Usar</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          flash={flash}
          mode={mode === "video" ? "video" : "picture"}
          mute={false}
          onCameraReady={() => setCameraReady(true)}
          onMountError={() => {
            Alert.alert(
              "Cámara no disponible",
              "No pudimos iniciar la cámara. Puedes adjuntar evidencia desde la galería.",
            );
            onClose();
          }}
        />

        <SafeAreaView edges={["top"]} style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
            <Ionicons name="close" size={26} color="white" />
          </Pressable>
          <Pressable
            style={styles.iconBtn}
            onPress={cycleFlash}
            hitSlop={10}
            accessibilityLabel="Cambiar flash"
          >
            <Ionicons
              name={flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline"}
              size={22}
              color={flash !== "off" ? "#F59E0B" : "white"}
            />
          </Pressable>
        </SafeAreaView>

        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>REC {timer}</Text>
          </View>
        )}

        <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
          {allowedModes.length > 1 && (
            <View style={styles.modePills}>
              {allowedModes.includes("photo") && (
                <Pressable
                  style={[styles.modePill, mode === "photo" && styles.modePillActive]}
                  onPress={() => {
                    if (!isRecording) setMode("photo");
                  }}
                >
                  <Text style={[styles.modePillText, mode === "photo" && styles.modePillTextActive]}>
                    FOTO
                  </Text>
                </Pressable>
              )}
              {allowedModes.includes("video") && (
                <Pressable
                  style={[styles.modePill, mode === "video" && styles.modePillActive]}
                  onPress={() => {
                    if (!isRecording) setMode("video");
                  }}
                >
                  <Ionicons
                    name="videocam-outline"
                    size={12}
                    color={mode === "video" ? "#111" : "rgba(255,255,255,0.6)"}
                  />
                  <Text style={[styles.modePillText, mode === "video" && styles.modePillTextActive]}>
                    VIDEO
                  </Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={styles.shutterRow}>
            <View style={{ width: 50 }} />
            <Pressable
              style={styles.shutterOuter}
              onPress={handleShutter}
              onLongPress={() => {
                if (mode === "video" && !isRecording) void handleStartVideo();
              }}
              delayLongPress={280}
              accessibilityLabel={mode === "photo" ? "Tomar foto" : isRecording ? "Detener grabación" : "Grabar video"}
            >
              <View
                style={[
                  styles.shutterInner,
                  mode === "video" && styles.shutterInnerVideo,
                  isRecording && styles.shutterInnerRecording,
                ]}
              />
            </Pressable>
            <Pressable
              style={styles.flipBtn}
              onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
              hitSlop={10}
              disabled={isRecording}
              accessibilityLabel="Voltear cámara"
            >
              <Ionicons name="camera-reverse-outline" size={30} color="white" />
            </Pressable>
          </View>

          <Text style={styles.modeHint}>
            {mode === "photo"
              ? "Toca para tomar foto"
              : isRecording
                ? "Toca para detener"
                : "Toca o mantén para grabar · máx. 60 s"}
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  permissionContainer: { flex: 1, backgroundColor: "#000" },
  permissionInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 36,
  },
  permissionTitle: {
    color: "white",
    fontSize: 22,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
  },
  permissionSubtitle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 15,
    fontFamily: "SpaceGrotesk_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  permissionButton: {
    marginTop: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 32,
    backgroundColor: "white",
    minHeight: 48,
    justifyContent: "center",
  },
  permissionButtonText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  permissionClose: { padding: 12 },
  permissionCloseText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingBadge: {
    position: "absolute",
    top: 108,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(180,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  recordingText: {
    color: "white",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 16,
    paddingTop: 20,
    alignItems: "center",
    gap: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modePills: { flexDirection: "row", gap: 8 },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 18,
    paddingVertical: 10,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  modePillActive: {
    backgroundColor: "white",
    borderColor: "white",
  },
  modePillText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  modePillTextActive: { color: "#111" },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 32,
  },
  shutterOuter: {
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "white",
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "white",
  },
  shutterInnerVideo: { backgroundColor: "#EF4444" },
  shutterInnerRecording: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#EF4444",
  },
  flipBtn: {
    width: 50,
    alignItems: "flex-end",
  },
  modeHint: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  previewActions: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingBottom: 20,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  retakeText: {
    color: "white",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  useButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 14,
    minHeight: 48,
    borderRadius: 32,
    backgroundColor: "white",
  },
  useText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
