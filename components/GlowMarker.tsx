import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

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
      return { transform: [{ scale: 1.2 }], opacity: 0.2 };
    }
    return {
      transform: [{ scale: 1 + pulse.value * 2.2 }],
      opacity: 0.7 - pulse.value * 0.6,
    };
  });

  return (
    <View style={styles.container}>
      <View style={[styles.heat, { backgroundColor: color }]} />
      <Animated.View style={[styles.ring, ringStyle, { backgroundColor: color }]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
  },
  heat: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 999,
    opacity: 0.2,
  },
  ring: {
    position: "absolute",
    width: 20,
    height: 20,
    borderRadius: 999,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
  },
});
