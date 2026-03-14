import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../lib/theme";

type GlowMarkerProps = {
  color: string;
  duration: number;
  hasMedia: boolean;
  isVerified: boolean;
  lowConnection?: boolean;
};

export function GlowMarker({
  color,
  duration,
  hasMedia,
  isVerified,
  lowConnection,
}: GlowMarkerProps) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (lowConnection) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withTiming(1, { duration }), -1, false);
  }, [duration, lowConnection, pulse]);

  const ringStyle = useAnimatedStyle(() => {
    if (lowConnection) {
      return { transform: [{ scale: 1.3 }], opacity: 0.15 };
    }
    return {
      transform: [{ scale: 1 + pulse.value * 1.8 }],
      opacity: 0.6 - pulse.value * 0.5,
    };
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, ringStyle, { backgroundColor: color }]} />
      <View style={[styles.dot, { borderColor: color }]}>
        <View style={[styles.inner, { backgroundColor: color }]} />
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
