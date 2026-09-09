// Envía push notifications cuando se crea una alerta o una actualización.
// Invocada desde el cliente: supabase.functions.invoke("notify-on-alert", { body })
//   body = { type: "alert", alertId }    -> críticas: push a todos
//   body = { type: "update", updateId }  -> push a los seguidores de la alerta
//
// Setup:
//   supabase functions deploy notify-on-alert
//
// Usa SUPABASE_SERVICE_ROLE_KEY (inyectada automáticamente) para leer
// destinatarios saltando RLS. Verifica el JWT del usuario que la invoca.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const CRITICAL_CATEGORIES = [
  "sos",
  "balacera",
  "narcobloqueo",
  "enfrentamiento",
  "detonaciones",
  "incendio",
];

const CATEGORY_LABELS: Record<string, string> = {
  sos: "SOS",
  balacera: "Balacera",
  narcobloqueo: "Narcobloqueo",
  enfrentamiento: "Enfrentamiento",
  detonaciones: "Detonaciones",
  bloqueo: "Bloqueo",
  captura: "Captura",
  robo: "Robo",
  accidente: "Accidente",
  incendio: "Incendio",
  inundacion: "Inundación",
  "zona segura": "Zona segura",
};

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CIRCULO_RADIUS_KM = 0.8;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: "default";
  data: Record<string, unknown>;
};

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function sendExpoPush(messages: PushMessage[]) {
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error("Expo push send failed", e);
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  // Verifica identidad del invocador
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  // Service role para leer destinatarios saltando RLS
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: { type?: string; alertId?: string; updateId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const messages: PushMessage[] = [];

  if (body.type === "alert" && body.alertId) {
    const { data: alert } = await admin
      .from("alerts")
      .select("id,category,user_id,title,lat,lng")
      .eq("id", body.alertId)
      .single();

    if (!alert) return json({ sent: 0 });

    const label = CATEGORY_LABELS[alert.category] ?? alert.category;
    const byUser = new Map<string, PushMessage>();

    if (CRITICAL_CATEGORIES.includes(alert.category)) {
      let query = admin
        .from("push_tokens")
        .select("token, user_id, users!inner(push_enabled)")
        .eq("users.push_enabled", true);
      if (alert.user_id) query = query.neq("user_id", alert.user_id);
      const { data: rows } = await query;

      for (const row of rows ?? []) {
        const userId = (row as { user_id: string }).user_id;
        byUser.set(userId, {
          to: (row as { token: string }).token,
          title: alert.category === "sos" ? "SOS · 2 km a la redonda" : `${label} reportada`,
          body:
            alert.category === "sos"
              ? "Emergencia crítica cerca. Abre Pulso."
              : alert.title ?? `Se reportó ${label.toLowerCase()} en tu zona.`,
          sound: "default",
          priority: "high",
          channelId: "default",
          data: { alertId: alert.id },
        });
      }
    }

    const alertLat = Number(alert.lat);
    const alertLng = Number(alert.lng);
    if (
      alert.category !== "zona segura" &&
      Number.isFinite(alertLat) &&
      Number.isFinite(alertLng)
    ) {
      const { data: zones } = await admin
        .from("watched_zones")
        .select("user_id,label,lat,lng");

      const nearByUser = new Map<string, string>();
      for (const zone of zones ?? []) {
        if (alert.user_id && zone.user_id === alert.user_id) continue;
        const km = haversineKm(alertLat, alertLng, Number(zone.lat), Number(zone.lng));
        if (km <= CIRCULO_RADIUS_KM && !nearByUser.has(zone.user_id)) {
          nearByUser.set(zone.user_id, zone.label);
        }
      }

      if (nearByUser.size > 0) {
        const { data: rows } = await admin
          .from("push_tokens")
          .select("token, user_id, users!inner(push_enabled)")
          .in("user_id", [...nearByUser.keys()])
          .eq("users.push_enabled", true);

        for (const row of rows ?? []) {
          const userId = (row as { user_id: string }).user_id;
          const zoneLabel = nearByUser.get(userId);
          if (!zoneLabel) continue;
          byUser.set(userId, {
            to: (row as { token: string }).token,
            title: `${label} · ${zoneLabel}`,
            body: `Se reportó ${label.toLowerCase()} cerca de ${zoneLabel}.`,
            sound: "default",
            priority: "high",
            channelId: "default",
            data: { alertId: alert.id },
          });
        }
      }
    }

    messages.push(...byUser.values());
  } else if (body.type === "update" && body.updateId) {
    const { data: update } = await admin
      .from("alert_updates")
      .select("id,content,alert_id,user_id")
      .eq("id", body.updateId)
      .single();

    if (!update) return json({ sent: 0 });

    const { data: alert } = await admin
      .from("alerts")
      .select("id,category,title")
      .eq("id", update.alert_id)
      .single();

    const { data: follows } = await admin
      .from("alert_follows")
      .select("user_id")
      .eq("alert_id", update.alert_id);

    const followerIds = (follows ?? [])
      .map((f) => f.user_id as string)
      .filter((id) => id !== update.user_id);

    if (followerIds.length > 0) {
      const { data: rows } = await admin
        .from("push_tokens")
        .select("token, users!inner(push_enabled)")
        .in("user_id", followerIds)
        .eq("users.push_enabled", true);

      const label = alert ? (CATEGORY_LABELS[alert.category] ?? alert.category) : "Alerta";
      for (const row of rows ?? []) {
        messages.push({
          to: (row as { token: string }).token,
          title: `Actualización · ${label}`,
          body: String(update.content).slice(0, 140),
          sound: "default",
          priority: "high",
          channelId: "default",
          data: { alertId: update.alert_id },
        });
      }
    }
  } else {
    return json({ error: "Bad request" }, 400);
  }

  if (messages.length > 0) await sendExpoPush(messages);

  return json({ sent: messages.length });
});
