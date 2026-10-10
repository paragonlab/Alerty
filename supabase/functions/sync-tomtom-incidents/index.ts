/**
 * Sync TomTom Traffic Incidents → community_posts (source=tomtom).
 *
 * Auth (mismo patrón que notify-on-alert):
 *   - Header `x-pulso-hook` = NOTIFY_HOOK_SECRET (Vault `notify_hook_secret`), o
 *   - Authorization Bearer = SUPABASE_SERVICE_ROLE_KEY
 * La publishable/anon key solo abre el gateway (verify_jwt); no autoriza el sync.
 *
 * Setup:
 *   supabase secrets set TOMTOM_API_KEY=...
 *   supabase secrets set NOTIFY_HOOK_SECRET=...   # mismo que notify-on-alert
 *   supabase functions deploy sync-tomtom-incidents
 * Cron: migración 20261010010000 (cada 20 min, 3 bbox ≈ 216 req/día).
 *
 * Dedupe por (source, external_id). Auto "Ya se despejó" (status=resolved)
 * cuando el incidente ya no viene en la respuesta presente.
 * Avisos suaves a watchedZones vía notify-on-alert (type=tomtom_incident).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import {
  TOMTOM_ATTRIBUTION,
  TOMTOM_BBOXES,
  calmIncidentText,
  mapTomtomCategory,
  parseIncidentDetails,
  pointFromIncidentGeometry,
  tomtomGetJson,
  tomtomKey,
  type TomtomBboxKey,
  type TomtomIncidentFeature,
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

async function fetchIncidents(bbox: string): Promise<TomtomIncidentFeature[]> {
  const fields = encodeURIComponent(
    "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},from,to,startTime,endTime,timeValidity}}}",
  );
  const path =
    `/traffic/services/5/incidentDetails?bbox=${bbox}` +
    `&fields=${fields}&language=es-ES&timeValidityFilter=present`;
  const { ok, data } = await tomtomGetJson(path);
  if (!ok) return [];
  return parseIncidentDetails(data);
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
    // Anon/publishable JWT llega al código si verify_jwt=true, pero no basta:
    // sin hook cualquiera gastaría la cuota TomTom.
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

  const seenIds = new Set<string>();
  let upserted = 0;
  let resolved = 0;
  let notifyQueued = 0;
  const perBox: Record<string, number> = {};

  for (const key of Object.keys(TOMTOM_BBOXES) as TomtomBboxKey[]) {
    const box = TOMTOM_BBOXES[key];
    const features = await fetchIncidents(box.bbox);
    perBox[key] = features.length;

    for (const feat of features) {
      const props = feat.properties || {};
      const externalId = props.id;
      if (!externalId) continue;
      seenIds.add(externalId);

      const pt = pointFromIncidentGeometry(feat.geometry);
      if (!pt) continue;

      const mapped = mapTomtomCategory(props.iconCategory);
      const eventDesc = props.events?.[0]?.description ?? null;
      const text = calmIncidentText({
        iconCategory: props.iconCategory,
        description: eventDesc,
        from: props.from,
        to: props.to,
        placeLabel: box.label,
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
        place_label: box.label,
        created_at: props.startTime || new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        category_guess: mapped.category,
        is_demo: false,
        trust_tier: "traffic",
        city_id: box.cityId,
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

      // Solo notificar zonas la primera vez que aparece como active.
      if (!existing || existing.status === "resolved") {
        const { data: post } = await admin
          .from("community_posts")
          .select("id")
          .eq("source", "tomtom")
          .eq("external_id", externalId)
          .maybeSingle();
        if (post?.id) {
          try {
            await fetch(`${supabaseUrl}/functions/v1/notify-on-alert`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceKey}`,
              },
              body: JSON.stringify({
                type: "tomtom_incident",
                postId: post.id,
                externalId,
                lat: pt.lat,
                lng: pt.lng,
                cityId: box.cityId,
                category: mapped.category,
                title: text.slice(0, 80),
                placeLabel: box.label,
              }),
            });
            notifyQueued += 1;
          } catch (e) {
            console.warn("notify tomtom", e);
          }
        }
      }
    }
  }

  // Auto despejado: activos de TomTom no vistos en esta corrida.
  const { data: activeRows } = await admin
    .from("community_posts")
    .select("id,external_id")
    .eq("source", "tomtom")
    .eq("status", "active")
    .limit(500);

  const toResolve = (activeRows ?? []).filter((r) => !seenIds.has(r.external_id));
  if (toResolve.length > 0) {
    const { error } = await admin
      .from("community_posts")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      })
      .in(
        "id",
        toResolve.map((r) => r.id),
      );
    if (!error) resolved = toResolve.length;
  }

  return json({
    ok: true,
    upserted,
    resolved,
    notifyQueued,
    perBox,
    seen: seenIds.size,
    attribution: TOMTOM_ATTRIBUTION,
  });
});
