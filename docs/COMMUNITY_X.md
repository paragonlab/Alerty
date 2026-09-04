# Comunidad desde X (Twitter)

Pulso muestra posts de X sobre seguridad en Culiacán en el **Feed** y el **Mapa**, claramente etiquetados como “Desde X / Comunidad” (y **DEMO** cuando son seeds de muestra). No se mezclan con alertas ciudadanas ni usan el pin pulsante `GlowMarker`.

## Qué incluye este PR

| Pieza | Ruta |
|---|---|
| Migración + seeds DEMO + RLS + realtime | `supabase/migrations/202609040001_community_posts.sql` |
| Edge function de sync | `supabase/functions/sync-x-community/index.ts` |
| Tipos / mock / store | `lib/alerty/types.ts`, `mock.ts`, `store.ts` |
| UI Feed | `components/CommunityPostCard.tsx`, `app/(tabs)/feed.tsx` |
| UI Mapa | `components/CommunityMarker.tsx`, `CommunityPostPreview.tsx`, `app/(tabs)/index.tsx`, `ExpoMapView.web.tsx` |

## Variables de entorno / secrets

**Cliente** (sin cambios obligatorios): ya usa `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

**Edge function** (Supabase secrets — no commitear):

```bash
supabase secrets set X_BEARER_TOKEN=TU_BEARER_TOKEN_DE_X
```

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` las inyecta Supabase automáticamente en las functions.

Cómo obtener el bearer de X: [Developer Portal](https://developer.x.com/) → App → Keys and tokens → Bearer Token (API v2 Recent Search requiere acceso adecuado al producto).

## Deploy

```bash
# 1. Migración
npm run supabase:db:push

# 2. Deploy de la function
supabase functions deploy sync-x-community

# 3. Secret (opcional; sin él la function responde mode=demo)
supabase secrets set X_BEARER_TOKEN=...
```

## Programar el sync (cron)

La function es **cron-friendly**: `POST` (o `GET`) con `Authorization: Bearer <service_role_o_jwt>`.

Ejemplo cada 10 minutos con `pg_cron` + `pg_net`:

```sql
select cron.schedule(
  'sync-x-community',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/sync-x-community',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
```

O desde un cron externo / GitHub Action:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/sync-x-community" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Sin `X_BEARER_TOKEN`, la function responde `{ ok: true, mode: "demo", upserted: 0 }` y la app sigue mostrando los 3 posts DEMO de la migración (badge **DEMO · no en vivo**).

## Query e intención (Recent Search v2)

La function busca **alertas / noticias / hechos recién ocurridos** ligados a Culiacán, no menciones casuales.

- Operadores reales de Recent Search: `has:geo`, `-is:retweet`, `-is:reply`, `lang:es`.
- Términos de evento: alerta, balacera, tiroteo, detonaciones, enfrentamiento, bloqueo, accidente, asalto, “acaba de”, “ahora mismo”, etc.
- Exclusiones de ruido: promo/ads, turismo, deportes, “estoy en…”, replies.
- Pasada 1 con `has:geo` (preferencia de place/coords); pasada 2 sin `has:geo` para el Feed.
- Post-filtro: exige `category_guess` y descarta soft noise residual.
- Orden: más recientes primero.

## Política de geo en el mapa

La mayoría de tweets **no traen coordenadas precisas**. Solo se escribe `lat`/`lng` cuando hay:

1. punto geo del tweet, o
2. `place.geo.bbox` usable (se usa el centro del bbox).

**No hay jitter** alrededor del centro de Culiacán para posts en vivo. Sin geo usable → `lat`/`lng` null: el post puede aparecer en el **Feed**, pero **no** como pin en el mapa. Los seeds **DEMO** sí conservan coordenadas de muestra.

En cliente, el mapa filtra `post.lat != null && post.lng != null`.

## Comportamiento en cliente

1. Tras login: `loadCommunityPosts()` lee `community_posts`.
2. Realtime: suscripción `INSERT` en `community_posts` (mismo canal que alertas).
3. Sin filas / error / sin Supabase: fallback a `demoCommunityPosts` en `lib/alerty/mock.ts`.
4. Feed: tarjetas `CommunityPostCard` con badges “Desde X”, “Comunidad”, “DEMO” si aplica; toque abre el tweet.
5. Mapa: `CommunityMarker` (cuadrado azul/negro, no pulso). Toque → `CommunityPostPreview` (autor, texto, categoría, lugar, tiempo, Abrir en X). Solo pines con geo/place real (o DEMO).

## Plan de prueba

1. **Sin token**: aplicar migración → login → Feed muestra ≥1 tarjeta “Desde X” con badge DEMO → Mapa muestra pines cuadrados (no GlowMarker) → toque abre preview con aviso DEMO y “Abrir en X”.
2. **Con token**: `supabase secrets set X_BEARER_TOKEN=...` → invocar function → `mode: "live"` y `upserted` / `with_geo` / `feed_only` → Feed puede tener posts sin pin; Mapa solo los `with_geo`.
3. **Regresión**: alertas ciudadanas siguen pulsando con `GlowMarker`; SOS, PKCE y bundle IDs intactos.
4. **RLS**: con anon key sin sesión no se leen posts; con usuario autenticado sí; insert desde cliente debe fallar (solo service_role).
5. **Web**: pin cuadrado de comunidad; click abre la misma preview (no `Alert.alert`).
