-- Backfill idempotente de community_posts.category_guess con el clasificador canónico.
-- NO ejecutar contra producción desde el agente: el asistente del owner lo aplica tras review.
--
-- Orden recomendado:
--   1) 20261007100000_users_character.sql
--   2) 20261007110000_alert_categories_desaparecida_operativo.sql
--   3) ESTA migración (backfill)
--   4) 20261007130000_community_category_guess_check.sql (constraint NOT VALID)
--
-- Distribución esperada (aprox. sobre ~1870 posts al momento del diseño):
--   Antes: ~839 null, ~318 alerta, resto categorías viejas.
--   Después: null baja al reasignar keywords; parte de "alerta" pasa a
--   desaparecida / operativo / categorías específicas; el resto queda en el set canónico.

-- Función SQL espejo del clasificador Deno (_shared/guessCategory.ts).
-- Idempotente: solo escribe si el valor nuevo difiere.

create or replace function public._guess_category_es(raw text)
returns text
language plpgsql
immutable
as $$
declare
  t text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;
  -- minúsculas + quitar acentos
  t := lower(raw);
  t := translate(t,
    'áéíóúüñÁÉÍÓÚÜÑ',
    'aeiouunAEIOUUN');

  if t ~ '(sos|auxilio|pide ayuda|piden ayuda|auxilien)' then return 'sos'; end if;
  if t ~ '(desaparecid[oa]s?|levanton|levantamiento|privacion de la libertad|secuestro|plagiad[oa]s?|extraviad[oa]s?|buscan a)' then
    return 'desaparecida';
  end if;
  if t ~ '(operativo|despliegue|militares?|ejercito|guardia nacional|federal(es)?|rastrillo|revision de vehiculos)' then
    return 'operativo';
  end if;
  if t ~ '(balacera|tiroteo|disparos?|balead[oa]s?|rafagas?)' then return 'balacera'; end if;
  if t ~ '(enfrentamiento|grupo armado|elementos armados|choque armado|toma de cuartel)' then
    return 'enfrentamiento';
  end if;
  if t ~ '(detonaciones?|explosiones?|estallidos?)' then return 'detonaciones'; end if;
  if t ~ '(narcobloqueo|narcobloqueos)' then return 'narcobloqueo'; end if;
  if t ~ '(bloqueo vial|bloqueos?|toma de (la )?(calle|avenida|carretera)|barricadas?)' then
    return 'bloqueo';
  end if;
  if t ~ '(captura|detenid[oa]s?|arrestad[oa]s?|asegurad[oa]s?|detencion)' then return 'captura'; end if;
  if t ~ '(robo|asalto|raspon|carjacking)' then return 'robo'; end if;
  if t ~ '(accidente|choque|volcadura|colision|percance vial)' then return 'accidente'; end if;
  if t ~ '(incendio|se quema|conflagracion|lamas|vehiculos? en llamas)' then return 'incendio'; end if;
  if t ~ '(inundacion|inundad[oa]s?|encharcamiento|desborde|lluvias torrenciales)' then
    return 'inundacion';
  end if;
  if t ~ '(zona segura|todo en calma|sin novedad|se restablece)' then return 'zona segura'; end if;
  if t ~ '(alerta|alertan|reportan|zona de riesgo|precaucion)' then return 'alerta'; end if;
  return null;
end;
$$;

revoke all on function public._guess_category_es(text) from public, anon, authenticated;

update public.community_posts p
set category_guess = g.guess
from (
  select
    id,
    public._guess_category_es(coalesce(text, '')) as guess
  from public.community_posts
) g
where p.id = g.id
  and g.guess is not null
  and p.category_guess is distinct from g.guess;

-- Posts que ya tenían un valor fuera del set canónico y el clasificador no pudo
-- reasignar: normalizar a 'alerta' (catch-all) para poder poner el check.
update public.community_posts
set category_guess = 'alerta'
where category_guess is not null
  and category_guess not in (
    'balacera', 'enfrentamiento', 'detonaciones', 'narcobloqueo', 'bloqueo',
    'captura', 'robo', 'accidente', 'incendio', 'inundacion', 'zona segura',
    'sos', 'desaparecida', 'operativo', 'alerta', 'otro'
  );

comment on function public._guess_category_es(text) is
  'Clasificador ES de category_guess (espejo de supabase/functions/_shared/guessCategory.ts). Solo para backfill; no exponer a clientes.';
