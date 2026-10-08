import type { CommunityPost } from "./types";
import { getActiveCity } from "./city";
import { isOtherSinaloaCityStory } from "./coloniaGeocode";
import { calculateDistance } from "./utils";

export function isNewsPost(post: Pick<CommunityPost, "source" | "trustTier">): boolean {
  return post.source === "rss" || post.trustTier === "news";
}

/**
 * Post con video: la miniatura de X (amplify_video_thumb / ext_tw_video_thumb)
 * o un archivo de video. El mp4 de X, cuando lo hay, viene en videoUrl.
 */
export function isCommunityVideo(post: Pick<CommunityPost, "mediaUrl">): boolean {
  const url = post.mediaUrl ?? "";
  return /video_thumb/i.test(url) || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
}

/** Quita líneas que solo son hashtags ("#cdmx,#culiacan,#mazatlan"): relleno para salir en búsquedas. */
function withoutHashtagLines(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.replace(/#[^\s,]+|https?:\/\/\S+|[\s,.;|·-]/g, "") !== "")
    .join("\n");
}

/**
 * Video/pulso de la ciudad activa: con ubicación cerca del centro, o que la
 * nombra en el texto. Fase 1 = Culiacán; el sync de X busca "Culiacán", pero
 * muchos posts de otros estados solo la meten en hashtags de relleno.
 */
export function isAboutCuliacan(post: Pick<CommunityPost, "text" | "lat" | "lng">): boolean {
  const city = getActiveCity();
  if (post.lat != null && post.lng != null) {
    return (
      calculateDistance(city.center.latitude, city.center.longitude, post.lat, post.lng) <= 30
    );
  }
  const body = withoutHashtagLines(post.text);
  if (isOtherSinaloaCityStory(body)) return false;
  if (city.slug === "culiacan") {
    return /culiac[aá]n/i.test(body);
  }
  if (city.slug === "mazatlan") {
    return /mazatl[aá]n/i.test(body);
  }
  const nameRe = new RegExp(city.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  return nameRe.test(body);
}

/** Nombre del medio en pulsos RSS; "Desde X" en comunidad. */
export function communitySourceLabel(
  post: Pick<CommunityPost, "source" | "trustTier" | "authorName">,
): string {
  if (!isNewsPost(post)) return "Desde X";
  const name = post.authorName?.trim();
  return name || "Noticia";
}
