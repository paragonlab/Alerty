import { useEffect, useRef, useMemo } from "react";
import { StyleSheet, View, Animated, Easing } from "react-native";
import type { AlertCategory } from "../lib/alerty/types";
import { balloonPinDisplaySize } from "../lib/alerty/pinArt";
import { CitizenPin } from "./CitizenPin";

type GlowMarkerProps = {
  category: AlertCategory;
  color: string;
  duration: number;
  hasMedia: boolean;
  isVerified: boolean;
  lowConnection?: boolean;
  avatarUrl?: string | null;
  character?: string | null;
  userId: string;
  username?: string | null;
  showName?: boolean;
  /** 0.35–1: brillo del halo SOS. */
  intensity?: number;
  /** false = sin glow. */
  showGlow?: boolean;
  markerKind?: "citizen";
};

/**
 * Pin de alerta ciudadana (globo Waze) + énfasis de pulso para SOS.
 */
export function GlowMarker({
  category,
  color,
  duration,
  hasMedia: _hasMedia,
  isVerified: _isVerified,
  lowConnection,
  avatarUrl,
  character,
  userId,
  username,
  showName = false,
  intensity = 1,
  showGlow = true,
  markerKind = "citizen",
}: GlowMarkerProps) {
  const isSos = category === "sos";
  const glow = showGlow && !lowConnection && isSos;
  const rings = glow && intensity >= 0.8;
  const haloSize = Math.round(40 + 20 * intensity);
  const { w, h } = balloonPinDisplaySize(showName);

  const haloAnim = useMemo(() => new Animated.Value(0), []);
  const ring1Anim = useMemo(() => new Animated.Value(0), []);
  const ring2Anim = useMemo(() => new Animated.Value(0), []);
  const ring2LoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!glow) return;

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
      ]),
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
        ]),
      );

    haloLoop.start();
    makeRingLoop(ring1Anim).start();

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
      clearTimeout(t);
      ring2LoopRef.current?.stop();
      ring2LoopRef.current = null;
    };
  }, [duration, glow, haloAnim, ring1Anim, ring2Anim]);

  const haloScale = haloAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.15] });
  const haloOpacity = haloAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25 * intensity, 0.55 * intensity],
  });
  const r1Scale = ring1Anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.2] });
  const r1Opacity = ring1Anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.85, 0.25, 0] });
  const r2Scale = ring2Anim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.2] });
  const r2Opacity = ring2Anim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.85, 0.25, 0] });

  return (
    <View style={[styles.container, { width: Math.max(w, haloSize), height: Math.max(h, haloSize) }]}>
      {glow ? (
        <Animated.View
          style={[
            styles.halo,
            {
              width: haloSize,
              height: haloSize,
              backgroundColor: color,
              transform: [{ scale: haloScale }],
              opacity: haloOpacity,
            },
          ]}
        />
      ) : null}
      {rings ? (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: color,
              transform: [{ scale: r1Scale }],
              opacity: r1Opacity,
            },
          ]}
        />
      ) : null}
      {rings ? (
        <Animated.View
          style={[
            styles.ring,
            {
              borderColor: color,
              transform: [{ scale: r2Scale }],
              opacity: r2Opacity,
            },
          ]}
        />
      ) : null}
      <CitizenPin
        markerKind={markerKind}
        userId={userId}
        character={character}
        avatarUrl={avatarUrl}
        category={category}
        username={username}
        showName={showName}
        showBadge
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  halo: {
    position: "absolute",
    borderRadius: 999,
  },
  ring: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 999,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
});
