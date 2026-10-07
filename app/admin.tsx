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
import { CATEGORY_LABELS } from "../lib/alerty/constants";

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
  pin_shape: string | null;
  pin_giro: string | null;
  logo_url: string | null;
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

type AdminUser = {
  id: string;
  username: string | null;
  email: string | null;
  created_at: string;
  is_premium: boolean;
  is_moderator: boolean;
  subscription_status: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_seen_at: string | null;
  alerts_count: number;
  zones_count: number;
};

type UserLocation = {
  id: string;
  username: string | null;
  email: string | null;
  last_lat: number;
  last_lng: number;
  last_seen_at: string | null;
};

type AdminAlert = {
  id: string;
  category: string;
  title: string | null;
  description: string | null;
  lat: number;
  lng: number;
  status: string;
  hidden_at: string | null;
  created_at: string;
  username: string | null;
};

type WatchedZone = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  created_at: string;
  username: string | null;
};

type Counts = {
  users: number;
  with_location: number;
  circulo_active: number;
  aliados_active: number;
  alerts_active: number;
  alerts_total: number;
  watched_zones: number;
  community_posts: number;
};

type TrafficBucket = {
  visits: number;
  guest_visits: number;
  signed_in_visits: number;
  minutes: number;
};

type Traffic = {
  day: TrafficBucket;
  week: TrafficBucket;
  month: TrafficBucket;
  year: TrafficBucket;
};

type CirculoSub = {
  id: string;
  username: string | null;
  email: string | null;
  subscription_status: string | null;
  subscription_end_date: string | null;
  premium_source: string | null;
  created_at: string;
  zones_count: number;
};

type AliadoSub = {
  id: string;
  name: string;
  description: string;
  owner_email: string;
  type: ZoneType;
  status: ZoneStatus;
  lat: number;
  lng: number;
  current_period_end: string | null;
  created_at: string;
};

const EMPTY_BUCKET: TrafficBucket = {
  visits: 0,
  guest_visits: 0,
  signed_in_visits: 0,
  minutes: 0,
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

function coords(lat: number, lng: number) {
  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps?q=${lat},${lng}`;
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [locations, setLocations] = useState<UserLocation[]>([]);
  const [circulo, setCirculo] = useState<CirculoSub[]>([]);
  const [aliados, setAliados] = useState<AliadoSub[]>([]);
  const [traffic, setTraffic] = useState<Traffic | null>(null);
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [watched, setWatched] = useState<WatchedZone[]>([]);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase || !isModerator) {
      setLoading(false);
      return;
    }
    const [leadRes, zoneRes, overviewRes] = await Promise.all([
      supabase
        .from("aliado_leads")
        .select(
          "id,name,description,contact_email,type,lat,lng,address,proof_url,proof_kind,location_distance_m,pin_shape,pin_giro,logo_url,status,zone_id,created_at",
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("sponsored_zones")
        .select("id,name,description,owner_email,type,status,lat,lng")
        .order("created_at", { ascending: false }),
      supabase.rpc("admin_overview"),
      loadModeration(),
    ]);
    if (leadRes.error) Alert.alert("Solicitudes", leadRes.error.message);
    else setLeads((leadRes.data ?? []) as Lead[]);
    if (zoneRes.error) Alert.alert("Pines", zoneRes.error.message);
    else setZones((zoneRes.data ?? []) as Zone[]);
    if (overviewRes.error) Alert.alert("Resumen", overviewRes.error.message);
    else if (overviewRes.data) {
      const data = overviewRes.data as {
        users?: AdminUser[];
        locations?: UserLocation[];
        circulo?: CirculoSub[];
        aliados?: AliadoSub[];
        traffic?: Traffic;
        alerts?: AdminAlert[];
        watched_zones?: WatchedZone[];
        counts?: Counts;
      };
      setUsers(data.users ?? []);
      setLocations(data.locations ?? []);
      setCirculo(data.circulo ?? []);
      setAliados(data.aliados ?? []);
      setTraffic(data.traffic ?? null);
      setAlerts(data.alerts ?? []);
      setWatched(data.watched_zones ?? []);
      setCounts(data.counts ?? null);
    }
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
        pin_shape:
          lead.pin_shape === "flag" || lead.pin_shape === "house" || lead.pin_shape === "shield"
            ? lead.pin_shape
            : "pin",
        pin_giro:
          lead.pin_giro === "tienda" ||
          lead.pin_giro === "farmacia" ||
          lead.pin_giro === "cafe" ||
          lead.pin_giro === "generico" ||
          lead.pin_giro === "casa" ||
          lead.pin_giro === "escudo"
            ? lead.pin_giro
            : null,
        logo_url: lead.logo_url,
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
              <Text style={styles.statNum}>{counts?.users ?? users.length}</Text>
              <Text style={styles.statLabel}>Usuarios</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{counts?.circulo_active ?? circulo.length}</Text>
              <Text style={styles.statLabel}>Círculo</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{counts?.aliados_active ?? aliados.length}</Text>
              <Text style={styles.statLabel}>Aliados</Text>
            </View>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{traffic?.day.guest_visits ?? 0}</Text>
              <Text style={styles.statLabel}>Visitas hoy</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{counts?.alerts_active ?? 0}</Text>
              <Text style={styles.statLabel}>Alertas</Text>
            </View>
            <Pressable style={styles.stat} onPress={() => router.push("/moderacion")}>
              <Text style={styles.statNum}>{reports}</Text>
              <Text style={styles.statLabel}>Reportes</Text>
            </Pressable>
          </View>

          <Text style={styles.sectionTitle}>Visitas</Text>
          <Text style={styles.sectionHelp}>
            Incluye gente sin cuenta. Los minutos son aproximados (1 ping por minuto en pantalla).
          </Text>
          {(
            [
              ["Hoy", traffic?.day],
              ["Semana", traffic?.week],
              ["Mes", traffic?.month],
              ["Año", traffic?.year],
            ] as const
          ).map(([label, bucket]) => {
            const b = bucket ?? EMPTY_BUCKET;
            return (
              <View key={label} style={styles.card}>
                <Text style={styles.name}>{label}</Text>
                <Text style={styles.meta}>
                  {b.visits} visitas · {b.guest_visits} sin cuenta · {b.signed_in_visits} con sesión · ~
                  {b.minutes} min
                </Text>
              </View>
            );
          })}

          <Text style={styles.sectionTitle}>Círculo activo</Text>
          {circulo.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Nadie tiene Círculo activo.</Text>
            </View>
          ) : (
            circulo.map((sub) => (
              <View key={sub.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{sub.username || "sin nombre"}</Text>
                  <Text style={styles.meta}>{sub.subscription_status || "active"}</Text>
                </View>
                {sub.email ? <Text style={styles.meta}>{sub.email}</Text> : null}
                <Text style={styles.meta}>
                  {sub.zones_count} {sub.zones_count === 1 ? "zona" : "zonas"}
                  {sub.premium_source ? ` · ${sub.premium_source}` : ""}
                  {sub.subscription_end_date
                    ? ` · hasta ${new Date(sub.subscription_end_date).toLocaleDateString("es-MX")}`
                    : ""}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Aliados activos</Text>
          {aliados.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>No hay Aliados activos en el mapa.</Text>
            </View>
          ) : (
            aliados.map((zone) => (
              <View key={zone.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>{zone.type === "refugio" ? "REFUGIO" : "ALIADO"}</Text>
                  <Text style={styles.meta}>En el mapa</Text>
                </View>
                <Text style={styles.name}>{zone.name}</Text>
                <Text style={styles.meta}>{zone.owner_email}</Text>
                <Text style={styles.meta}>
                  {coords(zone.lat, zone.lng)}
                  {zone.current_period_end
                    ? ` · hasta ${new Date(zone.current_period_end).toLocaleDateString("es-MX")}`
                    : ""}
                </Text>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Ubicaciones</Text>
          <Text style={styles.sectionHelp}>
            Última posición cuando alguien abrió el mapa o Avisos con GPS. No es en vivo.
          </Text>
          {locations.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>
                Todavía no hay ubicaciones. Aparecen cuando un usuario con sesión da permiso de GPS.
              </Text>
            </View>
          ) : (
            locations.map((loc) => (
              <View key={loc.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{loc.username || "sin nombre"}</Text>
                  <Text style={styles.meta}>
                    {loc.last_seen_at ? hace(loc.last_seen_at) : "sin fecha"}
                  </Text>
                </View>
                {loc.email ? <Text style={styles.meta}>{loc.email}</Text> : null}
                <Text style={styles.meta}>{coords(loc.last_lat, loc.last_lng)}</Text>
                <Pressable onPress={() => void Linking.openURL(mapsUrl(loc.last_lat, loc.last_lng))}>
                  <Text style={styles.link}>Abrir en Maps</Text>
                </Pressable>
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Usuarios</Text>
          <Text style={styles.sectionHelp}>
            Cuenta, Círculo y cuántos pulsos llevan. La ubicación reciente está arriba.
          </Text>
          {users.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>No hay usuarios.</Text>
            </View>
          ) : (
            users.map((user) => (
              <View key={user.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.name}>{user.username || "sin nombre"}</Text>
                  <Text style={styles.meta}>{hace(user.created_at)}</Text>
                </View>
                {user.email ? <Text style={styles.meta}>{user.email}</Text> : null}
                <Text style={styles.meta}>
                  {user.alerts_count} {user.alerts_count === 1 ? "alerta" : "alertas"} ·{" "}
                  {user.zones_count} {user.zones_count === 1 ? "zona" : "zonas"}
                  {user.is_premium ? " · Círculo" : ""}
                  {user.is_moderator ? " · admin" : ""}
                </Text>
                {user.last_lat != null && user.last_lng != null ? (
                  <Text style={styles.meta}>
                    Última ubicación {coords(user.last_lat, user.last_lng)}
                    {user.last_seen_at ? ` · ${hace(user.last_seen_at)}` : ""}
                  </Text>
                ) : (
                  <Text style={styles.meta}>Sin ubicación guardada</Text>
                )}
              </View>
            ))
          )}

          <Text style={styles.sectionTitle}>Alertas recientes</Text>
          {alerts.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>No hay alertas.</Text>
            </View>
          ) : (
            alerts.map((alert) => (
              <Pressable
                key={alert.id}
                style={styles.card}
                onPress={() => router.push(`/alert/${alert.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.kicker}>
                    {((CATEGORY_LABELS as Record<string, string>)[alert.category] ?? alert.category).toUpperCase()}
                  </Text>
                  <Text style={styles.meta}>{hace(alert.created_at)}</Text>
                </View>
                <Text style={styles.bodyText} numberOfLines={2}>
                  {alert.title || alert.description || "Sin texto"}
                </Text>
                <Text style={styles.meta}>
                  {alert.username || "cuenta borrada"} · {coords(alert.lat, alert.lng)}
                  {alert.hidden_at ? " · oculta" : ""}
                  {alert.status !== "active" ? ` · ${alert.status}` : ""}
                </Text>
              </Pressable>
            ))
          )}

          <Text style={styles.sectionTitle}>Zonas vigiladas</Text>
          <Text style={styles.sectionHelp}>Lugares de Círculo que la gente está cuidando.</Text>
          {watched.length === 0 ? (
            <View style={styles.emptyInline}>
              <Text style={styles.emptyText}>Nadie tiene zonas todavía.</Text>
            </View>
          ) : (
            watched.map((zone) => (
              <View key={zone.id} style={styles.card}>
                <Text style={styles.name}>{zone.label}</Text>
                <Text style={styles.meta}>
                  {zone.username || "cuenta borrada"} · {coords(zone.lat, zone.lng)} · {hace(zone.created_at)}
                </Text>
              </View>
            ))
          )}

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
    cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    kicker: { fontSize: 11, letterSpacing: 0.5, color: theme.colors.accent, fontFamily: theme.fonts.heading },
    name: { fontSize: 16, fontFamily: theme.fonts.heading, color: theme.colors.text, flexShrink: 1 },
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
