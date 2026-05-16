import { Audio } from "expo-av";

const TAP = require("../assets/sounds/tap.wav");
const SUCCESS = require("../assets/sounds/success.wav");
const SOS_SOUND = require("../assets/sounds/sos.wav");

async function play(source: any) {
  try {
    const { sound } = await Audio.Sound.createAsync(source);
    await sound.playAsync();
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.isLoaded && s.didJustFinish) sound.unloadAsync();
    });
  } catch {}
}

export const Sounds = {
  tap: () => play(TAP),
  success: () => play(SUCCESS),
  sos: () => play(SOS_SOUND),
};
