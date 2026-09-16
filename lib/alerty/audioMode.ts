import { Audio } from "expo-av";

/**
 * Reproducir: el pulso se oye aunque el iPhone traiga el switch en silencio, y
 * la sesión sale del modo micrófono. Grabar deja iOS en modo micrófono y todo
 * lo que suene después se oye bajito o no se oye.
 */
export async function setPlaybackAudioMode() {
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  } catch (e) {
    console.warn("playback audio mode failed", e);
  }
}

/** Grabar: iOS necesita el micrófono abierto para la sesión. */
export async function setRecordingAudioMode() {
  try {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  } catch (e) {
    console.warn("recording audio mode failed", e);
  }
}
