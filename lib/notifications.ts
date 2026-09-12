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

/**
 * Por qué no hay token. Devolverlo importa: el interruptor de Ajustes es una
 * preferencia local y arranca encendido, así que sin esto la app dice "Push
 * críticas · activado" mientras no existe ningún token. El usuario cree que le
 * avisarán de una balacera a 2 km y no va a pasar.
 */
export type PushStatus =
  | "ok"
  /** Sin módulo nativo: web o Expo Go. No es un fallo del usuario. */
  | "unsupported"
  | "denied"
  /** Falta el projectId de EAS: error de configuración, no del usuario. */
  | "misconfigured"
  | "error";

export async function registerForPushNotificationsAsync(): Promise<
  { token: string; status: "ok" } | { token: null; status: Exclude<PushStatus, "ok"> }
> {
  const N = getNotifications();
  if (!N) return { token: null, status: "unsupported" };
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
    if (finalStatus !== "granted") return { token: null, status: "denied" };

    const projectId = getProjectId();
    if (!projectId) return { token: null, status: "misconfigured" };

    const tokenData = await N.getExpoPushTokenAsync({ projectId });
    return { token: tokenData.data, status: "ok" };
  } catch (e) {
    console.warn("registerForPushNotifications failed", e);
    return { token: null, status: "error" };
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

export async function syncPushRegistration(): Promise<PushStatus> {
  const result = await registerForPushNotificationsAsync();
  if (result.status !== "ok") return result.status;
  await savePushToken(result.token);
  return "ok";
}

/** Qué decirle al usuario cuando el interruptor está encendido pero no hay token. */
export const PUSH_STATUS_HINT: Record<Exclude<PushStatus, "ok">, string> = {
  unsupported: "En el navegador no hay avisos push. Instala la app para recibirlos.",
  denied: "Permiso de notificaciones denegado: actívalo en los ajustes del teléfono.",
  misconfigured: "No se pudo configurar el aviso en este dispositivo.",
  error: "No se pudo activar el aviso. Vuelve a intentar.",
};

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
