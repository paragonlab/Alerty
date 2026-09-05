# Comunidad multi-fuente (X + noticias)

Pulso muestra señales externas de seguridad en Culiacán en el **Feed** y el **Mapa**, etiquetadas (Desde X / Medio / Oficial / Noticia / DEMO). **No** se mezclan con alertas ciudadanas ni usan el pin pulsante `GlowMarker`.

## Capas

| Capa | Origen | Pin mapa | Notas |
|---|---|---|---|
| Alertas ciudadanas | App Pulso (GPS) | `GlowMarker` (pulso) | Avatar reportero o icono de categoría |
| X / Comunidad | Recent Search v2 + allowlist | Cuadrado estático | Color por `category_guess`; avatar X |
| Noticias RSS | Feeds locales | Cuadrado estático | Logo de feed o media; badge Noticia |

## Retención vs ventana de horario (honesto)

- Los posts de comunidad **permanecen en la base de datos**. No hay borrado silencioso por antigüedad.
- Feed y Mapa cargan los **últimos 50** (`loadCommunityPosts`) y filtran por `timeFilter` (`createdAt` en 1h / 6h / 24h / 7d).
- Si un post “desaparece” de la vista, es porque quedó **fuera de la ventana** seleccionada (o del top 50), no porque haya expirado en DB.
- Feed y Mapa comparten el mismo `timeFilter` / `setTimeFilter` del store (pills sincronizadas).
- Caption UI: “Ventana: últimos Xh · no caducan en DB”.

## Piezas

| Pieza | Ruta |
|---|---|
| Migraciones | `202609040001_community_posts.sql`, `202609040002_community_multi_source.sql`, `202609040003_community_author_avatar.sql`, `202609040004_community_geo_source.sql` |
| Sync X | `supabase/functions/sync-x-community/` |
| Sync RSS | `supabase/functions/sync-news-rss/` |
| Allowlist / places | `supabase/functions/_shared/xAllowlist.ts`, `culiacanPlaces.ts` (+ `lib/alerty/coloniaGeocode.ts`) |
| UI | `CommunityMarker`, `GlowMarker`, `CommunityPostCard`, `CommunityPostPreview` |

## Allowlist X (medios / oficiales)

Editar de dos formas:

1. Constante `DEFAULT_X_ALLOWLIST` en `supabase/functions/_shared/xAllowlist.ts` → redeploy.
2. Secret: `supabase secrets set X_ALLOWLIST=LineaDirectaMX:medio,SSPSinaloa:oficial`

Un handle en allowlist se sincroniza aunque el texto no tenga keyword fuerte; sigue el anti-ruido. `trust_tier` = `medio` | `oficial`.

## Query e intención (Recent Search v2)

- Operadores reales: `has:geo`, `from:`, `-is:retweet`, `-is:reply`, `lang:es`.
- Queries acortadas: **≤512 caracteres** (límite de la API).
- Eventos: alerta, balacera, bloqueo, accidente, detonaciones, “acaba de”, etc.
- Exclusiones cortas en query + soft-noise en código.
- Pasadas: (1) `has:geo` + eventos, (2) eventos sin geo, (3) `from:` allowlist + Culiacán.
- Criterio: **allowlist OR** `category_guess` fuerte.
- `user.fields` incluye `profile_image_url` → columna `author_avatar_url`.

## Política de geo (mapa)

Marcadores **solo** si hay geo usable y `mapEligible`:

1. coordenadas del tweet, o
2. centro de `place.geo.bbox`, o
3. **colonia extraída del título/cuerpo** contra el gazetteer `culiacanPlaces` / `coloniaGeocode` (patrones `colonia X`, `col. X`, `ocurrió en…`).

### Preferencia texto vs place del publisher (v1)

Si el cuerpo nombra con confianza una colonia de Culiacán **distinta** del check-in / `place` del autor (p. ej. place=Guadalupe pero el texto dice “colonia Adolfo López Mateos”), el pin usa el geocode del **texto**.

Columnas:

| Columna | Uso |
|---|---|
| `place_label` | Etiqueta del pin (la que se muestra) |
| `place_name_source` | Lugar del publisher (si existía) |
| `geocoded_from_text` | Colonia del cuerpo cuando aplica |
| `geo_source` | `tweet_coords` \| `place_bbox` \| `text_colonia` \| `none` |

Si hay **varias colonias** en el texto sin ganador claro (contexto de evento / headline) → `lat`/`lng` null (Feed sí, mapa no).

**Sin jitter** para posts en vivo. DEMO puede tener coords de muestra.

Límite honesto: gazetteer determinista (no Google Geocoding) para evitar matches en otra ciudad; colonias fuera de lista no se pines por texto.

### Prueba manual colonia

1. Seed DEMO `demo-rss-colonia-mismatch`: pin en Adolfo López Mateos; preview muestra “pin por texto” y nota si el publisher decía Guadalupe.
2. `deno test supabase/functions/_shared/culiacanPlaces.test.ts`
3. `npx tsx lib/alerty/coloniaGeocode.test.ts` (o node con strip-types).
4. Tras deploy sync: noticia/tweet con “colonia Adolfo López Mateos” + place Guadalupe → `geo_source=text_colonia`.

## Pines (mapa)

- Ciudadanos: `GlowMarker` circular con pulso; color por intensidad/edad; avatar `user.avatarUrl` si hay.
- Comunidad: `CommunityMarker` cuadrado (sin pulso); color por `categoryGuess` (`CATEGORY_PIN_COLORS`); imagen = `author_avatar_url` → `media_url` → icono X/noticia.
- Web (`ExpoMapView.web`) refleja los mismos metadatos.

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

Defaults en `sync-news-rss/index.ts` (Línea Directa, Ríodoce, Noroeste). Filtra por Culiacán/Sinaloa + lenguaje de evento. `trust_tier=news`. Guarda favicon del dominio en `author_avatar_url` cuando es posible.

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

## Cron (cada ~10 min)

La migración `20260905044049_community_sync_cron.sql` programa `pg_cron` + `pg_net`:

| Job | Minuto | Function |
|---|---|---|
| `pulso-sync-x-community` | `*/10` | `sync-x-community` |
| `pulso-sync-news-rss` | `2-59/10` | `sync-news-rss` |

No commitea keys. Una vez en el SQL Editor (Vault), sin pegar `service_role`:

```sql
select vault.create_secret('https://hllgwcphvobgpdvidbad.supabase.co', 'project_url');
select vault.create_secret('<EXPO_PUBLIC_SUPABASE_ANON_KEY>', 'publishable_key');
```

El cron manda el JWT anon (`Authorization` + `apikey`). Las functions siguen escribiendo con `SUPABASE_SERVICE_ROLE_KEY` de su env.

Comprobar jobs:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname like 'pulso-sync-%';
```

Últimas corridas: `cron.job_run_details` o Integraciones → Cron en el dashboard.

## RLS

Sin cambios: lectura `authenticated`, escritura solo `service_role`.

## Prueba rápida

1. Sin tokens: Feed/Map con seeds DEMO → pines coloreados + avatar de muestra; pills de horario en mapa sincronizan con Feed.
2. Con X token: sync → `author_avatar_url` + `with_geo` / `feed_only`.
3. RSS: deploy + invocar → posts `source=rss` con logo.
4. Ampliar ventana (7d) vs 1h: posts “vuelven” a la vista sin re-sync.
5. Regresión: GlowMarker pulso, SOS, PKCE, bundle IDs intactos.
