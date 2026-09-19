import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { needsReview, useAlertyStore, type ModerationItem } from "../lib/alerty/store";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { safeBack } from "../lib/alerty/nav";

const HORA = 1000 * 60 * 60;

/** "hace 3 h", "hace 2 d". */
function desde(iso: string) {
  const horas = (Date.now() - new Date(iso).getTime()) / HORA;
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

const vencido = (iso: string) => Date.now() - new Date(iso).getTime() > 24 * HORA;

/**
 * Cola de revisión. Lo prometido en los términos y a App Review: cada reporte
 * lo mira una persona en menos de 24 horas. El ocultado automático al tercer
 * reporte no sustituye esto, solo gana tiempo.
 */
export default function ModeracionScreen() {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const isModerator = useAlertyStore((s) => s.isModerator);
  const queue = useAlertyStore((s) => s.moderationQueue);
  const blocked = useAlertyStore((s) => s.moderationBlocked);
  const loadModeration = useAlertyStore((s) => s.loadModeration);
  const reviewAlert = useAlertyStore((s) => s.reviewAlert);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    void loadModeration();
  }, [loadModeration]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadModeration();
    setRefreshing(false);
  }, [loadModeration]);

  const revisar = async (item: ModerationItem, action: "hidden" | "kept") => {
    setWorking(item.alertId);
    const { error } = await reviewAlert(item.alertId, action);
    setWorking(null);
    if (error) Alert.alert("No se pudo", error);
  };

  const pendientes = queue.filter(needsReview);
  const revisados = queue.filter((item) => !needsReview(item));

  const renderItem = (item: ModerationItem) => {
    const tarde = needsReview(item) && vencido(item.firstFlagAt);
    return (
      <View key={item.alertId} style={[styles.card, tarde && styles.cardLate]}>
        <View style={styles.cardTop}>
          <Text style={styles.category}>{item.category.toUpperCase()}</Text>
          <Text style={[styles.age, tarde && styles.ageLate]}>
            reportado {desde(item.firstFlagAt)}
          </Text>
        </View>

        <Text style={styles.description}>
          {item.description?.trim() || "Sin texto (solo foto, video o voz)."}
        </Text>

        <Text style={styles.meta}>
          {item.authorUsername ?? "cuenta borrada"} · {item.flagCount}{" "}
          {item.flagCount === 1 ? "reporte" : "reportes"} ·{" "}
          {item.hiddenAt ? "oculto ahora" : "visible ahora"}
        </Text>

        {item.reasons.length > 0 && (
          <Text style={styles.reasons}>Motivos: {item.reasons.join(" · ")}</Text>
        )}

        {item.reviewedAt && (
          <Text style={styles.meta}>
            Última revisión {desde(item.reviewedAt)}:{" "}
            {item.lastAction === "hidden" ? "se quitó" : "se dejó visible"}
          </Text>
        )}

        <View style={styles.actions}>
          <Pressable
            style={[styles.action, styles.actionOpen]}
            onPress={() => router.push(`/alert/${item.alertId}` as any)}
          >
            <Text style={styles.actionOpenText}>Ver pulso</Text>
          </Pressable>
          <Pressable
            style={[styles.action, styles.actionKeep]}
            disabled={working === item.alertId}
            onPress={() => revisar(item, "kept")}
          >
            <Text style={styles.actionKeepText}>Dejar visible</Text>
          </Pressable>
          <Pressable
            style={[styles.action, styles.actionHide]}
            disabled={working === item.alertId}
            onPress={() => revisar(item, "hidden")}
          >
            <Text style={styles.actionHideText}>Quitar</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router)} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Moderación</Text>
        <View style={styles.back} />
      </View>

      {!isModerator ? (
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Esta cuenta no modera contenido.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.accent} />
          }
        >
          <Text style={styles.sectionTitle}>
            {pendientes.length === 0
              ? "Nada pendiente"
              : `${pendientes.length} ${pendientes.length === 1 ? "pendiente" : "pendientes"}`}
          </Text>
          <Text style={styles.sectionHelp}>
            Cada reporte se revisa antes de 24 horas. En rojo, los que ya pasaron.
          </Text>

          {pendientes.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={28} color={theme.colors.accent} />
              <Text style={styles.emptyText}>Ningún pulso reportado espera revisión.</Text>
            </View>
          ) : (
            pendientes.map(renderItem)
          )}

          {blocked.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Cuentas bloqueadas por vecinos</Text>
              <Text style={styles.sectionHelp}>
                No se actúa solo: es la señal para mirar lo que publica quien reincide.
              </Text>
              {blocked.map((cuenta) => (
                <View key={cuenta.userId} style={styles.blockRow}>
                  <Text style={styles.blockName}>{cuenta.username ?? "cuenta borrada"}</Text>
                  <Text style={styles.meta}>
                    {cuenta.blockCount}{" "}
                    {cuenta.blockCount === 1 ? "bloqueo" : "bloqueos"} · último{" "}
                    {desde(cuenta.lastBlockAt)}
                  </Text>
                </View>
              ))}
            </>
          )}

          {revisados.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Ya revisados</Text>
              {revisados.map(renderItem)}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    headerTitle: { fontFamily: theme.fonts.heading, fontSize: 16, color: theme.colors.text },
    body: { padding: 16, paddingBottom: 40, gap: 12 },
    sectionTitle: {
      fontSize: 17,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      marginTop: 8,
    },
    sectionHelp: { fontSize: 12, lineHeight: 18, color: theme.colors.textMuted, marginTop: -6 },
    empty: { alignItems: "center", gap: 8, paddingVertical: 32 },
    emptyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: "center" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      gap: 6,
    },
    cardLate: { borderColor: theme.colors.danger },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    category: { fontSize: 11, letterSpacing: 0.5, color: theme.colors.accent, fontWeight: "700" },
    age: { fontSize: 11, color: theme.colors.textMuted },
    ageLate: { color: theme.colors.danger, fontWeight: "700" },
    description: { fontSize: 14, lineHeight: 20, color: theme.colors.text },
    meta: { fontSize: 12, color: theme.colors.textMuted },
    reasons: { fontSize: 12, color: theme.colors.textMuted, fontStyle: "italic" },
    actions: { flexDirection: "row", gap: 8, marginTop: 6 },
    action: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
    actionOpen: { borderWidth: 1, borderColor: theme.colors.border },
    actionOpenText: { fontSize: 13, fontWeight: "600", color: theme.colors.text },
    actionKeep: { borderWidth: 1, borderColor: theme.colors.accent },
    actionKeepText: { fontSize: 13, fontWeight: "600", color: theme.colors.accent },
    actionHide: { backgroundColor: theme.colors.danger },
    actionHideText: { fontSize: 13, fontWeight: "700", color: "#fff" },
    blockRow: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 12,
      gap: 2,
    },
    blockName: { fontSize: 14, fontWeight: "600", color: theme.colors.text },
  });
