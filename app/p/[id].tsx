/**
 * Deep link in-app /p/<id> → detalle del pulso.
 * En web producción, Vercel sirve /api/p (OG + landing). Esta ruta cubre
 * Expo Router nativo y previews locales del SPA.
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

export default function PublicPulseRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    router.replace(`/alert/${id}` as any);
  }, [id, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
