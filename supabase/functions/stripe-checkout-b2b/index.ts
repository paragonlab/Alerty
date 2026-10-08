// Crea Stripe Checkout Session para suscripción B2B de pin patrocinado.
// Requiere JWT de un usuario autenticado (igual que stripe-checkout-plus).
//
// Setup:
//   supabase functions deploy stripe-checkout-b2b
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_PRICE_ID_PIN=price_...
//   supabase secrets set BUSINESS_RETURN_URL=https://pulso-ciudadano.com/business
//
// Body esperado:
//   { name, description, lat, lng, type, owner_email, pin_shape?, logo_url? }

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";
import { DEFAULT_SYNC_CITY_ID } from "../_shared/cities.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID_PIN")!;
const RETURN_URL = Deno.env.get("BUSINESS_RETURN_URL") ?? "https://pulso-ciudadano.com/business";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const fail = (message: string, status = 500) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return fail("Falta el token de sesión.", 401);

  if (!Deno.env.get("STRIPE_SECRET_KEY")) return fail("Falta el secret STRIPE_SECRET_KEY.");
  if (!PRICE_ID) return fail("Falta el secret STRIPE_PRICE_ID_PIN.");

  type Body = {
    name?: string;
    description?: string;
    lat?: number;
    lng?: number;
    type?: "refugio" | "anuncio";
    owner_email?: string;
    pin_shape?: string;
    pin_giro?: string | null;
    logo_url?: string | null;
  };

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return fail("JSON inválido.", 400);
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return fail("Tu sesión no es válida. Entra de nuevo.", 401);

    const { name, description, lat, lng, type, owner_email, pin_shape, pin_giro, logo_url } = body;
    if (!name || !description || typeof lat !== "number" || typeof lng !== "number"
        || !type || !owner_email) {
      return fail("Faltan campos.", 400);
    }
    if (type !== "refugio" && type !== "anuncio") {
      return fail("Tipo inválido.", 400);
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pre-creamos la zona en estado pending. La activación final es por webhook.
    const shape =
      pin_shape === "flag" || pin_shape === "house" || pin_shape === "shield" || pin_shape === "pin"
        ? pin_shape
        : "pin";
    const giro =
      pin_giro === "tienda" ||
      pin_giro === "farmacia" ||
      pin_giro === "cafe" ||
      pin_giro === "generico" ||
      pin_giro === "casa" ||
      pin_giro === "escudo"
        ? pin_giro
        : null;
    const logo =
      typeof logo_url === "string" &&
      logo_url.startsWith("https://") &&
      logo_url.includes("/aliado-logos/") &&
      logo_url.length < 500
        ? logo_url
        : null;

    const { data: zone, error: zoneErr } = await adminClient
      .from("sponsored_zones")
      .insert({
        name,
        description,
        lat,
        lng,
        type,
        owner_email,
        owner_user_id: user.id,
        pin_shape: shape,
        pin_giro: giro,
        logo_url: logo,
        status: "pending",
        city_id: DEFAULT_SYNC_CITY_ID,
      })
      .select("id")
      .single();

    if (zoneErr || !zone) {
      return fail(`Error de base: ${zoneErr?.message ?? "desconocido"}`, 500);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      customer_email: owner_email,
      success_url: `${RETURN_URL}?status=success&zone_id=${zone.id}`,
      cancel_url: `${RETURN_URL}?status=cancel&zone_id=${zone.id}`,
      metadata: { zone_id: zone.id, user_id: user.id },
      subscription_data: { metadata: { zone_id: zone.id, user_id: user.id } },
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: session.url, zone_id: zone.id }),
      {
        status: 200,
        headers: { ...corsHeaders, "content-type": "application/json" },
      },
    );
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("stripe-checkout-b2b failed", detail);
    return fail(`Stripe: ${detail}`);
  }
});
