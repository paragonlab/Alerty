import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Video, ResizeMode, Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useAlertyStore } from "../lib/alerty/store";
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  DANGER_CATEGORIES,
  INFO_DISCLAIMER,
  RELIABLE_REPORTER_MIN_CONFIRMATIONS,
} from "../lib/alerty/constants";
import {
  calculateDistance,
  formatRelativeTime,
  getAlertAgeMinutes,
  getIntensityColor,
} from "../lib/alerty/utils";
import { Sounds } from "../lib/sounds";
import { shareAlertPulse } from "../lib/alerty/share";
import type { AlertItem, CommunityPost } from "../lib/alerty/types";
import { communitySourceLabel, isNewsPost } from "../lib/alerty/communityLabel";
import { recordAlertView } from "../lib/alerty/impact";
import { requireSession } from "../lib/alerty/session";
import { useRouter } from "expo-router";
import { CommunityVoteBar } from "./CommunityVoteBar";
import { MapBackdrop } from "./MapBackdrop";
import { ReelsTimeFilter } from "./ReelsTimeFilter";

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

/** En categorías de riesgo, grabar solo después de confirmar que se está a salvo. */
function confirmSafe(): Promise<boolean> {
  const title = "Solo si estás a salvo";
  const message = "No te acerques ni grabes rostros de víctimas. Ningún video vale tu seguridad.";
  if (Platform.OS === "web") {
    return Promise.resolve(Boolean(globalThis.confirm?.(`${title}\n\n${message}`)));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: "Mejor no", style: "cancel", onPress: () => resolve(false) },
        { text: "Estoy a salvo", onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
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
            <Text style={styles.denyBtnText}>Es falsa</Text>
          </Pressable>
          <Pressable
            style={[styles.confirmBtn, !selected && styles.confirmBtnOff]}
            onPress={doConfirm}
            disabled={!selected}
          >
            <Ionicons name="checkmark" size={13} color={selected ? "#0A0A0A" : "white"} />
            <Text style={[styles.confirmBtnText, !selected && { color: "rgba(255,255,255,0.5)" }]}>
              Es real
            </Text>
          </Pressable>
        </View>
      </View>
      </Animated.View>
    </View>
  );
}

// ── VideoReelCard ─────────────────────────────────────────────────────────────

/** Lo que se ve de fondo en un pulso de vecino. */
type ReelMedium = "video" | "photo" | "voice" | "text";

/** Nota de voz: suena sola al entrar en pantalla y se ve como ondas. */
function VoicePlayer({
  uri,
  playing,
  paused,
  muted,
  color,
}: {
  uri: string;
  playing: boolean;
  /** Las ondas se mueven mientras la tarjeta esté a la vista y sin pausar. */
  paused: boolean;
  muted: boolean;
  color: string;
}) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const bars = useMemo(() => Array.from({ length: 26 }, () => new Animated.Value(0.2)), []);

  useEffect(() => {
    if (!playing) return;
    let active = true;
    let sound: Audio.Sound | null = null;
    void (async () => {
      try {
        const created = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, isLooping: true, isMuted: muted },
        );
        if (!active) {
          void created.sound.unloadAsync();
          return;
        }
        sound = created.sound;
        soundRef.current = created.sound;
      } catch (e) {
        console.warn("voice playback failed", e);
      }
    })();
    return () => {
      active = false;
      soundRef.current = null;
      void sound?.unloadAsync();
    };
  }, [uri, playing]);

  useEffect(() => {
    void soundRef.current?.setIsMutedAsync(muted);
  }, [muted]);

  useEffect(() => {
    if (paused) return;
    const loops = bars.map((bar, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 45),
          Animated.timing(bar, {
            toValue: 0.55 + ((i % 5) * 0.09),
            duration: 280 + ((i * 37) % 260),
            useNativeDriver: true,
          }),
          Animated.timing(bar, { toValue: 0.2, duration: 300, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [paused, bars]);

  return (
    <View style={styles.voiceWrap} pointerEvents="none">
      <View style={[styles.voiceIcon, { borderColor: color }]}>
        <Ionicons name="mic" size={26} color={color} />
      </View>
      <View style={styles.voiceBars}>
        {bars.map((bar, i) => (
          <Animated.View
            key={i}
            style={[styles.voiceBar, { backgroundColor: color, transform: [{ scaleY: bar }] }]}
          />
        ))}
      </View>
      <Text style={styles.voiceLabel}>NOTA DE VOZ</Text>
    </View>
  );
}

/** Pulso de solo texto: se lee grande sobre el mapa del lugar. */
function TextPulse({ alert, color }: { alert: AlertItem; color: string }) {
  const body = alert.title ?? alert.description ?? CATEGORY_LABELS[alert.category];
  return (
    <View style={styles.textPulseWrap} pointerEvents="none">
      <View style={[styles.textPulseMark, { borderColor: color + "66", backgroundColor: color + "26" }]}>
        <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={18} color={color} />
      </View>
      <Text style={styles.textPulseBody} numberOfLines={7}>
        {body}
      </Text>
    </View>
  );
}

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
  const { voteAlert, votedAlerts, addAngleAlert, maxReportingDistance, alerts } = useAlertyStore();

  // Video, foto, voz o solo texto. Voz y texto se ven sobre el mapa del lugar
  // desde donde se envió el pulso.
  const videoUri = alert.media.find((m) => m.type === "video")?.url;
  const photoUri = alert.media.find((m) => m.type === "image")?.url;
  const audioUri = alert.media.find((m) => m.type === "audio")?.url;
  const medium: ReelMedium = videoUri
    ? "video"
    : photoUri
      ? "photo"
      : audioUri
        ? "voice"
        : "text";

  // En una nota de voz el audio es el contenido: arranca con sonido.
  const [isMuted, setIsMuted] = useState(medium !== "voice");
  const [isPaused, setIsPaused] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [contributing, setContributing] = useState(false);
  const barPulse = useRef(new Animated.Value(1)).current;
  const aportarPulse = useRef(new Animated.Value(0.9)).current;

  const parentAlert = alert.parentAlertId
    ? alerts.find((a) => a.id === alert.parentAlertId)
    : null;
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
  const risky = DANGER_CATEGORIES.includes(alert.category);
  const reliable =
    (alert.user.confirmationsReceived ?? 0) >= RELIABLE_REPORTER_MIN_CONFIRMATIONS;

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
    if (isNear && !risky) aportarLoop.start();
    return () => { barLoop.stop(); aportarLoop.stop(); };
  }, [isActive, isNear, risky]);

  // Cuenta como vista si el pulso estuvo 2 s en pantalla.
  useEffect(() => {
    if (!isActive) return;
    const t = setTimeout(() => void recordAlertView(alert.id), 2000);
    return () => clearTimeout(t);
  }, [isActive, alert.id]);

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
    if (risky && !(await confirmSafe())) return;
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
    // El reporte original: si esta alerta ya es un ángulo, el nuevo aporte
    // cuelga del mismo reporte raíz, no de un ángulo.
    const referenceId = alert.parentAlertId ?? alert.id;
    await addAngleAlert(referenceId, {
      id: `cap-${Date.now()}`,
      url: result.assets[0].uri,
      type: "video" as const,
    });
    setContributing(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("¡Gracias!", "Tu video se publicó como otro ángulo; ya aparece en Videos.");
  }

  return (
    <View style={styles.reel}>
      {/* fondo: lo que trae el pulso */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPaused((p) => !p)}>
        {medium === "video" ? (
          <Video
            source={{ uri: videoUri! }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            shouldPlay={isActive && !isPaused}
            isMuted={isMuted}
          />
        ) : medium === "photo" ? (
          <Image
            source={{ uri: photoUri! }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <>
            <MapBackdrop lat={alert.lat} lng={alert.lng} category={alert.category} />
            {medium === "voice" ? (
              <VoicePlayer
                uri={audioUri!}
                playing={isActive && !isPaused}
                paused={isPaused}
                muted={isMuted}
                color={intensityColor}
              />
            ) : (
              <TextPulse alert={alert} color={intensityColor} />
            )}
          </>
        )}
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
        {onClose && (
          <Pressable
            style={styles.listaBtn}
            onPress={onClose}
            accessibilityLabel="Volver a la lista de pulsos"
          >
            <Ionicons name="list" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.listaBtnText}>Ver lista</Text>
          </Pressable>
        )}
        {isLive ? (
          <View style={styles.liveChip}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN VIVO</Text>
          </View>
        ) : (
          <View style={[styles.ageChip, { borderColor: urgencyColor + "55", backgroundColor: urgencyColor + "1A" }]}>
            <Ionicons name="flame" size={11} color={urgencyColor} />
            <Text style={[styles.ageChipText, { color: urgencyColor }]}>
              {formatRelativeTime(alert.createdAt)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable
          style={styles.listaBtn}
          onPress={() => setIsMuted((m) => !m)}
          accessibilityLabel={isMuted ? "Activar audio" : "Silenciar audio"}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={14}
            color="rgba(255,255,255,0.9)"
          />
          <Text style={styles.listaBtnText}>{isMuted ? "Sin audio" : "Con audio"}</Text>
        </Pressable>
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

        {/* otro ángulo */}
        {alert.parentAlertId && (
          <View style={styles.angleChip}>
            <Ionicons name="git-branch" size={10} color="#FFB088" />
            <Text style={styles.angleChipText} numberOfLines={1}>
              Otro ángulo de: {parentAlert?.title ?? parentAlert?.description ?? "reporte original"}
            </Text>
          </View>
        )}

        {/* title — en un pulso de texto ya se lee grande al centro */}
        {(alert.title || alert.description) && medium !== "text" && (
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
            <Ionicons
              name={reliable ? "shield-checkmark" : "eye"}
              size={11}
              color={reliable ? "#66FF8C" : "rgba(255,255,255,0.6)"}
            />
            <Text style={[styles.metaChipText, reliable && { color: "#66FF8C" }]}>
              {reliable ? "REPORTERO CONFIABLE" : (alert.user.level ?? "vecino").toUpperCase()}
            </Text>
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

      {/* RIGHT ACTIONS — cada uno hace una cosa distinta, no están encadenados */}
      <View style={styles.actionsCol} pointerEvents="box-none">
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
            accessibilityLabel={`Marcar como real. ${confirmCount} confirmaciones`}
          >
            <Ionicons
              name={myVote === "upvote" ? "shield-checkmark" : "shield-checkmark-outline"}
              size={24}
              color={myVote === "upvote" ? "#66FF8C" : "white"}
            />
          </Pressable>
          <Text style={styles.actionLabel}>Es real</Text>
          <Text style={styles.actionCount}>{confirmCount}</Text>
        </View>

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
            accessibilityLabel="Marcar como falsa"
          >
            <Ionicons
              name={myVote === "downvote" ? "close-circle" : "close-circle-outline"}
              size={28}
              color={myVote === "downvote" ? "#EF4444" : "rgba(255,255,255,0.85)"}
            />
          </Pressable>
          <Text style={styles.actionLabel}>Es falsa</Text>
        </View>

        <View style={styles.actionItem}>
          <Pressable
            style={styles.actionIconBtn}
            onPress={() => {
              void Sounds.tap();
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              void shareAlertPulse({
                title: alert.title ?? CATEGORY_LABELS[alert.category],
                neighborhood: alert.neighborhood,
                alertId: alert.id,
              });
            }}
            accessibilityLabel="Compartir esta alerta"
          >
            <Ionicons name="share-social-outline" size={28} color="rgba(255,255,255,0.85)" />
          </Pressable>
          <Text style={styles.actionLabel}>Compartir alerta</Text>
        </View>

        <View style={styles.actionItem}>
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            {isNear && !risky && (
              <Animated.View
                style={[styles.aportarHalo, { transform: [{ scale: aportarPulse }] }]}
                pointerEvents="none"
              />
            )}
            <Pressable
              style={styles.aportarBtn}
              onPress={handleAportar}
              disabled={contributing}
              accessibilityLabel="Grabar un video de este evento"
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
            {contributing ? "Enviando…" : "Grabar video"}
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
            <Text style={styles.bottomCTASub}>
              {risky
                ? "Ponte a salvo primero. No grabes si te arriesgas."
                : "Graba un video y ayuda a confirmarlo"}
            </Text>
          </View>
        </View>
      )}

      {/* SWIPE HINT — oculto cuando se muestra el CTA de aportar para no encimarse */}
      {!isNear && (
        <View style={styles.swipeHint} pointerEvents="none">
          <Ionicons name="chevron-up" size={13} color="rgba(255,255,255,0.3)" />
          <Text style={styles.swipeHintText}>Siguiente video</Text>
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

// ── CommunityReelCard ─────────────────────────────────────────────────────────

/**
 * Video de X o de un medio. Los de X se reproducen dentro de Pulso con el
 * reproductor oficial de X; los de medios se abren en su sitio. Siempre dice
 * que no es alerta ciudadana.
 */
function CommunityReelCard({
  post,
  isActive,
  onClose,
}: {
  post: CommunityPost;
  isActive: boolean;
  onClose?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const news = isNewsPost(post);
  const source = communitySourceLabel(post);
  const [isMuted, setIsMuted] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const handle = post.authorHandle.replace(/^@/, "");
  const open = () => void Linking.openURL(post.url);
  const openProfile = () => void Linking.openURL(`https://x.com/${handle}`);

  // Con el mp4 de la API, pantalla completa como los videos de vecinos. Las
  // reglas de X piden logo, foto/nombre/@ con enlace al perfil, hora con
  // enlace al post y el texto sin cambios.
  if (post.videoUrl) {
    return (
      <View style={styles.reel}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPaused((p) => !p)}>
          {Platform.OS === "web" ? (
            // Web: <video> propio para que llene la pantalla. El Referer lo quita
            // VideoReelsList (ver useNoReferrerOnWeb).
            createElement("video", {
              src: post.videoUrl,
              poster: post.mediaUrl ?? undefined,
              loop: true,
              playsInline: true,
              style: {
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                background: "#000",
              },
              ref: (el: HTMLVideoElement | null) => {
                if (!el) return;
                el.muted = isMuted;
                if (isActive && !isPaused) void el.play().catch(() => {});
                else el.pause();
              },
            })
          ) : (
            <Video
              source={{ uri: post.videoUrl }}
              posterSource={post.mediaUrl ? { uri: post.mediaUrl } : undefined}
              usePoster={Boolean(post.mediaUrl)}
              posterStyle={{ resizeMode: "contain" }}
              style={StyleSheet.absoluteFill}
              resizeMode={ResizeMode.CONTAIN}
              isLooping
              shouldPlay={isActive && !isPaused}
              isMuted={isMuted}
            />
          )}
        </Pressable>

        {isPaused && (
          <View style={styles.pausedOverlay} pointerEvents="none">
            <Ionicons name="play" size={60} color="rgba(255,255,255,0.7)" />
          </View>
        )}

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

        <View style={styles.topRow}>
          {onClose && (
            <Pressable
              style={styles.listaBtn}
              onPress={onClose}
              accessibilityLabel="Volver a la lista de pulsos"
            >
              <Ionicons name="list" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.listaBtnText}>Ver lista</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          <Pressable
            style={styles.listaBtn}
            onPress={() => setIsMuted((m) => !m)}
            accessibilityLabel={isMuted ? "Activar audio" : "Silenciar audio"}
          >
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={14}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.listaBtnText}>{isMuted ? "Sin audio" : "Con audio"}</Text>
          </Pressable>
        </View>

        <View style={styles.infoOverlay} pointerEvents="box-none">
          <View style={styles.xAuthorRow}>
            <Pressable
              style={styles.xAuthor}
              onPress={openProfile}
              accessibilityLabel={`Perfil de @${handle} en X`}
            >
              {post.authorAvatarUrl ? (
                <Image source={{ uri: post.authorAvatarUrl }} style={styles.xAvatar} />
              ) : (
                <View style={[styles.xAvatar, { backgroundColor: "#333" }]} />
              )}
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.xName} numberOfLines={1}>
                  {post.authorName ?? handle}
                </Text>
                <Text style={styles.xHandle} numberOfLines={1}>
                  @{handle}
                </Text>
              </View>
            </Pressable>
            <Ionicons name="logo-x" size={18} color="#FFFFFF" />
          </View>
          <Text style={styles.xText} numberOfLines={4}>
            {post.text}
          </Text>
          <Pressable onPress={open} accessibilityLabel="Ver el post en X">
            <Text style={styles.xTime}>{formatRelativeTime(post.createdAt)} · Ver en X</Text>
          </Pressable>
          <View style={[styles.catPill, styles.sourcePill]}>
            <Text style={[styles.catText, { color: "#7CC4FA" }]}>NO ES ALERTA CIUDADANA</Text>
          </View>
          <CommunityVoteBar postId={post.id} dark />
        </View>
      </View>
    );
  }

  // Sin mp4 (medios, o un post de X que aún no lo trae): miniatura, y el
  // video se abre en su fuente.
  return (
    <View style={styles.reel}>
      {post.mediaUrl && !failed ? (
        <Image
          source={{ uri: post.mediaUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : null}
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

      <View style={styles.topRow}>
        {onClose && (
          <Pressable
            style={styles.listaBtn}
            onPress={onClose}
            accessibilityLabel="Volver a la lista de pulsos"
          >
            <Ionicons name="list" size={14} color="rgba(255,255,255,0.9)" />
            <Text style={styles.listaBtnText}>Ver lista</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.playCenter} pointerEvents="box-none">
        <Pressable onPress={open} hitSlop={12} accessibilityLabel={`Ver video en ${news ? source : "X"}`}>
          <Ionicons name="play-circle" size={76} color="rgba(255,255,255,0.88)" />
        </Pressable>
      </View>

      <View style={styles.infoOverlay} pointerEvents="box-none">
        <View style={[styles.catPill, styles.sourcePill]}>
          <Ionicons name={news ? "newspaper-outline" : "logo-x"} size={11} color="#7CC4FA" />
          <Text style={[styles.catText, { color: "#7CC4FA" }]}>
            {source.toUpperCase()} · NO ES ALERTA CIUDADANA
          </Text>
        </View>
        <Text style={styles.alertTitle} numberOfLines={3}>
          {post.text}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaChip}>
            <Ionicons name="person-circle-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.metaChipText}>@{handle}</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.6)" />
            <Text style={styles.metaChipText}>{formatRelativeTime(post.createdAt)}</Text>
          </View>
        </View>
        <CommunityVoteBar postId={post.id} dark />
        <Pressable style={styles.sourceCta} onPress={open}>
          <Ionicons name="open-outline" size={14} color="#0A0A0A" />
          <Text style={styles.sourceCtaText}>Ver video en {news ? source : "X"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * En web, video.twimg.com responde 403 a peticiones con Referer de otro sitio,
 * y un <video> no acepta referrerpolicy propio. Mientras Videos está abierto la
 * página no manda Referer; al salir vuelve a la política normal. En iOS y
 * Android el reproductor nativo no manda Referer.
 */
function useNoReferrerOnWeb() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
    const previous = meta?.content ?? null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "referrer";
      document.head.appendChild(meta);
    }
    meta.content = "no-referrer";
    return () => {
      if (meta) meta.content = previous ?? "strict-origin-when-cross-origin";
    };
  }, []);
}

// ── VideoReelsList ────────────────────────────────────────────────────────────

/** Al terminar los videos: lo avisa y recuerda que Pulso no es verdad absoluta. */
function ReelsEnd({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  return (
    <View style={[styles.reel, styles.endCard]}>
      <Ionicons name="checkmark-done-circle-outline" size={52} color="rgba(255,255,255,0.55)" />
      <Text style={styles.endTitle}>Ya viste todos los videos</Text>
      <Text style={styles.endSub}>Cambia el horario arriba para ver más, o vuelve más tarde.</Text>
      <Text style={styles.endDisclaimer}>{INFO_DISCLAIMER}</Text>
      <Pressable
        style={[styles.sourceCta, { alignSelf: "center" }]}
        onPress={async () => {
          if (await requireSession("/report")) router.push("/report" as any);
        }}
      >
        <Ionicons name="add-circle-outline" size={14} color="#0A0A0A" />
        <Text style={styles.sourceCtaText}>Publicar un pulso</Text>
      </Pressable>
      {onClose ? (
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Volver a la lista de pulsos">
          <Text style={styles.endLink}>Volver a la lista</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type ReelItem =
  | { key: string; kind: "alert"; alert: AlertItem }
  | { key: string; kind: "community"; post: CommunityPost };

export function VideoReelsList({
  alerts,
  communityVideos = [],
  onClose,
  initialAlertId,
}: {
  alerts: AlertItem[];
  /** Videos de X y medios: van después de los de vecinos para que nunca quede vacío. */
  communityVideos?: CommunityPost[];
  onClose?: () => void;
  initialAlertId?: string | null;
}) {
  useNoReferrerOnWeb();
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

  const items = useMemo<ReelItem[]>(() => {
    const all: ReelItem[] = [
      ...ordered.map((alert) => ({ key: alert.id, kind: "alert" as const, alert })),
      ...[...communityVideos]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((post) => ({ key: `c-${post.id}`, kind: "community" as const, post })),
    ];
    // Un video de X tocado en la lista o el mapa va primero.
    const idx = initialAlertId ? all.findIndex((item) => item.key === initialAlertId) : -1;
    if (idx <= 0) return all;
    return [all[idx], ...all.slice(0, idx), ...all.slice(idx + 1)];
  }, [ordered, communityVideos, initialAlertId]);

  // Hasta que la lista reporte qué está en pantalla, el primero cuenta como
  // activo: si no, el primer video no arranca solo.
  const currentKey = activeId ?? items[0]?.key ?? null;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveId((viewableItems[0].item as ReelItem).key);
      }
    },
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === "alert" ? (
            <VideoReelCard
              alert={item.alert}
              isActive={currentKey === item.key}
              userCoords={userCoords}
              onClose={onClose}
            />
          ) : (
            <CommunityReelCard
              post={item.post}
              isActive={currentKey === item.key}
              onClose={onClose}
            />
          )
        }
        ListFooterComponent={<ReelsEnd onClose={onClose} />}
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
      {/* Horario: el mismo del mapa y la lista, al centro de la barra de arriba. */}
      <View style={styles.timeOverlay} pointerEvents="box-none">
        <ReelsTimeFilter />
      </View>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  voiceWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  voiceIcon: {
    width: 68,
    height: 68,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  voiceBars: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 78,
  },
  voiceBar: {
    width: 4,
    height: 78,
    borderRadius: 999,
  },
  voiceLabel: {
    fontSize: 11,
    letterSpacing: 2,
    color: "rgba(255,255,255,0.6)",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  textPulseWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 34,
    gap: 16,
  },
  textPulseMark: {
    width: 46,
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textPulseBody: {
    fontSize: 26,
    lineHeight: 34,
    textAlign: "center",
    color: "#fff",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  endCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 28,
  },
  endTitle: {
    fontSize: 20,
    color: "#FFFFFF",
    textAlign: "center",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  endSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  endDisclaimer: {
    fontSize: 12,
    lineHeight: 17,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    marginTop: 6,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  endLink: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  timeOverlay: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 30,
  },
  playCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  xAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  xAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  xAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  xName: {
    fontSize: 14,
    color: "#FFFFFF",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  xHandle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  xText: {
    fontSize: 15,
    lineHeight: 21,
    color: "#FFFFFF",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  xTime: {
    fontSize: 12,
    color: "#7CC4FA",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  sourcePill: {
    borderColor: "rgba(124,196,250,0.5)",
    backgroundColor: "rgba(29,155,240,0.18)",
  },
  sourceCta: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  sourceCtaText: {
    fontSize: 13,
    color: "#0A0A0A",
    fontFamily: "SpaceGrotesk_700Bold",
  },
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
  listaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 34,
    paddingHorizontal: 11,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  listaBtnText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
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
  angleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    maxWidth: "100%",
    backgroundColor: "rgba(255,107,58,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,107,58,0.4)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  angleChipText: {
    color: "#FFB088",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_500Medium",
    flexShrink: 1,
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
    fontSize: 11,
    fontFamily: "SpaceGrotesk_700Bold",
    textAlign: "center",
    maxWidth: 72,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actionCount: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    fontFamily: "SpaceGrotesk_500Medium",
    marginTop: -2,
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
