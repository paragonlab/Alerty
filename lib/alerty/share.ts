import { Platform, Share } from "react-native";
import { GO_OUT_LABEL, RISK_LABEL, type RiskAssessment } from "./risk";

export const APP_SHARE_URL = "https://alerty-two.vercel.app";

export const zoneShareMessage = (
  assessment: RiskAssessment,
  placeLabel: string,
  pulseCount: number,
  windowLabel: string,
): string => {
  const pulses =
    pulseCount === 0
      ? `Sin pulsos cerca (${windowLabel})`
      : `${pulseCount} ${pulseCount === 1 ? "pulso" : "pulsos"} cerca (${windowLabel})`;
  return [
    `Pulso · ${placeLabel}`,
    `${GO_OUT_LABEL[assessment.level]} · ${RISK_LABEL[assessment.level]}`,
    `${pulses} · comunidad y noticieros`,
    `Mira el mapa: ${APP_SHARE_URL}`,
  ].join("\n");
};

export const shareZonePulse = async (
  assessment: RiskAssessment,
  placeLabel: string,
  pulseCount: number,
  windowLabel: string,
): Promise<void> => {
  const message = zoneShareMessage(assessment, placeLabel, pulseCount, windowLabel);
  await Share.share(
    Platform.OS === "web"
      ? { message, title: "Pulso", url: APP_SHARE_URL }
      : { message },
  );
};
