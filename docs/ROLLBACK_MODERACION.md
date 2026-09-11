# Marcha atrás: límite de frecuencia y denuncias

Cubre `supabase/migrations/20260911000000_alert_rate_limit_and_flags.sql`.

**Revertir el código no revierte la base.** El archivo de migración desaparece del
repo pero los triggers siguen vivos en producción. El SQL de abajo hay que
correrlo a mano.

Este archivo vive en `docs/` a propósito: cualquier `.sql` dentro de
`supabase/migrations/` se aplicaría **hacia adelante** en el próximo `db push`.

## Antes de desmontar nada

Casi nunca quieres quitar todo. Los tres diales, en orden de menor a mayor daño:

### 1. Desocultar alertas

Si el umbral resultó agresivo y hay pulsos reales ocultos:

```sql
update public.alerts set hidden_at = null where hidden_at is not null;
```

Ocultar solo pone una fecha en `hidden_at`. Nada se borra: la alerta sigue
entera y `service_role` siempre la vio.

Para ver qué hay oculto y por qué, antes de decidir:

```sql
select a.id, a.category, a.title, a.created_at, a.hidden_at,
       count(f.user_id) as denuncias
  from public.alerts a
  left join public.alert_flags f on f.alert_id = a.id
 where a.hidden_at is not null
 group by a.id
 order by a.hidden_at desc;
```

### 2. Aflojar el límite de frecuencia

Editar los intervalos y volver a aplicar la función completa. Es
`create or replace`: sin downtime y sin tocar datos.

- `interval '2 minutes'` — espera entre pulsos normales
- `interval '1 minute'` — espera entre SOS
- `en_la_hora >= 10` — tope por hora de pulsos normales

**SOS tiene su propio carril a propósito.** Si se comparte el contador, alguien
que acaba de reportar una balacera no puede pedir auxilio medio minuto después.
No lo unifiques.

### 3. Mover el umbral de ocultado

En `public.hide_alert_on_flags()`, cambiar `>= 3` por el número que quieras.
También `create or replace`.

Subirlo hace falta si aparece brigading; bajarlo, si entran muchos pulsos falsos
y no alcanzan tres denunciantes distintos a tiempo.

## Desmontaje completo

Solo si hay que quitarlo todo. El orden importa: la policy se recrea **antes**
de borrar `hidden_at`, porque la referencia.

```sql
-- 1) Quitar el límite de frecuencia
drop trigger if exists alerts_rate_limit on public.alerts;
drop function if exists public.enforce_alert_rate_limit();

-- 2) Quitar el ocultado por denuncias
drop trigger if exists alert_flags_hide on public.alert_flags;
drop function if exists public.hide_alert_on_flags();

-- 3) Volver a mostrar todo (recrear la policy original)
drop policy if exists "Alerts are viewable by everyone" on public.alerts;
create policy "Alerts are viewable by everyone"
on public.alerts for select
using (true);

-- 4) Borrar denuncias y la columna
drop table if exists public.alert_flags;
alter table public.alerts drop column if exists hidden_at;
```

Esto sí pierde datos: las filas de `alert_flags` y qué estaba oculto. Si quieres
conservar el historial, respáldalo antes:

```sql
create table public.alert_flags_backup as select * from public.alert_flags;
```

## Código

```bash
git revert dcb59ab b0827c1 --no-edit && git push origin main
```

`b0827c1` es la migración, `dcb59ab` el botón de denuncia y el store. Revertirlos
deja la app sin la UI de denuncia, pero **los triggers siguen activos** hasta que
corras el SQL de arriba.

## Qué se pierde al revertir

Cualquier usuario autenticado vuelve a poder insertar alertas sin límite, y una
alerta falsa vuelve a no tener forma de bajarse sin entrar a la base a mano.
Antes de esto, trece alertas de prueba ya incluían seis SOS desde una misma
coordenada en un día — severidad 3 cada una — y eso fue sin querer.
