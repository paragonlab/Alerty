import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import { useAlertyStore } from "../../lib/alerty/store";
import { isSupabaseConfigured } from "../../lib/supabase";
import { GlassTabBar } from "../../components/GlassTabBar";

export default function TabsLayout() {
  const { startDemo, loadAlertsFromSupabase, startRealtime } = useAlertyStore();
  const theme = useTheme();

  useEffect(() => {
    if (isSupabaseConfigured) {
      void loadAlertsFromSupabase();
      startRealtime();
    } else {
      startDemo();
    }
  }, [loadAlertsFromSupabase, startDemo, startRealtime]);

  return (
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarActiveTintColor: theme.colors.accent,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Mapa",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="map-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
