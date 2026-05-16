// Stripe → Supabase webhook. Maneja dos tipos de suscripciones:
//   1. B2B pin patrocinado (metadata.zone_id)  → tabla sponsored_zones
//   2. Consumer Plus en web    (metadata.user_id) → tabla users
//
// Setup:
//   supabase functions deploy stripe-webhook --no-verify-jwt
//   supabase secrets set STRIPE_SECRET_KEY=sk_test_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
// En Stripe Dashboard → Developers → Webhooks (crea uno solo):
//   URL: https://<project>.supabase.co/functions/v1/stripe-webhook
//   Eventos: checkout.session.completed, customer.subscription.updated,
//            customer.subscription.deleted, invoice.payment_failed

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

const WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

type MetaTarget =
  | { kind: "zone"; zoneId: string }
  | { kind: "user"; userId: string }
  | { kind: "none" };

const targetFromMetadata = (obj: { metadata?: Record<string, string> | null }): MetaTarget => {
  const m = obj.metadata ?? {};
  if (m.zone_id) return { kind: "zone", zoneId: m.zone_id };
  if (m.user_id) return { kind: "user", userId: m.user_id };
  return { kind: "none" };
};

const subscriptionStatusToSponsored = (status: Stripe.Subscription.Status): string => {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
};

const subscriptionStatusToUser = (status: Stripe.Subscription.Status): string => {
  if (status === "active") return "active";
  if (status === "trialing") return "trialing";
  if (status === "past_due" || status === "unpaid") return "past_due";
  return "canceled";
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const target = targetFromMetadata(session);
      if (target.kind === "none") break;

      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      let currentPeriodEnd: string | null = null;
      if (subscriptionId) {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
      }

      if (target.kind === "zone") {
        const { error } = await supabase
          .from("sponsored_zones")
          .update({
            status: "active",
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            current_period_end: currentPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.zoneId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      } else if (target.kind === "user") {
        const { error } = await supabase
          .from("users")
          .update({
            is_premium: true,
            stripe_customer_id: customerId,
            subscription_status: "active",
            subscription_end_date: currentPeriodEnd,
            premium_source: "stripe",
          })
          .eq("id", target.userId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const target = targetFromMetadata(sub);
      if (target.kind === "none") break;

      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

      if (target.kind === "zone") {
        const { error } = await supabase
          .from("sponsored_zones")
          .update({
            status: subscriptionStatusToSponsored(sub.status),
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", target.zoneId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      } else if (target.kind === "user") {
        const status = subscriptionStatusToUser(sub.status);
        const { error } = await supabase
          .from("users")
          .update({
            subscription_status: status,
            subscription_end_date: periodEnd,
            is_premium: status === "active" || status === "trialing",
          })
          .eq("id", target.userId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const target = targetFromMetadata(sub);
      if (target.kind === "zone") {
        const { error } = await supabase
          .from("sponsored_zones")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("id", target.zoneId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      } else if (target.kind === "user") {
        const { error } = await supabase
          .from("users")
          .update({
            is_premium: false,
            subscription_status: "expired",
          })
          .eq("id", target.userId);
        if (error) return new Response(`DB error: ${error.message}`, { status: 500 });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : null;
      if (!subscriptionId) break;

      await supabase
        .from("sponsored_zones")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", subscriptionId);

      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (customerId) {
        await supabase
          .from("users")
          .update({ subscription_status: "past_due" })
          .eq("stripe_customer_id", customerId);
      }
      break;
    }
  }

  return new Response("ok", { status: 200 });
});
