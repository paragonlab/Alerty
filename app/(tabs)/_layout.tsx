import { View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useEffect } from "react";
import { AlertyTabBar } from "../../components/AlertyTabBar";

export default function TabLayout() {
  const theme = useAlertyTheme();
  const { startDemo, loadAlertsFromSupabase, loadSponsoredZones, startRealtime } = useAlertyStore();

  useEffect(() => {
    if (isSupabaseConfigured) {
      void loadAlertsFromSupabase();
      void loadSponsoredZones();
      startRealtime();
    } else {
      startDemo();
    }
  }, [loadAlertsFromSupabase, loadSponsoredZones, startDemo, startRealtime]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        tabBar={(props) => <AlertyTabBar {...(props as any)} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Mapa",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "map" : "map-outline"} color={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: "Feed",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "list" : "list-outline"} color={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="videos"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="avisos"
          options={{
            title: "Avisos",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? "notifications" : "notifications-outline"} color={color} size={22} />
            ),
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: "Ajustes",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "settings" : "settings-outline"}
                color={color}
                size={22}
              />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}
