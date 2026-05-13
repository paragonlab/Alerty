import { useEffect, useRef, useMemo } from "react";
import { StyleSheet, View, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyStore } from "../lib/alerty/store";
import type { AlertCategory } from "../lib/alerty/types";
import { CATEGORY_ICONS } from "../lib/alerty/constants";

type GlowMarkerProps = {
  category: AlertCategory;
  color: string;
  duration: number;
  hasMedia: boolean;
  isVerified: boolean;
  lowConnection?: boolean;
};

export function GlowMarker({
  category,
  color,
  duration,
  hasMedia,
  isVerified,
  lowConnection,
}: GlowMarkerProps) {
  const themeMode = useAlertyStore((s) => s.themeMode);
  const isDark = themeMode === "darkHighVisibility";

  const haloAnim = useMemo(() => new Animated.Value(0), []);
  const ring1Anim = useMemo(() => new Animated.Value(0), []);
  const ring2Anim = useMemo(() => new Animated.Value(0), []);
  const heartbeatAnim = useMemo(() => new Animated.Value(0), []);

  const ring2LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (lowConnection) return;

    const haloDur = Math.round(duration * 1.6);
    const haloLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(haloAnim, {
          toValue: 1,
          duration: haloDur / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(haloAnim, {
          toValue: 0,
          duration: haloDur / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    const makeRingLoop = (anim: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 1,
            duration,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const beatDur = Math.round(duration * 0.1);
    const heartbeatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(heartbeatAnim, { toValue: 0.55, duration: beatDur, useNativeDriver: true }),
        Animated.timing(heartbeatAnim, { toValue: 0, duration: beatDur, useNativeDriver: true }),
        Animated.timing(heartbeatAnim, { toValue: 0.25, duration: beatDur, useNativeDriver: true }),
        Animated.timing(heartbeatAnim, { toValue: 0, duration: beatDur, useNativeDriver: true }),
        Animated.delay(Math.round(duration * 0.6)),
      ])
    );

    haloLoop.start();
    makeRingLoop(ring1Anim).start();
    heartbeatLoop.start();

    const t = setTimeout(() => {
      if (!isMounted.current) return;
      ring2Anim.setValue(0);
      ring2LoopRef.current = makeRingLoop(ring2Anim);
      ring2LoopRef.current.start();
    }, Math.round(duration * 0.5));

    return () => {
      isMounted.current = false;
      haloLoop.stop();
      ring1Anim.stopAnimation();
      ring2Anim.stopAnimation();
      heartbeatLoop.stop();
      clearTimeout(t);
      ring2LoopRef.current?.stop();
      ring2LoopRef.current = null;
    };
  }, [duration, lowConnection]);

  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.1] });
  const haloOpacity = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [isDark ? 0.6 : 0.45, isDark ? 0.9 : 0.75] });

  const r1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 3.6] });
  const r1Opacity = ring1Anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.25, 0] });
  const r2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 3.6] });
  const r2Opacity = ring2Anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.9, 0.25, 0] });

  const mediaColor = isDark ? "#FF00FF" : "#5A4C3B";
  const verifiedColor = isDark ? "#00E0FF" : "#2C7BE5";
  const badgeBg = isDark ? "#000000" : "#FFFFFF";

  return (
    <View style={styles.container}>
      {/* Layer 1: Halo ambient bloom */}
      {!lowConnection && (
        <Animated.View
          style={[
            styles.halo,
            { backgroundColor: color, transform: [{ scale: haloScale }], opacity: haloOpacity },
          ]}
        />
      )}

      {/* Layer 2: Staggered expanding rings */}
      {!lowConnection && (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: color,
              borderWidth: isDark ? 1.5 : 2,
              transform: [{ scale: r1Scale }],
              opacity: r1Opacity,
            },
          ]}
        />
      )}
      {!lowConnection && (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: color,
              borderWidth: isDark ? 1.5 : 2,
              transform: [{ scale: r2Scale }],
              opacity: r2Opacity,
            },
          ]}
        />
      )}

      {/* Layer 3: Core dot */}
      <View
        style={[
          styles.dot,
          {
            backgroundColor: color,
            borderColor: isDark ? "rgba(255,255,255,0.92)" : "#FFFFFF",
            shadowColor: color,
            shadowOpacity: isDark ? 0.9 : 0.55,
            shadowRadius: isDark ? 14 : 7,
            shadowOffset: { width: 0, height: 2 },
            elevation: isDark ? 12 : 5,
          },
        ]}
      >
        {/* Highlight */}
        <View style={styles.dotHighlight} />
        {/* Heartbeat flash */}
        {!lowConnection && (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.dotHeartbeat, { opacity: heartbeatAnim }]}
          />
        )}
        <Ionicons
          name={CATEGORY_ICONS[category] as any}
          size={10}
          color="#fff"
          style={styles.dotIcon}
        />
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        {hasMedia && (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Ionicons name="camera" size={9} color={mediaColor} />
          </View>
        )}
        {isVerified && (
          <View style={[styles.badge, { backgroundColor: badgeBg }]}>
            <Ionicons name="checkmark-circle" size={9} color={verifiedColor} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 72,
    height: 72,
  },
  halo: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 999,
  },
  ring: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 3,
    overflow: "hidden",
  },
  dotHighlight: {
    position: "absolute",
    top: 2,
    left: "16%",
    right: "16%",
    height: 7,
    backgroundColor: "rgba(255,255,255,0.5)",
    borderRadius: 999,
  },
  dotHeartbeat: {
    backgroundColor: "#ffffff",
    borderRadius: 999,
  },
  dotIcon: {
    position: "relative",
    zIndex: 2,
  },
  badgeRow: {
    position: "absolute",
    top: 2,
    right: 0,
    flexDirection: "row",
    gap: 2,
    zIndex: 4,
  },
  badge: {
    width: 14,
    height: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
});
