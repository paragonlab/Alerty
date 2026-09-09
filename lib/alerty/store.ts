import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  AlertCategory,
  AlertItem,
  AlertMedia,
  AlertUpdate,
  CommunityPost,
  SponsoredZone,
  TimeFilter,
  WatchedZone,
} from "./types";
import { ALERT_CATEGORIES, REPUTATION_LEVELS, getLevelProgress } from "./constants";
import { canAddCirculoZone } from "./circulo";
import { baseAlerts, createRandomAlert, demoCommunityPosts, isDemoEnabled } from "./mock";
import { matchInboxAlert, type UserCoords } from "./utils";
import { isOtherSinaloaCityStory } from "./coloniaGeocode";
import { isSupabaseConfigured, supabase } from "../supabase";
import { uploadMediaBatch } from "../upload";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { AlertUser } from "./types";

const mapCommunityRow = (row: any): CommunityPost => {
  const hasGeo =
    typeof row.lat === "number" &&
    typeof row.lng === "number" &&
    Number.isFinite(row.lat) &&
    Number.isFinite(row.lng);
  const source = row.source === "rss" ? "rss" : "x";
  const rawTier = row.trust_tier;
  const trustTier: CommunityPost["trustTier"] =
    rawTier === "medio" || rawTier === "oficial" || rawTier === "news" || rawTier === "community"
      ? rawTier
      : source === "rss"
        ? "news"
        : "community";
  return {
    id: row.id,
    source,
    externalId: row.external_id,
    authorHandle: row.author_handle?.startsWith("@")
      ? row.author_handle
      : `@${row.author_handle ?? "desconocido"}`,
    authorName: row.author_name ?? null,
    text: row.text,
    url: row.url,
    mediaUrl: row.media_url ?? null,
    authorAvatarUrl: row.author_avatar_url ?? null,
    // Sin geo usable → null (Feed sí; mapa no). No centrar en Culiacán artificialmente.
    lat: hasGeo ? row.lat : null,
    lng: hasGeo ? row.lng : null,
    placeLabel: row.place_label ?? (source === "rss" ? "Sinaloa (noticia)" : "Culiacán (X)"),
    geoSource:
      row.geo_source === "tweet_coords" ||
      row.geo_source === "place_bbox" ||
      row.geo_source === "text_colonia" ||
      row.geo_source === "none"
        ? row.geo_source
        : null,
    placeNameSource: row.place_name_source ?? null,
    geocodedFromText: row.geocoded_from_text ?? null,
    createdAt: row.created_at,
    fetchedAt: row.fetched_at ?? row.created_at,
    categoryGuess: row.category_guess ?? null,
    isDemo: Boolean(row.is_demo),
    trustTier,
  };
};

type VoteType = "upvote" | "downvote";

type AlertyState = {
  alerts: AlertItem[];
  communityPosts: CommunityPost[];
  alertsLoaded: boolean;
  communityLoaded: boolean;
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
  loadCommunityPosts: (opts?: { refreshNews?: boolean }) => Promise<void>;
  toggleFollowAlert: (id: string) => void;
  addUpdateToAlert: (alertId: string, content: string, media?: AlertMedia[]) => Promise<void>;
  addAngleAlert: (parentAlertId: string, video: AlertMedia) => Promise<void>;
  setMaxReportingDistance: (distance: number) => void;
  setSOSActive: (active: boolean) => void;
  setShowHeatmap: (show: boolean) => void;
  setSosWarningAccepted: (accepted: boolean) => void;
  setThemeMode: (mode: "light" | "darkHighVisibility") => void;
  updateUserScore: (score: number) => void;
  getReportingRange: () => number;
  loadUserProfile: () => Promise<void>;
  resetGuest: () => void;
  updateUsername: (newUsername: string) => Promise<{ error: string | null }>;
  updateAvatar: (avatarUrl: string) => Promise<{ error: string | null }>;
  recomputeVerifiedStatus: () => void;
  sponsoredZones: SponsoredZone[];
  loadSponsoredZones: () => Promise<void>;
  watchedZones: WatchedZone[];
  loadWatchedZones: () => Promise<void>;
  addWatchedZone: (input: {
    label: string;
    lat: number;
    lng: number;
  }) => Promise<{ error: string | null }>;
  deleteWatchedZone: (id: string) => Promise<{ error: string | null }>;
  feedViewMode: "list" | "reels";
  setFeedViewMode: (mode: "list" | "reels") => void;
  reelsInitialAlertId: string | null;
  openReels: (alertId: string | null) => void;
  unreadAlerts: number;
  clearUnreadAlerts: () => void;
  userCoords: UserCoords | null;
  setUserCoords: (coords: UserCoords | null) => void;
};

const syncPreference = async (key: string, value: any) => {
  if (!isSupabaseConfigured || !supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  
  await supabase.from("users").update({ [key]: value }).eq("id", session.user.id);
};

// Los IDs de alertas demo/locales (seed-, live-, local-) no son UUID y no
// existen en la base de datos — sus mutaciones se quedan solo en memoria.
const isDbId = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

const COMMUNITY_POST_COLUMNS =
  "id,source,external_id,author_handle,author_name,text,url,media_url,author_avatar_url,lat,lng,place_label,geo_source,place_name_source,geocoded_from_text,created_at,fetched_at,category_guess,is_demo,trust_tier";

const NEWS_SYNC_MIN_MS = 2 * 60 * 1000;
let lastNewsSyncAt = 0;
let newsSyncInflight: Promise<void> | null = null;

const FEED_CACHE_KEY = "alerty.feed.v1";

const persistFeedCache = (alerts: AlertItem[], communityPosts: CommunityPost[]) => {
  void AsyncStorage.setItem(
    FEED_CACHE_KEY,
    JSON.stringify({ alerts, communityPosts }),
  ).catch(() => {});
};

const communityActivityAt = (post: CommunityPost) =>
  Math.max(new Date(post.createdAt).getTime(), new Date(post.fetchedAt).getTime());

const mergeCommunityRows = (rssRows: any[] | null, otherRows: any[] | null) => {
  const byId = new Map<string, CommunityPost>();
  for (const row of [...(rssRows ?? []), ...(otherRows ?? [])]) {
    const post = mapCommunityRow(row);
    if (post.isDemo) continue;
    byId.set(post.id, post);
  }
  return [...byId.values()].sort((a, b) => communityActivityAt(b) - communityActivityAt(a));
};

const GUEST_USER: AlertUser = {
  id: "local-user",
  username: "@invitado",
  avatarUrl: null,
  isVerified: false,
  trustScore: 10,
  level: "CIUDADANO",
  followersCount: 0,
};

const SCORE_REPORT = 5;
const SCORE_UPVOTE = 1;

const normalizeTrustScore = (raw: number): number => {
  if (!Number.isFinite(raw)) return 10;
  if (raw <= 1) return Math.round(raw * 20);
  return Math.max(0, Math.min(100, Math.round(raw)));
};

const levelFromScore = (score: number): string => getLevelProgress(score).currentKey;

const mapUserFromRow = (row: any, fallbackId?: string): AlertUser => {
  const trustScore = normalizeTrustScore(Number(row?.trust_score ?? 0.5));
  return {
    id: row?.id ?? fallbackId ?? "unknown",
    username: row?.username ?? "@anon",
    avatarUrl: row?.avatar_url ?? null,
    isVerified: Boolean(row?.is_verified),
    isPremium: Boolean(row?.is_premium),
    trustScore,
    level: levelFromScore(trustScore),
    followersCount: Number(row?.followers_count ?? 0),
  };
};

const persistTrustScore = (userId: string, score: number) => {
  if (!isSupabaseConfigured || !supabase || userId === "local-user" || !isDbId(userId)) return;
  void supabase.from("users").update({ trust_score: score }).eq("id", userId);
};

export const useAlertyStore = create<AlertyState>((set, get) => ({
  alerts: [],
  communityPosts: [],
  alertsLoaded: false,
  communityLoaded: false,
  timeFilter: "24h",
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
  showHeatmap: true,
  sosWarningAccepted: false,
  themeMode: "light",
  currentUser: GUEST_USER,
  sponsoredZones: [],
  watchedZones: [],
  feedViewMode: "list",
  setFeedViewMode: (mode) => set({ feedViewMode: mode }),
  reelsInitialAlertId: null,
  openReels: (alertId) => set({ feedViewMode: "reels", reelsInitialAlertId: alertId }),
  unreadAlerts: 0,
  clearUnreadAlerts: () => set({ unreadAlerts: 0 }),
  userCoords: null,
  setUserCoords: (coords) => set({ userCoords: coords }),
  startDemo: () => {
    if (!isDemoEnabled) return;

    const { demoStarted, demoInterval, alerts, communityPosts } = get();
    if (demoStarted) return;

    if (alerts.length === 0) {
      set({ alerts: baseAlerts });
    }
    if (communityPosts.length === 0) {
      set({ communityPosts: demoCommunityPosts });
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
          parentAlertId: row.parent_alert_id ?? undefined,
          upvotes: 0,
          downvotes: 0,
          media: [],
          updates: [],
          user: mapUserFromRow(userData, row.user_id),
        };

        set((state) => {
          if (state.alerts.some((existing) => existing.id === alert.id)) return state;
          const inbox = matchInboxAlert(alert, state.userCoords, state.followingAlertIds);
          const countUnread = Boolean(inbox) && alert.user.id !== state.currentUser.id;
          return {
            alerts: [alert, ...state.alerts],
            unreadAlerts: countUnread ? state.unreadAlerts + 1 : state.unreadAlerts,
          };
        });
      },
    );

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "media" },
      (payload) => {
        const row = payload.new as any;
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === row.alert_id && !alert.media.some((m) => m.id === row.id)
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
          user: mapUserFromRow(userData, row.user_id),
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

    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "community_posts" },
      (payload) => {
        const post = mapCommunityRow(payload.new);
        if (post.isDemo) return;
        if (isOtherSinaloaCityStory(post.text)) return;
        set((state) => {
          if (state.communityPosts.some((p) => p.id === post.id || p.externalId === post.externalId)) {
            return state;
          }
          return { communityPosts: [post, ...state.communityPosts] };
        });
      },
    );

    channel.subscribe();
    set({ realtimeStarted: true, realtimeChannel: channel });

    return () => {
      if (supabase) supabase.removeChannel(channel);
      set({ realtimeStarted: false, realtimeChannel: null });
    };
  },
  addAlert: (alert) => {
    let added = false;
    set((state) => {
      if (state.alerts.some((a) => a.id === alert.id)) return state;
      added = true;
      return { alerts: [alert, ...state.alerts] };
    });
    const me = get().currentUser;
    if (added && alert.user?.id === me.id && me.id !== "local-user") {
      get().updateUserScore(SCORE_REPORT);
    }
  },
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
      if (isSupabaseConfigured && supabase && currentUser.id !== "local-user") {
        void supabase.from("users").update({ is_verified: isVerified }).eq("id", currentUser.id);
      }
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

    if (vote === "upvote") {
      get().updateUserScore(SCORE_UPVOTE);
    }

    if (!isSupabaseConfigured || !supabase || !isDbId(id)) return;
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
  resetGuest: () =>
    set({
      currentUser: GUEST_USER,
      followingAlertIds: [],
      votedAlerts: {},
      watchedZones: [],
    }),
  loadUserProfile: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    let data: any = null;
    try {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess?.session?.user) return;
      const res = await supabase
        .from("users")
        .select("*")
        .eq("id", sess.session.user.id)
        .single();
      data = res.data;
    } catch (err) {
      console.warn("loadUserProfile failed", err);
      return;
    }

    if (data) {
      const trustScore = normalizeTrustScore(Number(data.trust_score ?? 0.5));
      set((state) => ({
        currentUser: {
          ...state.currentUser,
          id: data.id,
          username: data.username,
          avatarUrl: data.avatar_url,
          isVerified: Boolean(data.is_verified),
          trustScore,
          level: levelFromScore(trustScore),
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
        showHeatmap: data.show_heatmap ?? true,
      }));
      void get().loadWatchedZones();
    }
  },
  loadSponsoredZones: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    let data: any[] | null = null;
    try {
      const res = await supabase
        .from("sponsored_zones")
        .select("id,name,description,lat,lng,type,logo_url")
        .eq("status", "active");
      if (res.error || !res.data) return;
      data = res.data;
    } catch (err) {
      console.warn("loadSponsoredZones failed", err);
      return;
    }
    if (!data) return;
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
  loadWatchedZones: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ watchedZones: [] });
      return;
    }
    const { data: sess } = await supabase.auth.getSession();
    if (!sess?.session?.user) {
      set({ watchedZones: [] });
      return;
    }
    const { data, error } = await supabase
      .from("watched_zones")
      .select("id,label,lat,lng,created_at")
      .eq("user_id", sess.session.user.id)
      .order("created_at", { ascending: true });
    if (error || !data) {
      console.warn("loadWatchedZones failed", error);
      return;
    }
    set({
      watchedZones: data.map((row) => ({
        id: row.id,
        label: row.label,
        lat: row.lat,
        lng: row.lng,
        createdAt: row.created_at,
      })),
    });
  },
  addWatchedZone: async ({ label, lat, lng }) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "No hay conexión." };
    }
    const { currentUser, watchedZones } = get();
    if (!currentUser.id || currentUser.id === "local-user") {
      return { error: "Inicia sesión para guardar una zona." };
    }
    if (!canAddCirculoZone(watchedZones.length, Boolean(currentUser.isPremium))) {
      return { error: "limit" };
    }
    const trimmed = label.trim();
    if (trimmed.length < 1 || trimmed.length > 40) {
      return { error: "Ponle un nombre corto a la zona." };
    }
    const { data, error } = await supabase
      .from("watched_zones")
      .insert({
        user_id: currentUser.id,
        label: trimmed,
        lat,
        lng,
      })
      .select("id,label,lat,lng,created_at")
      .single();
    if (error || !data) {
      if (error?.message?.includes("watched_zone_limit")) {
        return { error: "limit" };
      }
      return { error: error?.message ?? "No se pudo guardar la zona." };
    }
    set((state) => ({
      watchedZones: [
        ...state.watchedZones,
        {
          id: data.id,
          label: data.label,
          lat: data.lat,
          lng: data.lng,
          createdAt: data.created_at,
        },
      ],
    }));
    return { error: null };
  },
  deleteWatchedZone: async (id) => {
    if (!isSupabaseConfigured || !supabase) {
      return { error: "No hay conexión." };
    }
    const { error } = await supabase.from("watched_zones").delete().eq("id", id);
    if (error) return { error: error.message };
    set((state) => ({
      watchedZones: state.watchedZones.filter((zone) => zone.id !== id),
    }));
    return { error: null };
  },
  loadCommunityPosts: async (opts) => {
    if (!isSupabaseConfigured || !supabase) {
      if (get().communityPosts.length === 0) set({ communityPosts: [] });
      set({ communityLoaded: true });
      return;
    }
    const client = supabase;

    try {
      const rssQuery = client
        .from("community_posts")
        .select(COMMUNITY_POST_COLUMNS)
        .eq("is_demo", false)
        .eq("source", "rss")
        .order("fetched_at", { ascending: false })
        .limit(30);
      const otherQuery = client
        .from("community_posts")
        .select(COMMUNITY_POST_COLUMNS)
        .eq("is_demo", false)
        .neq("source", "rss")
        .order("created_at", { ascending: false })
        .limit(40);

      const [rssRes, otherRes] = await Promise.all([rssQuery, otherQuery]);
      if (rssRes.error) console.warn("loadCommunityPosts rss failed", rssRes.error.message);
      if (otherRes.error) console.warn("loadCommunityPosts x failed", otherRes.error.message);

      if (rssRes.error && otherRes.error) {
        if (get().communityPosts.length === 0) set({ communityPosts: [] });
        set({ communityLoaded: true });
        return;
      }

      const communityPosts = mergeCommunityRows(rssRes.data, otherRes.data).filter(
        (post) => !isOtherSinaloaCityStory(post.text),
      );
      set({ communityPosts, communityLoaded: true });
      persistFeedCache(get().alerts, communityPosts);
    } catch (err) {
      console.warn("loadCommunityPosts failed", err);
      if (get().communityPosts.length === 0) set({ communityPosts: [] });
      set({ communityLoaded: true });
    }

    if (!opts?.refreshNews) return;
    const now = Date.now();
    if (newsSyncInflight || now - lastNewsSyncAt < NEWS_SYNC_MIN_MS) return;
    lastNewsSyncAt = now;
    newsSyncInflight = (async () => {
      try {
        await client.functions.invoke("sync-news-rss", {
          body: { source: "app_open" },
        });
        await get().loadCommunityPosts();
      } catch (err) {
        console.warn("sync-news-rss on open failed", err);
      } finally {
        newsSyncInflight = null;
      }
    })();
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
  updateAvatar: async (avatarUrl) => {
    if (!isSupabaseConfigured || !supabase) return { error: "Sin conexión" };
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return { error: "No autenticado" };

    const { error } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", session.user.id);
    if (error) return { error: "No se pudo guardar. Intenta de nuevo." };

    set((state) => ({
      currentUser: { ...state.currentUser, avatarUrl },
    }));
    return { error: null };
  },
  loadAlertsFromSupabase: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({ alertsLoaded: true });
      return;
    }

    try {
    const { data } = await supabase
      .from("alerts")
      .select(`
        id,category,lat,lng,title,description,created_at,status,parent_alert_id,
        users(id,username,avatar_url,is_verified,is_premium,trust_score,followers_count),
        media(id,media_url,media_type,update_id),
        alert_updates(id,content,created_at,user_id,users(id,username,avatar_url,is_verified,is_premium))
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (!data || data.length === 0) {
      set({ alerts: [], alertsLoaded: true });
      persistFeedCache([], get().communityPosts);
      return;
    }

    const toItems = (voteCounts: Map<string, { up: number; down: number }>): AlertItem[] =>
      data.map((row: any) => {
        const counts = voteCounts.get(row.id) ?? { up: 0, down: 0 };
        return {
          id: row.id,
          category: row.category,
          lat: row.lat,
          lng: row.lng,
          title: row.title ?? undefined,
          description: row.description ?? undefined,
          createdAt: row.created_at,
          status: row.status ?? "active",
          neighborhood: undefined,
          parentAlertId: row.parent_alert_id ?? undefined,
          upvotes: counts.up,
          downvotes: counts.down,
          media: (row.media ?? []).map((media: any) => ({
            id: media.id,
            url: media.media_url,
            type: media.media_type,
          })),
          updates: (row.alert_updates ?? [])
            .map((upd: any) => ({
              id: upd.id,
              content: upd.content,
              createdAt: upd.created_at,
              user: mapUserFromRow(upd.users, upd.user_id),
              media: (row.media ?? [])
                .filter((m: any) => m.update_id === upd.id)
                .map((m: any) => ({ id: m.id, url: m.media_url, type: m.media_type })),
            }))
            .sort(
              (a: AlertUpdate, b: AlertUpdate) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
            ),
          user: mapUserFromRow(row.users),
        };
      });

    set({ alerts: toItems(new Map()), alertsLoaded: true });
    get().recomputeVerifiedStatus();

    const alertIds = data.map((row: any) => row.id);
    const [votesRes, userRes] = await Promise.all([
      supabase.from("verifications").select("alert_id,vote_type").in("alert_id", alertIds),
      supabase.auth.getUser(),
    ]);

    const voteCounts = new Map<string, { up: number; down: number }>();
    votesRes.data?.forEach((v: any) => {
      const counts = voteCounts.get(v.alert_id) ?? { up: 0, down: 0 };
      if (v.vote_type === "upvote") counts.up++;
      else counts.down++;
      voteCounts.set(v.alert_id, counts);
    });
    set({ alerts: toItems(voteCounts) });
    get().recomputeVerifiedStatus();
    persistFeedCache(get().alerts, get().communityPosts);

    const user = userRes.data?.user;
    if (!user) return;

    const [followsRes, myVotesRes] = await Promise.all([
      supabase.from("alert_follows").select("alert_id").eq("user_id", user.id),
      supabase.from("verifications").select("alert_id, vote_type").eq("user_id", user.id),
    ]);

    if (followsRes.data) {
      set({ followingAlertIds: followsRes.data.map((f) => f.alert_id) });
    }
    if (myVotesRes.data) {
      const votedAlerts: Record<string, "upvote" | "downvote"> = {};
      myVotesRes.data.forEach((v: any) => {
        votedAlerts[v.alert_id] = v.vote_type;
      });
      set({ votedAlerts });
    }
    } catch (err) {
      console.warn("loadAlertsFromSupabase failed", err);
      set({ alertsLoaded: true });
    }
  },
  toggleFollowAlert: async (id) => {
    if (!isSupabaseConfigured || !supabase || !isDbId(id)) {
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
  addUpdateToAlert: async (alertId, content, mediaItems = []) => {
    if (!isSupabaseConfigured || !supabase || !isDbId(alertId)) {
      const currentUser = get().currentUser;
      set((state) => ({
        alerts: state.alerts.map((alert) => {
          if (alert.id !== alertId) return alert;
          const newUpdate: AlertUpdate = {
            id: `upd-${Date.now()}`,
            content,
            createdAt: new Date().toISOString(),
            user: currentUser,
            media: mediaItems,
          };
          return {
            ...alert,
            updates: [newUpdate, ...(alert.updates ?? [])],
            media: [...alert.media, ...mediaItems],
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

    let uploadedMedia: AlertMedia[] = [];
    if (mediaItems.length > 0) {
      uploadedMedia = await uploadMediaBatch(mediaItems);
      if (uploadedMedia.length > 0) {
        await supabase.from("media").insert(
          uploadedMedia.map((m) => ({
            alert_id: alertId,
            update_id: data.id,
            media_url: m.url,
            media_type: m.type,
          })),
        );
      }
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
        trustScore: normalizeTrustScore(Number(data.users?.trust_score ?? 0.5)),
        level: levelFromScore(normalizeTrustScore(Number(data.users?.trust_score ?? 0.5))),
        followersCount: Number(data.users?.followers_count ?? 0),
      },
      media: uploadedMedia,
    };

    set((state) => ({
      alerts: state.alerts.map((alert) =>
        alert.id === alertId
          ? {
              ...alert,
              updates: [newUpdate, ...(alert.updates ?? [])],
              media: [...alert.media, ...uploadedMedia],
            }
          : alert
      ),
    }));

    void supabase.functions
      .invoke("notify-on-alert", { body: { type: "update", updateId: data.id } })
      .catch(() => {});
  },
  addAngleAlert: async (parentAlertId, video) => {
    const parent = get().alerts.find((a) => a.id === parentAlertId);
    if (!parent) return;
    const currentUser = get().currentUser;

    // Demo/local o sin conexión: el aporte vive solo en memoria.
    if (!isSupabaseConfigured || !supabase || !isDbId(parentAlertId)) {
      const child: AlertItem = {
        id: `local-${Date.now()}`,
        user: currentUser,
        category: parent.category,
        lat: parent.lat,
        lng: parent.lng,
        title: "Otro ángulo",
        createdAt: new Date().toISOString(),
        status: "active",
        media: [video],
        upvotes: 0,
        downvotes: 0,
        neighborhood: parent.neighborhood,
        parentAlertId,
        updates: [],
      };
      set((state) => ({ alerts: [child, ...state.alerts] }));
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("alerts")
      .insert({
        user_id: user.id,
        category: parent.category,
        lat: parent.lat,
        lng: parent.lng,
        title: "Otro ángulo",
        parent_alert_id: parentAlertId,
      })
      .select("id,created_at")
      .single();

    if (error || !data) {
      console.error("Error adding angle:", error);
      return;
    }

    const uploaded = await uploadMediaBatch([video]);
    if (uploaded.length > 0) {
      await supabase.from("media").insert(
        uploaded.map((m) => ({
          alert_id: data.id,
          media_url: m.url,
          media_type: m.type,
        })),
      );
    }

    const child: AlertItem = {
      id: data.id,
      user: currentUser,
      category: parent.category,
      lat: parent.lat,
      lng: parent.lng,
      title: "Otro ángulo",
      createdAt: data.created_at,
      status: "active",
      media: uploaded,
      upvotes: 0,
      downvotes: 0,
      neighborhood: parent.neighborhood,
      parentAlertId,
      updates: [],
    };
    set((state) => ({ alerts: [child, ...state.alerts] }));
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
    const state = get();
    const newScore = Math.max(0, Math.min(100, state.currentUser.trustScore + score));
    const newLevel = levelFromScore(newScore);
    set({
      currentUser: { ...state.currentUser, trustScore: newScore, level: newLevel },
    });
    persistTrustScore(state.currentUser.id, newScore);
  },
  getReportingRange: () => {
    const { currentUser } = get();
    const level = (currentUser.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
    return REPUTATION_LEVELS[level].range;
  },
}));

void AsyncStorage.getItem(FEED_CACHE_KEY)
  .then((raw) => {
    if (!raw) return;
    const state = useAlertyStore.getState();
    if (state.alertsLoaded && state.communityLoaded) return;
    const parsed = JSON.parse(raw) as {
      alerts?: AlertItem[];
      communityPosts?: CommunityPost[];
    };
    useAlertyStore.setState({
      alerts: state.alertsLoaded || state.alerts.length > 0 ? state.alerts : parsed.alerts ?? [],
      communityPosts:
        state.communityLoaded || state.communityPosts.length > 0
          ? state.communityPosts
          : parsed.communityPosts ?? [],
    });
  })
  .catch(() => {});
