# Cómo se modera Pulso

Los términos que cada cuenta acepta al entrar prometen dos cosas: tolerancia
cero al contenido ofensivo y revisión en menos de 24 horas. Esto es lo que hay
detrás de esa promesa. Sirve también como respuesta si App Review pregunta por
el proceso.

## Qué pasa cuando alguien reporta un pulso

1. **Al instante.** El pulso deja de verse para quien lo reportó.
2. **Al tercer reportante distinto.** Un trigger de la base
   (`hide_alert_on_flags`) lo oculta para todos. Es un reflejo automático, no
   una revisión: gana tiempo mientras alguien lo mira.
3. **Antes de 24 horas.** Quien modera abre Ajustes → Moderación y decide:
   **Quitar** o **Dejar visible**. Cada decisión queda escrita en
   `moderation_reviews` con quién y cuándo.

Un pulso vuelve a la cola si lo reportan otra vez después de haberse revisado.

## Quién modera

La columna `users.is_moderator`. Hoy la traen las tres cuentas del dueño. La
pantalla y las policies leen ese campo mediante `public.is_moderator()`, así que
para sumar a alguien basta con:

```sql
update public.users set is_moderator = true where username = '@quien';
```

## Qué ve quien modera

`app/moderacion.tsx`, con dos fuentes:

- **`moderation_queue`** — cada pulso reportado con su texto, autor, número de
  reportes, motivos, si está oculto y cuándo se revisó por última vez. Los que
  llevan más de 24 horas sin revisar salen en rojo.
- **`moderation_blocked_accounts`** — cuentas que otros vecinos bloquearon, con
  cuántas personas las bloquearon. No dispara nada por sí sola: es la señal para
  ir a mirar lo que publica quien reincide.

Las dos vistas son `security_invoker`, es decir respetan las policies de quien
consulta: un vecino normal no ve reportes ajenos ni pulsos ocultos, y no puede
modificar pulsos de nadie. Verificado contra la base el 19 de septiembre de 2026
simulando las dos sesiones.

## Lo que un vecino puede hacer sin esperarnos

- **Reportar** cualquier pulso, desde el detalle o desde Videos.
- **Bloquear** a la cuenta: sus pulsos desaparecen de su mapa, de Pulsos y de
  Videos al instante, sin esperar a ninguna revisión.

## Lo que falta

No hay aviso automático cuando entra un reporte: el pendiente se ve como
contador en Ajustes → Moderación cada vez que se abre la app. Si el volumen
crece, esto se queda corto y hay que mandar push o correo al moderador.
