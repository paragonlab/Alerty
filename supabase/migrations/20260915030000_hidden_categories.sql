-- Se guardan las categorías que la persona OCULTA, no las que ve. Con la lista
-- de visibles, cada categoría nueva quedaba oculta para siempre: el default de
-- active_categories nunca incluyó incendio ni inundación, así que ninguna cuenta
-- los veía.
--
-- categories_configured: una cuenta nueva elige sus categorías antes de entrar.
-- Las cuentas que ya existen no tienen que pasar por eso.

alter table public.users
  add column if not exists hidden_categories text[] not null default '{}',
  add column if not exists categories_configured boolean not null default false;

-- Lo que cada cuenta tenía apagado de las 10 categorías originales. Incendio e
-- inundación no estaban en su lista por el default, no porque las apagaran.
update public.users
   set hidden_categories = array(
         select c
           from unnest(array[
             'balacera', 'narcobloqueo', 'enfrentamiento', 'detonaciones', 'bloqueo',
             'captura', 'robo', 'accidente', 'zona segura'
           ]) as c
          where active_categories is not null and not (c = any (active_categories))
       ),
       categories_configured = true;
