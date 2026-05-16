-- Tracking de suscripciones para soportar RevenueCat (mobile IAP) y Stripe (web)

alter table public.users
  add column if not exists revenuecat_user_id text,
  add column if not exists subscription_status text,
  add column if not exists subscription_end_date timestamptz,
  add column if not exists premium_source text;

alter table public.users
  drop constraint if exists users_subscription_status_check;

alter table public.users
  add constraint users_subscription_status_check
  check (subscription_status is null or subscription_status in (
    'active', 'trialing', 'past_due', 'canceled', 'expired'
  ));

alter table public.users
  drop constraint if exists users_premium_source_check;

alter table public.users
  add constraint users_premium_source_check
  check (premium_source is null or premium_source in (
    'stripe', 'app_store', 'play_store', 'promo'
  ));

create index if not exists users_revenuecat_idx on public.users (revenuecat_user_id);
create index if not exists users_stripe_customer_idx on public.users (stripe_customer_id);
