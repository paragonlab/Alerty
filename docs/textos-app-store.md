# Textos para reposicionar Pulso Ciudadano ante App Review

Apple rechazó la app por Guideline 2.1: no acepta que una app reciba denuncias
de delitos sin respaldo de la autoridad local. Estos tres textos quitan de en
medio la lectura de "canal de denuncia" y dejan a Pulso como lo que es: vecinos
avisándose entre ellos.

Nada de esto se ha aplicado todavía.

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

Hello,

Thank you for the review. We would like to clarify how the app works, because
we believe it was understood as a crime-reporting channel, which it is not.

Pulso Ciudadano is a neighbor-to-neighbor information app. People share what
they see in their own neighborhood with other residents nearby, alongside
headlines from local news outlets. The app does not transmit anything to law
enforcement, emergency services, or any public institution. There is no
integration with any authority, we do not claim any partnership, and no report
made in the app reaches the police or 911.

We have updated the app so this is unmistakable:

- The app is now named Pulso Ciudadano, and the App Store description states
  explicitly that the app is not a reporting channel to any authority and that
  users must call 911 for emergencies.
- The in-app SOS notifies only other users of the app within 2 km, and the
  screen now states that it does not contact the police or 911.

Regarding Guideline 1.2, the app now includes: terms that every account must
accept before entering, with zero tolerance for objectionable content; a way to
report any post; a way to block an abusive account, which removes that account's
content from the map, the feed and the video section immediately; and a
moderation process that acts on reports within 24 hours.

If any wording still reads as a crime-reporting service, we are glad to change
it. Thank you for your time.
