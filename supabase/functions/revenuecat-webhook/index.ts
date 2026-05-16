// RevenueCat → Supabase webhook
// RevenueCat envía eventos cuando una suscripción cambia. Esta función actualiza
// users.is_premium y subscription_status según el evento.
//
// Setup:
//   supabase functions deploy revenuecat-webhook --no-verify-jwt
//   supabase secrets set REVENUECAT_WEBHOOK_AUTH=<random_token>
// En RevenueCat dashboard → Integrations → Webhooks:
//   URL: https://<project>.supabase.co/functions/v1/revenuecat-webhook
//   Authorization header: Bearer <random_token>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.97.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_AUTH = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");

type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "PRODUCT_CHANGE"
  | "CANCELLATION"
  | "UNCANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "NON_RENEWING_PURCHASE"
  | "TRIAL_STARTED"
  | "TRIAL_CONVERTED"
  | "TRIAL_CANCELLED"
  | "TEST";

interface RCEvent {
  type: RCEventType;
  app_user_id: string;
  original_app_user_id?: string;
  expiration_at_ms?: number;
  store?: "APP_STORE" | "PLAY_STORE" | "STRIPE" | "PROMOTIONAL";
}

const premiumSourceFromStore = (store?: string): string | null => {
  switch (store) {
    case "APP_STORE": return "app_store";
    case "PLAY_STORE": return "play_store";
    case "STRIPE": return "stripe";
    case "PROMOTIONAL": return "promo";
    default: return null;
  }
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // RevenueCat manda Authorization: Bearer <token>
  if (WEBHOOK_AUTH) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${WEBHOOK_AUTH}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  let payload: { event?: RCEvent };
  try {
    payload = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const event = payload.event;
  if (!event || !event.app_user_id) {
    return new Response("Missing event", { status: 400 });
  }

  const userId = event.app_user_id;

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "PRODUCT_CHANGE":
    case "UNCANCELLATION":
    case "TRIAL_STARTED":
    case "TRIAL_CONVERTED":
    case "NON_RENEWING_PURCHASE": {
      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;
      const { error } = await supabase
        .from("users")
        .update({
          is_premium: true,
          subscription_status: event.type === "TRIAL_STARTED" ? "trialing" : "active",
          subscription_end_date: expiresAt,
          premium_source: premiumSourceFromStore(event.store),
          revenuecat_user_id: event.original_app_user_id ?? userId,
        })
        .eq("id", userId);
      if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      break;
    }

    case "BILLING_ISSUE": {
      const { error } = await supabase
        .from("users")
        .update({ subscription_status: "past_due" })
        .eq("id", userId);
      if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      break;
    }

    case "CANCELLATION":
    case "TRIAL_CANCELLED": {
      // El usuario canceló pero aún tiene acceso hasta expiration_at_ms.
      // No quitamos is_premium todavía — eso lo hace EXPIRATION.
      const { error } = await supabase
        .from("users")
        .update({ subscription_status: "canceled" })
        .eq("id", userId);
      if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      break;
    }

    case "EXPIRATION": {
      const { error } = await supabase
        .from("users")
        .update({
          is_premium: false,
          subscription_status: "expired",
        })
        .eq("id", userId);
      if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      break;
    }

    case "TEST":
      // RevenueCat dashboard test webhook — solo confirma 200
      break;
  }

  return new Response("ok", { status: 200 });
});
