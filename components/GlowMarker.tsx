import { useEffect, useRef } from "react";
import { StyleSheet, View, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";
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
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (lowConnection) {
      pulseAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => animation.stop();
  }, [duration, lowConnection, pulseAnim]);

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.8],
  });

  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0.1],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.ring,
          {
            backgroundColor: color,
            transform: [{ scale: lowConnection ? 1.3 : ringScale }],
            opacity: lowConnection ? 0.15 : ringOpacity,
          },
        ]}
      />
      <View style={[styles.dot, { borderColor: color }]}>
        <Ionicons 
          name={CATEGORY_ICONS[category] as any} 
          size={10} 
          color={color} 
        />
      </View>
      <View style={styles.badgeRow}>
        {hasMedia ? (
          <View style={styles.badge}>
            <Ionicons name="camera" size={10} color={theme.colors.mapMedia} />
          </View>
        ) : null}
        {isVerified ? (
          <View style={styles.badge}>
            <Ionicons name="checkmark-circle" size={10} color={theme.colors.mapVerified} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },
  ring: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 999,
    opacity: 0.4,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  inner: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  badgeRow: {
    position: "absolute",
    top: -4,
    right: -6,
    flexDirection: "row",
    gap: 2,
  },
  badge: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
});
