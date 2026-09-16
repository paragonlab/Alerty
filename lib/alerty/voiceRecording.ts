import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";

/**
 * Deja la grabación lista para subir y devuelve su URI.
 *
 * En el navegador el archivo es un blob y no hay documentDirectory: copiarlo
 * ahí lanzaba, el catch solo lo mandaba a consola y la nota de voz se perdía
 * sin que nadie se enterara. Por eso nunca llegó un audio a la base.
 */
/**
 * Si el navegador puede grabar una nota de voz que todos puedan oír.
 *
 * Chrome y Firefox graban en webm y un iPhone no lo reproduce, así que en vez
 * de publicar un audio mudo para media ciudad, ahí no se ofrece grabar voz.
 * Se pregunta por el formato y no por el navegador: el día que Chrome grabe
 * mp4, la opción se activa sola.
 */
export function canRecordVoice(): boolean {
  return Platform.OS !== "web" || webVoiceMime() !== null;
}

/** AAC dentro de mp4: lo único que reproducen por igual iPhone y Android. */
const AAC_IN_MP4 = "audio/mp4;codecs=mp4a.40.2";

/**
 * El formato que este navegador puede grabar y que todos pueden oír, o null si
 * no puede ninguno. Pedir "audio/mp4" a secas no sirve: Chrome lo acepta pero
 * mete Opus, que el iPhone no reproduce aunque el archivo diga mp4.
 */
function webVoiceMime(): string | null {
  const recorder = (globalThis as { MediaRecorder?: { isTypeSupported?: (t: string) => boolean } })
    .MediaRecorder;
  if (!recorder?.isTypeSupported) return null;
  if (recorder.isTypeSupported(AAC_IN_MP4)) return AAC_IN_MP4;
  // Safari no siempre reconoce la cadena con códec, y su mp4 ya es AAC.
  if (recorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}

/**
 * Opciones de grabación. En el navegador se pide mp4: expo-av trae webm fijo
 * en sus presets y un iPhone no reproduce webm, aunque el navegador que graba
 * sí pueda darnos mp4.
 */
export function voiceRecordingOptions(): Audio.RecordingOptions {
  const base = Audio.RecordingOptionsPresets.HIGH_QUALITY;
  const mimeType = Platform.OS === "web" ? webVoiceMime() : null;
  if (!mimeType) return base;
  return { ...base, web: { mimeType, bitsPerSecond: 128000 } };
}

export async function saveRecording(
  recording: Audio.Recording,
  prefix: string,
): Promise<string | null> {
  const uri = recording.getURI();
  if (!uri) return null;
  if (Platform.OS === "web") return uri;
  const dest = `${FileSystem.documentDirectory}${prefix}-${Date.now()}.m4a`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}
