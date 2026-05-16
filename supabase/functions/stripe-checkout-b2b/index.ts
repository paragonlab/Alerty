// Crea Stripe Checkout Session para suscripción B2B de pin patrocinado.
//
// Setup:
//   supabase functions deploy stripe-checkout-b2b --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_PRICE_ID_PIN=price_...
//   supabase secrets set BUSINESS_RETURN_URL=https://alerty.app/business/return
//
// Body esperado:
//   { name, description, lat, lng, type, owner_email }

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID_PIN")!;
const RETURN_URL = Deno.env.get("BUSINESS_RETURN_URL") ?? "https://alerty.app/business";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  type Body = {
    name?: string;
    description?: string;
    lat?: number;
    lng?: number;
    type?: "refugio" | "anuncio";
    owner_email?: string;
  };

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400, headers: corsHeaders });
  }

  const { name, description, lat, lng, type, owner_email } = body;
  if (!name || !description || typeof lat !== "number" || typeof lng !== "number"
      || !type || !owner_email) {
    return new Response("Missing fields", { status: 400, headers: corsHeaders });
  }
  if (type !== "refugio" && type !== "anuncio") {
    return new Response("Invalid type", { status: 400, headers: corsHeaders });
  }

  // Pre-creamos la zona en estado pending. La activación final es por webhook.
  const { data: zone, error: zoneErr } = await supabase
    .from("sponsored_zones")
    .insert({
      name, description, lat, lng, type,
      owner_email,
      status: "pending",
    })
    .select("id")
    .single();

  if (zoneErr || !zone) {
    return new Response(`DB error: ${zoneErr?.message ?? "unknown"}`, {
      status: 500, headers: corsHeaders,
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    customer_email: owner_email,
    success_url: `${RETURN_URL}?status=success&zone_id=${zone.id}`,
    cancel_url: `${RETURN_URL}?status=cancel&zone_id=${zone.id}`,
    metadata: { zone_id: zone.id },
    subscription_data: { metadata: { zone_id: zone.id } },
    allow_promotion_codes: true,
  });

  return new Response(
    JSON.stringify({ url: session.url, zone_id: zone.id }),
    {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    },
  );
});
