# Tono de comunidad + compartir (Pulso)

Contraste explícito con canales amarillistas: informar para cuidarse, tono de vecino.

## Qué incluye

1. **Tono de vecino** — `displayTitle`, labels SOS calmados, badges “Urgente/Reciente”, push suaves en `notify-on-alert`.
2. **Acción sugerida** — `lib/alerty/actionLines.ts` por categoría.
3. **Ya se despejó** — migración + RPC `mark_alert_cleared`, UI en detalle/feed, push `type: "cleared"`.
4. **Compartir** — `shareAlertPulse` / WhatsApp + tarjeta SVG (`shareCard.ts`, `/api/og`).
5. **Link `/p/<id>`** — `api/p.js` con OG tags + landing sin forzar descarga.
6. **Avísale a tu familia** — link `/onboarding?invite=familia&zone=…`.
7. **Resumen del día** — Ajustes → tarjeta compartible.
8. **Gracias al vecino** — `NeighborThanks` sin rankings.

## Orden de aplicación (migración)

**No aplicar desde este PR automáticamente.** En el proyecto Supabase `hllgwcphvobgpdvidbad`:

1. Revisar diff de `supabase/migrations/20261009120000_alert_cleared_and_clearance_votes.sql`.
2. `supabase db push` (o SQL editor) **solo** esa migración, en staging primero.
3. Redeploy **manual** de `notify-on-alert` cuando quieran el push “Ya se despejó” y el copy suave (este agente no despliega edge functions).
4. Redeploy web Vercel para `/p/:id` y `/api/og`.

Sin la migración, marcar despejado cae al fallback: el **autor** puede `update status=resolved`; los votos de vecinos requieren el RPC.

## Política operativo (no tocada)

- Sin reporte ciudadano de operativo.
- Feed/mapa con delay 2 h y sin coords en vivo.
- Share/OG de operativo: solo nombre de ciudad, sin pin.

## Cómo probar

```bash
npm run test:share
npm run test:community
npm run typecheck
```

Manual:

1. Abrir un pulso → Compartir / WhatsApp → debe usar `https://pulso-ciudadano.com/p/<id>`.
2. En staging Vercel, `curl -sI https://…/p/<uuid>` y revisar `og:title` / `og:image`.
3. Detalle → “Ya se despejó” (autor o 3 votos tras migración).
4. Ajustes → resumen del día + “Avísale a tu familia”.
5. Onboarding con `?invite=familia&zone=Las%20Quintas&lat=24.810&lng=-107.387&city=culiacan`.
