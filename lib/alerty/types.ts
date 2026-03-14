import type { ALERT_CATEGORIES, TIME_FILTERS } from "./constants";

export type AlertCategory = (typeof ALERT_CATEGORIES)[number];
export type TimeFilter = (typeof TIME_FILTERS)[number];

export type AlertMedia = {
  id: string;
  url: string;
  type: "image" | "video";
};

export type AlertUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  trustScore: number;
  followersCount: number;
};

export type AlertItem = {
  id: string;
  user: AlertUser;
  category: AlertCategory;
  lat: number;
  lng: number;
  description?: string;
  createdAt: string;
  status: "active" | "resolved";
  media: AlertMedia[];
  upvotes: number;
  downvotes: number;
  neighborhood?: string;
};
