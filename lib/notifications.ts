import { Platform } from "react-native";
import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { isSupabaseConfigured, supabase } from "./supabase";

// expo-notifications necesita su módulo nativo compilado (dev build). Se
// verifica la presencia REAL del módulo — no el entorno — para no intentar
// cargarlo donde no existe (Expo Go o un dev client desactualizado).
const hasNativePush = requireOptionalNativeModule("ExpoPushTokenManager") != null;

type NotificationsModule = typeof import("expo-notifications");
let cached: NotificationsModule | null = null;
let triedLoad = false;

function getNotifications(): NotificationsModule | null {
  if (!hasNativePush || triedLoad) return cached;
  triedLoad = true;
  try {
    const mod = require("expo-notifications") as NotificationsModule;
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    cached = mod;
    return mod;
  } catch {
    return null;
  }
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;
  try {
    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Alertas",
        importance: N.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF4500",
      });
    }

    const { status: existing } = await N.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== "granted") {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== "granted") return null;

    const projectId = getProjectId();
    if (!projectId) return null;

    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (e) {
    console.warn("registerForPushNotifications failed", e);
    return null;
  }
}

export async function savePushToken(token: string): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("push_tokens").upsert(
      {
        user_id: user.id,
        token,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
  } catch (e) {
    console.warn("savePushToken failed", e);
  }
}

export async function removePushTokens(): Promise<void> {
  if (!isSupabaseConfigured || !supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("push_tokens").delete().eq("user_id", user.id);
  } catch (e) {
    console.warn("removePushTokens failed", e);
  }
}

export async function syncPushRegistration(): Promise<void> {
  const token = await registerForPushNotificationsAsync();
  if (token) await savePushToken(token);
}

export function addNotificationTapListener(
  onAlertId: (alertId: string) => void,
): () => void {
  const N = getNotifications();
  if (!N) return () => {};
  const sub = N.addNotificationResponseReceivedListener((response) => {
    const alertId = response.notification.request.content.data?.alertId;
    if (typeof alertId === "string") onAlertId(alertId);
  });
  return () => sub.remove();
}

export async function getInitialNotificationAlertId(): Promise<string | null> {
  const N = getNotifications();
  if (!N) return null;
  try {
    const response = await N.getLastNotificationResponseAsync();
    const alertId = response?.notification.request.content.data?.alertId;
    return typeof alertId === "string" ? alertId : null;
  } catch {
    return null;
  }
}
