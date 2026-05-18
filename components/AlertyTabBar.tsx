import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlertyStore } from "../lib/alerty/store";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { Sounds } from "../lib/sounds";
import { supabase, isSupabaseConfigured } from "../lib/supabase";

export const TAB_BAR_HEIGHT = 88;

type TabBarProps = {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  descriptors: Record<string, { options: Record<string, unknown> }>;
  insets: { bottom: number };
};

// ── SOS animated button ───────────────────────────────────────────────────────

function SOSCenterBtn({
  size,
  socketColor,
  onPress,
  onLongPress,
}: {
  size: "large" | "mini";
  socketColor: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const outerSize = size === "large" ? 88 : 60;
  const coreSize = size === "large" ? 62 : 46;
  const glowSize = size === "large" ? 76 : 54;
  const radarSize = size === "large" ? 70 : 0;
  const iconSize = size === "large" ? 28 : 22;

  const auraAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim  = useRef(new Animated.Value(0)).current;
  const radarAnim = useRef(new Animated.Value(0)).current;
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;
  const diodeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loops: Animated.CompositeAnimation[] = [
      // aura: slow breathing 2.4s
      Animated.loop(Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])),
      // glow: faster breathing 1.5s
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 750, useNativeDriver: true }),
      ])),
      // radar: slow rotation 9s
      Animated.loop(Animated.timing(radarAnim, { toValue: 1, duration: 9000, useNativeDriver: true })),
      // diode: blink pattern (matches CSS keyframes)
      Animated.loop(Animated.sequence([
        Animated.timing(diodeAnim, { toValue: 0.2, duration: 288, useNativeDriver: true }),
        Animated.timing(diodeAnim, { toValue: 1.0, duration: 672, useNativeDriver: true }),
        Animated.timing(diodeAnim, { toValue: 0.2, duration: 288, useNativeDriver: true }),
        Animated.timing(diodeAnim, { toValue: 1.0, duration: 352, useNativeDriver: true }),
      ])),
    ];
    loops.forEach((l) => l.start());

    // waves: 3 staggered, each 2400ms cycle
    const makeWave = (v: Animated.Value) =>
      Animated.loop(Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
    let l2: Animated.CompositeAnimation | undefined;
    let l3: Animated.CompositeAnimation | undefined;
    const l1 = makeWave(wave1Anim);
    l1.start();
    const t2 = setTimeout(() => { l2 = makeWave(wave2Anim); l2.start(); }, 800);
    const t3 = setTimeout(() => { l3 = makeWave(wave3Anim); l3.start(); }, 1600);

    return () => {
      loops.forEach((l) => l.stop());
      l1.stop(); l2?.stop(); l3?.stop();
      clearTimeout(t2); clearTimeout(t3);
    };
  }, []);

  // Interpolated values
  const auraScale   = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const auraOpacity = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.78] });
  const glowScale   = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1.0, 1.12] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0.95] });
  const radarRotate = radarAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const waveStyle = (v: Animated.Value) => ({
    scale:   v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 2.2] }),
    opacity: v.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.8, 0.15, 0] }),
  });
  const w1 = waveStyle(wave1Anim);
  const w2 = waveStyle(wave2Anim);
  const w3 = waveStyle(wave3Anim);

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: "center", justifyContent: "center" }}>
      {/* Layer 1 — aura (atmosphere) */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", width: outerSize, height: outerSize,
          borderRadius: outerSize / 2,
          backgroundColor: "rgba(255,26,26,0.35)",
          opacity: auraOpacity, transform: [{ scale: auraScale }],
        }}
      />
      {/* Layer 2 — glow */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", width: glowSize, height: glowSize,
          borderRadius: glowSize / 2,
          backgroundColor: "rgba(255,26,26,0.42)",
          opacity: glowOpacity, transform: [{ scale: glowScale }],
        }}
      />
      {/* Layer 3 — rotating radar ring (large only) */}
      {size === "large" && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute", width: radarSize, height: radarSize,
            borderRadius: radarSize / 2,
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.28)",
            borderStyle: "dashed",
            transform: [{ rotate: radarRotate }],
          }}
        />
      )}
      {/* Layer 4 — expanding waves */}
      {[w1, w2, w3].map((w, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: "absolute", width: coreSize, height: coreSize,
            borderRadius: coreSize / 2,
            borderWidth: 2, borderColor: "#FF1A1A",
            opacity: w.opacity, transform: [{ scale: w.scale }],
          }}
        />
      ))}
      {/* Socket ring — dark ring that "sockets" button into bar */}
      <View style={{ borderRadius: coreSize / 2 + 3, padding: 3, backgroundColor: socketColor }}>
        {/* Core */}
        <Pressable
          style={{ width: coreSize, height: coreSize, borderRadius: coreSize / 2, overflow: "hidden", alignItems: "center", justifyContent: "center" }}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={2000}
        >
          {/* Sphere gradient */}
          <LinearGradient
            colors={["#FFB7A0", "#FF1A1A", "#B30000"]}
            locations={[0, 0.42, 1]}
            start={{ x: 0.35, y: 0.28 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Top specular highlight */}
          <LinearGradient
            colors={["rgba(255,255,255,0.55)", "transparent"]}
            style={{
              position: "absolute",
              top: size === "large" ? 4 : 3,
              left: "16%", right: "16%",
              height: size === "large" ? 16 : 12,
              borderRadius: 999,
            }}
          />
          {/* Bottom depth shadow */}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.28)"]}
            style={{
              position: "absolute",
              top: size === "large" ? 14 : 10,
              left: size === "large" ? 14 : 10,
              right: size === "large" ? 14 : 10,
              bottom: size === "large" ? 14 : 10,
              borderRadius: 999,
            }}
          />
          {/* Green diode LED */}
          <Animated.View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: size === "large" ? 5 : 4,
              width: size === "large" ? 4 : 3.5,
              height: size === "large" ? 4 : 3.5,
              borderRadius: 999,
              backgroundColor: "#00FF41",
              alignSelf: "center",
              opacity: diodeAnim,
            }}
          />
          {/* Alert icon */}
          <Ionicons name="alert-circle" size={iconSize} color="white" style={{ zIndex: 2 }} />
        </Pressable>
      </View>
    </View>
  );
}

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  icon, iconOut, label, active, onPress,
  activeColor, inactiveColor, badgeCount = 0, badgeBorderColor = "#000",
}: {
  icon: string; iconOut: string; label: string;
  active: boolean; onPress: () => void;
  activeColor: string; inactiveColor: string;
  badgeCount?: number; badgeBorderColor?: string;
}) {
  return (
    <Pressable style={styles.navItem} onPress={onPress} hitSlop={8}>
      <View>
        <Ionicons
          name={(active ? icon : iconOut) as any}
          size={22}
          color={active ? activeColor : inactiveColor}
        />
        {badgeCount > 0 && (
          <View style={[styles.badge, { borderColor: badgeBorderColor }]}>
            <Text style={styles.badgeText}>{badgeCount > 9 ? "9+" : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.navLabel, { color: active ? activeColor : inactiveColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── AlertyTabBar ──────────────────────────────────────────────────────────────

export function AlertyTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useAlertyTheme();
  const {
    feedViewMode, setFeedViewMode,
    themeMode, addAlert, currentUser,
    sosWarningAccepted, setSosWarningAccepted,
    unreadAlerts, clearUnreadAlerts,
  } = useAlertyStore();

  const isDark = themeMode === "darkHighVisibility";
  const isReels = feedViewMode === "reels";
  const activeRoute = state.routes[state.index];

  const activeColor   = isDark ? "#FF4500" : theme.colors.accent;
  const inactiveColor = isDark ? "rgba(255,255,255,0.45)" : theme.colors.textMuted;
  const socketColor   = isDark ? "#050505" : (theme.colors.background as string);

  // ── SOS handler ──────────────────────────────────────────────────────────
  const handleSOS = async () => {
    const triggerSOS = async () => {
      void Sounds.sos();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "Necesitamos tu ubicación para enviar el SOS.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = loc.coords;
      addAlert({
        id: `sos-${Date.now()}`,
        category: "sos",
        lat: latitude, lng: longitude,
        createdAt: new Date().toISOString(),
        status: "active", media: [],
        upvotes: 0, downvotes: 0,
        user: currentUser,
      } as any);
      if (supabase && isSupabaseConfigured) {
        const { data: ud } = await supabase.auth.getUser();
        await supabase.from("alerts").insert({
          user_id: ud.user?.id, category: "sos",
          lat: latitude, lng: longitude,
          status: "active", title: "EMERGENCIA SOS",
        });
      }
      Alert.alert("Alerta SOS enviada", "Tu ubicación ha sido compartida como emergencia crítica.");
    };

    if (!sosWarningAccepted) {
      Alert.alert(
        "🚨 BOTÓN DE EMERGENCIA (SOS)",
        "Esta función alertará a todos los usuarios cercanos de una emergencia real. ¿Es una emergencia legítima?",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "ENVIAR SOS", onPress: () => { setSosWarningAccepted(true); void triggerSOS(); } },
        ],
      );
    } else {
      void triggerSOS();
    }
  };

  // ── navigation helper ─────────────────────────────────────────────────────
  function goTo(name: string) {
    const route = state.routes.find((r) => r.name === name);
    if (!route) return;
    const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(name);
    if (name === "avisos") clearUnreadAlerts();
  }

  // ── COMPACT REELS PILL ────────────────────────────────────────────────────
  if (isReels) {
    const pillBottom = Math.max(22, insets.bottom + 14);
    return (
      <View style={{ height: 60 + pillBottom + 8 }} pointerEvents="box-none">
        <View style={[styles.reelsPill, { bottom: pillBottom }]}>
          {/* left: exit + LISTA */}
          <View style={styles.pillSide}>
            <Pressable style={styles.pillBtn} onPress={() => setFeedViewMode("list")} hitSlop={8}>
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Pressable style={[styles.pillBtn, styles.pillBtnMode]} onPress={() => setFeedViewMode("list")} hitSlop={8}>
              <Ionicons name="list" size={13} color="rgba(255,255,255,0.85)" />
              <Text style={styles.pillModeText}>LISTA</Text>
            </Pressable>
          </View>

          {/* center: mini SOS */}
          <View style={styles.pillCenter}>
            <SOSCenterBtn
              size="mini"
              socketColor="rgba(8,8,8,0.72)"
              onPress={() => router.push("/report" as any)}
              onLongPress={() => { void handleSOS(); }}
            />
          </View>

          {/* right: volume + more */}
          <View style={[styles.pillSide, styles.pillSideRight]}>
            <Pressable style={styles.pillBtn} hitSlop={8} onPress={() => {}}>
              <Ionicons name="volume-high" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Pressable style={styles.pillBtn} hitSlop={8} onPress={() => {}}>
              <Ionicons name="ellipsis-horizontal" size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  // ── STANDARD BAR ──────────────────────────────────────────────────────────
  const barInner = 62;
  const containerH = TAB_BAR_HEIGHT + insets.bottom;

  const bgColors: [string, string, string] = isDark
    ? ["rgba(5,5,5,0.97)", "rgba(5,5,5,0.88)", "rgba(5,5,5,0)"]
    : ["rgba(246,242,234,0.97)", "rgba(246,242,234,0.88)", "rgba(246,242,234,0)"];

  return (
    <View style={{ height: containerH }}>
      {/* gradient background */}
      <LinearGradient
        colors={bgColors}
        locations={[0, 0.65, 1]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* top border line */}
      <View
        style={[styles.topBorder, { backgroundColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)" }]}
      />

      {/* tab items row: Mapa | Feed | [96px gap] | Avisos | Ajustes */}
      <View style={[styles.tabRow, { height: barInner, bottom: insets.bottom }]}>
        <NavItem
          icon="map" iconOut="map-outline" label="Mapa"
          active={activeRoute?.name === "index"}
          onPress={() => goTo("index")}
          activeColor={activeColor} inactiveColor={inactiveColor}
          badgeBorderColor={socketColor}
        />
        <NavItem
          icon="albums" iconOut="albums-outline" label="Feed"
          active={activeRoute?.name === "feed"}
          onPress={() => goTo("feed")}
          activeColor={activeColor} inactiveColor={inactiveColor}
          badgeBorderColor={socketColor}
        />
        {/* spacer for raised SOS button */}
        <View style={styles.sosSpacer} />
        <NavItem
          icon="notifications" iconOut="notifications-outline" label="Avisos"
          active={activeRoute?.name === "avisos"}
          onPress={() => goTo("avisos")}
          activeColor={activeColor} inactiveColor={inactiveColor}
          badgeCount={unreadAlerts}
          badgeBorderColor={socketColor}
        />
        <NavItem
          icon="settings" iconOut="settings-outline" label="Ajustes"
          active={activeRoute?.name === "settings"}
          onPress={() => goTo("settings")}
          activeColor={activeColor} inactiveColor={inactiveColor}
          badgeBorderColor={socketColor}
        />
      </View>

      {/* center SOS — raised 34px above the bar */}
      <View style={[styles.sosCenter, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
        <SOSCenterBtn
          size="large"
          socketColor={socketColor}
          onPress={() => { void Sounds.tap(); router.push("/report" as any); }}
          onLongPress={() => { void handleSOS(); }}
        />
      </View>
    </View>
  );
}

// ── styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  topBorder: {
    position: "absolute", top: 0, left: 0, right: 0, height: 1,
  },
  tabRow: {
    position: "absolute", left: 0, right: 0,
    flexDirection: "row", alignItems: "center",
  },
  navItem: {
    flex: 1, alignItems: "center", gap: 3, paddingVertical: 8,
  },
  navLabel: {
    fontSize: 9, fontFamily: "SpaceGrotesk_700Bold",
    letterSpacing: 1.1, textTransform: "uppercase",
  },
  badge: {
    position: "absolute", top: -2, right: -8,
    minWidth: 14, height: 14,
    paddingHorizontal: 3,
    borderRadius: 999,
    backgroundColor: "#FF0000",
    borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  badgeText: {
    color: "#fff", fontSize: 8,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 10,
  },
  sosSpacer: { width: 88 },
  sosCenter: {
    position: "absolute", left: 0, right: 0,
    alignItems: "center",
  },

  // reels compact pill
  reelsPill: {
    position: "absolute", left: 14, right: 14,
    height: 60, borderRadius: 22,
    backgroundColor: "rgba(8,8,8,0.72)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.10)",
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", paddingHorizontal: 8,
  },
  pillSide: {
    flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4,
  },
  pillSideRight: { justifyContent: "flex-end" },
  pillCenter: { alignItems: "center", justifyContent: "center" },
  pillBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  pillBtnMode: {
    flexDirection: "row", gap: 5, width: "auto", paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  pillModeText: {
    color: "rgba(255,255,255,0.85)", fontSize: 10,
    fontFamily: "SpaceGrotesk_700Bold", letterSpacing: 1.2,
  },
});
