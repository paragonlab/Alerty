import { theme } from "../theme";
import type { AlertItem, TimeFilter } from "./types";

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
    default:
      return true;
  }
};

export const getIntensityColor = (createdAt: string) => {
  const minutes = getAlertAgeMinutes(createdAt);
  if (minutes <= 30) return theme.colors.mapRed;
  if (minutes <= 180) return theme.colors.mapOrange;
  return theme.colors.mapYellow;
};

export const getPulseDuration = (createdAt: string) => {
  const minutes = getAlertAgeMinutes(createdAt);
  if (minutes <= 30) return 1100;
  if (minutes <= 180) return 1700;
  return 2400;
};

export const shouldSuppressAlert = (alert: AlertItem) =>
  alert.downvotes >= 3 && alert.downvotes > alert.upvotes;

export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
