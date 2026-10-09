import { Alert, Platform, Share } from "react-native";
import { getActiveCityName } from "./city";
import { GO_DEST_LABEL, GO_OUT_LABEL, RISK_LABEL, type RiskAssessment } from "./risk";
import {
  buildShareCardModel,
  shareCardDataUrl,
  sharePulseMessage,
  type ShareCardInput,
} from "./shareCard";
import { familyInviteMessage, type FamilyInviteParams } from "./familyInvite";
import {
  APP_SHARE_URL,
  APP_PRIVACY_URL,
  alertDeepLink,
  dailySummaryShareMessage,
  pulsePublicUrl,
} from "./shareCore";

export {
  APP_SHARE_URL,
  APP_PRIVACY_URL,
  alertDeepLink,
  dailySummaryShareMessage,
  pulsePublicUrl,
};

export const zoneShareMessage = (
  assessment: RiskAssessment,
  placeLabel: string,
  pulseCount: number,
  windowLabel: string,
  destination?: boolean,
): string => {
  const pulses =
    pulseCount === 0
      ? `Sin pulsos cerca (${windowLabel})`
      : `${pulseCount} ${pulseCount === 1 ? "pulso" : "pulsos"} cerca (${windowLabel})`;
  const verdict = destination
    ? `${GO_DEST_LABEL[assessment.level]} · ${placeLabel}`
    : `${GO_OUT_LABEL[assessment.level]} · ${RISK_LABEL[assessment.level]}`;
  return [
    destination ? `Pulso · ¿Es prudente ir a ${placeLabel}?` : `Pulso · ${placeLabel}`,
    verdict,
    `${pulses} · comunidad y noticieros`,
    `Mira el mapa: ${APP_SHARE_URL}`,
  ].join("\n");
};

export const shareZonePulse = async (
  assessment: RiskAssessment,
  placeLabel: string,
  pulseCount: number,
  windowLabel: string,
  destination?: boolean,
): Promise<void> => {
  const message = zoneShareMessage(assessment, placeLabel, pulseCount, windowLabel, destination);
  await Share.share(
    Platform.OS === "web"
      ? { message, title: "Pulso", url: APP_SHARE_URL }
      : { message },
  );
};

async function copyFallback(message: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(message);
    Alert.alert("Enlace copiado", "Pégalo en WhatsApp o donde quieras.");
    return;
  }
  await Share.share({ message, title: "Pulso" });
}

/**
 * Comparte un pulso: mensaje calmado + link /p/<id>.
 * En web intenta Web Share API (con imagen SVG si el navegador la acepta);
 * si no, copia el link. En nativo abre el share sheet (WhatsApp incluido).
 */
export async function shareAlertPulse(opts: {
  title: string;
  neighborhood?: string | null;
  alertId?: string;
  category?: string;
  status?: "active" | "resolved";
  cityName?: string;
  kind?: "alert" | "community";
}): Promise<void> {
  const cityName = opts.cityName ?? getActiveCityName();
  const input: ShareCardInput = {
    id: opts.alertId ?? "pulso",
    category: opts.category ?? "otro",
    title: opts.title,
    placeLabel: opts.neighborhood,
    cityName,
    status: opts.status,
    kind: opts.kind ?? "alert",
  };
  const model = buildShareCardModel(input);
  const message = sharePulseMessage(model);
  const url = opts.alertId ? model.url : APP_SHARE_URL;

  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      const dataUrl = shareCardDataUrl(model);
      if (typeof navigator.share === "function") {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], "pulso.svg", { type: "image/svg+xml" });
          const canFiles =
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] });
          if (canFiles) {
            await navigator.share({
              title: "Pulso",
              text: message,
              url,
              files: [file],
            });
            return;
          }
        } catch {
          /* sigue con share sin archivo */
        }
        await navigator.share({ title: "Pulso", text: message, url });
        return;
      }
      await copyFallback(message);
      return;
    }

    await Share.share(
      Platform.OS === "web" ? { message, title: "Pulso", url } : { message },
    );
  } catch {
    /* el usuario canceló o el navegador bloqueó share */
  }
}

/** Abre WhatsApp (app o wa.me) con el texto del pulso. */
export async function shareAlertToWhatsApp(opts: {
  title: string;
  neighborhood?: string | null;
  alertId: string;
  category?: string;
  status?: "active" | "resolved";
  cityName?: string;
  kind?: "alert" | "community";
}): Promise<void> {
  const cityName = opts.cityName ?? getActiveCityName();
  const model = buildShareCardModel({
    id: opts.alertId,
    category: opts.category ?? "otro",
    title: opts.title,
    placeLabel: opts.neighborhood,
    cityName,
    status: opts.status,
    kind: opts.kind ?? "alert",
  });
  const text = sharePulseMessage(model);
  const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;

  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.open(wa, "_blank", "noopener,noreferrer");
    return;
  }

  try {
    const Linking = await import("expo-linking");
    const can = await Linking.canOpenURL(wa);
    if (can) {
      await Linking.openURL(wa);
      return;
    }
  } catch {
    /* fallback share sheet */
  }
  await Share.share({ message: text });
}

export async function shareFamilyInvite(params: FamilyInviteParams): Promise<void> {
  const message = familyInviteMessage(params);
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pulso", text: message });
        return;
      }
      await copyFallback(message);
      return;
    }
    await Share.share({ message });
  } catch {
    /* cancelado */
  }
}

export async function shareDailySummary(
  opts: Parameters<typeof dailySummaryShareMessage>[0],
): Promise<void> {
  const message = dailySummaryShareMessage(opts);
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pulso", text: message, url: APP_SHARE_URL });
        return;
      }
      await copyFallback(message);
      return;
    }
    await Share.share({ message });
  } catch {
    /* cancelado */
  }
}
