import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";
import { CATEGORY_ICONS, CATEGORY_LABELS } from "../lib/alerty/constants";
import { formatRelativeTime, getIntensityColor } from "../lib/alerty/utils";
import { Sounds } from "../lib/sounds";
import type { AlertItem } from "../lib/alerty/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export function VideoReelCard({ alert, isActive }: { alert: AlertItem; isActive: boolean }) {
  const router = useRouter();
  const theme = useAlertyTheme();
  const { voteAlert, votedAlerts, toggleFollowAlert, followingAlertIds } = useAlertyStore();
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const videoUri = alert.media.find((m) => m.type === "video")?.url;
  const myVote = votedAlerts[alert.id];
  const voted = Boolean(myVote);
  const isFollowing = followingAlertIds.includes(alert.id);
  const intensityColor = getIntensityColor(alert.createdAt);

  return (
    <View style={styles.reelContainer}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsPaused((p) => !p)}>
        <Video
          source={{ uri: videoUri! }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && !isPaused}
          isMuted={isMuted}
        />
      </Pressable>

      {isPaused && (
        <View style={styles.pausedOverlay} pointerEvents="none">
          <Ionicons name="play" size={64} color="rgba(255,255,255,0.75)" />
        </View>
      )}

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        start={{ x: 0, y: 0.3 }}
        end={{ x: 0, y: 1 }}
        style={styles.gradient}
        pointerEvents="none"
      />

      <View style={styles.infoOverlay} pointerEvents="box-none">
        <View
          style={[
            styles.categoryPill,
            { borderColor: intensityColor + "80", backgroundColor: intensityColor + "25" },
          ]}
        >
          <Ionicons name={CATEGORY_ICONS[alert.category] as any} size={12} color={intensityColor} />
          <Text style={[styles.categoryText, { color: intensityColor }]}>
            {CATEGORY_LABELS[alert.category]}
          </Text>
        </View>

        {(alert.title || alert.description) && (
          <Text style={styles.alertTitle} numberOfLines={2}>
            {alert.title ?? alert.description}
          </Text>
        )}

        <Text style={styles.metaText}>
          {alert.neighborhood ?? "Culiacán"} · {formatRelativeTime(alert.createdAt)}
        </Text>

        <Pressable
          style={styles.userRow}
          onPress={() => router.push(`/alert/${alert.id}` as any)}
        >
          <Text style={styles.username}>{alert.user.username}</Text>
          {alert.user.isVerified && (
            <Ionicons name="checkmark-circle" size={14} color={theme.colors.accent} />
          )}
          {alert.user.isPremium && <Ionicons name="star" size={14} color="#F59E0B" />}
        </Pressable>
      </View>

      <View style={styles.actionsColumn}>
        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            if (voted) return;
            void Sounds.tap();
            voteAlert(alert.id, "upvote");
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          disabled={voted}
        >
          <Ionicons
            name={myVote === "upvote" ? "thumbs-up" : "thumbs-up-outline"}
            size={28}
            color={myVote === "upvote" ? "#22C55E" : "white"}
          />
          <Text style={styles.actionCount}>{alert.upvotes}</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            if (voted) return;
            void Sounds.tap();
            voteAlert(alert.id, "downvote");
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
          disabled={voted}
        >
          <Ionicons
            name={myVote === "downvote" ? "thumbs-down" : "thumbs-down-outline"}
            size={28}
            color={myVote === "downvote" ? "#EF4444" : "white"}
          />
          <Text style={styles.actionCount}>{alert.downvotes}</Text>
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => {
            void Sounds.tap();
            toggleFollowAlert(alert.id);
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }}
        >
          <Ionicons
            name={isFollowing ? "notifications" : "notifications-outline"}
            size={28}
            color={isFollowing ? "#F59E0B" : "white"}
          />
          <Text style={styles.actionCount}>{isFollowing ? "Sig." : "Seguir"}</Text>
        </Pressable>

        <Pressable style={styles.actionBtn} onPress={() => setIsMuted((m) => !m)}>
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={28} color="white" />
        </Pressable>

        <Pressable
          style={styles.actionBtn}
          onPress={() => router.push(`/alert/${alert.id}` as any)}
        >
          <Ionicons name="open-outline" size={28} color="white" />
          <Text style={styles.actionCount}>Ver más</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function VideoReelsList({ alerts }: { alerts: AlertItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        setActiveId((viewableItems[0].item as AlertItem).id);
      }
    },
    [],
  );

  return (
    <FlatList
      data={alerts}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <VideoReelCard alert={item} isActive={activeId === item.id} />
      )}
      pagingEnabled
      snapToInterval={SCREEN_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
      getItemLayout={(_, index) => ({
        length: SCREEN_HEIGHT,
        offset: SCREEN_HEIGHT * index,
        index,
      })}
      removeClippedSubviews
      windowSize={3}
    />
  );
}

const styles = StyleSheet.create({
  reelContainer: {
    height: SCREEN_HEIGHT,
    backgroundColor: "#111",
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "65%",
  },
  pausedOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 88,
    left: 16,
    right: 84,
    gap: 9,
  },
  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "SpaceGrotesk_700Bold",
  },
  alertTitle: {
    color: "white",
    fontSize: 17,
    fontFamily: "SpaceGrotesk_700Bold",
    lineHeight: 23,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  metaText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "SpaceGrotesk_400Regular",
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  username: {
    color: "white",
    fontSize: 14,
    fontFamily: "SpaceGrotesk_500Medium",
  },
  actionsColumn: {
    position: "absolute",
    right: 14,
    bottom: 96,
    gap: 22,
    alignItems: "center",
  },
  actionBtn: {
    alignItems: "center",
    gap: 4,
  },
  actionCount: {
    color: "white",
    fontSize: 12,
    fontFamily: "SpaceGrotesk_500Medium",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
