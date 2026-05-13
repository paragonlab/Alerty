import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type SOSButtonProps = {
  onSOS: () => void;
  onPress?: () => void;
  active?: boolean;
  compact?: boolean;
};

const RING_RADIUS = 42;
const RING_STROKE = 7;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// Burst particle positions (8 directions)
const BURST_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];
const BURST_RADIUS = 48;

export function SOSButton({ onSOS, onPress, active, compact }: SOSButtonProps) {
  const theme = useAlertyTheme();
  const themeMode = useAlertyStore((s) => s.themeMode);
  const isDark = themeMode === "darkHighVisibility";

  const [isPressing, setIsPressing] = useState(false);
  const [isActivated, setIsActivated] = useState(false);
  const isPressingRef = useRef(false);

  // Animations
  const auraAnim   = useMemo(() => new Animated.Value(0), []);
  const glowAnim   = useMemo(() => new Animated.Value(0), []);
  const radarAnim  = useMemo(() => new Animated.Value(0), []);
  const wave1Anim  = useMemo(() => new Animated.Value(0), []);
  const wave2Anim  = useMemo(() => new Animated.Value(0), []);
  const wave3Anim  = useMemo(() => new Animated.Value(0), []);
  const scaleAnim  = useMemo(() => new Animated.Value(1), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const burstAnim  = useMemo(() => new Animated.Value(0), []);
  const diodeAnim  = useMemo(() => new Animated.Value(0), []);
  const [progressValue, setProgressValue] = useState(0);

  const wave2LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const wave3LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMounted = useRef(true);

  // Idle animations
  useEffect(() => {
    isMounted.current = true;

    // Aura: slowest breathing
    const auraLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0, duration: 2400, useNativeDriver: true }),
      ])
    );

    // Mid glow breathing
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    );

    // Radar rotation (9s full spin)
    const radarLoop = Animated.loop(
      Animated.timing(radarAnim, { toValue: 1, duration: 9000, useNativeDriver: true })
    );

    // Waves — staggered starts
    const makeWaveLoop = (anim: Animated.Value) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 2400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );

    const wave1Loop = makeWaveLoop(wave1Anim);
    wave1Loop.start();

    const t2 = setTimeout(() => {
      if (!isMounted.current) return;
      wave2Anim.setValue(0);
      wave2LoopRef.current = makeWaveLoop(wave2Anim);
      wave2LoopRef.current.start();
    }, 800);

    const t3 = setTimeout(() => {
      if (!isMounted.current) return;
      wave3Anim.setValue(0);
      wave3LoopRef.current = makeWaveLoop(wave3Anim);
      wave3LoopRef.current.start();
    }, 1600);

    // LED diode blink
    const diodeLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(diodeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(diodeAnim, { toValue: 0.2, duration: 160, useNativeDriver: true }),
        Animated.delay(1280),
        Animated.timing(diodeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(diodeAnim, { toValue: 0.2, duration: 160, useNativeDriver: true }),
        Animated.delay(400),
      ])
    );

    auraLoop.start();
    glowLoop.start();
    radarLoop.start();
    diodeLoop.start();

    return () => {
      isMounted.current = false;
      auraLoop.stop();
      glowLoop.stop();
      radarLoop.stop();
      wave1Anim.stopAnimation();
      wave2Anim.stopAnimation();
      wave3Anim.stopAnimation();
      diodeAnim.stopAnimation();
      clearTimeout(t2);
      clearTimeout(t3);
      wave2LoopRef.current?.stop();
      wave3LoopRef.current?.stop();
    };
  }, []);

  // Progress listener
  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      setProgressValue(value);
      if (value >= 0.99 && isPressingRef.current) {
        progressAnim.setValue(0);
        handlePressOut();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        triggerActivated();
        onSOS();
      }
    });
    return () => progressAnim.removeListener(id);
  }, []);

  // Haptics while pressing
  useEffect(() => {
    isPressingRef.current = isPressing;
    if (!isPressing) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;
    const tick = (progress: number) => {
      if (!isPressingRef.current) return;
      void Haptics.impactAsync(
        progress < 0.6 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium
      );
      const freq = Math.max(80, 250 - progress * 170);
      timeout = setTimeout(() => tick(progressValue), freq);
    };
    tick(0);
    return () => { if (timeout) clearTimeout(timeout); };
  }, [isPressing]);

  function handlePressIn() {
    setIsPressing(true);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1.45, friction: 3, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 2000, useNativeDriver: false }),
    ]).start();
  }

  function handlePressOut() {
    setIsPressing(false);
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 0, duration: 500, useNativeDriver: false }),
    ]).start();
  }

  function triggerActivated() {
    setIsActivated(true);
    Animated.sequence([
      Animated.timing(burstAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(burstAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      if (isMounted.current) setIsActivated(false);
    }, 2200);
  }

  // Interpolations
  const auraScale = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });
  const auraOpacity = auraAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] });

  const glowScale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  const radarRotation = radarAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const w1Scale = wave1Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const w1Opacity = wave1Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.15, 0] });
  const w2Scale = wave2Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const w2Opacity = wave2Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.15, 0] });
  const w3Scale = wave3Anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] });
  const w3Opacity = wave3Anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 0.15, 0] });

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  const diodeColor = isPressing ? "#FFEA00" : isActivated ? "#00FF41" : "#00FF41";
  const diodeOpacity = diodeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  const sosColor = "#FF1A1A";
  const sos_lo = "#B30000";

  // Core gradient colors shift on press/activated
  const coreGradientStart = isActivated ? "#FFFFFF" : isPressing ? "#FFF2EE" : "#FFB7A0";
  const coreGradientEnd = isActivated ? sosColor : isPressing ? sos_lo : sos_lo;

  const coreIcon = isActivated ? "checkmark" : "alert-circle";

  const styles = useMemo(() => createStyles(theme, isDark), [theme, isDark]);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      {/* Layer 1: Aura */}
      <Animated.View
        style={[
          styles.aura,
          { transform: [{ scale: auraScale }], opacity: auraOpacity },
        ]}
      />

      {/* Layer 2: Mid glow */}
      <Animated.View
        style={[
          styles.glowMid,
          { transform: [{ scale: glowScale }], opacity: glowOpacity },
        ]}
      />

      {/* Layer 3: Waves */}
      {[w1Scale, w2Scale, w3Scale].map((wScale, i) => {
        const wOpacity = [w1Opacity, w2Opacity, w3Opacity][i];
        return (
          <Animated.View
            key={i}
            style={[
              styles.wave,
              { transform: [{ scale: wScale }], opacity: isPressing ? Animated.multiply(wOpacity, 1.4) as any : wOpacity },
            ]}
          />
        );
      })}

      {/* Layer 4: Radar ring */}
      <Animated.View
        style={[
          styles.radar,
          {
            transform: [{ rotate: radarRotation }],
            borderStyle: isPressing ? "solid" : "dashed",
            borderColor: isPressing ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.28)",
          },
        ]}
      />

      {/* Progress ring SVG */}
      <Animated.View style={[styles.ringWrapper, { transform: [{ scale: scaleAnim }] }]}>
        <Svg
          width={(RING_RADIUS + RING_STROKE) * 2}
          height={(RING_RADIUS + RING_STROKE) * 2}
          style={StyleSheet.absoluteFill}
        >
          <Circle
            cx={RING_RADIUS + RING_STROKE}
            cy={RING_RADIUS + RING_STROKE}
            r={RING_RADIUS}
            stroke="rgba(255,255,255,0.22)"
            strokeWidth={RING_STROKE}
            fill="transparent"
          />
          <AnimatedCircle
            cx={RING_RADIUS + RING_STROKE}
            cy={RING_RADIUS + RING_STROKE}
            r={RING_RADIUS}
            stroke="#ffffff"
            strokeWidth={RING_STROKE + 2}
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            rotation="-90"
            origin={`${RING_RADIUS + RING_STROKE}, ${RING_RADIUS + RING_STROKE}`}
          />
        </Svg>

        {/* LED diode */}
        <Animated.View
          style={[
            styles.diode,
            { backgroundColor: diodeColor, shadowColor: diodeColor, opacity: diodeOpacity },
          ]}
        />

        {/* Layer 5: Core */}
        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          style={styles.pressable}
        >
          <LinearGradient
            colors={[coreGradientStart, sosColor, coreGradientEnd]}
            locations={[0, 0.42, 1]}
            start={{ x: 0.35, y: 0.28 }}
            end={{ x: 0.65, y: 0.72 }}
            style={styles.core}
          >
            {/* Highlight shimmer */}
            <View style={styles.coreHighlight} />
            {/* Shadow depth */}
            <View style={styles.coreShadow} />
            <Ionicons
              name={coreIcon as any}
              size={isActivated ? 34 : 38}
              color={isActivated ? sosColor : "white"}
              style={styles.coreIcon}
            />
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Burst particles */}
      {BURST_ANGLES.map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const tx = burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(rad) * BURST_RADIUS] });
        const ty = burstAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -Math.cos(rad) * BURST_RADIUS] });
        const op = burstAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.5, 0] });
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              { transform: [{ translateX: tx }, { translateY: ty }], opacity: op },
            ]}
          />
        );
      })}

      {!compact && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintTitle}>LLAMADA DE EMERGENCIA</Text>
          <Text style={[styles.hintSub, { color: theme.colors.surface }]}>
            Mantenlo presionado para avisar a todos
          </Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any, isDark: boolean) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 150,
    height: 180,
  },
  compactContainer: {
    height: 90,
  },
  // Layer 1: Aura
  aura: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,26,26,0.38)",
  },
  // Layer 2: Mid glow
  glowMid: {
    position: "absolute",
    width: 108,
    height: 108,
    borderRadius: 999,
    backgroundColor: "rgba(255,26,26,0.28)",
  },
  // Layer 3: Waves
  wave: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FF1A1A",
    backgroundColor: "transparent",
  },
  // Layer 4: Radar
  radar: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  // SVG ring wrapper
  ringWrapper: {
    width: (RING_RADIUS + RING_STROKE) * 2,
    height: (RING_RADIUS + RING_STROKE) * 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  pressable: {
    width: 84,
    height: 84,
    borderRadius: 999,
    overflow: "hidden",
  },
  core: {
    width: 84,
    height: 84,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#FF1A1A",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 12,
    overflow: "hidden",
  },
  coreHighlight: {
    position: "absolute",
    top: 6,
    left: "16%",
    right: "16%",
    height: 22,
    backgroundColor: "rgba(255,255,255,0.45)",
    borderRadius: 999,
  },
  coreShadow: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 36,
    height: 28,
    backgroundColor: "rgba(0,0,0,0.22)",
    borderRadius: 999,
  },
  coreIcon: {
    position: "relative",
    zIndex: 2,
  },
  diode: {
    position: "absolute",
    top: RING_STROKE + 8,
    width: 5,
    height: 5,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
    zIndex: 5,
  },
  particle: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: "#FF1A1A",
    shadowColor: "#FF1A1A",
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 1,
  },
  hintContainer: {
    marginTop: 14,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    width: 150,
  },
  hintTitle: {
    color: "#FF5252",
    fontSize: 10,
    fontFamily: theme.fonts.heading,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  hintSub: {
    fontSize: 9,
    fontFamily: theme.fonts.body,
    marginTop: 2,
    textAlign: "center",
  },
});
