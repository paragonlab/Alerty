import { useRef, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Video, ResizeMode, Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type FlashMode = "off" | "on" | "auto";
type CameraFacing = "front" | "back";
type CaptureMode = "photo" | "video";

export type CaptureResult = {
  uri: string;
  type: "image" | "video";
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onCapture: (result: CaptureResult) => void;
};

export function CameraCapture({ visible, onClose, onCapture }: Props) {
  const cameraRef = useRef<CameraView>(null);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraFacing>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [isRecording, setIsRecording] = useState(false);
  const [preview, setPreview] = useState<CaptureResult | null>(null);

  if (!visible) return null;

  if (!camPermission?.granted) {
    return (
      <Modal visible animationType="slide" statusBarTranslucent>
        <View style={styles.permissionContainer}>
          <SafeAreaView style={styles.permissionInner}>
            <Ionicons name="camera-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.permissionTitle}>Acceso a la cámara</Text>
            <Text style={styles.permissionSubtitle}>
              Necesitamos acceso a tu cámara para capturar evidencia del incidente.
            </Text>
            <Pressable style={styles.permissionButton} onPress={requestCamPermission}>
              <Text style={styles.permissionButtonText}>Permitir acceso</Text>
            </Pressable>
            <Pressable onPress={onClose} style={styles.permissionClose}>
              <Text style={styles.permissionCloseText}>Cancelar</Text>
            </Pressable>
          </SafeAreaView>
        </View>
      </Modal>
    );
  }

  const handleTakePhoto = async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85 });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPreview({ uri: photo.uri, type: "image" });
    } catch (err) {
      console.error("Failed to take photo", err);
    }
  };

  const handleStartVideo = async () => {
    if (!cameraRef.current || isRecording) return;
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({ maxDuration: 60 });
      if (video?.uri) {
        setPreview({ uri: video.uri, type: "video" });
      }
    } catch (err) {
      console.error("Failed to record video", err);
    } finally {
      setIsRecording(false);
    }
  };

  const handleStopVideo = () => {
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

  if (preview) {
    return (
      <Modal visible animationType="fade" statusBarTranslucent>
        <View style={styles.container}>
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
          <SafeAreaView edges={["bottom"]} style={styles.previewActions}>
            <Pressable style={styles.retakeButton} onPress={() => setPreview(null)}>
              <Ionicons name="refresh" size={20} color="white" />
              <Text style={styles.retakeText}>Repetir</Text>
            </Pressable>
            <Pressable style={styles.useButton} onPress={handleUse}>
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
        />

        {/* Top bar */}
        <SafeAreaView edges={["top"]} style={styles.topBar}>
          <Pressable style={styles.iconBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={cycleFlash} hitSlop={10}>
            <Ionicons
              name={flash === "off" ? "flash-off" : flash === "on" ? "flash" : "flash-outline"}
              size={24}
              color={flash !== "off" ? "#F59E0B" : "white"}
            />
          </Pressable>
        </SafeAreaView>

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingBadge}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingText}>Grabando</Text>
          </View>
        )}

        {/* Bottom controls */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomBar}>
          <View style={styles.modePills}>
            <Pressable
              style={[styles.modePill, mode === "photo" && styles.modePillActive]}
              onPress={() => { if (!isRecording) setMode("photo"); }}
            >
              <Text style={[styles.modePillText, mode === "photo" && styles.modePillTextActive]}>
                FOTO
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modePill, mode === "video" && styles.modePillActive]}
              onPress={() => { if (!isRecording) setMode("video"); }}
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
          </View>

          <View style={styles.shutterRow}>
            <View style={{ width: 50 }} />
            <Pressable style={styles.shutterOuter} onPress={handleShutter}>
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
            >
              <Ionicons name="camera-reverse-outline" size={32} color="white" />
            </Pressable>
          </View>

          <Text style={styles.modeHint}>
            {mode === "photo"
              ? "Toca para tomar foto"
              : isRecording
              ? "Toca para detener"
              : "Toca para grabar · máx 60s"}
          </Text>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: "#000",
  },
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
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  recordingBadge: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recordingText: {
    color: "white",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
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
  modePills: {
    flexDirection: "row",
    gap: 8,
  },
  modePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 7,
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
  modePillTextActive: {
    color: "#111",
  },
  shutterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 32,
  },
  shutterOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: "white",
  },
  shutterInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "white",
  },
  shutterInnerVideo: {
    backgroundColor: "#EF4444",
  },
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
    color: "rgba(255,255,255,0.4)",
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
    paddingHorizontal: 40,
    paddingBottom: 20,
    paddingTop: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  retakeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 13,
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
    paddingVertical: 13,
    borderRadius: 32,
    backgroundColor: "white",
  },
  useText: {
    color: "#000",
    fontSize: 16,
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
