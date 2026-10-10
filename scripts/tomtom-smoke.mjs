#!/usr/bin/env node
/**
 * Smoke test contra TomTom con la key real (no la tiene el agente).
 *
 * Uso:
 *   TOMTOM_API_KEY=xxx node scripts/tomtom-smoke.mjs
 *   # o, tras deploy:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... \
 *     node scripts/tomtom-smoke.mjs --edge
 *
 * Secrets / env (nombres exactos):
 *   TOMTOM_API_KEY          → Supabase secret (Incidents/Flow/Routing/Search)
 *   EXPO_PUBLIC_TOMTOM_KEY  → Vercel + Expo (solo tiles Leaflet)
 *
 * Cuenta ~4–6 requests non-tile. Ver docs/TOMTOM.md.
 */

const KEY = (process.env.TOMTOM_API_KEY || "").trim();
const BASE = "https://api.tomtom.com";

const BBOX_CUL = "-107.52,24.70,-107.30,24.88";
const POINT_ELOTA = "23.95,-107.02";
const ROUTE = "24.8091,-107.394:23.2494,-106.4111";

async function get(path) {
  const url = path.includes("?")
    ? `${BASE}${path}&key=${encodeURIComponent(KEY)}`
    : `${BASE}${path}?key=${encodeURIComponent(KEY)}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await r.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 200);
  }
  return { ok: r.ok, status: r.status, data };
}

function pass(name, cond, detail = "") {
  const mark = cond ? "OK" : "FAIL";
  console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ""}`);
  return cond;
}

async function smokeDirect() {
  if (!KEY) {
    console.error(
      "Falta TOMTOM_API_KEY.\n" +
        "  export TOMTOM_API_KEY=...   # o: supabase secrets set TOMTOM_API_KEY=...\n" +
        "  node scripts/tomtom-smoke.mjs",
    );
    process.exit(2);
  }

  let ok = true;
  console.log("TomTom smoke (API directa)…\n");

  const fields = encodeURIComponent(
    "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,events{description},from,to}}}",
  );
  const incidents = await get(
    `/traffic/services/5/incidentDetails?bbox=${BBOX_CUL}&fields=${fields}&language=es-ES&timeValidityFilter=present`,
  );
  ok =
    pass(
      "incidentDetails v5",
      incidents.ok && Array.isArray(incidents.data?.incidents),
      `HTTP ${incidents.status}, n=${incidents.data?.incidents?.length ?? "?"}`,
    ) && ok;

  const flow = await get(
    `/traffic/services/4/flowSegmentData/relative/10/json?point=${POINT_ELOTA}&unit=KMPH`,
  );
  ok =
    pass(
      "flowSegmentData",
      flow.ok && Number.isFinite(flow.data?.flowSegmentData?.currentSpeed),
      `HTTP ${flow.status}, speed=${flow.data?.flowSegmentData?.currentSpeed ?? "?"}`,
    ) && ok;

  const route = await get(
    `/routing/1/calculateRoute/${ROUTE}/json?traffic=true&travelMode=car&routeType=fastest&maxAlternatives=1&language=es-ES`,
  );
  const mins = Math.round((route.data?.routes?.[0]?.summary?.travelTimeInSeconds || 0) / 60);
  ok =
    pass(
      "calculateRoute",
      route.ok && mins > 0,
      `HTTP ${route.status}, ETA~${mins} min`,
    ) && ok;

  const poi = await get(
    `/search/2/nearbySearch/.json?lat=23.95&lon=-107.02&radius=50000&categorySet=7311&limit=3&language=es-ES`,
  );
  ok =
    pass(
      "nearbySearch (petrol 7311)",
      poi.ok && Array.isArray(poi.data?.results),
      `HTTP ${poi.status}, n=${poi.data?.results?.length ?? "?"}`,
    ) && ok;

  console.log(ok ? "\nSmoke OK — key válida para Pulso." : "\nSmoke FALLÓ — revisar key/plan.");
  process.exit(ok ? 0 : 1);
}

async function smokeEdge() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anon = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anon) {
    console.error(
      "Modo --edge requiere SUPABASE_URL y SUPABASE_ANON_KEY (o SERVICE_ROLE).\n" +
        "  SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=eyJ... \\\n" +
        "    node scripts/tomtom-smoke.mjs --edge",
    );
    process.exit(2);
  }

  console.log("TomTom smoke (edge tomtom-travel)…\n");
  const r = await fetch(`${url}/functions/v1/tomtom-travel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anon}`,
      apikey: anon,
    },
    body: JSON.stringify({ direction: "culiacan_to_mazatlan", smoke: true }),
  });
  const data = await r.json().catch(() => null);
  const ok =
    r.ok &&
    data &&
    data.mock === false &&
    data.route?.travelTimeMinutes != null;

  console.log(
    `[${ok ? "OK" : "FAIL"}] tomtom-travel HTTP ${r.status}` +
      (data?.route?.travelTimeMinutes != null
        ? ` ETA~${data.route.travelTimeMinutes} min mock=${data.mock}`
        : ` body=${JSON.stringify(data)?.slice(0, 180)}`),
  );

  console.log("\nTambién puedes invocar sync (service role O anon + x-pulso-hook):");
  console.log(
    `  curl -X POST "${url}/functions/v1/sync-tomtom-incidents" \\\n` +
      `    -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \\\n` +
      `    -H "Content-Type: application/json" -d '{}'\n` +
      `  # cron-like:\n` +
      `  curl -X POST "${url}/functions/v1/sync-tomtom-incidents" \\\n` +
      `    -H "Authorization: Bearer $SUPABASE_ANON_KEY" -H "apikey: $SUPABASE_ANON_KEY" \\\n` +
      `    -H "x-pulso-hook: $NOTIFY_HOOK_SECRET" -H "Content-Type: application/json" -d '{}'`,
  );

  process.exit(ok ? 0 : 1);
}

const edge = process.argv.includes("--edge");
(edge ? smokeEdge() : smokeDirect()).catch((e) => {
  console.error(e);
  process.exit(1);
});
