// Envía push notifications cuando se crea una alerta o una actualización.
// Invocada por el trigger alerts_notify (service_role) y también desde el
// cliente para las actualizaciones de hilo.
//   body = { type: "alert", alertId }    -> críticas: push a users.city_id = alert.city_id
//   body = { type: "update", updateId }  -> push a los seguidores de la alerta
//
// Setup:
//   supabase functions deploy notify-on-alert
//
// Usa SUPABASE_SERVICE_ROLE_KEY (inyectada automáticamente) para leer
// destinatarios saltando RLS. Verifica el JWT del usuario que la invoca.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import {
  filterTokensByAlertCity,
  filterZonesByAlertCity,
} from "../_shared/notifyCityScope.ts";

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

/**
 * "ok" = Expo aceptó el aviso (ticket), no que el teléfono lo mostró. Antes la
 * respuesta de Expo se descartaba y la function decía "sent" aunque Expo o
 * Firebase/Apple lo rechazaran: si un SOS no llegaba, no había forma de saber
 * si fue el token, las credenciales de FCM o APNs.
 */
type PushSummary = {
  ok: number;
  failed: number;
  errors: Record<string, number>;
  receiptErrors?: Record<string, number>;
};

const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";

// El ticket solo dice que Expo recibió el aviso; si Apple o Firebase lo
// rechazan (p. ej. credenciales de APNs), eso solo aparece en el receipt.
async function collectReceiptErrors(
  ids: string[],
  headers: Record<string, string>,
): Promise<Record<string, number>> {
  const errors: Record<string, number> = {};
  if (ids.length === 0) return errors;
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const res = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ ids }),
    });
    const payload = await res.json().catch(() => null);
    const receipts: Record<string, { status: string; message?: string; details?: { error?: string } }> =
      payload?.data ?? {};
    for (const id of ids) {
      const r = receipts[id];
      if (!r) {
        errors.Pending = (errors.Pending ?? 0) + 1;
      } else if (r.status !== "ok") {
        const code = r.details?.error ?? "Unknown";
        errors[code] = (errors[code] ?? 0) + 1;
        console.error("Expo receipt con error", code, r.message ?? "");
      }
    }
  } catch (e) {
    console.error("Expo receipts failed", e);
  }
  return errors;
}

async function sendExpoPush(messages: PushMessage[]): Promise<PushSummary> {
  const summary: PushSummary = { ok: 0, failed: 0, errors: {} };
  // El proyecto de Expo tiene activada la seguridad reforzada de push: sin este
  // token Expo responde 403 "Insufficient permissions" y no entrega nada.
  const expoToken = Deno.env.get("EXPO_ACCESS_TOKEN");
  const fail = (code: string, n = 1) => {
    summary.failed += n;
    summary.errors[code] = (summary.errors[code] ?? 0) + n;
  };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(expoToken ? { Authorization: `Bearer ${expoToken}` } : {}),
  };
  const ticketIds: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(chunk),
      });
      const payload = await res.json().catch(() => null);
      const tickets: Array<{ status: string; id?: string; message?: string; details?: { error?: string } }> =
        Array.isArray(payload?.data) ? payload.data : [];
      if (!res.ok || tickets.length !== chunk.length) {
        fail(`HTTP_${res.status}`, chunk.length);
        console.error("Expo rechazó el lote", res.status, JSON.stringify(payload?.errors ?? payload).slice(0, 500));
        continue;
      }
      for (const t of tickets) {
        if (t.status === "ok") {
          summary.ok += 1;
          if (t.id) ticketIds.push(t.id);
          continue;
        }
        const code = t.details?.error ?? "Unknown";
        fail(code);
        console.error("Expo ticket con error", code, t.message ?? "");
      }
    } catch (e) {
      fail("NetworkError", chunk.length);
      console.error("Expo push send failed", e);
    }
  }
  summary.receiptErrors = await collectReceiptErrors(ticketIds, headers);
  return summary;
}

/** Quien ocultó la categoría no recibe el aviso; el SOS llega siempre. */
function hidesCategory(row: unknown, category: string): boolean {
  if (category === "sos") return false;
  type U = { hidden_categories?: string[] | null };
  const users = (row as { users?: U | U[] }).users;
  const hidden = (Array.isArray(users) ? users[0] : users)?.hidden_categories ?? [];
  return hidden.includes(category);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // El trigger alerts_notify invoca con un secreto propio, no con service_role:
  // este camino solo necesita mandar avisos, no poder todo en la base.
  //
  // Hace falta porque si el aviso sale solo del cliente, un teléfono sin señal
  // o en segundo plano deja la alerta guardada y a nadie avisado — justo cuando
  // más importa. El secreto vive en Vault y nunca sale del servidor.
  const hookSecret = Deno.env.get("NOTIFY_HOOK_SECRET");
  const fromHook = Boolean(hookSecret) && req.headers.get("x-pulso-hook") === hookSecret;
  const fromServiceRole = authHeader === `Bearer ${serviceKey}`;
  const fromServer = fromHook || fromServiceRole;

  if (!fromServer) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  // Service role para leer destinatarios saltando RLS
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  let body: {
    type?: string;
    alertId?: string;
    updateId?: string;
    confirmations?: number;
    postId?: string;
    externalId?: string;
    lat?: number;
    lng?: number;
    cityId?: string;
    category?: string;
    title?: string;
    placeLabel?: string;
    digestCount?: number;
    restrictToUserIds?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const messages: PushMessage[] = [];

  if (body.type === "alert" && body.alertId) {
    const { data: alert } = await admin
      .from("alerts")
      .select("id,category,user_id,title,lat,lng,city_id")
      .eq("id", body.alertId)
      .single();

    if (!alert) return json({ sent: 0 });

    // Operativo: no push (ni broadcast ni Círculo). Ver operativoPolicy / halconeo.
    if (alert.category === "operativo") {
      return json({ sent: 0, skipped: "operativo" });
    }

    const alertCityId = (alert as { city_id?: string | null }).city_id ?? null;
    if (!alertCityId) {
      // Sin city_id no hay broadcast global: evita landmine multi-ciudad.
      return json({ sent: 0, skipped: "missing_city_id" });
    }

    const label = CATEGORY_LABELS[alert.category] ?? alert.category;
    const byUser = new Map<string, PushMessage>();

    if (CRITICAL_CATEGORIES.includes(alert.category)) {
      let query = admin
        .from("push_tokens")
        .select("token, user_id, users!inner(push_enabled, hidden_categories, city_id)")
        .eq("users.push_enabled", true)
        .eq("users.city_id", alertCityId);
      if (alert.user_id) query = query.neq("user_id", alert.user_id);
      const { data: rows } = await query;
      const scoped = filterTokensByAlertCity(rows ?? [], alertCityId);

      for (const row of scoped) {
        if (hidesCategory(row, alert.category)) continue;
        const userId = (row as { user_id: string }).user_id;
        byUser.set(userId, {
          to: (row as { token: string }).token,
          title: alert.category === "sos" ? "SOS cerca · 2 km" : `Aviso: ${label}`,
          body:
            alert.category === "sos"
              ? "Hay un SOS cerca. Abre Pulso si puedes ayudar con seguridad."
              : alert.title ?? `Hay un aviso de ${label.toLowerCase()} en tu zona.`,
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
        .select("user_id,label,lat,lng,city_id")
        .eq("city_id", alertCityId);

      const scopedZones = filterZonesByAlertCity(zones ?? [], alertCityId);
      const nearByUser = new Map<string, string>();
      for (const zone of scopedZones) {
        if (alert.user_id && zone.user_id === alert.user_id) continue;
        const km = haversineKm(alertLat, alertLng, Number(zone.lat), Number(zone.lng));
        if (km <= CIRCULO_RADIUS_KM && !nearByUser.has(zone.user_id)) {
          nearByUser.set(zone.user_id, zone.label);
        }
      }

      if (nearByUser.size > 0) {
        const { data: rows } = await admin
          .from("push_tokens")
          .select("token, user_id, users!inner(push_enabled, hidden_categories, city_id)")
          .in("user_id", [...nearByUser.keys()])
          .eq("users.push_enabled", true)
          .eq("users.city_id", alertCityId);

        const scoped = filterTokensByAlertCity(rows ?? [], alertCityId);
        for (const row of scoped) {
          if (hidesCategory(row, alert.category)) continue;
          const userId = (row as { user_id: string }).user_id;
          const zoneLabel = nearByUser.get(userId);
          if (!zoneLabel) continue;
          byUser.set(userId, {
            to: (row as { token: string }).token,
            title: `${label} · ${zoneLabel}`,
            body: `Aviso de ${label.toLowerCase()} cerca de ${zoneLabel}.`,
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

    if (alert?.category === "operativo") {
      return json({ sent: 0, skipped: "operativo" });
    }

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
  } else if (body.type === "cleared" && body.alertId) {
    // Push suave a quien sigue la alerta: “ya se despejó”.
    // Solo si está resolved en DB (prod v24) y una sola vez por alerta.
    let alert: {
      id: string;
      category: string;
      title?: string | null;
      status: string;
      cleared_push_sent_at?: string | null;
    } | null = null;

    {
      const primary = await admin
        .from("alerts")
        .select("id,category,title,status,cleared_push_sent_at")
        .eq("id", body.alertId)
        .single();
      if (primary.error) {
        const legacy = await admin
          .from("alerts")
          .select("id,category,title,status")
          .eq("id", body.alertId)
          .single();
        alert = legacy.data;
      } else {
        alert = primary.data;
      }
    }

    if (!alert || alert.category === "operativo") {
      return json({ sent: 0, skipped: "operativo_or_missing" });
    }

    if (alert.status !== "resolved") {
      return json({ sent: 0, skipped: "not_resolved" });
    }

    // Claim atómico: solo el primer request envía push (columna nueva).
    if (Object.prototype.hasOwnProperty.call(alert, "cleared_push_sent_at")) {
      if (alert.cleared_push_sent_at) {
        return json({ sent: 0, skipped: "already_notified" });
      }
      const { data: claimed, error: claimErr } = await admin
        .from("alerts")
        .update({ cleared_push_sent_at: new Date().toISOString() })
        .eq("id", alert.id)
        .eq("status", "resolved")
        .is("cleared_push_sent_at", null)
        .select("id")
        .maybeSingle();

      if (claimErr) {
        console.error("cleared push claim failed", claimErr.message);
        return json({ sent: 0, skipped: "claim_failed" });
      }
      if (!claimed) {
        return json({ sent: 0, skipped: "already_notified" });
      }
    }

    const { data: follows } = await admin
      .from("alert_follows")
      .select("user_id")
      .eq("alert_id", alert.id);

    const followerIds = (follows ?? []).map((f) => f.user_id as string);
    if (followerIds.length === 0) return json({ sent: 0 });

    const { data: rows } = await admin
      .from("push_tokens")
      .select("token, users!inner(push_enabled)")
      .in("user_id", followerIds)
      .eq("users.push_enabled", true);

    const label = CATEGORY_LABELS[alert.category] ?? alert.category;
    for (const row of rows ?? []) {
      messages.push({
        to: (row as { token: string }).token,
        title: `Ya se despejó · ${label}`,
        body: "Vecinos marcan que la zona volvió a la calma.",
        sound: "default",
        priority: "high",
        channelId: "default",
        data: { alertId: alert.id, cleared: true },
      });
    }
  } else if (body.type === "tomtom_incident") {
    // Aviso suave a Círculo (watchedZones) cuando un incidente TomTom cae cerca.
    // Geocerca en DB (haversine) — TomTom Geofencing no aporta sobre nuestras zonas.
    // Anti-spam: 1 push por (user, external_id); sync agrupa (digestCount / restrictToUserIds).
    if (!fromServer) return json({ error: "Forbidden" }, 403);

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const cityId = body.cityId || null;
    const externalId = body.externalId || "";
    const digestCount = Math.max(1, Number(body.digestCount) || 1);
    const restrictTo = Array.isArray(body.restrictToUserIds)
      ? (body.restrictToUserIds as unknown[]).filter((id): id is string => typeof id === "string")
      : null;
    if (!cityId || !externalId || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return json({ sent: 0, skipped: "bad_tomtom_payload" });
    }

    const { data: zones } = await admin
      .from("watched_zones")
      .select("user_id,label,lat,lng,city_id")
      .eq("city_id", cityId);

    const nearByUser = new Map<string, string>();
    for (const zone of filterZonesByAlertCity(zones ?? [], cityId)) {
      if (restrictTo && !restrictTo.includes(zone.user_id)) continue;
      const km = haversineKm(lat, lng, Number(zone.lat), Number(zone.lng));
      if (km <= CIRCULO_RADIUS_KM && !nearByUser.has(zone.user_id)) {
        nearByUser.set(zone.user_id, zone.label);
      }
    }
    if (nearByUser.size === 0) return json({ sent: 0, skipped: "no_nearby_zones" });

    // Filtrar ya notificados (anti-spam).
    const { data: already } = await admin
      .from("tomtom_zone_notify_log")
      .select("user_id")
      .eq("external_id", externalId)
      .in("user_id", [...nearByUser.keys()]);

    const alreadySet = new Set((already ?? []).map((r) => r.user_id as string));
    const recipients = [...nearByUser.keys()].filter((id) => !alreadySet.has(id));
    if (recipients.length === 0) return json({ sent: 0, skipped: "already_notified" });

    const { data: rows } = await admin
      .from("push_tokens")
      .select("token, user_id, users!inner(push_enabled, city_id)")
      .in("user_id", recipients)
      .eq("users.push_enabled", true)
      .eq("users.city_id", cityId);

    const scoped = filterTokensByAlertCity(rows ?? [], cityId);
    const label = CATEGORY_LABELS[body.category ?? ""] ?? "Circulación";
    const place = body.placeLabel || "tu zona";
    for (const row of scoped) {
      const userId = (row as { user_id: string }).user_id;
      const zoneLabel = nearByUser.get(userId) || place;
      const title =
        digestCount > 1
          ? `Circulación cerca de ${zoneLabel}`
          : `${label} cerca de ${zoneLabel}`;
      const text =
        digestCount > 1
          ? `Hay ${digestCount} avisos de circulación cerca de tu zona vigilada. Ábrelos con calma.`
          : "Hay un aviso de circulación cerca de tu zona vigilada. Ábrelo con calma.";
      messages.push({
        to: (row as { token: string }).token,
        title,
        body: text,
        sound: "default",
        priority: "high",
        channelId: "default",
        data: { postId: body.postId, tomtom: true, digestCount },
      });
    }

    if (messages.length > 0) {
      const logRows = recipients.map((user_id) => ({
        user_id,
        external_id: externalId,
        city_id: cityId,
      }));
      await admin.from("tomtom_zone_notify_log").upsert(logRows, {
        onConflict: "user_id,external_id",
      });
    }
  } else if (body.type === "impact" && body.alertId) {
    // Aviso al autor cuando su pulso llega a un hito de confirmaciones. Solo lo
    // dispara el trigger verifications_impact: desde un teléfono serviría para
    // mandarle avisos falsos a cualquiera.
    if (!fromServer) return json({ error: "Forbidden" }, 403);

    const { data: alert } = await admin
      .from("alerts")
      .select("id,category,user_id")
      .eq("id", body.alertId)
      .single();
    if (!alert?.user_id) return json({ sent: 0 });

    const { count: views } = await admin
      .from("alert_views")
      .select("alert_id", { count: "exact", head: true })
      .eq("alert_id", alert.id)
      .neq("viewer_id", alert.user_id);

    const { data: rows } = await admin
      .from("push_tokens")
      .select("token, users!inner(push_enabled)")
      .eq("user_id", alert.user_id)
      .eq("users.push_enabled", true);

    const confirmations = Math.max(1, Number(body.confirmations ?? 1));
    const who = confirmations === 1 ? "1 vecino" : `${confirmations} vecinos`;
    const verb = confirmations === 1 ? "confirmó" : "confirmaron";
    const label = (CATEGORY_LABELS[alert.category] ?? alert.category).toLowerCase();
    // En categorías de riesgo no se habla de vistas: no queremos premiar
    // grabar una balacera de cerca.
    const risky = CRITICAL_CATEGORIES.includes(alert.category);
    const title = risky ? "Gracias por avisar" : "Tu pulso está ayudando";
    const text = risky
      ? `${who} ${verb} tu reporte de ${label}.`
      : `${who} lo ${verb}${(views ?? 0) > 0 ? ` · lo vieron ${views}` : ""}.`;

    for (const row of rows ?? []) {
      messages.push({
        to: (row as { token: string }).token,
        title,
        body: text,
        sound: "default",
        priority: "high",
        channelId: "default",
        data: { alertId: alert.id },
      });
    }
  } else {
    return json({ error: "Bad request" }, 400);
  }

  const delivery = messages.length > 0
    ? await sendExpoPush(messages)
    : { ok: 0, failed: 0, errors: {} };

  return json({ sent: messages.length, ...delivery });
});
