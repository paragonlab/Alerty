alter table public.alerts
  drop constraint if exists alerts_category_check;

alter table public.alerts
  add constraint alerts_category_check
  check (category in (
    'balacera',
    'narcobloqueo',
    'enfrentamiento',
    'detonaciones',
    'bloqueo',
    'captura',
    'robo',
    'accidente',
    'incendio',
    'inundacion',
    'zona segura',
    'sos'
  ));
