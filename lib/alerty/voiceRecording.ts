import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import type { Audio } from "expo-av";

/**
 * Deja la grabación lista para subir y devuelve su URI.
 *
 * En el navegador el archivo es un blob y no hay documentDirectory: copiarlo
 * ahí lanzaba, el catch solo lo mandaba a consola y la nota de voz se perdía
 * sin que nadie se enterara. Por eso nunca llegó un audio a la base.
 */
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
