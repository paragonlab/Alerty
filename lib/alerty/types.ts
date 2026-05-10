import type { ALERT_CATEGORIES, TIME_FILTERS } from "./constants";

export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export type TimeFilter = (typeof TIME_FILTERS)[number];

export type AlertMedia = {
  id: string;
  url: string;
  type: "image" | "video" | "audio";
};

export type AlertUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  trustScore: number;
  level: string;
  followersCount: number;
  themeMode?: "light" | "darkHighVisibility";
  pushEnabled?: boolean;
  lowConnection?: boolean;
  activeCategories?: string[];
  showHeatmap?: boolean;
  isPremium?: boolean;
};

export type AlertUpdate = {
  id: string;
  content: string;
  createdAt: string;
  user: AlertUser;
  media?: AlertMedia[];
};

export type AlertItem = {
  id: string;
  user: AlertUser;
  category: AlertCategory;
  lat: number;
  lng: number;
  title?: string;
  description?: string;
  createdAt: string;
  status: "active" | "resolved";
  media: AlertMedia[];
  upvotes: number;
  downvotes: number;
  neighborhood?: string;
  updates?: AlertUpdate[];
};

export type SponsoredZone = {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  logoUrl?: string;
  type: "refugio" | "anuncio";
};
