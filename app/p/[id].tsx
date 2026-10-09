/**
 * Deep link in-app /p/<id> → detalle.
 * id uuid → alerta; id c-<uuid> → ficha de comunidad en Pulsos.
 * En web producción Vercel sirve /api/p (OG + landing).
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  isCommunityPublicId,
  stripCommunityPublicId,
} from "../../lib/alerty/shareCore";
import { useAlertyStore } from "../../lib/alerty/store";

export default function PublicPulseRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const focusCommunity = useAlertyStore((s) => s.focusCommunity);

  useEffect(() => {
    if (!id) return;
    if (isCommunityPublicId(id)) {
      const postId = stripCommunityPublicId(id);
      focusCommunity(postId);
      router.replace("/(tabs)/pulsos" as any);
      return;
    }
    router.replace(`/alert/${id}` as any);
  }, [id, router, focusCommunity]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
