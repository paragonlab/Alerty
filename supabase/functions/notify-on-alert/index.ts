// Envía push notifications cuando se crea una alerta o una actualización.
// Invocada por el trigger alerts_notify (service_role) y también desde el
// cliente para las actualizaciones de hilo.
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
  const fromServer = Boolean(hookSecret) && req.headers.get("x-pulso-hook") === hookSecret;

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

  let body: { type?: string; alertId?: string; updateId?: string; confirmations?: number };
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
        .select("token, user_id, users!inner(push_enabled, hidden_categories)")
        .eq("users.push_enabled", true);
      if (alert.user_id) query = query.neq("user_id", alert.user_id);
      const { data: rows } = await query;

      for (const row of rows ?? []) {
        if (hidesCategory(row, alert.category)) continue;
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
          .select("token, user_id, users!inner(push_enabled, hidden_categories)")
          .in("user_id", [...nearByUser.keys()])
          .eq("users.push_enabled", true);

        for (const row of rows ?? []) {
          if (hidesCategory(row, alert.category)) continue;
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
