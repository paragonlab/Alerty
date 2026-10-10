# TomTom en Pulso

Integración de tráfico (tiles cliente + APIs servidor) para Culiacán, Mazatlán y el corredor México 15 / 15D.

## Keys y secrets (nombres exactos)

| Nombre | Dónde | Uso |
| --- | --- | --- |
| `TOMTOM_API_KEY` | **Supabase secrets** | Incidents, Flow, Routing, Search — solo edge |
| `EXPO_PUBLIC_TOMTOM_KEY` | **Vercel** env + **Expo/EAS** | Solo tiles Leaflet de circulación. Restringir por dominio/referrer |
| `EXPO_PUBLIC_GOOGLE_MAPS_KEY` | Vercel + EAS (ya existente) | `showsTraffic` nativo |
| `EXPO_PUBLIC_TRAFFIC_LAYER` | Opcional (default on) | `0` oculta el toggle |
| `EXPO_PUBLIC_TRAFFIC_MOCK` | Solo demos/screenshots | `1` muestra toggle web sin key de tiles |
| `EXPO_PUBLIC_TRAVEL_MODE` | Opcional (default on) | `0` oculta Modo viaje |

```bash
# Supabase (APIs — nunca en el cliente)
supabase secrets set TOMTOM_API_KEY=tu_key_real

# Vercel (solo tiles)
# Project → Settings → Environment Variables → EXPO_PUBLIC_TOMTOM_KEY
# Expo EAS: eas secret:create --name EXPO_PUBLIC_TOMTOM_KEY --value …
```

**Nunca** poner `TOMTOM_API_KEY` en Vercel ni en `EXPO_PUBLIC_*`.

El agente de este PR **no** tiene la key real. Tests y screenshots usan fixtures/mocks en
`supabase/functions/_shared/tomtomFixtures.ts` y el mock de `tomtom-travel` / `lib/alerty/tomtomTravel.ts`.

## Smoke test (con la key real)

Cuando publiquen, validar con ~4–6 requests:

```bash
# 1) API directa (local, con la key en el shell)
TOMTOM_API_KEY=xxx node scripts/tomtom-smoke.mjs

# 2) Tras deploy de edge + secret en Supabase
SUPABASE_URL=https://YOUR.supabase.co SUPABASE_ANON_KEY=eyJ... \
  node scripts/tomtom-smoke.mjs --edge

# 3) Sync de incidentes (service role)
curl -X POST "$SUPABASE_URL/functions/v1/sync-tomtom-incidents" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

`tomtom-travel` acepta `{ "smoke": true }` para saltar cache y forzar llamadas live.

## Orden de aplicación (humano / CI)

1. **Migración** `supabase/migrations/20261010010000_tomtom_traffic.sql`  
   (`supabase db push` o SQL Editor). Amplía `community_posts`, crea `tomtom_cache`, `tomtom_zone_notify_log`, cron.  
   **No aplicar desde el agente.**
2. **Secret** `TOMTOM_API_KEY` en el proyecto Supabase.
3. **Deploy edge functions**  
   `sync-tomtom-incidents`, `tomtom-travel`, y redeploy `notify-on-alert` (tipo `tomtom_incident`).
4. **Cron** — la migración agenda `pulso-sync-tomtom-incidents` (`5,25,45 * * * *`). Verificar:
   ```sql
   select jobid, jobname, schedule, active from cron.job
   where jobname like 'pulso-sync-%';
   ```
5. **Vercel / Expo** — `EXPO_PUBLIC_TOMTOM_KEY` (tiles) + rebuild web/native.
6. **Smoke** — `node scripts/tomtom-smoke.mjs` y `--edge`.
7. **Atribución** — visible en mapa (Leaflet) y en Antes de salir («Datos de tráfico © TomTom»).

## Edge functions

| Function | Trigger | Qué hace |
| --- | --- | --- |
| `sync-tomtom-incidents` | Cron ~20 min | 3 bbox (CUL, MZT, corredor) → upsert `community_posts` `source=tomtom`; resuelve ausentes; avisa Círculo |
| `tomtom-travel` | Cliente (Modo viaje) | Flow delays + Routing ETA/alternas + POI; cache `tomtom_cache`; mock sin key |
| `notify-on-alert` | Sync (service role) | `type=tomtom_incident`: push suave a `watched_zones` cercanas, 1× por (user, incidente) |

## Presupuesto free (~2.5k non-tile/día)

| Trabajo | Frecuencia | Req/día (orden) |
| --- | --- | --- |
| Incidents (3 bbox) | cada 20 min | ~216 |
| Flow (5 puntos corredor) | cache 30 min | ~240 |
| Routing | cache 45 min por par | decenas (uso real) |
| POI nearby (4 cats) | cache 6 h | ~16 |
| **Total típico** | | **~500–700** ≪ 2500 |

Tiles de tráfico (cliente) usan el free de **tiles** (50k/día), no el non-tile.

## Geofencing

Avisos por zona se hacen **en DB** (haversine sobre `watched_zones` + `city_id`), no con TomTom Geofencing API: ya tenemos Círculo, city scoping y anti-spam (`tomtom_zone_notify_log`). Geofencing de TomTom no aporta margen suficiente frente al costo/complejidad.

## Fixtures (sin key)

| Fixture | API TomTom |
| --- | --- |
| `FIXTURE_INCIDENT_DETAILS` | Traffic Incidents Details v5 |
| `FIXTURE_FLOW_SEGMENT` | Flow Segment Data |
| `FIXTURE_CALCULATE_ROUTE` | Routing `calculateRoute` |
| `FIXTURE_NEARBY_GAS` / `_HOSPITAL` | Search nearbySearch |

Tests: `npm run test:tomtom`.

## Tono

Copy calmado («Va lento», «Hay obras», «Precaución»). Sin «peligro» / «ruta segura». Operativos de vecinos siguen con delay 2 h y sin coords en vivo; incidentes TomTom son infraestructura vial, no operativos.
