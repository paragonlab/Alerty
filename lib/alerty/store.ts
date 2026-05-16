import { create } from "zustand";
import type { AlertCategory, AlertItem, AlertUpdate, SponsoredZone, TimeFilter } from "./types";
import { ALERT_CATEGORIES, REPUTATION_LEVELS } from "./constants";
import { baseAlerts, createRandomAlert } from "./mock";
import { isSupabaseConfigured, supabase } from "../supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AlertUser } from "./types";

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
  followingAlertIds: string[];
  votedAlerts: Record<string, "upvote" | "downvote">;
  maxReportingDistance: number; // in km
  sosActive: boolean;
  showHeatmap: boolean;
  sosWarningAccepted: boolean;
  themeMode: "light" | "darkHighVisibility";
  currentUser: AlertUser;
  startDemo: () => void;
  stopDemo: () => void;
  startRealtime: () => (() => void) | undefined;
  addAlert: (alert: AlertItem) => void;
  voteAlert: (id: string, vote: VoteType) => void;
  setTimeFilter: (filter: TimeFilter) => void;
  toggleCategory: (category: AlertCategory) => void;
  setCategoryDefaults: (categories: AlertCategory[]) => void;
  setLowConnection: (value: boolean) => void;
  setPushEnabled: (value: boolean) => void;
  loadAlertsFromSupabase: () => Promise<void>;
  toggleFollowAlert: (id: string) => void;
  addUpdateToAlert: (alertId: string, content: string) => Promise<void>;
  setMaxReportingDistance: (distance: number) => void;
  setSOSActive: (active: boolean) => void;
  setShowHeatmap: (show: boolean) => void;
  setSosWarningAccepted: (accepted: boolean) => void;
  setThemeMode: (mode: "light" | "darkHighVisibility") => void;
  updateUserScore: (score: number) => void;
  getReportingRange: () => number;
  loadUserProfile: () => Promise<void>;
  updateUsername: (newUsername: string) => Promise<{ error: string | null }>;
  recomputeVerifiedStatus: () => void;
  sponsoredZones: SponsoredZone[];
  loadSponsoredZones: () => Promise<void>;
};

const syncPreference = async (key: string, value: any) => {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  
  await supabase.from("users").update({ [key]: value }).eq("id", session.user.id);
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
  followingAlertIds: [],
  votedAlerts: {},
  maxReportingDistance: 2.0,
  sosActive: false,
  showHeatmap: false,
  sosWarningAccepted: false,
  themeMode: "light",
  currentUser: {
    id: "local-user",
    username: "@DemoUser",
    avatarUrl: null,
    isVerified: false,
    trustScore: 10,
    level: "CIUDADANO",
    followersCount: 0,
  },
  sponsoredZones: [],
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
        const { data: userData } = await supabase!
          .from("users")
          .select("id,username,avatar_url,is_verified,trust_score,followers_count")
          .eq("id", row.user_id)
          .maybeSingle();

        const alert: AlertItem = {
          id: row.id,
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          title: row.title ?? undefined,
          description: row.description ?? undefined,
          createdAt: row.created_at,
          status: row.status ?? "active",
          neighborhood: undefined,
          upvotes: 0,
          downvotes: 0,
          media: [],
          updates: [],
          user: {
            id: userData?.id ?? row.user_id ?? "unknown",
            username: userData?.username ?? "@anon",
            avatarUrl: userData?.avatar_url ?? null,
            isVerified: Boolean(userData?.is_verified),
            trustScore: Number(userData?.trust_score ?? 0.5),
            level: "CIUDADANO",
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
      { event: "INSERT", schema: "public", table: "alert_updates" },
      async (payload) => {
        const row = payload.new as any;
        const { data: userData } = await supabase!
          .from("users")
          .select("id,username,avatar_url,is_verified,trust_score,followers_count")
          .eq("id", row.user_id)
          .maybeSingle();

        const update: AlertUpdate = {
          id: row.id,
          content: row.content,
          createdAt: row.created_at,
          user: {
            id: userData?.id ?? row.user_id,
            username: userData?.username ?? "@anon",
            avatarUrl: userData?.avatar_url ?? null,
            isVerified: Boolean(userData?.is_verified),
            trustScore: Number(userData?.trust_score ?? 0.5),
            level: "CIUDADANO",
            followersCount: Number(userData?.followers_count ?? 0),
          },
        };

        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === row.alert_id
              ? { ...alert, updates: [update, ...(alert.updates || [])] }
              : alert
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

    return () => {
      if (supabase) supabase.removeChannel(channel);
      set({ realtimeStarted: false, realtimeChannel: null });
    };
  },
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
  recomputeVerifiedStatus: () => {
    const { alerts, currentUser } = get();
    const myAlerts = alerts.filter((a) => a.user.id === currentUser.id);
    if (myAlerts.length < 10) return;

    const totalUpvotes = myAlerts.reduce((acc, a) => acc + a.upvotes, 0);
    const totalVotes = myAlerts.reduce((acc, a) => acc + a.upvotes + a.downvotes, 0);
    const ratio = totalVotes > 0 ? totalUpvotes / totalVotes : 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFalse = myAlerts.some(
      (a) => new Date(a.createdAt) > thirtyDaysAgo && a.downvotes > a.upvotes,
    );

    const isVerified = ratio >= 0.7 && !recentFalse;
    if (isVerified !== currentUser.isVerified) {
      set((state) => ({ currentUser: { ...state.currentUser, isVerified } }));
    }
  },
  voteAlert: (id, vote) => {
    if (get().votedAlerts[id]) return;

    set((state) => ({
      votedAlerts: { ...state.votedAlerts, [id]: vote },
      alerts: state.alerts.map((alert) => {
        if (alert.id !== id) return alert;
        if (vote === "upvote") return { ...alert, upvotes: alert.upvotes + 1 };
        return { ...alert, downvotes: alert.downvotes + 1 };
      }),
    }));
    get().recomputeVerifiedStatus();

    if (!isSupabaseConfigured || !supabase) return;
    void supabase.auth.getUser().then(({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      void supabase!.from("verifications").insert({
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
      const newCategories = isActive
        ? state.activeCategories.filter((item) => item !== category)
        : [...state.activeCategories, category];
      syncPreference("active_categories", newCategories);
      return { activeCategories: newCategories };
    }),
  setCategoryDefaults: (categories) => {
    set({ activeCategories: categories });
    syncPreference("active_categories", categories);
  },
  setLowConnection: (value) => {
    set({ lowConnection: value });
    syncPreference("low_connection", value);
  },
  setPushEnabled: (value) => {
    set({ pushEnabled: value });
    syncPreference("push_enabled", value);
  },
  loadUserProfile: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (data) {
      set((state) => ({
        currentUser: {
          ...state.currentUser,
          id: data.id,
          username: data.username,
          avatarUrl: data.avatar_url,
          isVerified: Boolean(data.is_verified),
          trustScore: Number(data.trust_score),
          followersCount: Number(data.followers_count),
          themeMode: data.theme_mode,
          pushEnabled: data.push_enabled,
          lowConnection: data.low_connection,
          activeCategories: data.active_categories,
          showHeatmap: data.show_heatmap,
          isPremium: data.is_premium,
        },
        themeMode: data.theme_mode ?? state.themeMode,
        pushEnabled: data.push_enabled ?? state.pushEnabled,
        lowConnection: data.low_connection ?? state.lowConnection,
        activeCategories: data.active_categories ?? state.activeCategories,
        showHeatmap: data.show_heatmap ?? state.showHeatmap,
      }));
    }
  },
  loadSponsoredZones: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data, error } = await supabase
      .from("sponsored_zones")
      .select("id,name,description,lat,lng,type,logo_url")
      .eq("status", "active");
    if (error || !data) return;
    const zones: SponsoredZone[] = data.map((row: any) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      lat: row.lat,
      lng: row.lng,
      type: row.type,
      logoUrl: row.logo_url ?? undefined,
    }));
    set({ sponsoredZones: zones });
  },
  updateUsername: async (newUsername) => {
    if (!isSupabaseConfigured || !supabase) return { error: "Sin conexión" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: "No autenticado" };

    if (!/^@[a-zA-Z0-9_]{3,19}$/.test(newUsername)) {
      return { error: "Usa @ + 3-19 letras, números o _" };
    }

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", newUsername)
      .maybeSingle();
    if (existing && existing.id !== session.user.id) {
      return { error: "Ese nombre ya está en uso" };
    }

    const { error } = await supabase
      .from("users")
      .update({ username: newUsername })
      .eq("id", session.user.id);
    if (error) return { error: "No se pudo guardar. Intenta de nuevo." };

    set((state) => ({
      currentUser: { ...state.currentUser, username: newUsername },
    }));
    return { error: null };
  },
  loadAlertsFromSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    
    // Load follows first if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: follows } = await supabase
        .from("alert_follows")
        .select("alert_id")
        .eq("user_id", user.id);
      
      if (follows) {
        set({ followingAlertIds: follows.map(f => f.alert_id) });
      }

      const { data: myVotes } = await supabase
        .from("verifications")
        .select("alert_id, vote_type")
        .eq("user_id", user.id);

      if (myVotes) {
        const votedAlerts: Record<string, "upvote" | "downvote"> = {};
        myVotes.forEach((v: any) => { votedAlerts[v.alert_id] = v.vote_type; });
        set({ votedAlerts });
      }
    }

    const { data } = await supabase
      .from("alerts")
      .select(`
        id,category,lat,lng,title,description,created_at,status,
        users(id,username,avatar_url,is_verified,is_premium,trust_score,followers_count),
        media(id,media_url,media_type),
        alert_updates(id,content,created_at,user_id,users(id,username,avatar_url,is_verified,is_premium))
      `)
      .order("created_at", { ascending: false })
      .limit(100);

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
      title: row.title ?? undefined,
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
      updates: (row.alert_updates ?? []).map((upd: any) => ({
        id: upd.id,
        content: upd.content,
        createdAt: upd.created_at,
          user: {
            id: upd.users?.id ?? upd.user_id,
            username: upd.users?.username ?? "@anon",
            avatarUrl: upd.users?.avatar_url ?? null,
            isVerified: Boolean(upd.users?.is_verified),
            isPremium: Boolean(upd.users?.is_premium),
            trustScore: Number(upd.users?.trust_score ?? 0.5),
            level: "CIUDADANO",
            followersCount: Number(upd.users?.followers_count ?? 0),
          },
      })).sort((a: AlertUpdate, b: AlertUpdate) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      user: {
        id: row.users?.id ?? "unknown",
        username: row.users?.username ?? "@anon",
        avatarUrl: row.users?.avatar_url ?? null,
        isVerified: Boolean(row.users?.is_verified),
        isPremium: Boolean(row.users?.is_premium),
        trustScore: Number(row.users?.trust_score ?? 0.5),
        level: "CIUDADANO",
        followersCount: Number(row.users?.followers_count ?? 0),
      },
    }));

    set({ alerts: parsed });
    get().recomputeVerifiedStatus();
  },
  toggleFollowAlert: async (id) => {
    if (!isSupabaseConfigured || !supabase) {
      set((state) => ({
        followingAlertIds: state.followingAlertIds.includes(id)
          ? state.followingAlertIds.filter((fid) => fid !== id)
          : [...state.followingAlertIds, id],
      }));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const isFollowing = get().followingAlertIds.includes(id);

    if (isFollowing) {
      set((state) => ({ followingAlertIds: state.followingAlertIds.filter(fid => fid !== id) }));
      await supabase.from("alert_follows").delete().eq("alert_id", id).eq("user_id", user.id);
    } else {
      set((state) => ({ followingAlertIds: [...state.followingAlertIds, id] }));
      await supabase.from("alert_follows").insert({ alert_id: id, user_id: user.id });
    }
  },
  addUpdateToAlert: async (alertId, content) => {
    if (!isSupabaseConfigured || !supabase) {
      set((state) => ({
        alerts: state.alerts.map((alert) => {
          if (alert.id !== alertId) return alert;
          const newUpdate: AlertUpdate = {
            id: `upd-${Date.now()}`,
            content,
            createdAt: new Date().toISOString(),
            user: {
          id: "local-user",
          username: "@DemoUser",
          avatarUrl: null,
          isVerified: false,
          trustScore: 0.1,
          level: "CIUDADANO",
          followersCount: 0,
        },
          };
          return {
            ...alert,
            updates: [newUpdate, ...(alert.updates ?? [])],
          };
        }),
      }));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("alert_updates")
      .insert({
        alert_id: alertId,
        user_id: user.id,
        content: content,
      })
      .select("*, users(id,username,avatar_url,is_verified)")
      .single();

    if (error) {
      console.error("Error adding update:", error);
      return;
    }

    const newUpdate: AlertUpdate = {
      id: data.id,
      content: data.content,
      createdAt: data.created_at,
      user: {
        id: data.users?.id ?? user.id,
        username: data.users?.username ?? "@me",
        avatarUrl: data.users?.avatar_url ?? null,
        isVerified: Boolean(data.users?.is_verified),
        trustScore: Number(data.users?.trust_score ?? 1.0),
        level: (get().currentUser.level) || "CIUDADANO",
        followersCount: Number(data.users?.followers_count ?? 0),
      },
    };

    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId
          ? { ...alert, updates: [newUpdate, ...(alert.updates ?? [])] }
          : alert
      ),
    }));
  },
  setMaxReportingDistance: (distance) => set({ maxReportingDistance: distance }),
  setSOSActive: (active) => set({ sosActive: active }),
  setShowHeatmap: (show) => {
    set({ showHeatmap: show });
    syncPreference("show_heatmap", show);
  },
  setSosWarningAccepted: (accepted) => set({ sosWarningAccepted: accepted }),
  setThemeMode: (mode) => {
    set({ themeMode: mode });
    syncPreference("theme_mode", mode);
  },
  updateUserScore: (score) => {
    set((state) => {
      const newScore = Math.max(0, Math.min(100, state.currentUser.trustScore + score));
      let newLevel: string = "CIUDADANO";
      
      if (newScore >= REPUTATION_LEVELS.HEROE.minScore) newLevel = "HEROE";
      else if (newScore >= REPUTATION_LEVELS.PROTECTOR.minScore) newLevel = "PROTECTOR";
      else if (newScore >= REPUTATION_LEVELS.VIGIA.minScore) newLevel = "VIGIA";
      
      return {
        currentUser: { ...state.currentUser, trustScore: newScore, level: newLevel }
      };
    });
  },
  getReportingRange: () => {
    const { currentUser } = get();
    const level = (currentUser.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
    return REPUTATION_LEVELS[level].range;
  },
}));
