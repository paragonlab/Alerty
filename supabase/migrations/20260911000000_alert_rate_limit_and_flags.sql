-- Control de daños antes de publicar.
--
-- Hasta ahora cualquier usuario autenticado podía insertar alertas sin límite y
-- no existía policy de DELETE, así que una alerta falsa no se podía bajar sin
-- entrar a la base de datos a mano. En una app de seguridad un pin falso de
-- balacera provoca pánico o desvía a alguien hacia una ruta peor: esto no es
-- antispam, es evitar daño.
--
-- El límite vive en la base y no en el cliente: en el cliente se evade.

-- 1) Alertas ocultables ------------------------------------------------------

alter table public.alerts add column if not exists hidden_at timestamptz;

-- Las ocultas dejan de existir para el cliente; service_role las sigue viendo.
-- Las filas actuales tienen hidden_at nulo, así que nada deja de verse hoy.
drop policy if exists "Alerts are viewable by everyone" on public.alerts;
create policy "Alerts are viewable by everyone"
on public.alerts for select
using (hidden_at is null);

-- 2) Denuncias ---------------------------------------------------------------

create table if not exists public.alert_flags (
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  -- Una denuncia por persona y alerta: sin esto, uno solo tumba cualquier pin.
  primary key (alert_id, user_id)
);

alter table public.alert_flags enable row level security;

drop policy if exists "Users can flag an alert" on public.alert_flags;
create policy "Users can flag an alert"
on public.alert_flags for insert to authenticated
with check (auth.uid() = user_id);

-- Nadie ve las denuncias ajenas: el conteo no debe ser un tablero público.
drop policy if exists "Users see their own flags" on public.alert_flags;
create policy "Users see their own flags"
on public.alert_flags for select to authenticated
using (auth.uid() = user_id);

grant select, insert on table public.alert_flags to authenticated;

-- 3) Ocultar al tercer denunciante distinto ----------------------------------

create or replace function public.hide_alert_on_flags()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.alerts a
     set hidden_at = now()
   where a.id = new.alert_id
     and a.hidden_at is null
     and (select count(*) from public.alert_flags f where f.alert_id = new.alert_id) >= 3;
  return new;
end;
$$;

revoke execute on function public.hide_alert_on_flags() from public;
revoke execute on function public.hide_alert_on_flags() from anon, authenticated;

drop trigger if exists alert_flags_hide on public.alert_flags;
create trigger alert_flags_hide
after insert on public.alert_flags
for each row execute function public.hide_alert_on_flags();

-- 4) Límite de frecuencia ----------------------------------------------------

create or replace function public.enforce_alert_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ultima timestamptz;
  en_la_hora integer;
  espera interval;
begin
  if new.user_id is null then
    return new;
  end if;

  -- SOS en su propio carril: un pulso normal reciente NO puede bloquear una
  -- emergencia. Si se comparte el contador, reportar una balacera y necesitar
  -- SOS medio minuto después deja a la persona sin poder pedir ayuda.
  -- Cuenta también las ocultas: si no, denunciar una reinicia el contador.
  if new.category = 'sos' then
    espera := interval '1 minute';
    select max(created_at) into ultima
      from public.alerts
     where user_id = new.user_id and category = 'sos';
  else
    espera := interval '2 minutes';
    select max(created_at) into ultima
      from public.alerts
     where user_id = new.user_id and category <> 'sos';
  end if;

  if ultima is not null and now() - ultima < espera then
    raise exception 'Espera un momento antes de enviar otro pulso.';
  end if;

  -- El tope por hora no aplica a SOS.
  if new.category <> 'sos' then
    select count(*) into en_la_hora
      from public.alerts
     where user_id = new.user_id
       and category <> 'sos'
       and created_at > now() - interval '1 hour';

    if en_la_hora >= 10 then
      raise exception 'Llegaste al máximo de pulsos por hora.';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_alert_rate_limit() from public;
revoke execute on function public.enforce_alert_rate_limit() from anon, authenticated;

drop trigger if exists alerts_rate_limit on public.alerts;
create trigger alerts_rate_limit
before insert on public.alerts
for each row execute function public.enforce_alert_rate_limit();
