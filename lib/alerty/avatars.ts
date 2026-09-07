export type ProfilePreset = {
  id: string;
  emoji: string;
  label: string;
  color: string;
};

export const PROFILE_PRESETS: ProfilePreset[] = [
  { id: "radar", emoji: "📡", label: "Radar", color: "#D9552B" },
  { id: "owl", emoji: "🦉", label: "Búho", color: "#2E7D32" },
  { id: "fox", emoji: "🦊", label: "Zorro", color: "#C45C26" },
  { id: "wolf", emoji: "🐺", label: "Lobo", color: "#4A5568" },
  { id: "eagle", emoji: "🦅", label: "Águila", color: "#1F4E79" },
  { id: "cat", emoji: "🐱", label: "Gato", color: "#7A5C3E" },
  { id: "sun", emoji: "☀️", label: "Sol", color: "#D79A24" },
  { id: "moon", emoji: "🌙", label: "Luna", color: "#3D4A6B" },
];

const PRESET_PREFIX = "preset:";

export const presetAvatarUrl = (id: string) => `${PRESET_PREFIX}${id}`;

export function presetFromUrl(url?: string | null): ProfilePreset | null {
  if (!url?.startsWith(PRESET_PREFIX)) return null;
  const id = url.slice(PRESET_PREFIX.length);
  return PROFILE_PRESETS.find((p) => p.id === id) ?? null;
}

export function isHttpAvatar(url?: string | null): boolean {
  return Boolean(url && /^https?:\/\//i.test(url));
}
