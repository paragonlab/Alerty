import { Platform } from "react-native";
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

// En web la extensión sale del tipo real: Safari de iPhone graba .mov.
const EXT_BY_MIME: Record<string, string> = {
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/mp4": "mp4",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/heic": "heic",
};

function randomPath(ext: string) {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
}

// Sube un archivo local al Storage y devuelve su URL pública.
export async function uploadMedia(
  localUri: string,
  type: AlertMedia["type"],
): Promise<string | null> {
  if (!isSupabaseConfigured || !supabase) return null;
  try {
    let path: string;
    let error: unknown;
    if (Platform.OS === "web") {
      // En el navegador el archivo es un blob: URL; FileSystem no existe aquí.
      const blob = await (await fetch(localUri)).blob();
      const contentType = blob.type || CONTENT_TYPE[type];
      path = randomPath(EXT_BY_MIME[contentType] ?? EXT[type]);
      ({ error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType }));
    } else {
      const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
      path = randomPath(EXT[type]);
      ({ error } = await supabase.storage
        .from(BUCKET)
        .upload(path, decode(base64), { contentType: CONTENT_TYPE[type] }));
    }
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
