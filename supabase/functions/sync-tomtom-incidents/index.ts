/**
 * Sync TomTom Traffic Incidents → community_posts (source=tomtom).
 *
 * Auth (mismo patrón que notify-on-alert):
 *   - Header `x-pulso-hook` = NOTIFY_HOOK_SECRET (Vault `notify_hook_secret`), o
 *   - Authorization Bearer = SUPABASE_SERVICE_ROLE_KEY
 *
 * Bboxes ≤ 10k km² (ciudades + tramos de corredor sin solape con cajas ciudad).
 * city_id por coords (caja ciudad o ciudad activa más cercana).
 * Despejado fail-safe: solo bboxes con respuesta OK.
 * Pushes: no en first-run ni incidentes >30 min; máx 2/usuario o 1 digest.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import {
  TOMTOM_ATTRIBUTION,
  TOMTOM_BBOXES,
  TOMTOM_CIRCULO_RADIUS_KM,
  calmIncidentText,
  cityIdForIncident,
  haversineKm,
  isFreshTomtomIncident,
  mapTomtomCategory,
  parseIncidentDetails,
  planTomtomNotifiesPerUser,
  pointFromIncidentGeometry,
  selectIncidentsToResolve,
  tomtomGetJson,
  tomtomKey,
  type TomtomIncidentFeature,
  type TomtomNotifyCandidate,
} from "../_shared/tomtom.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-pulso-hook",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function fetchIncidents(
  bbox: string,
): Promise<{ ok: boolean; features: TomtomIncidentFeature[]; status: number }> {
  const fields = encodeURIComponent(
    "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},from,to,startTime,endTime,timeValidity}}}",
  );
  const path =
    `/traffic/services/5/incidentDetails?bbox=${bbox}` +
    `&fields=${fields}&language=es-ES&timeValidityFilter=present`;
  const { ok, data, status } = await tomtomGetJson(path);
  if (!ok) return { ok: false, features: [], status };
  return { ok: true, features: parseIncidentDetails(data), status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const hookSecret = Deno.env.get("NOTIFY_HOOK_SECRET");
  const fromHook = Boolean(hookSecret) && req.headers.get("x-pulso-hook") === hookSecret;
  const fromServiceRole = Boolean(serviceKey) && authHeader === `Bearer ${serviceKey}`;
  if (!fromHook && !fromServiceRole) {
    return json({ error: "Forbidden" }, 403);
  }

  if (!tomtomKey()) {
    return json({ ok: false, skipped: "missing_TOMTOM_API_KEY", attribution: TOMTOM_ATTRIBUTION });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl || !serviceKey) {
    return json({ error: "missing_supabase_env" }, 500);
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // First-run: sin posts tomtom previos → upsert sí, push no (backfill silencioso).
  const { count: priorCount } = await admin
    .from("community_posts")
    .select("id", { count: "exact", head: true })
    .eq("source", "tomtom");
  const isFirstRun = (priorCount ?? 0) === 0;

  const seenIds = new Set<string>();
  const successfulBboxes: string[] = [];
  const notifyCandidates: TomtomNotifyCandidate[] = [];
  let upserted = 0;
  let resolved = 0;
  let notifyQueued = 0;
  const perBox: Record<string, { ok: boolean; n: number; status: number }> = {};

  for (const box of TOMTOM_BBOXES) {
    const result = await fetchIncidents(box.bbox);
    perBox[box.key] = { ok: result.ok, n: result.features.length, status: result.status };
    if (!result.ok) continue;

    successfulBboxes.push(box.bbox);

    for (const feat of result.features) {
      const props = feat.properties || {};
      const externalId = props.id;
      if (!externalId) continue;
      if (seenIds.has(externalId)) continue; // dedupe entre bboxes
      seenIds.add(externalId);

      const pt = pointFromIncidentGeometry(feat.geometry);
      if (!pt) continue;

      const city = cityIdForIncident(pt.lat, pt.lng);
      const mapped = mapTomtomCategory(props.iconCategory);
      const eventDesc = props.events?.[0]?.description ?? null;
      const placeLabel = city.label;
      const text = calmIncidentText({
        iconCategory: props.iconCategory,
        description: eventDesc,
        from: props.from,
        to: props.to,
        placeLabel,
      });

      const row = {
        source: "tomtom",
        external_id: externalId,
        author_handle: "TomTom",
        author_name: "TomTom",
        text,
        url: "https://www.tomtom.com/traffic-index/",
        media_url: null,
        lat: pt.lat,
        lng: pt.lng,
        place_label: placeLabel,
        created_at: props.startTime || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        category_guess: mapped.category,
        is_demo: false,
        trust_tier: "traffic",
        city_id: city.cityId,
        geo_source: "tomtom",
        status: "active",
        resolved_at: null,
        ends_at: props.endTime || null,
        tomtom_icon_category: props.iconCategory ?? null,
      };

      const { data: existing } = await admin
        .from("community_posts")
        .select("id,status")
        .eq("source", "tomtom")
        .eq("external_id", externalId)
        .maybeSingle();

      const { error } = await admin.from("community_posts").upsert(row, {
        onConflict: "source,external_id",
      });
      if (error) {
        console.error("tomtom upsert", externalId, error.message);
        continue;
      }
      upserted += 1;

      const isNewOrReactivated = !existing || existing.status === "resolved";
      if (
        isNewOrReactivated &&
        !isFirstRun &&
        isFreshTomtomIncident(props.startTime)
      ) {
        const { data: post } = await admin
          .from("community_posts")
          .select("id")
          .eq("source", "tomtom")
          .eq("external_id", externalId)
          .maybeSingle();
        if (post?.id) {
          notifyCandidates.push({
            postId: post.id,
            externalId,
            lat: pt.lat,
            lng: pt.lng,
            cityId: city.cityId,
            category: mapped.category,
            title: text.slice(0, 80),
            placeLabel,
            startTime: props.startTime,
          });
        }
      }
    }
  }

  // Auto despejado fail-safe: solo cobertura de bboxes OK.
  const { data: activeRows } = await admin
    .from("community_posts")
    .select("id,external_id,lat,lng")
    .eq("source", "tomtom")
    .eq("status", "active")
    .limit(500);

  const toResolveIds = selectIncidentsToResolve({
    active: (activeRows ?? []).map((r) => ({
      id: r.id as string,
      external_id: r.external_id as string,
      lat: typeof r.lat === "number" ? r.lat : null,
      lng: typeof r.lng === "number" ? r.lng : null,
    })),
    seenIds,
    successfulBboxes,
  });

  if (toResolveIds.length > 0) {
    const { error } = await admin
      .from("community_posts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })
      .in("id", toResolveIds);
    if (!error) resolved = toResolveIds.length;
  }

  // Pushes: agrupar por usuario (máx 2 individuales o 1 digest).
  if (notifyCandidates.length > 0) {
    const cityIds = [...new Set(notifyCandidates.map((c) => c.cityId))];
    const { data: zones } = await admin
      .from("watched_zones")
      .select("user_id,label,lat,lng,city_id")
      .in("city_id", cityIds);

    const byUser = new Map<string, TomtomNotifyCandidate[]>();
    for (const c of notifyCandidates) {
      for (const zone of zones ?? []) {
        if (zone.city_id !== c.cityId) continue;
        const km = haversineKm(c.lat, c.lng, Number(zone.lat), Number(zone.lng));
        if (km > TOMTOM_CIRCULO_RADIUS_KM) continue;
        const list = byUser.get(zone.user_id) || [];
        if (!list.some((x) => x.externalId === c.externalId)) list.push(c);
        byUser.set(zone.user_id, list);
      }
    }

    for (const [userId, items] of byUser) {
      const groups = planTomtomNotifiesPerUser(items);
      for (const group of groups) {
        const primary = group[0]!;
        const digestCount = group.length;
        try {
          await fetch(`${supabaseUrl}/functions/v1/notify-on-alert`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({
              type: "tomtom_incident",
              postId: primary.postId,
              externalId:
                digestCount > 1
                  ? `digest:${primary.externalId}:${digestCount}`
                  : primary.externalId,
              lat: primary.lat,
              lng: primary.lng,
              cityId: primary.cityId,
              category: primary.category,
              title: primary.title,
              placeLabel: primary.placeLabel,
              digestCount,
              restrictToUserIds: [userId],
            }),
          });
          notifyQueued += 1;
        } catch (e) {
          console.warn("notify tomtom", e);
        }
      }
    }
  }

  return json({
    ok: true,
    upserted,
    resolved,
    notifyQueued,
    isFirstRun,
    successfulBboxes: successfulBboxes.length,
    perBox,
    seen: seenIds.size,
    attribution: TOMTOM_ATTRIBUTION,
  });
});
