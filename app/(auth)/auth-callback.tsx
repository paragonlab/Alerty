import { View, ActivityIndicator, Text } from "react-native";
import { useAlertyStore } from "../../lib/alerty/store";
import { darkHighVisibility, lightTheme } from "../../lib/theme";

export default function AuthCallback() {
  const { themeMode } = useAlertyStore();
  const currentTheme = themeMode === "darkHighVisibility" ? darkHighVisibility : lightTheme;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: currentTheme.colors.background }}>
      <ActivityIndicator size="large" color={currentTheme.colors.primary} />
      <Text style={{ marginTop: 16, fontFamily: "SpaceGrotesk_500Medium", color: currentTheme.colors.text }}>
        Completando inicio de sesión...
      </Text>
    </View>
  );
}
