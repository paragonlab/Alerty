import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { needsReview, useAlertyStore } from "../lib/alerty/store";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { safeBack } from "../lib/alerty/nav";
import { supabase } from "../lib/supabase";

type LeadStatus = "new" | "contacted" | "closed";
type ZoneType = "refugio" | "anuncio";
type ZoneStatus = "pending" | "active" | "past_due" | "canceled";

type Lead = {
  id: string;
  name: string;
  description: string;
  contact_email: string;
  type: ZoneType;
  lat: number | null;
  lng: number | null;
  address: string | null;
  proof_url: string | null;
  proof_kind: string | null;
  location_distance_m: number | null;
  status: LeadStatus;
  zone_id: string | null;
  created_at: string;
};

type Zone = {
  id: string;
  name: string;
  description: string;
  owner_email: string;
  type: ZoneType;
  status: ZoneStatus;
  lat: number;
  lng: number;
};

const ZONE_STATUS: Record<ZoneStatus, string> = {
  active: "En el mapa",
  pending: "Esperando pago",
  past_due: "Pago vencido",
  canceled: "Fuera del mapa",
};

function hace(iso: string) {
  const horas = (Date.now() - new Date(iso).getTime()) / 3600000;
  if (horas < 1) return "hace menos de 1 h";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  return `hace ${Math.floor(horas / 24)} d`;
}

export default function AdminScreen() {
  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const isModerator = useAlertyStore((s) => s.isModerator);
  const reports = useAlertyStore((s) => s.moderationQueue.filter(needsReview).length);
  const loadModeration = useAlertyStore((s) => s.loadModeration);
  const loadSponsoredZones = useAlertyStore((s) => s.loadSponsoredZones);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !isModerator) {
      setLoading(false);
      return;
    }
    const [leadRes, zoneRes] = await Promise.all([
      supabase
        .from("aliado_leads")
        .select(
          "id,name,description,contact_email,type,lat,lng,address,proof_url,proof_kind,location_distance_m,status,zone_id,created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("sponsored_zones")
        .select("id,name,description,owner_email,type,status,lat,lng")
        .order("created_at", { ascending: false }),
      loadModeration(),
    ]);
    if (leadRes.error) Alert.alert("Solicitudes", leadRes.error.message);
    else setLeads((leadRes.data ?? []) as Lead[]);
    if (zoneRes.error) Alert.alert("Pines", zoneRes.error.message);
    else setZones((zoneRes.data ?? []) as Zone[]);
    setLoading(false);
  }, [isModerator, loadModeration]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const publicar = async (lead: Lead) => {
    if (!supabase || lead.lat == null || lead.lng == null) {
      Alert.alert("Sin ubicación", "Esta solicitud no trae un pin. No se puede publicar.");
      return;
    }
    setWorking(lead.id);
    const { data, error } = await supabase
      .from("sponsored_zones")
      .insert({
        name: lead.name,
        description: lead.description,
        owner_email: lead.contact_email,
        type: lead.type,
        lat: lead.lat,
        lng: lead.lng,
        status: "active",
      })
      .select("id")
      .single();
    if (error || !data) {
      setWorking(null);
      Alert.alert("No se publicó", error?.message ?? "Inténtalo de nuevo.");
      return;
    }
    const { error: leadError } = await supabase
      .from("aliado_leads")
      .update({ status: "contacted", zone_id: data.id })
      .eq("id", lead.id);
    setWorking(null);
    if (leadError) Alert.alert("Pin creado", "El pin quedó en el mapa, pero la solicitud no se marcó.");
    await loadSponsoredZones();
    await load();
  };

  const cerrar = async (lead: Lead) => {
    if (!supabase) return;
    setWorking(lead.id);
    const { error } = await supabase.from("aliado_leads").update({ status: "closed" }).eq("id", lead.id);
    setWorking(null);
    if (error) Alert.alert("No se cerró", error.message);
    else await load();
  };

  const ponerEnMapa = async (zone: Zone, active: boolean) => {
    if (!supabase) return;
    setWorking(zone.id);
    const { error } = await supabase
      .from("sponsored_zones")
      .update({ status: active ? "active" : "canceled", updated_at: new Date().toISOString() })
      .eq("id", zone.id);
    setWorking(null);
    if (error) Alert.alert("No se actualizó", error.message);
    else {
      await loadSponsoredZones();
      await load();
    }
  };

  const verComprobante = async (path: string) => {
    if (!supabase) return;
    const { data, error } = await supabase.storage.from("aliado-proofs").createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      Alert.alert("Comprobante", error?.message ?? "No se pudo abrir.");
      return;
    }
    await Linking.openURL(data.signedUrl);
  };

  const nuevas = leads.filter((lead) => lead.status === "new");
  const enMapa = zones.filter((zone) => zone.status === "active").length;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router)} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Administración</Text>
        <View style={styles.back} />
      </View>

      {!isModerator ? (
        <View style={styles.empty}>
          <Ionicons name="lock-closed-outline" size={28} color={theme.colors.textMuted} />
          <Text style={styles.emptyText}>Esta cuenta no administra Pulso.</Text>
        </View>
      ) : loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={theme.colors.textMuted} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.accent} />
          }
        >
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{nuevas.length}</Text>
              <Text style={styles.statLabel}>Solicitudes</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{enMapa}</Text>
              <Text style={styles.statLabel}>En el mapa</Text>
            </View>
            <Pressable style={styles.stat} onPress={() => router.push("/moderacion")}>
              <Text style={styles.statNum}>{reports}</Text>
              <Text style={styles.statLabel}>Reportes</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Aliados por revisar</Text>
          <Text style={styles.sectionHelp}>
            Publicar pone el pin en el mapa. El correo y el comprobante solo se ven aquí.
          </Text>
          {nuevas.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>No hay solicitudes nuevas.</Text>
            </View>
          ) : (
            nuevas.map((lead) => (
              <View key={lead.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>{lead.type === "refugio" ? "REFUGIO" : "ALIADO"}</Text>
                  <Text style={styles.meta}>{hace(lead.created_at)}</Text>
                </View>
                <Text style={styles.name}>{lead.name}</Text>
                <Text style={styles.bodyText}>{lead.description}</Text>
                <Text style={styles.meta}>{lead.contact_email}</Text>
                {lead.address ? <Text style={styles.meta}>{lead.address}</Text> : null}
                <Text style={styles.meta}>
                  {lead.location_distance_m != null
                    ? `Estaba a ${Math.round(lead.location_distance_m)} m del pin`
                    : "Sin verificación por GPS"}
                </Text>
                {lead.proof_url ? (
                  <Pressable onPress={() => void verComprobante(lead.proof_url!)}>
                    <Text style={styles.link}>
                      Ver {lead.proof_kind === "recibo" ? "recibo" : "fachada"}
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.actions}>
                  <Pressable
                    style={[styles.action, styles.actionQuiet]}
                    onPress={() => void cerrar(lead)}
                    disabled={working === lead.id}
                  >
                    <Text style={styles.actionQuietText}>No publicar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.action, styles.actionMain]}
                    onPress={() => void publicar(lead)}
                    disabled={working === lead.id}
                  >
                    {working === lead.id ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.actionMainText}>Publicar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Pines</Text>
          {zones.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Todavía no hay pines de Aliado.</Text>
            </View>
          ) : (
            zones.map((zone) => (
              <View key={zone.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>{zone.type === "refugio" ? "REFUGIO" : "ALIADO"}</Text>
                  <Text style={styles.meta}>{ZONE_STATUS[zone.status] ?? zone.status}</Text>
                </View>
                <Text style={styles.name}>{zone.name}</Text>
                <Text style={styles.bodyText}>{zone.description}</Text>
                <Text style={styles.meta}>{zone.owner_email}</Text>
                <Pressable
                  style={[styles.action, zone.status === "active" ? styles.actionQuiet : styles.actionMain]}
                  onPress={() => void ponerEnMapa(zone, zone.status !== "active")}
                  disabled={working === zone.id}
                >
                  <Text style={zone.status === "active" ? styles.actionQuietText : styles.actionMainText}>
                    {zone.status === "active" ? "Quitar del mapa" : "Poner en el mapa"}
                  </Text>
                </Pressable>
              </View>
            ))
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
    body: { padding: 16, paddingBottom: 48, gap: 12 },
    stats: { flexDirection: "row", gap: 8 },
    stat: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 14,
      alignItems: "center",
      gap: 2,
    },
    statNum: { fontFamily: theme.fonts.heading, fontSize: 22, color: theme.colors.text },
    statLabel: { fontSize: 11, color: theme.colors.textMuted },
    sectionTitle: {
      fontSize: 17,
      fontFamily: theme.fonts.heading,
      color: theme.colors.text,
      marginTop: 8,
    },
    sectionHelp: { fontSize: 12, lineHeight: 18, color: theme.colors.textMuted, marginTop: -6 },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
    emptyInline: { paddingVertical: 12 },
    emptyText: { fontSize: 13, color: theme.colors.textMuted, textAlign: "center" },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 14,
      gap: 6,
    },
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    kicker: { fontSize: 11, letterSpacing: 0.5, color: theme.colors.accent, fontFamily: theme.fonts.heading },
    name: { fontSize: 16, fontFamily: theme.fonts.heading, color: theme.colors.text },
    bodyText: { fontSize: 14, lineHeight: 20, color: theme.colors.text },
    meta: { fontSize: 12, color: theme.colors.textMuted },
    link: { fontSize: 13, color: theme.colors.accent, fontFamily: theme.fonts.heading },
    actions: { flexDirection: "row", gap: 8, marginTop: 6 },
    action: { flex: 1, paddingVertical: 10, borderRadius: 999, alignItems: "center" },
    actionQuiet: { borderWidth: 1, borderColor: theme.colors.border },
    actionQuietText: { fontSize: 13, color: theme.colors.text, fontFamily: theme.fonts.heading },
    actionMain: { backgroundColor: theme.colors.accent },
    actionMainText: { fontSize: 13, color: "#fff", fontFamily: theme.fonts.heading },
  });
