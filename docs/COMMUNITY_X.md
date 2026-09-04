# Comunidad multi-fuente (X + noticias)

Pulso muestra señales externas de seguridad en Culiacán en el **Feed** y el **Mapa**, etiquetadas (Desde X / Medio / Oficial / Noticia / DEMO). **No** se mezclan con alertas ciudadanas ni usan el pin pulsante `GlowMarker`.

## Capas

| Capa | Origen | Pin mapa | Notas |
|---|---|---|---|
| Alertas ciudadanas | App Pulso (GPS) | `GlowMarker` | Primarias; no tocar |
| X / Comunidad | Recent Search v2 + allowlist | Cuadrado | Solo con geo usable |
| Noticias RSS | Feeds locales | Cuadrado | `source=rss`, badge Noticia |

## Piezas

| Pieza | Ruta |
|---|---|
| Migraciones | `supabase/migrations/202609040001_community_posts.sql`, `202609040002_community_multi_source.sql` |
| Sync X | `supabase/functions/sync-x-community/` |
| Sync RSS | `supabase/functions/sync-news-rss/` |
| Allowlist / places | `supabase/functions/_shared/xAllowlist.ts`, `culiacanPlaces.ts` |
| UI | `CommunityMarker`, `CommunityPostCard`, `CommunityPostPreview` |

## Allowlist X (medios / oficiales)

Editar de dos formas:

1. Constante `DEFAULT_X_ALLOWLIST` en `supabase/functions/_shared/xAllowlist.ts` → redeploy.
2. Secret: `supabase secrets set X_ALLOWLIST=LineaDirectaMX:medio,SSPSinaloa:oficial`

Un handle en allowlist se sincroniza aunque el texto no tenga keyword fuerte; sigue el anti-ruido. `trust_tier` = `medio` | `oficial`.

## Query e intención (Recent Search v2)

- Operadores reales: `has:geo`, `from:`, `-is:retweet`, `-is:reply`, `lang:es`.
- Eventos: alerta, balacera, bloqueo, accidente, detonaciones, “acaba de”, etc.
- Exclusiones: promo, turismo, deportes, “estoy en…”.
- Pasadas: (1) `has:geo` + eventos, (2) eventos sin geo, (3) `from:` allowlist + Culiacán.
- Criterio: **allowlist OR** `category_guess` fuerte.

## Política de geo (mapa)

Marcadores **solo** si hay:

1. coordenadas del tweet, o
2. centro de `place.geo.bbox`, o
3. match de colonia/calle en texto contra el diccionario `culiacanPlaces` / `CULIACAN_NEIGHBORHOODS`.

**Sin jitter** para posts en vivo. Sin geo → `lat`/`lng` null → Feed sí, mapa no. DEMO puede tener coords de muestra.

Límite honesto: la mayoría de tweets no traen geo; RSS tampoco — muchos ítems serán Feed-only o geocode aproximado por colonia.

## Consumo in-app

- Toque en pin o tarjeta del Feed → `CommunityPostPreview` (modal): texto, media (`media_url` imagen/video), lugar, tiempo, badges.
- Primario: quedarse en Pulso. Secundario: “Abrir en X” / “Abrir noticia”.
- “Confirmar en Pulso”: prefill best-effort del flujo Reportar (`pendingCommunityConfirm`).

## RSS

```bash
supabase functions deploy sync-news-rss
# opcional:
supabase secrets set NEWS_RSS_FEEDS='https://...,https://...'
```

Defaults en `sync-news-rss/index.ts` (Línea Directa, Ríodoce, Noroeste). Filtra por Culiacán/Sinaloa + lenguaje de evento. `trust_tier=news`.

## Telegram / WhatsApp (stub)

Fuentes futuras posibles vía bots o exports moderados. **No** implementado en este PR (privacidad, ToS y moderación). TODO: evaluar canal oficial de PC / medios con acuerdo explícito antes de wire.

## Deploy

```bash
npm run supabase:db:push
supabase functions deploy sync-x-community
supabase functions deploy sync-news-rss
supabase secrets set X_BEARER_TOKEN=...
# opcionales: X_ALLOWLIST, NEWS_RSS_FEEDS
```

Cron: invocar ambas functions cada 10–30 min con `Authorization: Bearer <service_role>`.

## RLS

Sin cambios: lectura `authenticated`, escritura solo `service_role`.

## Prueba rápida

1. Sin tokens: Feed/Map con seeds DEMO → preview con media de muestra y badges.
2. Con X token: sync → `with_geo` / `feed_only` / `allowlist_size`.
3. RSS: deploy + invocar → posts `source=rss`.
4. Regresión: GlowMarker, SOS, PKCE, bundle IDs intactos.
