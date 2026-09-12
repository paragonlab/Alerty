-- El aviso de una alerta no puede depender del teléfono de quien la envía.
--
-- Hasta ahora `notify-on-alert` se invocaba solo desde el cliente, después del
-- insert, y con el error tragado:
--
--   void supabase.functions.invoke("notify-on-alert", ...).catch(() => {});
--
-- Si el teléfono pierde señal, la app pasa a segundo plano o el usuario cierra,
-- la alerta queda guardada y nadie recibe nada. En un SOS ese es justo el
-- momento en que un teléfono falla, y falla en silencio: nadie se entera.
--
-- Ahora lo dispara la base. Mismo patrón que internal.invoke_community_sync.
--
-- Requiere el secreto en Vault y en la function:
--   select vault.create_secret('<secreto>', 'notify_hook_secret');
--   supabase secrets set NOTIFY_HOOK_SECRET=<mismo secreto>
--
-- Se usa un secreto propio y no service_role: este camino solo necesita mandar
-- avisos, no poder todo en la base.

create extension if not exists pg_net with schema extensions;

create or replace function internal.notify_on_alert_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  hook_secret text;
  api_key text;
begin
  select ds.decrypted_secret into project_url
    from vault.decrypted_secrets as ds
   where ds.name = 'project_url'
   limit 1;

  select ds.decrypted_secret into hook_secret
    from vault.decrypted_secrets as ds
   where ds.name = 'notify_hook_secret'
   limit 1;

  select ds.decrypted_secret into api_key
    from vault.decrypted_secrets as ds
   where ds.name in ('publishable_key', 'anon_key')
   order by case ds.name when 'publishable_key' then 0 else 1 end
   limit 1;

  if project_url is null or hook_secret is null or api_key is null then
    -- Avisar y seguir: que falte un secreto no puede impedir guardar la alerta.
    raise warning 'notify-on-alert no disparado: falta project_url, notify_hook_secret o publishable_key en Vault';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/notify-on-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      -- verify_jwt está activo: el gateway rechaza antes de llegar al código si
      -- Authorization no es un JWT. La anon key lo es; quien autoriza de verdad
      -- es x-pulso-hook, que la function compara contra NOTIFY_HOOK_SECRET.
      'Authorization', 'Bearer ' || api_key,
      'apikey', api_key,
      'x-pulso-hook', hook_secret
    ),
    body := jsonb_build_object('type', 'alert', 'alertId', new.id)
  );

  return new;
end;
$$;

revoke execute on function internal.notify_on_alert_row() from public;
revoke execute on function internal.notify_on_alert_row() from anon, authenticated;

-- AFTER INSERT: si el aviso falla, la alerta ya está guardada de todos modos.
drop trigger if exists alerts_notify on public.alerts;
create trigger alerts_notify
after insert on public.alerts
for each row execute function internal.notify_on_alert_row();
