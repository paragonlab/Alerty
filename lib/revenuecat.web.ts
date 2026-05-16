// Web fallback: en web no usamos RevenueCat. La compra Plus va a Stripe Checkout
// directamente via la edge function stripe-checkout-plus.
// Expone la misma API que la versión nativa.

import { supabase } from "./supabase";

export const isRevenueCatConfigured = true; // siempre "configurado" en web (usa Stripe directo)

export const initRevenueCat = async (_userId: string) => {};
export const identifyUser = async (_userId: string) => {};
export const restorePurchases = async () => null;
export const hasActivePlus = (_info: any) => false;

// En web ofrecemos un único "paquete" virtual con la suscripción Plus.
// El precio real vive en Stripe; aquí sólo es etiqueta.
export type PurchasesPackage = { identifier: "plus_monthly_web" };
export type CustomerInfo = any;

export const getOfferings = async (): Promise<PurchasesPackage[]> => {
  return [{ identifier: "plus_monthly_web" }];
};

export const purchasePlus = async (
  _pkg: PurchasesPackage,
): Promise<{ customerInfo: any; cancelled: boolean; redirectUrl?: string }> => {
  if (!supabase) {
    throw new Error("Supabase no configurado");
  }
  const { data, error } = await supabase.functions.invoke("stripe-checkout-plus", {
    method: "POST",
  });
  if (error) throw error;
  const url = (data as any)?.url as string | undefined;
  if (!url) throw new Error("No se pudo crear la sesión de pago");

  // En web abrimos directamente. La sesión vuelve via webhook.
  if (typeof window !== "undefined") {
    window.location.href = url;
  }

  return { customerInfo: null, cancelled: false, redirectUrl: url };
};
