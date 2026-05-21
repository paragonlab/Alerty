import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAlertyStore } from "../lib/alerty/store";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../lib/alerty/constants";
import {
  calculateDistance,
  getAlertAgeMinutes,
  getIntensityColor,
} from "../lib/alerty/utils";
import { Sounds } from "../lib/sounds";
import type { AlertItem } from "../lib/alerty/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const VERIFICATION_THRESHOLD = 40;
const MAP_W = 116;
const MAP_H = 88;

// ── helpers ───────────────────────────────────────────────────────────────────

function calcBearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const r1 = (lat1 * Math.PI) / 180;
  const r2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(r2);
  const x = Math.cos(r1) * Math.sin(r2) - Math.sin(r1) * Math.cos(r2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function toCardinal(deg: number): string {
  return ["N", "NE", "E", "SE", "S", "SO", "O", "NO"][Math.round(deg / 45) % 8];
}

function fmtDist(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}

function barColor(createdAt: string): string {
  const min = getAlertAgeMinutes(createdAt);
  if (min <= 30) return "#FF3B3B";
  if (min <= 180) return "#FF8C00";
  return "#F5C518";
}

// ── MiniMap ───────────────────────────────────────────────────────────────────

function MiniMap({ deg, distText }: { deg: number | null; distText: string | null }) {
  const USER_X = MAP_W * 0.5;
  const USER_Y = MAP_H * 0.68;
  const R = 32;
  const a = deg !== null ? ((deg - 90) * Math.PI) / 180 : (-55 * Math.PI) / 180;
  const rawEvX = USER_X + Math.cos(a) * R;
  const rawEvY = USER_Y + Math.sin(a) * R;
  const evX = Math.max(8, Math.min(MAP_W - 8, rawEvX));
  const evY = Math.max(8, Math.min(MAP_H - 18, rawEvY));

  const dx = evX - USER_X;
  const dy = evY - USER_Y;
  const lineLen = Math.sqrt(dx * dx + dy * dy);
  const lineAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const cx = (USER_X + evX) / 2;
  const cy = (USER_Y + evY) / 2;

  return (
    <View style={styles.minimap}>
      <View style={styles.mapGridH} />
      <View style={styles.mapGridV} />
      {/* connecting line */}
      <View
        style={[
          styles.mapLine,
          {
            width: lineLen,
            left: cx - lineLen / 2,
            top: cy,
            transform: [{ rotate: `${lineAngle}deg` }],
          },
        ]}
      />
      {/* event dot */}
      <View style={[styles.mapEvtOuter, { left: evX - 7, top: evY - 7 }]}>
        <View style={styles.mapEvtInner} />
      </View>
      {/* user dot */}
      <View style={[styles.mapUserOuter, { left: USER_X - 5, top: USER_Y - 5 }]}>
        <View style={styles.mapUserInner} />
      </View>
      {distText && (
        <View style={styles.mapLabel}>
          <Ionicons name="location" size={9} color="#22D3EE" />
          <Text style={styles.mapLabelText}>{distText.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );
}

// ── ConfirmSheet ──────────────────────────────────────────────────────────────

const CONFIRM_OPTS = [
  { id: "see",    icon: "location" as const,          label: "Sí lo veo",      desc: "Lo estoy presenciando ahora mismo" },
  { id: "hear",   icon: "ear-outline" as const,        label: "Lo escucho",     desc: "Detonaciones audibles desde aquí" },
  { id: "told",   icon: "chatbubble-outline" as const, label: "Me reportaron",  desc: "Familiar/amigo me contó" },
  { id: "social", icon: "newspaper-outline" as const,  label: "Vi en redes",    desc: "Lo confirma otra fuente" },
];

function ConfirmSheet({
  alert,
  visible,
  onClose,
  distKm,
}: {
  alert: AlertItem;
  visible: boolean;
  onClose: () => void;
  distKm: number | null;
}) {
  const { voteAlert } = useAlertyStore();
  const [selected, setSelected] = useState<string | null>(null);
  const slide = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      damping: 22,
      stiffness: 200,
    }).start();
    if (!visible) setSelected(null);
  }, [visible]);

  const isNear = distKm !== null && distKm < 0.1;

  function doConfirm() {
    void Sounds.tap();
    voteAlert(alert.id, "upvote");
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  }

  function doDeny() {
    void Sounds.tap();
    voteAlert(alert.id, "downvote");
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  }

  return (
    <View pointerEvents={visible ? "auto" : "none"} style={styles.sheetRoot}>
      <Animated.View
        style={[
          styles.sheetScrim,
          { opacity: slide.interpolate({ inputRange: [0, 600], outputRange: [1, 0] }) },
        ]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheetWrap, { transform: [{ translateY: slide }] }]}>
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHead}>
          <View style={styles.sheetIconWrap}>
            <Ionicons name="shield-checkmark" size={20} color="#66FF8C" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetTitle}>¿Estás cerca?</Text>
            <Text style={styles.sheetSub}>Tu confirmación pesa más si estás en la zona</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <View style={styles.sheetOpts}>
          {CONFIRM_OPTS.map((opt) => {
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.sheetOpt, active && styles.sheetOptActive]}
                onPress={() => {
                  setSelected(opt.id);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <View style={styles.sheetOptRow}>
                  <Ionicons
                    name={opt.icon}
                    size={14}
                    color={active ? "#66FF8C" : "rgba(255,255,255,0.65)"}
                  />
                  <Text style={[styles.sheetOptTitle, active && { color: "#66FF8C" }]}>
                    {opt.label}
                  </Text>
                </View>
                <Text style={styles.sheetOptDesc}>{opt.desc}</Text>
              </Pressable>
            );
          })}
        </View>

        {isNear && (
          <View style={styles.nearBonus}>
            <Ionicons name="checkmark-circle" size={13} color="#66FF8C" />
            <Text style={styles.nearBonusText}>
              <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }}>
                Estás a {Math.round(distKm! * 1000)}m.{" "}
              </Text>
              Tu confirmación cuenta 5×.
            </Text>
          </View>
        )}

        <View style={styles.sheetVote}>
          <Pressable style={styles.denyBtn} onPress={doDeny}>
            <Ionicons name="close" size={13} color="white" />
            <Text style={styles.denyBtnText}>FALSA</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, !selected && styles.confirmBtnOff]}
            onPress={doConfirm}
            disabled={!selected}
          >
            <Ionicons name="checkmark" size={13} color={selected ? "#0A0A0A" : "white"} />
            <Text style={[styles.confirmBtnText, !selected && { color: "rgba(255,255,255,0.5)" }]}>
              ES REAL
            </Text>
          </Pressable>
        </View>
      </View>
      </Animated.View>
    </View>
  );
}

// ── VideoReelCard ─────────────────────────────────────────────────────────────

export function VideoReelCard({
  alert,
  isActive,
  userCoords,
  onClose,
}: {
  alert: AlertItem;
  isActive: boolean;
  userCoords: { latitude: number; longitude: number } | null;
  onClose?: () => void;
}) {
  const { voteAlert, votedAlerts, addUpdateToAlert, maxReportingDistance } = useAlertyStore();
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [avoided, setAvoided] = useState(false);
  const [contributing, setContributing] = useState(false);
  const barPulse = useRef(new Animated.Value(1)).current;
  const aportarPulse = useRef(new Animated.Value(0.9)).current;

  const videoUri = alert.media.find((m) => m.type === "video")?.url;
  const myVote = votedAlerts[alert.id];
  const voted = Boolean(myVote);
  const ageMin = getAlertAgeMinutes(alert.createdAt);
  const isLive = ageMin <= 2;
  const intensityColor = getIntensityColor(alert.createdAt);
  const urgencyColor = barColor(alert.createdAt);

  const distKm = userCoords
    ? calculateDistance(userCoords.latitude, userCoords.longitude, alert.lat, alert.lng)
    : null;
  const deg = userCoords
    ? calcBearingDeg(userCoords.latitude, userCoords.longitude, alert.lat, alert.lng)
    : null;
  const cardinal = deg !== null ? toCardinal(deg) : null;
  const distText = distKm !== null ? fmtDist(distKm) : null;
  const isNear = distKm !== null && distKm < 0.5;

  const confirmCount = alert.upvotes;
  const verifyPct = Math.min(100, (confirmCount / VERIFICATION_THRESHOLD) * 100);
  const remaining = Math.max(0, VERIFICATION_THRESHOLD - confirmCount);

  useEffect(() => {
    if (!isActive) return;
    const barLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(barPulse, { toValue: 0.45, duration: 950, useNativeDriver: true }),
        Animated.timing(barPulse, { toValue: 1, duration: 950, useNativeDriver: true }),
      ]),
    );
    const aportarLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(aportarPulse, { toValue: 1.22, duration: 900, useNativeDriver: true }),
        Animated.timing(aportarPulse, { toValue: 0.9, duration: 900, useNativeDriver: true }),
      ]),
    );
    barLoop.start();
    if (isNear) aportarLoop.start();
    return () => { barLoop.stop(); aportarLoop.stop(); };
  }, [isActive, isNear]);

  async function handleAportar() {
    if (contributing) return;
    void Sounds.tap();
    if (distKm !== null && distKm > maxReportingDistance) {
      Alert.alert(
        "Fuera de rango",
        `Debes estar a menos de ${maxReportingDistance}km del evento para aportar tu video. (Distancia actual: ${distKm.toFixed(2)}km)`,
      );
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso", "Necesitamos la cámara para aportar tu video.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "videos",
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    setContributing(true);
    await addUpdateToAlert(alert.id, "Otro ángulo del evento", [
      { id: `cap-${Date.now()}`, url: result.assets[0].uri, type: "video" as const },
    ]);
    setContributing(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("¡Gracias!", "Tu video se agregó como otro ángulo de este reporte.");
  }

  if (!videoUri) return null;

  return (
    <View style={styles.reel}>
      {/* video */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPaused((p) => !p)}>
        <Video
          source={{ uri: videoUri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && !isPaused}
          isMuted={isMuted}
        />
      </Pressable>

      {isPaused && (
        <View style={styles.pausedOverlay} pointerEvents="none">
          <Ionicons name="play" size={60} color="rgba(255,255,255,0.7)" />
        </View>
      )}

      {/* gradients */}
      <LinearGradient
        colors={["rgba(0,0,0,0.72)", "transparent"]}
        style={styles.gradTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        start={{ x: 0, y: 0.1 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradBottom}
        pointerEvents="none"
      />

      {/* intensity bar */}
      <Animated.View
        style={[styles.intensityBar, { backgroundColor: urgencyColor, opacity: barPulse }]}
        pointerEvents="none"
      />

      {/* TOP ROW */}
      <View style={styles.topRow}>
        {isLive ? (
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        ) : (
          <View style={[styles.ageChip, { borderColor: urgencyColor + "55", backgroundColor: urgencyColor + "1A" }]}>
            <Ionicons name="flame" size={11} color={urgencyColor} />
            <Text style={[styles.ageChipText, { color: urgencyColor }]}>Hace {ageMin} min</Text>
          </View>
        )}
        <View style={styles.viewersChip}>
          <Ionicons name="eye-outline" size={11} color="rgba(255,255,255,0.6)" />
          <Text style={styles.viewersText}>{(confirmCount + 38).toLocaleString()}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.topIconBtn} onPress={() => setIsMuted((m) => !m)}>
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={17}
            color="rgba(255,255,255,0.85)"
          />
        </Pressable>
        {onClose && (
          <Pressable style={styles.topIconBtn} onPress={onClose}>
            <Ionicons name="close" size={19} color="rgba(255,255,255,0.85)" />
          </Pressable>
        )}
      </View>

      {/* MINI-MAP */}
      <View style={styles.minimapWrap}>
        <MiniMap deg={deg} distText={distText} />
      </View>

      {/* LEFT INFO */}
      <View style={styles.infoOverlay} pointerEvents="box-none">
        {/* category */}
        <View
          style={[
            styles.catPill,
            { borderColor: intensityColor + "80", backgroundColor: intensityColor + "22" },
          ]}
        >
          <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={11} color={intensityColor} />
          <Text style={[styles.catText, { color: intensityColor }]}>
            {CATEGORY_LABELS[alert.category].toUpperCase()}
          </Text>
        </View>

        {/* title */}
        {(alert.title || alert.description) && (
          <Text style={styles.alertTitle} numberOfLines={2}>
            {alert.title ?? alert.description}
          </Text>
        )}

        {/* distance + bearing */}
        {distText && cardinal && (
          <View style={styles.distRow}>
            <View style={styles.distArrowWrap}>
              <LinearGradient
                colors={["#FF8859", "#E84F1F"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                start={{ x: 0.3, y: 0.2 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons
                name="arrow-up"
                size={13}
                color="white"
                style={{ transform: [{ rotate: `${deg ?? 0}deg` }] }}
              />
            </View>
            <View>
              <Text style={styles.distMain}>{distText} · {cardinal}</Text>
              <Text style={styles.distSub}>DE TU UBICACIÓN</Text>
            </View>
          </View>
        )}

        {/* user + level chips */}
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="person-circle-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.metaChipText}>@{alert.user.username}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="eye" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.metaChipText}>{alert.user.level.toUpperCase()}</Text>
          </View>
          {isNear && distText && (
            <View style={styles.metaChip}>
              <Ionicons name="locate-outline" size={11} color="rgba(255,255,255,0.6)" />
              <Text style={styles.metaChipText}>A {distText} del lugar</Text>
            </View>
          )}
        </View>

        {/* verification bar */}
        <View style={styles.verifyWrap}>
          <View style={styles.verifyRow}>
            <Ionicons name="shield-checkmark" size={13} color="#66FF8C" />
            <Text style={styles.verifyText} numberOfLines={1}>
              <Text style={{ fontFamily: "SpaceGrotesk_700Bold" }}>{confirmCount} confirman</Text>
              {remaining > 0 ? ` · ${remaining} más para verificar` : " · ¡Verificado!"}
            </Text>
            <Text style={styles.verifyPct}>{Math.round(verifyPct)}%</Text>
          </View>
          <View style={styles.verifyTrack}>
            <View style={[styles.verifyFill, { width: `${verifyPct}%` }]} />
          </View>
        </View>
      </View>

      {/* RIGHT ACTIONS */}
      <View style={styles.actionsCol} pointerEvents="box-none">
        {/* Es real */}
        <View style={styles.actionItem}>
          <Pressable
            style={[styles.confirmActionBtn, myVote === "upvote" && styles.confirmActionBtnDone]}
            onPress={() => {
              if (voted) return;
              void Sounds.tap();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowConfirm(true);
            }}
            disabled={voted}
          >
            <Ionicons
              name={myVote === "upvote" ? "shield-checkmark" : "shield-checkmark-outline"}
              size={24}
              color={myVote === "upvote" ? "#66FF8C" : "white"}
            />
          </Pressable>
          <Text style={styles.actionLabel}>{confirmCount}</Text>
        </View>

        {/* Falsa */}
        <View style={styles.actionItem}>
          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              if (voted) return;
              void Sounds.tap();
              voteAlert(alert.id, "downvote");
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            disabled={voted}
          >
            <Ionicons
              name={myVote === "downvote" ? "close-circle" : "close-circle-outline"}
              size={28}
              color={myVote === "downvote" ? "#EF4444" : "rgba(255,255,255,0.85)"}
            />
          </Pressable>
          <Text style={styles.actionLabel}>Falsa</Text>
        </View>

        {/* Evitar zona */}
        <View style={styles.actionItem}>
          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              void Sounds.tap();
              setAvoided((v) => !v);
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }}
          >
            <Ionicons
              name={avoided ? "git-branch" : "git-branch-outline"}
              size={28}
              color={avoided ? "#818CF8" : "rgba(255,255,255,0.85)"}
            />
          </Pressable>
          <Text style={[styles.actionLabel, avoided && { color: "#818CF8" }]}>
            {avoided ? "Evitando" : "Evitar"}
          </Text>
        </View>

        {/* Compartir */}
        <View style={styles.actionItem}>
          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              void Sounds.tap();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void Share.share({
                message: `Alerta en Pulso: ${alert.title ?? CATEGORY_LABELS[alert.category]} · ${alert.neighborhood ?? "Culiacán"}`,
              }).catch(() => {});
            }}
          >
            <Ionicons name="share-social-outline" size={28} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Text style={styles.actionLabel}>Compartir</Text>
        </View>

        {/* Aportar video */}
        <View style={styles.actionItem}>
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            {isNear && (
              <Animated.View
                style={[styles.aportarHalo, { transform: [{ scale: aportarPulse }] }]}
                pointerEvents="none"
              />
            )}
            <Pressable
              style={styles.aportarBtn}
              onPress={handleAportar}
              disabled={contributing}
            >
              <LinearGradient
                colors={["#FF6B3A", "#E84F1F"]}
                style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                start={{ x: 0.3, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <Ionicons name={contributing ? "hourglass" : "videocam"} size={26} color="#fff" />
            </Pressable>
          </View>
          <Text style={[styles.actionLabel, { color: isNear ? "#FFB088" : "rgba(255,255,255,0.82)" }]}>
            {contributing ? "Enviando..." : "Aportar"}
          </Text>
        </View>
      </View>

      {/* BOTTOM CTA */}
      {isNear && distText && (
        <View style={styles.bottomCTA}>
          <View style={styles.bottomCTAIcon}>
            <Ionicons name="videocam" size={15} color="#F97316" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bottomCTATitle}>Estás a {distText} del evento.</Text>
            <Text style={styles.bottomCTASub}>Aporta video y sube reputación</Text>
          </View>
        </View>
      )}

      {/* SWIPE HINT — oculto cuando se muestra el CTA de aportar para no encimarse */}
      {!isNear && (
        <View style={styles.swipeHint} pointerEvents="none">
          <Ionicons name="chevron-up" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={styles.swipeHintText}>Sig. evento</Text>
        </View>
      )}

      {/* CONFIRM SHEET */}
      <ConfirmSheet
        alert={alert}
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        distKm={distKm}
      />
    </View>
  );
}

// ── VideoReelsList ────────────────────────────────────────────────────────────

export function VideoReelsList({
  alerts,
  onClose,
  initialAlertId,
}: {
  alerts: AlertItem[];
  onClose?: () => void;
  initialAlertId?: string | null;
}) {
  const [activeId, setActiveId] = useState<string | null>(initialAlertId ?? null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  useEffect(() => {
    Location.requestForegroundPermissionsAsync().then(({ status }) => {
      if (status !== "granted") return;
      Location.getCurrentPositionAsync({}).then((loc) => {
        setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      });
    });
  }, []);

  const sorted = useMemo(() => {
    if (!userCoords) return alerts;
    return [...alerts].sort((a, b) => {
      const ageA = Math.max(1, getAlertAgeMinutes(a.createdAt));
      const ageB = Math.max(1, getAlertAgeMinutes(b.createdAt));
      const distA =
        calculateDistance(userCoords.latitude, userCoords.longitude, a.lat, a.lng) + 0.1;
      const distB =
        calculateDistance(userCoords.latitude, userCoords.longitude, b.lat, b.lng) + 0.1;
      const scoreA = (1 / ageA) * (1 / distA) * (a.upvotes + 1);
      const scoreB = (1 / ageB) * (1 / distB) * (b.upvotes + 1);
      return scoreB - scoreA;
    });
  }, [alerts, userCoords]);

  // Si se abrió desde un video específico, ese Pulso va primero.
  const ordered = useMemo(() => {
    if (!initialAlertId) return sorted;
    const idx = sorted.findIndex((a) => a.id === initialAlertId);
    if (idx <= 0) return sorted;
    const copy = [...sorted];
    const [target] = copy.splice(idx, 1);
    return [target, ...copy];
  }, [sorted, initialAlertId]);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveId((viewableItems[0].item as AlertItem).id);
      }
    },
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={ordered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VideoReelCard
            alert={item}
            isActive={activeId === item.id}
            userCoords={userCoords}
            onClose={onClose}
          />
        )}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        removeClippedSubviews
        windowSize={3}
      />
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  reel: {
    height: SCREEN_HEIGHT,
    backgroundColor: "#090909",
    overflow: "hidden",
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  gradTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 220,
    zIndex: 2,
  },
  gradBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "68%",
    zIndex: 2,
  },
  intensityBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    zIndex: 20,
  },

  // top row
  topRow: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    zIndex: 10,
  },
  liveChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(239,68,68,0.85)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "white",
  },
  liveText: {
    color: "white",
    fontSize: 11,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  ageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  ageChipText: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  viewersChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  viewersText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  topIconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 17,
  },

  // mini-map
  minimapWrap: {
    position: "absolute",
    top: 102,
    right: 14,
    zIndex: 10,
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 6,
  },
  minimap: {
    width: MAP_W,
    height: MAP_H,
    backgroundColor: "rgba(8,18,28,0.88)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  mapGridH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: MAP_H * 0.44,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mapGridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: MAP_W * 0.5,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  mapLine: {
    position: "absolute",
    height: 1,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  mapEvtOuter: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,59,59,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapEvtInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF3B3B",
  },
  mapUserOuter: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(34,211,238,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapUserInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#22D3EE",
  },
  mapLabel: {
    position: "absolute",
    bottom: 5,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  mapLabelText: {
    color: "#22D3EE",
    fontSize: 9,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },

  // left info
  infoOverlay: {
    position: "absolute",
    bottom: 150,
    left: 16,
    right: 90,
    gap: 9,
    zIndex: 5,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  catText: {
    fontSize: 11,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  alertTitle: {
    color: "white",
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 23,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5,
  },
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  distArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  distMain: {
    color: "white",
    fontSize: 15,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  distSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 9,
    fontFamily: "SpaceGrotesk_500Medium",
    letterSpacing: 0.8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  metaChipText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  verifyWrap: {
    gap: 5,
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  verifyText: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    flex: 1,
  },
  verifyPct: {
    color: "#66FF8C",
    fontSize: 11,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  verifyTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "hidden",
  },
  verifyFill: {
    height: 3,
    backgroundColor: "#66FF8C",
    borderRadius: 2,
  },

  // right actions
  actionsCol: {
    position: "absolute",
    right: 14,
    bottom: 150,
    gap: 16,
    alignItems: "center",
    zIndex: 5,
  },
  actionItem: {
    alignItems: "center",
    gap: 4,
  },
  confirmActionBtn: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(102,255,140,0.15)",
    borderWidth: 1.5,
    borderColor: "rgba(102,255,140,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmActionBtnDone: {
    backgroundColor: "rgba(102,255,140,0.3)",
    borderColor: "#66FF8C",
  },
  actionIconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  aportarBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    shadowColor: "#FF4500",
    shadowOpacity: 0.55,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  aportarHalo: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "rgba(255,107,58,0.45)",
  },
  actionLabel: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_500Medium",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // bottom cta
  bottomCTA: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(249,115,22,0.12)",
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.3)",
    borderRadius: 12,
    padding: 10,
    zIndex: 5,
  },
  bottomCTAIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(249,115,22,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomCTATitle: {
    color: "white",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  bottomCTASub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_400Regular",
  },

  // swipe hint
  swipeHint: {
    position: "absolute",
    bottom: 108,
    left: 0,
    right: 0,
    alignItems: "center",
    gap: 2,
    zIndex: 5,
  },
  swipeHintText: {
    color: "rgba(255,255,255,0.32)",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_500Medium",
    letterSpacing: 0.4,
  },

  // confirm sheet
  sheetRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  sheetScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  sheetWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: "rgba(8,8,12,0.97)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 20,
    paddingBottom: 124,
    gap: 14,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 2,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  sheetIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(102,255,140,0.12)",
    borderWidth: 1,
    borderColor: "rgba(102,255,140,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    color: "white",
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  sheetSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    marginTop: 2,
  },
  sheetOpts: {
    gap: 7,
  },
  sheetOpt: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 3,
  },
  sheetOptActive: {
    backgroundColor: "rgba(102,255,140,0.09)",
    borderColor: "rgba(102,255,140,0.32)",
  },
  sheetOptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  sheetOptTitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  sheetOptDesc: {
    color: "rgba(255,255,255,0.38)",
    fontSize: 11,
    fontFamily: "SpaceGrotesk_400Regular",
    marginLeft: 21,
  },
  nearBonus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(102,255,140,0.07)",
    borderWidth: 1,
    borderColor: "rgba(102,255,140,0.18)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  nearBonusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_400Regular",
    flex: 1,
  },
  sheetVote: {
    flexDirection: "row",
    gap: 10,
  },
  denyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.18)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.32)",
    borderRadius: 12,
    paddingVertical: 13,
  },
  denyBtnText: {
    color: "white",
    fontSize: 13,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
  confirmBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#66FF8C",
    borderRadius: 12,
    paddingVertical: 13,
  },
  confirmBtnOff: {
    backgroundColor: "rgba(102,255,140,0.22)",
  },
  confirmBtnText: {
    color: "#0A0A0A",
    fontSize: 13,
    fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 0.5,
  },
});
