import { create } from "zustand";
import type { AlertCategory, AlertItem, TimeFilter } from "./types";
import { ALERT_CATEGORIES } from "./constants";
import { baseAlerts, createRandomAlert } from "./mock";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type VoteType = "upvote" | "downvote";

type AlertyState = {
  alerts: AlertItem[];
  timeFilter: TimeFilter;
  activeCategories: AlertCategory[];
  lowConnection: boolean;
  pushEnabled: boolean;
  demoStarted: boolean;
  demoInterval: ReturnType<typeof setInterval> | null;
  realtimeStarted: boolean;
  realtimeChannel: RealtimeChannel | null;
  startDemo: () => void;
  stopDemo: () => void;
  startRealtime: () => void;
  addAlert: (alert: AlertItem) => void;
  voteAlert: (id: string, vote: VoteType) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleCategory: (category: AlertCategory) => void;
  setCategoryDefaults: (categories: AlertCategory[]) => void;
  setLowConnection: (value: boolean) => void;
  setPushEnabled: (value: boolean) => void;
  loadAlertsFromSupabase: () => Promise<void>;
};

export const useAlertyStore = create<AlertyState>((set, get) => ({
  alerts: [],
  timeFilter: "6h",
  activeCategories: [...ALERT_CATEGORIES],
  lowConnection: false,
  pushEnabled: true,
  demoStarted: false,
  demoInterval: null,
  realtimeStarted: false,
  realtimeChannel: null,
  startDemo: () => {
    const { demoStarted, demoInterval, alerts } = get();
    if (demoStarted) return;

    if (alerts.length === 0) {
      set({ alerts: baseAlerts });
    }

    const interval = setInterval(() => {
      set((state) => ({ alerts: [createRandomAlert(), ...state.alerts] }));
    }, 45000);

    set({ demoStarted: true, demoInterval: interval });
  },
  stopDemo: () => {
    const { demoInterval } = get();
    if (demoInterval) clearInterval(demoInterval);
    set({ demoInterval: null, demoStarted: false });
  },
  startRealtime: () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { realtimeStarted } = get();
    if (realtimeStarted) return;

    const channel = supabase.channel("alerty-feed");

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "alerts" },
      async (payload) => {
        const row = payload.new as any;
        const { data: userData } = await supabase
          .from("users")
          .select("id,username,avatar_url,is_verified,trust_score,followers_count")
          .eq("id", row.user_id)
          .maybeSingle();

        const alert: AlertItem = {
          id: row.id,
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          description: row.description ?? undefined,
          createdAt: row.created_at,
          status: row.status ?? "active",
          neighborhood: undefined,
          upvotes: 0,
          downvotes: 0,
          media: [],
          user: {
            id: userData?.id ?? row.user_id ?? "unknown",
            username: userData?.username ?? "@anon",
            avatarUrl: userData?.avatar_url ?? null,
            isVerified: Boolean(userData?.is_verified),
            trustScore: Number(userData?.trust_score ?? 0.5),
            followersCount: Number(userData?.followers_count ?? 0),
          },
        };

        set((state) => ({ alerts: [alert, ...state.alerts] }));
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "media" },
      (payload) => {
        const row = payload.new as any;
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === row.alert_id
              ? {
                  ...alert,
                  media: [
                    ...alert.media,
                    { id: row.id, url: row.media_url, type: row.media_type },
                  ],
                }
              : alert,
          ),
        }));
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "verifications" },
      (payload) => {
        const row = payload.new as any;
        set((state) => ({
          alerts: state.alerts.map((alert) => {
            if (alert.id !== row.alert_id) return alert;
            if (row.vote_type === "upvote") {
              return { ...alert, upvotes: alert.upvotes + 1 };
            }
            return { ...alert, downvotes: alert.downvotes + 1 };
          }),
        }));
      },
    );

    channel.subscribe();
    set({ realtimeStarted: true, realtimeChannel: channel });
  },
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  voteAlert: (id, vote) => {
    set((state) => ({
      alerts: state.alerts.map((alert) => {
        if (alert.id !== id) return alert;
        if (vote === "upvote") {
          return { ...alert, upvotes: alert.upvotes + 1 };
        }
        return { ...alert, downvotes: alert.downvotes + 1 };
      }),
    }));

    if (!isSupabaseConfigured || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      void supabase.from("verifications").insert({
        alert_id: id,
        user_id: userId,
        vote_type: vote,
      });
    });
  },
  setTimeFilter: (filter) => set({ timeFilter: filter }),
  toggleCategory: (category) =>
    set((state) => {
      const isActive = state.activeCategories.includes(category);
      return {
        activeCategories: isActive
          ? state.activeCategories.filter((item) => item !== category)
          : [...state.activeCategories, category],
      };
    }),
  setCategoryDefaults: (categories) => set({ activeCategories: categories }),
  setLowConnection: (value) => set({ lowConnection: value }),
  setPushEnabled: (value) => set({ pushEnabled: value }),
  loadAlertsFromSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data } = await supabase
      .from("alerts")
      .select(
        "id,category,lat,lng,description,created_at,status,users(id,username,avatar_url,is_verified,trust_score,followers_count),media(id,media_url,media_type)"
      )
      .order("created_at", { ascending: false })
      .limit(120);

    if (!data || data.length === 0) {
      set({ alerts: baseAlerts });
      get().startDemo();
      return;
    }

    const parsed: AlertItem[] = data.map((row: any) => ({
      id: row.id,
      category: row.category,
      lat: row.lat,
      lng: row.lng,
      description: row.description ?? undefined,
      createdAt: row.created_at,
      status: row.status ?? "active",
      neighborhood: undefined,
      upvotes: 0,
      downvotes: 0,
      media: (row.media ?? []).map((media: any) => ({
        id: media.id,
        url: media.media_url,
        type: media.media_type,
      })),
      user: {
        id: row.users?.id ?? "unknown",
        username: row.users?.username ?? "@anon",
        avatarUrl: row.users?.avatar_url ?? null,
        isVerified: Boolean(row.users?.is_verified),
        trustScore: Number(row.users?.trust_score ?? 0.5),
        followersCount: Number(row.users?.followers_count ?? 0),
      },
    }));

    set({ alerts: parsed });
  },
}));
