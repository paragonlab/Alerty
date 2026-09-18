// Crea Stripe Checkout Session para suscripción Plus de consumer (sólo web).
// En mobile (iOS/Android) Plus se vende a través de RevenueCat con IAP nativo.
//
// Setup:
//   supabase functions deploy stripe-checkout-plus
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_PRICE_ID_PLUS=price_...
//   supabase secrets set PLUS_RETURN_URL=https://alerty-two.vercel.app/premium
//
// Esta función SÍ verifica JWT — usa el token de Supabase del usuario para identificarlo.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-12-18.acacia",
  httpClient: Stripe.createFetchHttpClient(),
});

const PRICE_ID = Deno.env.get("STRIPE_PRICE_ID_PLUS")!;
const RETURN_URL = Deno.env.get("PLUS_RETURN_URL") ?? "https://alerty-two.vercel.app/premium";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Un error sin cabeceras CORS llega al navegador como "bloqueado por CORS": se
 * ve como problema de permisos lo que en realidad fue una config faltante o un
 * error de Stripe. Todo lo que salga de aquí las lleva y dice qué pasó.
 */
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
  if (!PRICE_ID) return fail("Falta el secret STRIPE_PRICE_ID_PLUS.");

  try {
    // Cliente con el JWT del usuario para resolver su identidad
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return fail("Tu sesión no es válida. Entra de nuevo.", 401);

    // Cliente con service role para leer/actualizar stripe_customer_id
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile } = await adminClient
      .from("users")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
      await adminClient
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      success_url: `${RETURN_URL}?status=success`,
      cancel_url: `${RETURN_URL}?status=cancel`,
      metadata: { user_id: user.id },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("stripe-checkout-plus failed", detail);
    return fail(`Stripe: ${detail}`);
  }
});
