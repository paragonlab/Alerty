# Comunidad desde X (Twitter)

Pulso muestra posts de X sobre seguridad en Culiacán en el **Feed** y el **Mapa**, claramente etiquetados como “Desde X / Comunidad” (y **DEMO** cuando son seeds de muestra). No se mezclan con alertas ciudadanas ni usan el pin pulsante `GlowMarker`.

## Qué incluye este PR

| Pieza | Ruta |
|---|---|
| Migración + seeds DEMO + RLS + realtime | `supabase/migrations/202609040001_community_posts.sql` |
| Edge function de sync | `supabase/functions/sync-x-community/index.ts` |
| Tipos / mock / store | `lib/alerty/types.ts`, `mock.ts`, `store.ts` |
| UI Feed | `components/CommunityPostCard.tsx`, `app/(tabs)/feed.tsx` |
| UI Mapa | `components/CommunityMarker.tsx`, `app/(tabs)/index.tsx` |

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

## Comportamiento en cliente

1. Tras login: `loadCommunityPosts()` lee `community_posts`.
2. Realtime: suscripción `INSERT` en `community_posts` (mismo canal que alertas).
3. Sin filas / error / sin Supabase: fallback a `demoCommunityPosts` en `lib/alerty/mock.ts`.
4. Feed: tarjetas `CommunityPostCard` con badges “Desde X”, “Comunidad”, “DEMO” si aplica; toque abre el tweet.
5. Mapa: `CommunityMarker` (cuadrado azul/negro, no pulso). Toque → diálogo + “Abrir en X”. Geo real si existe; si no, jitter alrededor del centro de Culiacán con `place_label = "Culiacán (X)"`.

## Plan de prueba

1. **Sin token**: aplicar migración → login → Feed muestra ≥1 tarjeta “Desde X” con badge DEMO → Mapa muestra pines cuadrados (no GlowMarker) → toque abre diálogo con aviso DEMO.
2. **Con token**: `supabase secrets set X_BEARER_TOKEN=...` → invocar function → `mode: "live"` y `upserted > 0` (o 0 si no hay matches) → Feed/Map refrescan (realtime o reload) con posts `is_demo=false`.
3. **Regresión**: alertas ciudadanas siguen pulsando con `GlowMarker`; SOS, PKCE y bundle IDs intactos.
4. **RLS**: con anon key sin sesión no se leen posts; con usuario autenticado sí; insert desde cliente debe fallar (solo service_role).
