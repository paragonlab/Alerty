# Pendientes

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
