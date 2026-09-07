import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { isHttpAvatar, presetFromUrl } from "../lib/alerty/avatars";

type Props = {
  url?: string | null;
  size?: number;
  muted?: string;
  border?: string;
};

export function UserAvatar({ url, size = 52, muted = "#6A6257", border = "#E1D4C2" }: Props) {
  const preset = presetFromUrl(url);
  const radius = size / 2;

  if (preset) {
    return (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: preset.color,
            borderColor: border,
          },
        ]}
      >
        <Text style={{ fontSize: size * 0.46 }}>{preset.emoji}</Text>
      </View>
    );
  }

  if (isHttpAvatar(url)) {
    return (
      <Image
        source={{ uri: url! }}
        style={{ width: size, height: size, borderRadius: radius, borderWidth: 1, borderColor: border }}
      />
    );
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: "#EFE6D7",
          borderColor: border,
        },
      ]}
    >
      <Ionicons name="person" size={size * 0.5} color={muted} />
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
