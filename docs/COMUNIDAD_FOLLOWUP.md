# Follow-up compartir / OG / comunidad

Complementa #47 (ya en prod, squash `c112230`).

## Orden de aplicación

### Ya en prod (solo sincronizar repo — no reaplicar a ciegas)

1. **`notify-on-alert` cleared → `not_resolved`**  
   Push “Ya se despejó” solo si `status = resolved`. Si no: `{ skipped: "not_resolved" }` (prod v24).
2. **`20261009140000_alert_cleared_revoke_default_grants.sql`**  
   `REVOKE EXECUTE` de `expire_stale_alerts` para PUBLIC/anon/authenticated. Idempotente; ya aplicada en prod.

### Nuevo (aplicar en este orden)

3. **`20261009150000_cleared_push_once_and_expire_cron.sql`**  
   - Columna `alerts.cleared_push_sent_at` (una push por alerta).  
   - `pg_cron` job `pulso-expire-stale-alerts` cada hora (`15 * * * *`).
4. Redeploy **manual** de `notify-on-alert` (claim atómico + `already_notified`).
5. Redeploy web Vercel (`@resvg/resvg-js` → OG **PNG**; `/p/c-<id>` community).

No aplicar migraciones ni deploys desde el agente.

## Cómo probar

```bash
npm run test:share
npm run test:community
```

Manual:
- `/api/og?id=<uuid>` → `Content-Type: image/png`
- `/p/c-<community_uuid>` → landing + OG de un post X/RSS
- Título ALL CAPS con colonia → casing tipo `La Obregón` / `Las Quintas`
- Segundo invoke `type: "cleared"` → `skipped: already_notified`
