import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Audio } from "expo-av";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { GlassView, GlassContainer } from "expo-glass-effect";
import { LinearGradient } from "expo-linear-gradient";
import { CATEGORY_ICONS, CATEGORY_LABELS, REPUTATION_LEVELS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { calculateDistance, formatRelativeTime, getIntensityColor } from "../../lib/alerty/utils";
import type { AlertUpdate } from "../../lib/alerty/types";


export default function AlertDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts, voteAlert, followingAlertIds, toggleFollowAlert, addUpdateToAlert, getReportingRange, themeMode } = useAlertyStore();
  const theme = useAlertyTheme();
  const isDark = themeMode === "darkHighVisibility";
  const styles = createStyles(theme, themeMode);
  const maxReportingDistance = getReportingRange();
  
  const [updateText, setUpdateText] = useState("");
  const [showUpdateInput, setShowUpdateInput] = useState(false);

  const alert = useMemo(() => alerts.find((item) => item.id === id), [alerts, id]);
  const isFollowing = useMemo(() => followingAlertIds.includes(id ?? ""), [followingAlertIds, id]);

  function AudioPlayer({ uri }: { uri: string }) {
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    async function playSound() {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync({ uri });
      setSound(newSound);
      setIsPlaying(true);
      await newSound.playAsync();
      
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    }

    return (
      <Pressable style={[styles.audioPlayer, { backgroundColor: theme.colors.accentSoft, borderColor: theme.colors.accent }]} onPress={playSound}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={theme.colors.accent} />
        <Text style={[styles.audioText, { color: theme.colors.accent }]}>Reproducir voz</Text>
      </Pressable>
    );
  }

  if (!alert) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={styles.title}>Detalle</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Alerta no encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Alerta en Alerty: ${alert.title ?? CATEGORY_LABELS[alert.category]}\n\n${alert.description ?? ""}\n\nUbicación: ${alert.neighborhood ?? "Culiacán"}`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddUpdate = async () => {
    if (!updateText.trim()) return;

    // Verify distance
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const current = await Location.getCurrentPositionAsync({});
        const distance = calculateDistance(
          current.coords.latitude,
          current.coords.longitude,
          alert.lat,
          alert.lng
        );

        if (distance > maxReportingDistance) {
          Alert.alert(
            "Fuera de rango",
            `Debes estar a menos de ${maxReportingDistance}km de la alerta para actualizarla. (Distancia actual: ${distance.toFixed(2)}km)`
          );
          return;
        }
      }
    } catch (err) {
      console.warn("Could not verify location for update proximity", err);
    }
    
    addUpdateToAlert(alert.id, updateText.trim());
    
    setUpdateText("");
    setShowUpdateInput(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const intensityColor = getIntensityColor(alert.createdAt);

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
        <Text style={styles.title}>Detalle de Alerta</Text>
        <Pressable style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color={theme.colors.text} />
        </Pressable>
      </GlassView>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.categoryRow}>
          <View style={[styles.categoryPill, { borderColor: intensityColor }]}>
            <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={14} color={intensityColor} />
            <Text style={styles.categoryText}>{CATEGORY_LABELS[alert.category]}</Text>
          </View>
          <Text style={styles.timeText}>{formatRelativeTime(alert.createdAt)}</Text>
        </View>

        <View style={styles.titleSection}>
          <Text style={styles.alertTitle}>{alert.title ?? CATEGORY_LABELS[alert.category]}</Text>
          <Pressable 
            style={[styles.followButton, isFollowing && styles.followButtonActive]}
            onPress={() => {
              toggleFollowAlert(alert.id);
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
          >
            <Ionicons 
              name={isFollowing ? "notifications" : "notifications-outline"} 
              size={16} 
              color={isFollowing ? theme.colors.surface : theme.colors.text} 
            />
            <Text style={[styles.followText, isFollowing && styles.followTextActive]}>
              {isFollowing ? "Siguiendo" : "Seguir"}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.description}>{alert.description ?? "Sin descripción adicional."}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Zona</Text>
            <Text style={styles.metaValue}>{alert.neighborhood ?? "Culiacán"}</Text>
          </View>
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Estado</Text>
            <Text style={styles.metaValue}>{alert.status === "active" ? "Activa" : "Resuelta"}</Text>
          </View>
        </View>

        {alert.media.length > 0 ? (
          <View>
            <Text style={styles.sectionTitle}>Evidencia Multimedia</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaRow}>
              {alert.media.map((item) => (
                <View key={item.id} style={styles.mediaContainer}>
                  {item.type === "audio" ? (
                    <AudioPlayer uri={item.url} />
                  ) : (
                    <>
                      <Image source={{ uri: item.url }} style={styles.mediaThumb} />
                      {item.type === "video" && (
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play-circle" size={32} color="white" />
                        </View>
                      )}
                    </>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.voteRow}>
          <Pressable
            style={styles.voteButton}
            onPress={() => {
              voteAlert(alert.id, "upvote");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="thumbs-up-outline" size={16} color={theme.colors.text} />
            <Text style={styles.voteText}>Es real · {alert.upvotes}</Text>
          </Pressable>
          <Pressable
            style={styles.voteButton}
            onPress={() => {
              voteAlert(alert.id, "downvote");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <Ionicons name="thumbs-down-outline" size={16} color={theme.colors.text} />
            <Text style={styles.voteText}>Falsa · {alert.downvotes}</Text>
          </Pressable>
        </View>

        <View style={styles.threadSection}>
          <View style={styles.threadHeader}>
            <Text style={styles.sectionTitle}>Hilo de Actualizaciones</Text>
            {!showUpdateInput && (
              <Pressable style={styles.addUpdateButton} onPress={() => setShowUpdateInput(true)}>
                <Ionicons name="add" size={16} color={theme.colors.accent} />
                <Text style={styles.addUpdateText}>Actualizar</Text>
              </Pressable>
            )}
          </View>

          {showUpdateInput && (
            <GlassView 
              colorScheme={isDark ? "dark" : "light"} 
              glassEffectStyle="regular" 
              style={styles.updateInputContainer}
            >
              <LinearGradient
                colors={["rgba(255,255,255,0.1)", "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <TextInput
                style={styles.updateInput}
                placeholder="Agrega una actualización sobre esta alerta..."
                placeholderTextColor={theme.colors.textMuted}
                value={updateText}
                onChangeText={setUpdateText}
                multiline
              />
              <View style={styles.updateActions}>
                <Pressable style={styles.cancelUpdate} onPress={() => setShowUpdateInput(false)}>
                  <Text style={styles.cancelUpdateText}>Cancelar</Text>
                </Pressable>
                <Pressable style={styles.submitUpdate} onPress={handleAddUpdate}>
                  <Text style={styles.submitUpdateText}>Publicar</Text>
                </Pressable>
              </View>
            </GlassView>
          )}

          <View style={styles.threadList}>
            <View style={styles.threadItem}>
              <View style={styles.threadTimeline}>
                <View style={[styles.timelineDot, { backgroundColor: intensityColor }]} />
                <View style={styles.timelineLine} />
              </View>
              <View style={styles.threadContent}>
                <Text style={styles.threadUser}>{alert.user.username} <Text style={styles.threadAction}>Reportó el incidente</Text></Text>
                <Text style={styles.threadTime}>{formatRelativeTime(alert.createdAt)}</Text>
              </View>
            </View>

            {(alert.updates ?? []).map((update, index) => (
              <View key={update.id} style={styles.threadItem}>
                <View style={styles.threadTimeline}>
                  <View style={styles.timelineDot} />
                  {index < (alert.updates ?? []).length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.threadContent}>
                  <View style={styles.threadUserRow}>
                    <Text style={styles.threadUser}>{update.user.username}</Text>
                    {update.user.isVerified && (
                      <Ionicons name="checkmark-circle" size={12} color={theme.colors.accent} />
                    )}
                    {(() => {
                      const levelKey = (update.user.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
                      const levelInfo = REPUTATION_LEVELS[levelKey];
                      return (
                        <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "15" }]}>
                          <Ionicons name={levelInfo.icon as any} size={10} color={levelInfo.color} />
                          <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
                        </View>
                      );
                    })()}
                  </View>
                  <Text style={styles.threadBody}>{update.content}</Text>
                  <Text style={styles.threadTime}>{formatRelativeTime(update.createdAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
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
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.8)",
    borderBottomWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
  },
  headerSpacer: {
    width: 32,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    paddingTop: 16,
    gap: 20,
  },
  categoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.surfaceAlt,
  },
  categoryText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
  },
  timeText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  titleSection: {
    gap: 12,
  },
  alertTitle: {
    color: theme.colors.text,
    fontSize: 26,
    fontFamily: theme.fonts.heading,
    lineHeight: 32,
  },
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.surface,
  },
  followButtonActive: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
  followText: {
    color: theme.colors.text,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  followTextActive: {
    color: theme.colors.surface,
  },
  description: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaCard: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 4,
  },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.body,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 17,
    fontFamily: theme.fonts.heading,
  },
  mediaRow: {
    marginTop: 12,
  },
  mediaContainer: {
    marginRight: 10,
    width: 200,
    height: 200,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    backgroundColor: theme.colors.surfaceAlt,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  mediaThumb: {
    width: "100%",
    height: "100%",
  },
  audioPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
  },
  audioText: {
    fontFamily: theme.fonts.heading,
    fontSize: 14,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  voteRow: {
    flexDirection: "row",
    gap: 12,
  },
  voteButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    backgroundColor: theme.colors.surface,
  },
  voteText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  threadSection: {
    marginTop: 10,
    gap: 20,
  },
  threadHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addUpdateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: theme.colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  addUpdateText: {
    color: theme.colors.accent,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  updateInputContainer: {
    padding: 16,
    borderRadius: theme.radius.xl,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: themeMode === "light" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.1)",
    backgroundColor: themeMode === "light" ? "rgba(255,255,255,0.8)" : "rgba(18,18,18,0.8)",
  },
  updateInput: {
    minHeight: 80,
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 15,
    textAlignVertical: "top",
  },
  updateActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  cancelUpdate: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelUpdateText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  submitUpdate: {
    backgroundColor: theme.colors.accent,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.pill,
  },
  submitUpdateText: {
    color: theme.colors.surface,
    fontSize: 14,
    fontFamily: theme.fonts.heading,
  },
  threadList: {
    gap: 4,
  },
  threadItem: {
    flexDirection: "row",
    gap: 14,
  },
  threadTimeline: {
    width: 2,
    alignItems: "center",
    marginLeft: 8,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
    marginTop: 6,
    zIndex: 2,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: theme.colors.border,
    marginVertical: 4,
  },
  threadContent: {
    flex: 1,
    paddingBottom: 24,
  },
  threadUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  threadUser: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  threadAction: {
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
    fontSize: 13,
  },
  threadBody: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.body,
    marginTop: 6,
    lineHeight: 22,
  },
  threadTime: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 6,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 11,
    fontFamily: theme.fonts.heading,
    textTransform: "uppercase",
  },
});
