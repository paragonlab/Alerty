import { View, Alert } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { useAlertyStore } from "../../lib/alerty/store";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { SOSButton } from "../../components/SOSButton";
import { supabase } from "../../lib/supabase";
import { isSupabaseConfigured } from "../../lib/supabase";
import { useEffect } from "react";

export default function TabLayout() {
  const router = useRouter();
  const theme = useAlertyTheme();
  const isDark = useAlertyStore((state) => state.themeMode === "darkHighVisibility");
  const addAlert = useAlertyStore((state) => state.addAlert);
  const currentUser = useAlertyStore((state) => state.currentUser);
  const {
    startDemo,
    loadAlertsFromSupabase,
    startRealtime,
    sosWarningAccepted,
    setSosWarningAccepted,
  } = useAlertyStore();

  const handleSOS = async () => {
    const triggerSOS = async () => {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso de ubicación denegado",
          "Para enviar una alerta SOS, necesitamos acceso a tu ubicación. Por favor, habilítalo en la configuración de tu dispositivo.",
        );
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      addAlert({
        id: `sos-${Date.now()}`,
        category: "sos",
        lat: latitude,
        lng: longitude,
        createdAt: new Date().toISOString(),
        status: "active",
        media: [],
        upvotes: 0,
        downvotes: 0,
        user: currentUser,
      } as any);

      if (supabase) {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("alerts").insert({
          user_id: userData.user?.id,
          category: "sos",
          lat: latitude,
          lng: longitude,
          status: "active",
          title: "EMERGENCIA SOS",
        });
      }

      Alert.alert(
        "Alerta SOS enviada",
        "Tu ubicación ha sido compartida como emergencia crítica y notificado a los usuarios más cercanos.",
      );
    };

    if (!sosWarningAccepted) {
      Alert.alert(
        "🚨 BOTÓN DE EMERGENCIA (SOS)",
        "Esta función alertará a todos los usuarios cercanos de una emergencia real. ¿Es una emergencia legítima?",
        [
          { text: "Cancelar", style: "cancel" },
          {
            text: "ENVIAR SOS",
            onPress: () => {
              setSosWarningAccepted(true);
              void triggerSOS();
            },
          },
        ],
      );
    } else {
      void triggerSOS();
    }
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      void loadAlertsFromSupabase();
      startRealtime();
    } else {
      startDemo();
    }
  }, [loadAlertsFromSupabase, startDemo, startRealtime]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
            borderTopWidth: 1,
            height: 68,
            paddingBottom: 10,
            paddingTop: 8,
          },
          tabBarInactiveTintColor: theme.colors.textMuted,
          tabBarActiveTintColor: theme.colors.accent,
          tabBarLabelStyle: {
            fontFamily: "SpaceGrotesk_500Medium",
            fontSize: 11,
          },
        }}
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

      <View
        style={{
          position: "absolute",
          bottom: 90,
          right: 20,
          zIndex: 100,
        }}
      >
        <SOSButton
          active={true}
          compact={true}
          onPress={() => {
            router.push("/report");
          }}
          onSOS={handleSOS}
        />
      </View>
    </View>
  );
}
