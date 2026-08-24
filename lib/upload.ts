import * as FileSystem from "expo-file-system/legacy";
import { decode } from "base64-arraybuffer";
import { isSupabaseConfigured, supabase } from "./supabase";
import type { AlertMedia } from "./alerty/types";

const BUCKET = "alert-media";

const EXT: Record<AlertMedia["type"], string> = {
  image: "jpg",
  video: "mp4",
  audio: "m4a",
};

const CONTENT_TYPE: Record<AlertMedia["type"], string> = {
  image: "image/jpeg",
  video: "video/mp4",
  audio: "audio/mp4",
};

// Sube un archivo local al Storage y devuelve su URL pública.
export async function uploadMedia(
  localUri: string,
  type: AlertMedia["type"],
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${EXT[type]}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, decode(base64), { contentType: CONTENT_TYPE[type] });
    if (error) {
      console.warn("uploadMedia failed", error);
      return null;
    }
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  } catch (e) {
    console.warn("uploadMedia failed", e);
    return null;
  }
}

// Sube un lote de media. Los items que ya son URL remota se dejan igual.
export async function uploadMediaBatch(items: AlertMedia[]): Promise<AlertMedia[]> {
  const out: AlertMedia[] = [];
  for (const item of items) {
    if (/^https?:\/\//.test(item.url)) {
      out.push(item);
      continue;
    }
    const url = await uploadMedia(item.url, item.type);
    if (url) out.push({ ...item, url });
  }
  return out;
}
