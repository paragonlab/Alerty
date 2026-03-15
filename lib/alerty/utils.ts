import type { Theme } from "../theme";
import type { AlertCategory, AlertItem, TimeFilter } from "./types";

export const getAlertAgeMinutes = (createdAt: string) =>
  Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));

export const formatRelativeTime = (createdAt: string) => {
  const minutes = getAlertAgeMinutes(createdAt);
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} d`;
};

export const isAlertInWindow = (alert: AlertItem, filter: TimeFilter) => {
  const minutes = getAlertAgeMinutes(alert.createdAt);
  switch (filter) {
    case "1h":
      return minutes <= 60;
    case "6h":
      return minutes <= 360;
    case "24h":
      return minutes <= 1440;
    case "7d":
      return minutes <= 10080;
    case "todo":
      return true;
    default:
      return true;
  }
};

export const getIntensityColor = (createdAt: string, theme: Theme) => {
  const minutes = getAlertAgeMinutes(createdAt);
  if (minutes <= 30) return theme.colors.mapRed;
  if (minutes <= 180) return theme.colors.mapOrange;
  return theme.colors.mapYellow;
};

export const getCategoryColor = (category: AlertCategory, theme: Theme) => {
  switch (category) {
    case "balacera":
    case "narcobloqueo":
    case "enfrentamiento":
    case "detonaciones":
      return theme.colors.mapRed;
    case "zona segura":
      return theme.colors.success;
    case "bloqueo":
    case "captura":
    case "robo":
    case "accidente":
    default:
      return theme.colors.mapYellow;
  }
};

export const getPulseDuration = (createdAt: string) => {
  const minutes = getAlertAgeMinutes(createdAt);
  if (minutes <= 30) return 1100;
  if (minutes <= 180) return 1700;
  return 2400;
};

export const shouldSuppressAlert = (alert: AlertItem) =>
  alert.downvotes >= 3 && alert.downvotes > alert.upvotes;
