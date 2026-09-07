import type { CommunityPost } from "./types";

export function isNewsPost(post: Pick<CommunityPost, "source" | "trustTier">): boolean {
  return post.source === "rss" || post.trustTier === "news";
}

/** Nombre del medio en pulsos RSS; "Desde X" en comunidad. */
export function communitySourceLabel(
  post: Pick<CommunityPost, "source" | "trustTier" | "authorName">,
): string {
  if (!isNewsPost(post)) return "Desde X";
  const name = post.authorName?.trim();
  return name || "Noticia";
}
