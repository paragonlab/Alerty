# Fuentes futuras: Telegram / WhatsApp

Estado: **stub / no implementado**.

## Por qué no va en el MVP

- ToS y privacidad de mensajería (no scrapear grupos privados).
- Moderación y atribución distintas a X/RSS públicos.
- Necesita acuerdo con canal oficial (PC, gobierno, medio) o bot propio.

## Dirección futura (cuando haya acuerdo)

1. Bot oficial que publique a un canal público o webhook → edge function.
2. Mapear a `community_posts` con `source` nuevo (`telegram` / `whatsapp`) + migración de check constraint.
3. Misma política de geo (coords / place / geocode colonia) y badges de confianza (`oficial` si canal verificado).
4. Preview in-app igual que X/RSS; sin forzar salir de Pulso.

Hasta entonces, la capa ciudadana GPS + X allowlist + RSS cubren el MVP de señales externas.
