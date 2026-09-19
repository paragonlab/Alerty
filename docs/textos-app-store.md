# Textos para reposicionar Pulso Ciudadano ante App Review

Apple rechazó la app por Guideline 2.1: no acepta que una app reciba denuncias
de delitos sin respaldo de la autoridad local. Estos tres textos quitan de en
medio la lectura de "canal de denuncia" y dejan a Pulso como lo que es: vecinos
avisándose entre ellos.

Los tres ya se aplicaron: la ficha se guardó en App Store Connect el 18 de
septiembre de 2026, los textos del SOS viven en `components/AlertyTabBar.tsx`
(commit 09d66ab) y la respuesta se envió por el Centro de Resoluciones ese mismo
día.

---

## 1. Descripción de la ficha (App Store Connect)

Pulso Ciudadano es la red de vecinos de Culiacán para saber cómo está tu zona
antes de salir.

Aquí los vecinos se avisan entre ellos: qué está pasando en la colonia, qué
calles evitar y qué lugares están tranquilos. Lo que lees lo escriben personas
como tú, junto con notas de noticieros locales.

Antes de ir al trabajo, a la escuela o a un mandado, checa tu colonia. En
segundos ves cómo está la zona según lo que cuentan los vecinos.

Pulso Ciudadano no es un canal de denuncia. No enviamos lo que publicas a la
policía, al 911 ni a ninguna autoridad, y no sustituimos a ninguna institución.
Si necesitas ayuda de emergencia, llama al 911.

Gratis siempre:
• Mapa en vivo de Culiacán
• Pulsos de la comunidad y de noticieros locales
• Compartir con tus vecinos lo que ves
• Aviso SOS a los vecinos que estén a 2 km

Círculo (suscripción, $39 MXN al mes): cuida hasta 5 lugares y recibe aviso
cuando un vecino publique algo cerca de alguno. Un lugar es gratis. El mapa, los
pulsos y el SOS no se cobran.

Comunidad sin tolerancia: puedes reportar cualquier publicación ofensiva y
bloquear a quien abuse. Revisamos lo reportado en menos de 24 horas.

Lo que se publica aquí no está verificado. Confirma siempre por tu cuenta antes
de tomar una decisión.

Términos de uso (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

### Texto promocional (30–170 caracteres)

Vecinos de Culiacán avisándose entre sí. Checa cómo está tu zona antes de salir.

---

## 2. Textos del SOS dentro de la app

Hoy el SOS ya no menciona autoridades, pero tampoco aclara que no las llama.
Ante Apple conviene decirlo en la pantalla misma.

**Confirmación antes de enviar** (`components/AlertyTabBar.tsx`):

> Esto no es un juego. Tu aviso llega a los vecinos que estén a 2 km, no a la
> policía ni al 911. Si necesitas a la autoridad, llámala tú. Si no es real,
> cancela.

**Mensaje al enviarse:**

> Avisamos a los vecinos que están a 2 km a la redonda. Pulso no llama al 911:
> si necesitas ayuda de la autoridad, márcale tú.

**Etiqueta del botón:**

> Mantén presionado para avisar a los vecinos a 2 km

---

## 3. Respuesta a App Review (Centro de Resoluciones, en inglés)

Enviada el 18 de septiembre de 2026 sobre el envío 59d3b608-1477-42fb-8d9b-d78b7a35bb51.
Corregida antes de enviarla: las protecciones de 1.2 están en el código, no en el
build 13 que Apple revisó, y Apple revisa el binario. Decirle que la app "ya las
incluye" habría sido falso.

Hello,

Thank you for the review. We would like to clarify how the app works, because we
believe it was understood as a crime-reporting channel, which it is not.

Pulso Ciudadano is a neighbor-to-neighbor information app. People share what they
see in their own neighborhood with other residents nearby, alongside headlines
from local news outlets. The app does not transmit anything to law enforcement,
emergency services, or any public institution. There is no integration with any
authority, we do not claim any partnership, and no report made in the app reaches
the police or 911.

The App Store listing has already been updated: the app is now named Pulso
Ciudadano, and the description states explicitly that it is not a reporting
channel to any authority and that users must call 911 in an emergency.

We have also made the following changes inside the app. They are implemented, but
they are not present in the build you reviewed; they will be included in the next
build we submit:

- The SOS screen now states that the alert reaches only other users of the app
  within 2 km, and that it does not contact the police or 911.
- For Guideline 1.2: terms that every account must accept before entering, with
  zero tolerance for objectionable content; a way to report any post; a way to
  block an abusive account, which immediately removes that account's content from
  the map, the feed and the video section; and a moderation process that acts on
  reports within 24 hours. We will include the requested video recording of these
  mechanisms in the App Review Notes of that submission.

If any wording still reads as a crime-reporting service, we are glad to change
it. Thank you for your time.
