import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme";
import type { Theme } from "../lib/theme";

export function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const routes = state.routes;
  const leftRoutes = routes.slice(0, 1);
  const rightRoutes = routes.slice(1);
  const bottomOffset = Math.max(insets.bottom, 12) + 12;
  const centerGap = 72;

  const renderTab = (route: (typeof routes)[number]) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === state.routes.indexOf(route);
    const color = isFocused ? theme.colors.accent : theme.colors.textMuted;
    const label = options.title ?? route.name;

    const onPress = () => {
      const event = navigation.emit({
        type: "tabPress",
        target: route.key,
        canPreventDefault: true,
      });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    };

    return (
      <Pressable key={route.key} onPress={onPress} style={styles.tabItem}>
        {options.tabBarIcon ? options.tabBarIcon({ color, size: 22, focused: isFocused }) : null}
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={[styles.bar, theme.effects.glassCard]}>
        <View style={styles.row}>
          <View style={styles.sideGroup}>{leftRoutes.map(renderTab)}</View>
          <View style={{ width: centerGap }} />
          <View style={styles.sideGroup}>{rightRoutes.map(renderTab)}</View>
        </View>
      </View>
      <Pressable
        onPress={() => router.push("/report")}
        style={({ pressed }) => [
          styles.reportButton,
          { bottom: bottomOffset },
          pressed && styles.reportButtonPressed,
        ]}
      >
        <LinearGradient
          colors={theme.mode === "dark" ? ["#FF6A75", "#FF3D4F"] : ["#FF5B6B", "#E02B3C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.reportButtonInner}
        >
          <View style={styles.reportButtonSheen} />
          <Ionicons name="alert-circle" size={24} color="#FFFFFF" />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      backgroundColor: "transparent",
    },
    bar: {
      marginHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 18,
      paddingTop: 12,
      paddingBottom: 14,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    sideGroup: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-around",
    },
    tabItem: {
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      minWidth: 64,
    },
    tabLabel: {
      fontSize: 10,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.body,
    },
    tabLabelActive: {
      color: theme.colors.accent,
      fontFamily: theme.fonts.heading,
    },
    reportButton: {
      position: "absolute",
      alignSelf: "center",
      width: 64,
      height: 64,
      borderRadius: 32,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.6)",
      shadowColor: theme.mode === "dark" ? "rgba(0,0,0,0.6)" : "#FF7B86",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 8,
    },
    reportButtonPressed: {
      transform: [{ scale: 0.98 }],
    },
    reportButtonInner: {
      flex: 1,
      borderRadius: 32,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    reportButtonSheen: {
      position: "absolute",
      top: -18,
      left: -10,
      right: -10,
      height: 30,
      borderRadius: 20,
      backgroundColor: theme.mode === "dark" ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.35)",
    },
  });
