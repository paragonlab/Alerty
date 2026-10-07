-- Backfill idempotente de community_posts.category_guess con el clasificador canónico.
-- NO ejecutar contra producción desde el agente: el asistente del owner lo aplica tras review.
--
-- Orden recomendado:
--   1) 20261007100000_users_character.sql
--   2) 20261007110000_alert_categories_desaparecida_operativo.sql
--   3) ESTA migración (backfill + backup reversible)
--   4) 20261007130000_community_category_guess_check.sql (constraint NOT VALID)
--
-- Distribución esperada con límites de palabra (simulación read-only ≈1871 posts):
--   null 669, alerta 266, balacera 275, operativo 195, enfrentamiento 134,
--   accidente 100, detonaciones 59, desaparecida 58, captura 51, inundacion 17,
--   incendio 19, robo 17, bloqueo 6, sos 5.
--   (sin \m/\M, "sos" hinchaba a ~165 por substrings: dolosos, casos, pesos, …)

-- Backup reversible (solo filas aún no respaldadas).
create table if not exists public.community_posts_category_backup (
  id uuid primary key,
  old_category_guess text,
  backed_up_at timestamptz not null default now()
);

revoke all on table public.community_posts_category_backup from public, anon, authenticated;

comment on table public.community_posts_category_backup is
  'Snapshot de category_guess antes del backfill canónico. Solo service_role/owner.';

-- Función SQL espejo de supabase/functions/_shared/guessCategory.ts.
-- Postgres: \m / \M = límites de palabra (\b en JS es backspace aquí).
create or replace function public._guess_category_es(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  t text;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;
  -- minúsculas + quitar acentos (equivalente a normalizeEs del TS)
  t := lower(raw);
  t := translate(t,
    'áéíóúüñÁÉÍÓÚÜÑ',
    'aeiouunAEIOUUN');

  if t ~ '\m(sos|auxilio|auxilien)\M'
     or t ~ '\mpid(e|en) ayuda\M' then
    return 'sos';
  end if;
  if t ~ '\m(desaparecid[oa]s?|levanton|levantamiento|secuestro|plagiad[oa]s?|extraviad[oa]s?)\M'
     or t ~ '\mprivacion de la libertad\M'
     or t ~ '\mbuscan a\M' then
    return 'desaparecida';
  end if;
  if t ~ '\m(operativo|despliegue|militares?|ejercito|rastrillo)\M'
     or t ~ '\mguardia nacional\M'
     or t ~ '\mfederal(es)?\M'
     or t ~ '\mrevision de vehiculos\M' then
    return 'operativo';
  end if;
  if t ~ '\m(balacera|tiroteo|disparos?|balead[oa]s?|rafagas?)\M' then
    return 'balacera';
  end if;
  if t ~ '\m(enfrentamiento)\M'
     or t ~ '\mgrupo armado\M'
     or t ~ '\melementos armados\M'
     or t ~ '\mchoque armado\M'
     or t ~ '\mtoma de cuartel\M' then
    return 'enfrentamiento';
  end if;
  if t ~ '\m(detonaciones?|explosiones?|estallidos?)\M' then
    return 'detonaciones';
  end if;
  if t ~ '\m(narcobloqueo|narcobloqueos)\M'
     or t ~ '\mvehiculos quemados en la via\M' then
    return 'narcobloqueo';
  end if;
  if t ~ '\mbloqueo vial\M'
     or t ~ '\mbloqueos?\M'
     or t ~ '\mtoma de (la )?(calle|avenida|carretera)\M'
     or t ~ '\mbarricadas?\M' then
    return 'bloqueo';
  end if;
  if t ~ '\m(captura|detenid[oa]s?|arrestad[oa]s?|asegurad[oa]s?|detencion)\M' then
    return 'captura';
  end if;
  if t ~ '\m(robo|asalto|raspon|carjacking)\M'
     or t ~ '\mportacion ilegal\M' then
    return 'robo';
  end if;
  if t ~ '\m(accidente|choque|volcadura|colision)\M'
     or t ~ '\mpercance vial\M' then
    return 'accidente';
  end if;
  if t ~ '\m(incendio|conflagracion|lamas)\M'
     or t ~ '\mse quema\M'
     or t ~ '\mvehiculos? en llamas\M' then
    return 'incendio';
  end if;
  if t ~ '\m(inundacion|inundad[oa]s?|encharcamiento|desborde)\M'
     or t ~ '\mlluvias torrenciales\M' then
    return 'inundacion';
  end if;
  if t ~ '\mzona segura\M'
     or t ~ '\mtodo en calma\M'
     or t ~ '\msin novedad\M'
     or t ~ '\mse restablece\M' then
    return 'zona segura';
  end if;
  if t ~ '\m(alerta|alertan|reportan|precaucion)\M'
     or t ~ '\mzona de riesgo\M' then
    return 'alerta';
  end if;
  return null;
end;
$$;

revoke all on function public._guess_category_es(text) from public, anon, authenticated;

-- Respaldar filas que van a cambiar y aún no están en el backup.
insert into public.community_posts_category_backup (id, old_category_guess, backed_up_at)
select p.id, p.category_guess, now()
from public.community_posts p
cross join lateral (
  select public._guess_category_es(coalesce(p.text, '')) as guess
) g
where not exists (
  select 1 from public.community_posts_category_backup b where b.id = p.id
)
and (
  (g.guess is not null and p.category_guess is distinct from g.guess)
  or (
    p.category_guess is not null
    and p.category_guess not in (
      'balacera', 'enfrentamiento', 'detonaciones', 'narcobloqueo', 'bloqueo',
      'captura', 'robo', 'accidente', 'incendio', 'inundacion', 'zona segura',
      'sos', 'desaparecida', 'operativo', 'alerta', 'otro'
    )
  )
);

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

-- Posts fuera del set canónico que el clasificador no reasignó → 'alerta'.
update public.community_posts
set category_guess = 'alerta'
where category_guess is not null
  and category_guess not in (
    'balacera', 'enfrentamiento', 'detonaciones', 'narcobloqueo', 'bloqueo',
    'captura', 'robo', 'accidente', 'incendio', 'inundacion', 'zona segura',
    'sos', 'desaparecida', 'operativo', 'alerta', 'otro'
  );

-- Solo hacía falta para el backfill; no dejar helper en el schema.
drop function if exists public._guess_category_es(text);
