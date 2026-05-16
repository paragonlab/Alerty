# Monetización Alerty

Dos modelos:
1. **Alerty Plus** — Suscripción mensual de consumer. RevenueCat en mobile (IAP), Stripe Checkout en web.
2. **Pin Patrocinado B2B** — Suscripción mensual para negocios que aparecen como pin en el mapa. Stripe Checkout en ambos canales.

---

## 1. Lo que ya hicimos en código

| Archivo | Propósito |
|---|---|
| `supabase/migrations/202605130001_user_subscriptions.sql` | Columnas en `users`: revenuecat_user_id, subscription_status, subscription_end_date, premium_source |
| `supabase/migrations/202605130002_sponsored_zones.sql` | Tabla `sponsored_zones` con RLS read-only para todos, escritura sólo via service_role |
| `supabase/functions/revenuecat-webhook/index.ts` | Recibe eventos de RevenueCat y actualiza `users.is_premium` |
| `supabase/functions/stripe-checkout-plus/index.ts` | Crea Checkout Session para Plus en web (usa JWT del usuario) |
| `supabase/functions/stripe-checkout-b2b/index.ts` | Crea Checkout Session para pin B2B y pre-crea zona en estado `pending` |
| `supabase/functions/stripe-webhook/index.ts` | Webhook unificado de Stripe — actualiza users (Plus) o sponsored_zones (B2B) según metadata |
| `supabase/functions/stripe-customer-portal/index.ts` | Crea sesión del Customer Portal para que el usuario gestione su suscripción Plus desde web |
| `lib/revenuecat.ts` (+ `.web.ts`) | Wrapper que en mobile usa RevenueCat SDK y en web redirige a Stripe Checkout |
| `app/premium.tsx` | Reescrita para usar el wrapper de RevenueCat. Eliminado el "pago" falso que regalaba Plus |
| `app/business.tsx` | Onboarding B2B: nombre, descripción, ubicación, email → crea checkout |

---

## 2. Setup pre-launch (lo que tienes que hacer tú)

### 2.1 Aplicar migrations de DB

```bash
npm run supabase:db:push
```

### 2.2 Cambiar el MCP de Stripe a test mode

El MCP que tengo conectado está en LIVE mode. Para development necesitas test mode:

1. Stripe Dashboard → Developers → API keys → Test mode
2. Copia el `sk_test_...` 
3. En tu cliente Claude: Settings → MCP servers → Stripe → actualiza el token
4. Reinicia la sesión de Claude

Cuando lo hagas, dime y yo recreo los productos en test mode.

### 2.3 Crear productos y precios en Stripe (test mode)

Una vez con el MCP en test mode, te creo:
- Producto: **Alerty Plus** + precio recurring $4.99/mes USD
- Producto: **Pin Patrocinado** + precio recurring $X/mes MXN (decide el precio)

Anota los `price_id` que devuelva Stripe (empiezan con `price_...`).

### 2.4 Setup RevenueCat (sólo para mobile)

1. Crear cuenta en https://app.revenuecat.com
2. Crear app "Alerty" — agrega plataformas iOS y Android
3. Para **iOS**: configura el bundle ID `com.mrparagon.alerty` y agrega el In-App Purchase Key de App Store Connect
4. Para **Android**: configura el package `com.mrparagon.alerty` y agrega service account de Google Play
5. **App Store Connect**: crear el producto IAP auto-renewable subscription, product ID sugerido: `alerty_plus_monthly`
6. **Google Play Console**: igual, subscription con product ID `alerty_plus_monthly`
7. **RevenueCat dashboard**:
   - Products → agregar `alerty_plus_monthly` (asociar a ambos stores)
   - Entitlements → crear `plus` y asociarlo a `alerty_plus_monthly`
   - Offerings → crear default offering con un package que apunte a `alerty_plus_monthly`
8. **(Opcional Stripe via RevenueCat):** RevenueCat también soporta Stripe. Si lo configuras ahí en vez de tener edge function de checkout-plus separada, simplifica. Por ahora dejamos las dos opciones (Stripe directo en web, RevenueCat en mobile).
9. Copia las **public SDK keys** de iOS y Android (Settings → API keys → Public).

### 2.5 Configurar webhooks

**RevenueCat → Supabase:**
1. RevenueCat → Integrations → Webhooks → Add new
2. URL: `https://hllgwcphvobgpdvidbad.supabase.co/functions/v1/revenuecat-webhook`
3. Generar un token random (ej. `openssl rand -hex 32`) y configurarlo como header `Authorization: Bearer <token>`
4. Guarda el token, lo necesitas en el siguiente paso

**Stripe → Supabase:**
1. Stripe Dashboard (test mode) → Developers → Webhooks → Add endpoint
2. URL: `https://hllgwcphvobgpdvidbad.supabase.co/functions/v1/stripe-webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copia el **signing secret** (`whsec_...`)

### 2.6 Configurar secrets de Supabase

```bash
# Stripe
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID_PLUS=price_...
supabase secrets set STRIPE_PRICE_ID_PIN=price_...
supabase secrets set PLUS_RETURN_URL=https://alerty.app/premium
supabase secrets set BUSINESS_RETURN_URL=https://alerty.app/business

# Las rutas /premium y /business YA leen ?status=success|cancel y muestran feedback.
# Ajusta el dominio (alerty.app) al que tengas configurado en Vercel/donde despliegues la web.

# RevenueCat
supabase secrets set REVENUECAT_WEBHOOK_AUTH=<el token random del paso 2.5>
```

### 2.7 Deploy de edge functions

```bash
supabase functions deploy revenuecat-webhook --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
supabase functions deploy stripe-checkout-b2b --no-verify-jwt
supabase functions deploy stripe-checkout-plus
supabase functions deploy stripe-customer-portal
```

`stripe-customer-portal` y `stripe-checkout-plus` verifican JWT.

Antes de usar el Customer Portal, en Stripe Dashboard (test mode) ve a
**Settings → Billing → Customer portal** y activa la configuración (define qué puede
hacer el cliente: cancelar, cambiar plan, actualizar método de pago, etc.).

`stripe-checkout-plus` SÍ verifica JWT porque usa el token del usuario para identificarlo.
Los webhooks NO verifican JWT — la autenticación viene del signing secret de Stripe / token de RevenueCat.

### 2.8 Configurar variables públicas en .env

```env
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxx
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxx
```

### 2.9 Instalar el SDK nativo

```bash
npm install
npx expo prebuild --clean   # regenera ios/ y android/ con el módulo nativo
```

Si usas EAS Build, no necesitas prebuild local — EAS lo hace en cloud.

---

## 3. Cómo probar

### 3.1 Plus en web (Stripe test mode)

1. Levanta web: `npm run web`
2. Login → ir a `/premium`
3. Click "Mejorar por $4.99/mes"
4. Stripe Checkout abre. Usa tarjeta de prueba: `4242 4242 4242 4242`, CVV `123`, expiry futura
5. Tras el pago, Stripe envía webhook → Supabase actualiza `is_premium = true`
6. Volver a la app → al recargar el perfil, debe verse como Plus activo

### 3.2 Plus en mobile (RevenueCat sandbox)

1. iOS: crear sandbox tester en App Store Connect
2. Login en el dispositivo con ese sandbox account
3. Abrir la app → `/premium` → suscribirse
4. RevenueCat → webhook → Supabase
5. Se refleja en el perfil

### 3.3 Pin B2B

1. Abrir `/business` (sin auth requerido)
2. Llenar form → "Continuar al pago"
3. Stripe Checkout
4. Tras el pago, la zona pasa de `pending` a `active` en `sponsored_zones`
5. En el siguiente refresh del feed/mapa aparece el pin

---

## 4. Riesgos conocidos

- **App Store review**: Stripe Checkout en web está bien. En la **app de iOS** Plus DEBE usar IAP via RevenueCat. La app B2B (pin patrocinado) podría rechazarse si parece "compra dentro de la app" — la ruta `/business` debería estar oculta en builds de iOS o redirigir a la web. Decide antes del submit.
- **Botón "Restaurar compras"**: ya agregado en `/premium` para mobile. Apple lo exige en cualquier app con compras IAP.
- **mock data**: `mockSponsoredZones` en `lib/alerty/mock.ts` ya no se usa pero sigue exportado. Bórralo cuando tengas confianza de que el flow real funciona.
- **moderación**: cualquiera puede llenar el form de `/business` y crear un registro `pending`. El status sólo pasa a `active` cuando hay pago, pero igual deberías revisar manualmente antes de promocionar zonas (la fila tiene `owner_email` para contactar).
- **Stripe test keys vs live**: cuando estés listo para producción, cambias las keys, productos, webhooks y secrets a live. Las edge functions no cambian.

---

## 5. Próximos pasos sugeridos (post-launch)

- Dashboard B2B para que negocios editen/cancelen su pin (Stripe Customer Portal)
- Métricas: impresiones de pin, clicks, conversión
- Promociones automáticas (mes gratis con coupon)
- Tier de Plus más caro con beneficios extra
- Sistema de moderación de zonas pendientes
