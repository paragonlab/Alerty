/**
 * Deep link in-app /v/<id> → pestaña Videos (reels).
 * id uuid → alerta; id c-<uuid> → post de comunidad.
 * En web producción Vercel sirve /api/p?surface=video (OG + landing).
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  isCommunityPublicId,
  stripCommunityPublicId,
} from "../../lib/alerty/shareCore";
import { useAlertyStore } from "../../lib/alerty/store";

export default function PublicVideoRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const openReels = useAlertyStore((s) => s.openReels);

  useEffect(() => {
    if (!id) return;
    if (isCommunityPublicId(id)) {
      openReels(`c-${stripCommunityPublicId(id)}`);
    } else {
      openReels(id);
    }
    router.replace("/(tabs)/pulsos" as any);
  }, [id, router, openReels]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator />
    </View>
  );
}
