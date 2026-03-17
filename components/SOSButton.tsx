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
import { GlassView } from "expo-glass-effect";
import { useAlertyTheme } from "../lib/useAlertyTheme";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// AnimatedGlassView removed to avoid potential creation issues in Hermis

type SOSButtonProps = {
  /** Triggered when long-press completes successfully */
  onSOS: () => void;
  /** Triggered on single tap */
  onPress?: () => void;
  active?: boolean;
  compact?: boolean;
};

const RADIUS = 36;
const STROKE = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function SOSButton({ onSOS, onPress, active, compact }: SOSButtonProps) {
  const theme = useAlertyTheme();
  const [isPressing, setIsPressing] = useState(false);
  const scaleAnim = useMemo(() => new Animated.Value(1), []);
  const progressAnim = useMemo(() => new Animated.Value(0), []);
  const glowAnim = useMemo(() => new Animated.Value(1), []);
  const flashAnim = useMemo(() => new Animated.Value(0), []); // New flash state
  const [progressValue, setProgressValue] = useState(0);
  const isPressingRef = useRef(false);

  useEffect(() => {
    isPressingRef.current = isPressing;
    
    let hapticTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const playProgressiveHaptics = (progress: number) => {
      if (!isPressingRef.current) return;
      
      // Start with Light, move to Medium as we progress
      const style = progress < 0.6 
        ? Haptics.ImpactFeedbackStyle.Light 
        : Haptics.ImpactFeedbackStyle.Medium;
        
      void Haptics.impactAsync(style);
      
      // Frequency increases as progress increases (from 250ms down to 80ms)
      const frequency = Math.max(80, 250 - progress * 170);
      
      hapticTimeout = setTimeout(() => {
        playProgressiveHaptics(progressValue);
      }, frequency);
    };

    if (isPressing) {
      playProgressiveHaptics(0);
    }
    
    return () => {
      if (hapticTimeout) clearTimeout(hapticTimeout);
    };
  }, [isPressing]);

  useEffect(() => {
    // Pulse animation for the glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1.4,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const handlePressIn = () => {
    setIsPressing(true);
    // Inflate effect + Start filling
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.5,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    setIsPressing(false);
    // Deflate and smooth "decompression" reset
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 500, // Smooth reset instead of instant or generic 300
        useNativeDriver: false,
      }),
    ]).start();
  };

  // Listen to progress once. Use ref to check isPressing state.
  useEffect(() => {
    const listenerId = progressAnim.addListener(({ value }) => {
      setProgressValue(value);
      if (value >= 0.99 && isPressingRef.current) {
        progressAnim.setValue(0);
        handlePressOut();
        
        // Final activation sequence
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        // Trigger Flash
        Animated.sequence([
          Animated.timing(flashAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
          Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]).start();
        
        onSOS();
      }
    });

    return () => {
      progressAnim.removeAllListeners();
    };
  }, []); // Only once for stability

  const strokeDashoffset = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
  });

  // Calculate tint manually to avoid Animated prop issue in Hermis
  const activeTint = `rgba(255, 82, 82, ${0.1 + progressValue * 0.5})`;

  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Animated.View
        style={[
          styles.glow,
          compact && styles.compactGlow,
          {
            transform: [{ 
              scale: isPressing 
                ? glowAnim.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [1, 1 + progressValue * 0.8] 
                  })
                : glowAnim // Breathing effect when idle
            }],
            opacity: isPressing ? 0.6 + progressValue * 0.4 : 0.4,
          },
        ]}
      />
      
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Svg width={(RADIUS + STROKE) * 2} height={(RADIUS + STROKE) * 2} style={styles.svg}>
          {/* Background circle */}
          <Circle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            stroke={isPressing ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.4)"}
            strokeWidth={STROKE}
            fill="transparent"
          />
          {/* Progress circle */}
          <AnimatedCircle
            cx={RADIUS + STROKE}
            cy={RADIUS + STROKE}
            r={RADIUS}
            stroke={theme.colors.accent}
            strokeWidth={STROKE + 2}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            rotation="-90"
            origin={`${RADIUS + STROKE}, ${RADIUS + STROKE}`}
          />
        </Svg>

        <Pressable
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={onPress}
          style={styles.pressable}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: scaleAnim }] }]}>
            <View style={styles.solidButton}>
              <Ionicons name="alert-circle" size={38} color="white" />
              <Text style={styles.label}>REPORTAR</Text>
            </View>
          </Animated.View>
          
          {/* Flash Overlay */}
          <Animated.View 
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: 'white',
                borderRadius: 36,
                opacity: flashAnim,
              }
            ]} 
          />
        </Pressable>
      </Animated.View>

      {!compact && (
        <View style={styles.hintContainer}>
          <Text style={styles.hintTitle}>LLAMADA DE EMERGENCIA</Text>
          <Text style={styles.hintSub}>Mantenlo presionado para avisar a todos</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 140,
  },
  compactContainer: {
    height: 80,
  },
  glow: {
    position: "absolute",
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.colors.mapRed,
    top: 20,
    shadowColor: theme.colors.mapRed,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
  },
  compactGlow: {
    top: 10,
  },
  svg: {
    position: "absolute",
    top: -STROKE,
    left: -STROKE,
  },
  pressable: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  solidButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.4)",
    backgroundColor: "#FF0000", // Solid bright alert red
    elevation: 8,
    shadowColor: "black",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  label: {
    color: theme.colors.surface,
    fontSize: 12,
    fontFamily: theme.fonts.heading,
    marginTop: -2,
    fontWeight: "bold",
  },
  hintContainer: {
    marginTop: 12,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    width: 140,
  },
  hintTitle: {
    color: "#FF5252",
    fontSize: 10,
    fontFamily: theme.fonts.heading,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  hintSub: {
    color: theme.colors.surface,
    fontSize: 9,
    fontFamily: theme.fonts.body,
    marginTop: 2,
    textAlign: "center",
  },
});
