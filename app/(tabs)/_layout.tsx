import { useEffect } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../lib/theme";
import { useAlertyStore } from "../../lib/alerty/store";
import { isSupabaseConfigured } from "../../lib/supabase";

export default function TabsLayout() {
  const { startDemo, loadAlertsFromSupabase, startRealtime } = useAlertyStore();

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
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
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
