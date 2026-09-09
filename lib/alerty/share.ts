import { Alert, Platform, Share } from "react-native";
import { GO_DEST_LABEL, GO_OUT_LABEL, RISK_LABEL, type RiskAssessment } from "./risk";

export const APP_SHARE_URL = "https://alerty-two.vercel.app";
export const APP_PRIVACY_URL = `${APP_SHARE_URL}/privacy`;

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

export async function shareAlertPulse(opts: {
  title: string;
  neighborhood?: string | null;
  alertId?: string;
}): Promise<void> {
  const url = opts.alertId ? `${APP_SHARE_URL}/alert/${opts.alertId}` : APP_SHARE_URL;
  const headline = `Alerta en Pulso: ${opts.title} · ${opts.neighborhood ?? "Culiacán"}`;
  const message = `${headline}\n${url}`;
  try {
    if (Platform.OS === "web" && typeof navigator !== "undefined") {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Pulso", text: headline, url });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(message);
        Alert.alert("Enlace copiado", "Pégalo en WhatsApp, X o donde quieras.");
        return;
      }
    }
    await Share.share(Platform.OS === "web" ? { message, title: "Pulso", url } : { message });
  } catch {
    /* el usuario canceló o el navegador bloqueó share */
  }
}
