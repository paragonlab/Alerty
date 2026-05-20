-- 'sos' faltaba en el default de active_categories, lo que ocultaba las
-- alertas SOS del feed y el mapa para usuarios sincronizados con la DB.

-- Default para usuarios nuevos
alter table public.users
  alter column active_categories
  set default array[
    'balacera',
    'narcobloqueo',
    'enfrentamiento',
    'detonaciones',
    'bloqueo',
    'captura',
    'robo',
    'accidente',
    'zona segura',
    'sos'
  ];

-- Usuarios existentes que aún no tienen 'sos' en sus filtros
update public.users
set active_categories = array_append(active_categories, 'sos')
where not ('sos' = any(active_categories));
