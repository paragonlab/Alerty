import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  getCurrentCoords,
  LocationRequestError,
  requestCoordsWithFix,
  webLocationHelp,
  type LocationRequestCode,
} from "../../lib/alerty/geolocation";
import { useAlertyStore } from "../../lib/alerty/store";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { AVISOS_RADIUS_KM, CATEGORY_ICONS, CATEGORY_LABELS } from "../../lib/alerty/constants";
import { formatRelativeTime, matchInboxAlert } from "../../lib/alerty/utils";
import type { AlertItem } from "../../lib/alerty/types";

function formatDistance(km: number | null) {
  if (km == null) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

type LocationCopyKey = "ask" | "web_blocked" | "blocked" | "services_off" | "failed";

function locationCopyKey(code: LocationRequestCode | null): LocationCopyKey {
  if (code === "denied") return Platform.OS === "web" ? "web_blocked" : "ask";
  if (code === "blocked" || code === "services_off") return code;
  if (code === "timeout" || code === "unavailable") return "failed";
  return "ask";
}

// En web el navegador ya no vuelve a preguntar si la bloquearon; en el teléfono,
// si se negó para siempre o el GPS está apagado, se arregla en Ajustes.
const LOCATION_COPY: Record<LocationCopyKey, { title: string; hint: string; cta: string }> = {
  ask: {
    title: "Activa la ubicación para ver avisos de tu zona",
    hint: `Las alertas que sigues aparecen igual. El resto solo si están a ${AVISOS_RADIUS_KM} km.`,
    cta: "Activar ubicación",
  },
  web_blocked: {
    title: "Tu navegador bloqueó la ubicación",
    hint: `${webLocationHelp()} Luego toca Reintentar: el navegador ya no vuelve a preguntar solo.`,
    cta: "Reintentar",
  },
  blocked: {
    title: "Pulso no tiene permiso de ubicación",
    hint:
      Platform.OS === "ios"
        ? "Actívalo en Ajustes → Pulso → Ubicación → Mientras se usa la app."
        : "Actívalo en Ajustes → Apps → Pulso → Permisos → Ubicación.",
    cta: "Abrir ajustes",
  },
  services_off: {
    title: "La ubicación del teléfono está apagada",
    hint:
      Platform.OS === "ios"
        ? "Enciéndela en Ajustes → Privacidad y seguridad → Localización, y vuelve a Pulso."
        : "Enciende la ubicación (GPS) y vuelve a intentar.",
    cta: Platform.OS === "android" ? "Encender ubicación" : "Abrir ajustes",
  },
  failed: {
    title: "No pudimos ubicarte",
    hint: "Revisa tu señal o sal a un lugar abierto y reintenta.",
    cta: "Reintentar",
  },
};

export default function AvisosScreen() {
  const theme = useAlertyTheme();
  const router = useRouter();
  const {
    alerts,
    activeCategories,
    clearUnreadAlerts,
    followingAlertIds,
    userCoords,
    setUserCoords,
  } = useAlertyStore();
  const styles = createStyles(theme);
  const [locating, setLocating] = useState(!userCoords);
  const [locationCode, setLocationCode] = useState<LocationRequestCode | null>(null);

  useEffect(() => {
    clearUnreadAlerts();
  }, [clearUnreadAlerts]);

  const fetchLocation = async (withFix = false) => {
    setLocating(true);
    setLocationCode(null);
    try {
      const coords = await (withFix ? requestCoordsWithFix() : getCurrentCoords());
      setUserCoords(coords);
    } catch (e) {
      setLocationCode(e instanceof LocationRequestError ? e.code : "unavailable");
    } finally {
      setLocating(false);
    }
  };

  useEffect(() => {
    if (userCoords) {
      setLocating(false);
      return;
    }
    void fetchLocation();
  }, []);

  const notifications = useMemo(() => {
    return alerts
      .map((alert) => {
        // Lo que sigues y el SOS siempre; lo demás, según tus categorías.
        if (
          alert.category !== "sos" &&
          !activeCategories.includes(alert.category) &&
          !followingAlertIds.includes(alert.id)
        ) {
          return null;
        }
        const match = matchInboxAlert(alert, userCoords, followingAlertIds);
        if (!match) return null;
        return { alert, match };
      })
      .filter((row): row is { alert: AlertItem; match: NonNullable<ReturnType<typeof matchInboxAlert>> } =>
        Boolean(row),
      )
      .sort((a, b) => new Date(b.alert.createdAt).getTime() - new Date(a.alert.createdAt).getTime())
      .slice(0, 30);
  }, [alerts, followingAlertIds, userCoords, activeCategories]);

  const requestLocation = () => {
    void fetchLocation(true);
  };

  const copy = LOCATION_COPY[locationCopyKey(locationCode)];

  const renderItem = ({
    item,
  }: {
    item: { alert: AlertItem; match: NonNullable<ReturnType<typeof matchInboxAlert>> };
  }) => {
    const { alert, match } = item;
    const isCritical = alert.category === "sos" || alert.category === "balacera" || alert.category === "incendio" || alert.upvotes > 10;
    const iconName = (CATEGORY_ICONS[alert.category] ?? "notifications-outline") as any;
    const label = CATEGORY_LABELS[alert.category] ?? alert.category;
    const hasMedia = alert.media.length > 0;
    const distLabel = formatDistance(match.distanceKm);

    return (
      <Pressable
        style={styles.item}
        android_ripple={{ color: theme.colors.border }}
        onPress={() => router.push(`/alert/${alert.id}` as any)}
      >
        <View style={[styles.iconWrap, isCritical && styles.iconWrapCritical]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isCritical ? "#FF3B3B" : theme.colors.textMuted}
          />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemRow}>
            <Text style={styles.itemTitle}>{label.toUpperCase()}</Text>
            {isCritical && (
              <View style={styles.criticalBadge}>
                <Text style={styles.criticalBadgeText}>CRÍTICO</Text>
              </View>
            )}
            {match.nearby && (
              <View style={styles.reasonBadge}>
                <Text style={styles.reasonBadgeText}>CERCA</Text>
              </View>
            )}
            {match.following && (
              <View style={styles.followBadge}>
                <Text style={styles.followBadgeText}>SIGUIENDO</Text>
              </View>
            )}
            {hasMedia && (
              <View style={styles.mediaBadge}>
                <Ionicons name={alert.media.some((m) => m.type === "video") ? "film" : "camera"} size={9} color={theme.colors.textMuted} />
              </View>
            )}
          </View>
          <Text style={styles.itemDesc} numberOfLines={1}>
            {alert.title ?? alert.description ?? label}
          </Text>
          <View style={styles.itemMeta}>
            <Ionicons name="location-outline" size={11} color={theme.colors.textMuted} />
            <Text style={styles.itemTime}>{alert.neighborhood ?? "Sin colonia"}</Text>
            {distLabel ? (
              <>
                <Text style={styles.itemDot}>·</Text>
                <Text style={styles.itemTime}>{distLabel}</Text>
              </>
            ) : null}
            <Text style={styles.itemDot}>·</Text>
            <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
            <Text style={styles.itemTime}>{formatRelativeTime(alert.createdAt)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
      </Pressable>
    );
  };

  const empty = locating ? (
    <View style={styles.empty}>
      <ActivityIndicator color={theme.colors.textMuted} />
      <Text style={styles.emptyText}>Buscando avisos cerca de ti</Text>
    </View>
  ) : !userCoords ? (
    <View style={styles.empty}>
      <Ionicons name="navigate-outline" size={44} color={theme.colors.border} />
      <Text style={styles.emptyText}>{copy.title}</Text>
      <Text style={styles.emptyHint}>{copy.hint}</Text>
      <Pressable style={styles.emptyCta} onPress={requestLocation}>
        <Text style={styles.emptyCtaText}>{copy.cta}</Text>
      </Pressable>
    </View>
  ) : (
    <View style={styles.empty}>
      <Ionicons name="notifications-off-outline" size={44} color={theme.colors.border} />
      <Text style={styles.emptyText}>Nada cerca ni en seguimiento</Text>
      <Text style={styles.emptyHint}>
        Avisos muestra alertas a {AVISOS_RADIUS_KM} km o las que sigues. Pulsos tiene el resto.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Avisos</Text>
        <Text style={styles.subtitle}>
          Cerca de ti ({AVISOS_RADIUS_KM} km) y alertas que sigues
        </Text>
      </View>
      <FlatList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={(item) => item.alert.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 14,
      gap: 2,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      color: theme.colors.text,
      fontSize: 28,
      fontFamily: theme.fonts.heading,
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
    },
    list: {
      paddingHorizontal: 16,
      paddingBottom: 160,
      paddingTop: 8,
      flexGrow: 1,
    },
    item: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      gap: 14,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    iconWrapCritical: {
      backgroundColor: "rgba(255,59,59,0.1)",
      borderColor: "rgba(255,59,59,0.3)",
    },
    itemBody: { flex: 1, gap: 4 },
    itemRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    itemTitle: {
      color: theme.colors.text,
      fontSize: 12,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    mediaBadge: {
      width: 18,
      height: 18,
      borderRadius: 5,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    criticalBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: "rgba(255,59,59,0.15)",
      borderWidth: 1,
      borderColor: "rgba(255,59,59,0.3)",
    },
    criticalBadgeText: {
      color: "#FF3B3B",
      fontSize: 8,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    reasonBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: "rgba(31,157,110,0.12)",
      borderWidth: 1,
      borderColor: "rgba(31,157,110,0.28)",
    },
    reasonBadgeText: {
      color: theme.colors.success ?? "#1F9D6E",
      fontSize: 8,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    followBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    followBadgeText: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.heading,
      letterSpacing: 0.8,
    },
    itemDesc: {
      color: theme.colors.textMuted,
      fontSize: 13,
      fontFamily: theme.fonts.body,
      lineHeight: 18,
    },
    itemMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexWrap: "wrap",
    },
    itemTime: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.body,
    },
    itemDot: {
      color: theme.colors.border,
      fontSize: 11,
    },
    separator: {
      height: 1,
      backgroundColor: theme.colors.border,
      opacity: 0.5,
    },
    empty: {
      alignItems: "center",
      paddingTop: 80,
      gap: 12,
      paddingHorizontal: 24,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontFamily: theme.fonts.body,
      textAlign: "center",
    },
    emptyHint: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.body,
      textAlign: "center",
      lineHeight: 18,
      opacity: 0.8,
    },
    emptyCta: {
      marginTop: 4,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.colors.accent,
    },
    emptyCtaText: {
      color: "#fff",
      fontSize: 13,
      fontFamily: theme.fonts.heading,
    },
  });
