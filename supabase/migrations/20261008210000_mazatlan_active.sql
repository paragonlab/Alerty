-- Fase 2 multi-ciudad: Mazatlán pasa a active=true para que sync/ops lo puedan
-- apuntar. La app cliente sigue con ACTIVE_CITY_SLUG / preferencia por defecto
-- en Culiacán (no cambia el path de prod hasta que alguien cambie la preferencia).

UPDATE public.cities
SET active = true
WHERE slug = 'mazatlan'
  AND active IS DISTINCT FROM true;
