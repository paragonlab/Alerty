-- pg_net espera 5 segundos por defecto. En la prueba del 14-09 la function tardó
-- ~7 s en responder y la espera se cortó: el aviso sí se procesó (los logs de la
-- function muestran 200), pero se perdió la respuesta, que es la única forma de
-- saber a cuántos teléfonos llegó y qué contestó Expo.
--
-- 20 s deja margen para arranque en frío + Expo. No retrasa nada: el insert de la
-- alerta no espera esta llamada; quien espera es el worker de pg_net.

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
    raise warning 'notify-on-alert no disparado: falta project_url, notify_hook_secret o publishable_key en Vault';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/notify-on-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key,
      'apikey', api_key,
      'x-pulso-hook', hook_secret
    ),
    body := jsonb_build_object('type', 'alert', 'alertId', new.id),
    timeout_milliseconds := 20000
  );

  return new;
end;
$$;
