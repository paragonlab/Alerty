import { Image, StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { isHttpAvatar } from "../lib/alerty/avatars";
import {
  CHARACTER_SVG,
  getCitizenCharacter,
  resolveCitizenCharacter,
} from "../lib/alerty/characters";

type Props = {
  url?: string | null;
  character?: string | null;
  userId?: string | null;
  size?: number;
  muted?: string;
  border?: string;
};

/**
 * Avatar de perfil / listas: foto o personaje ilustrado (sin insignia).
 */
export function UserAvatar({
  url,
  character,
  userId,
  size = 52,
  border = "#E1D4C2",
}: Props) {
  const radius = size / 2;
  const characterId = resolveCitizenCharacter({
    userId: userId || "anon",
    character,
    avatarUrl: url,
  });
  const bg = getCitizenCharacter(characterId).bg;

  if (isHttpAvatar(url)) {
    return (
      <Image
        source={{ uri: url! }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 1, borderColor: border }}
      />
    );
  }

  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="19 15 82 82" width="${size}" height="${size}">
    <circle cx="60" cy="56" r="41" fill="${bg}"/>
    <g>${CHARACTER_SVG[characterId]}</g>
  </svg>`;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
