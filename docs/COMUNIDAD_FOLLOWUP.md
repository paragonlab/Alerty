# Follow-up compartir / OG / comunidad

Complementa #47 (ya en prod, squash `c112230`).

## Orden de aplicación

### Versiones ya aplicadas en prod (nombres ≠ archivos del repo)

| Versión en prod | Equivale a (archivo en repo) |
|-----------------|------------------------------|
| `20261009075123` | cleared / clearance base (#47) |
| `20261009075129` | `20261009140000_alert_cleared_revoke_default_grants.sql` |
| `20261009085219` | lógica de `20261009150000_cleared_push_once_and_expire_cron.sql` (con `$do$`/`$cmd$`) |

**No re-aplicar a ciegas** por el nombre del archivo: en prod ya corrieron con timestamps distintos.

### Sync en repo

1. **`notify-on-alert` cleared → `not_resolved`** (prod v24+) + claim `cleared_push_sent_at`.
2. Migración revoke grants (idempotente).
3. Migración cron corregida (`$do$` / `$cmd$` — el nesting `$$` original rompía `db push`).

### Follow-up OG fuentes / títulos

4. Redeploy web Vercel con `api/fonts/*.ttf` (`includeFiles` en `vercel.json`) y `cleanShareTitle` para community.

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
