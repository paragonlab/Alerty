# Pendientes

## Cobro de Círculo: dónde quedó (17 sep 2026)

**Web (Stripe).** Funciona: el checkout abre y crea el cliente. Lo que faltó fue
un cliente guardado de modo prueba con una llave de modo vivo; la función ahora
crea uno nuevo si el guardado ya no existe.

**Falta probar:** que el webhook ponga `is_premium` tras un pago completo. Es el
único eslabón de la cadena del dinero que nunca ha corrido.

**iPhone (RevenueCat).** Ya están las llaves públicas del SDK en el entorno
`production` de EAS, sacadas del proyecto Pulso (`c7d5cf25`): la app de iOS es
"Alerty (App Store)" (`com.mrparagon.alerty`) y la de Android "Alerty"
(`com.paragonlabs.alerty`). El entitlement se llama `plus`, que es el que lee
`lib/revenuecat.ts`, y hay una oferta "Default" con un paquete.

Para que el paywall cobre falta:

1. **Build nuevo** — las `EXPO_PUBLIC_*` se hornean en el binario. La cuota de
   builds de iOS del plan gratuito de EAS se agotó; se reinicia el 1 de octubre
   de 2026.
2. **Mandar la suscripción a revisión.** `com.mrparagon.alerty.plus_monthly`
   está en "Rechazada por el desarrollador" en App Store Connect. Apple pide una
   captura del paywall corriendo, que sale del build del punto 1.
3. **Llave de In-App Purchase (P8)** de App Store Connect subida a RevenueCat:
   sin ella avisa que no puede validar con StoreKit 2.

**Android está parado antes de empezar:** no existe cuenta de desarrollador de
Play Console (25 USD, una vez). Por eso el producto de Android en RevenueCat
(`com.mrparagon.alerty.plus_monthly:monthly`) aparece como "Not found": apunta a
algo que no existe en ninguna tienda de Google.

**Lo que sí está listo:** contrato de apps de pago activo, banco en MXN y
formularios fiscales al corriente en App Store Connect.

## Grande: convertir videos en el servidor (después de publicar en App Store)

**Problema.** El iPhone graba en HEVC (.mov), también desde Safari en la versión
web. Esos videos se ven en iPhone, pero algunos Android y Chrome no los
reproducen en Videos. Hoy la subida conserva el formato real y rechaza videos de
más de 45 MB (`lib/upload.ts`, `app/report.tsx`), pero no convierte nada.

**Qué hacer.** Al subir un video, pasarlo a MP4 H.264 (720p) y cambiar el enlace
en `media.media_url`.

**Opciones evaluadas** (Supabase Edge Functions no sirve: no alcanza el tiempo de
CPU para ffmpeg):

1. **Función en Vercel** (recomendada): ruta `/api/convertir` en el mismo
   proyecto de la web, con `ffmpeg-static`, llamada por la base (pg_net) cuando
   se inserta un video. No requiere cuenta nueva; hay que agregar dos variables
   de entorno en Vercel. Ojo: el plan Hobby es para uso no comercial; con
   premium corresponde el plan Pro.
2. **Cloudinary**: lo más rápido de montar, capa gratis de ~25 GB al mes; los
   videos se sirven desde Cloudinary.
3. **Servicio en Railway** con ffmpeg: ~$5 al mes, control total.

**Arreglo parcial barato** (solo app nativa de iPhone): `videoExportPreset` de
expo-image-picker para exportar en H.264 desde el teléfono.
