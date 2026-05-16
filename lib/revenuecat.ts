// RevenueCat wrapper para iOS/Android. La versión .web.ts redirige a Stripe Checkout.
import Purchases from "react-native-purchases";
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";
import { Platform } from "react-native";

export type { PurchasesPackage, CustomerInfo };

const apiKey = Platform.OS === "ios"
  ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
  : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY;

let initialized = false;

export const isRevenueCatConfigured = Boolean(apiKey);

export const initRevenueCat = async (userId: string) => {
  if (!apiKey || initialized) return;
  Purchases.configure({ apiKey, appUserID: userId });
  initialized = true;
};

export const identifyUser = async (userId: string) => {
  if (!apiKey) return;
  if (!initialized) await initRevenueCat(userId);
  else await Purchases.logIn(userId);
};

export const getOfferings = async (): Promise<PurchasesPackage[]> => {
  if (!apiKey) return [];
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
};

export const purchasePlus = async (
  pkg: PurchasesPackage,
): Promise<{ customerInfo: CustomerInfo; cancelled: boolean }> => {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, cancelled: false };
  } catch (e: any) {
    if (e?.userCancelled) {
      return { customerInfo: null as any, cancelled: true };
    }
    throw e;
  }
};

export const restorePurchases = async (): Promise<CustomerInfo | null> => {
  if (!apiKey) return null;
  return Purchases.restorePurchases();
};

export const hasActivePlus = (info: CustomerInfo): boolean => {
  return Boolean(info?.entitlements?.active?.["plus"]);
};
