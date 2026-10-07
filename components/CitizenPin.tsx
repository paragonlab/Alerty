import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import {
  balloonPinDisplaySize,
  citizenPinSvg,
} from "../lib/alerty/pinArt";
import {
  resolveCitizenCharacter,
  type CitizenCharacterId,
} from "../lib/alerty/characters";
import { isHttpAvatar } from "../lib/alerty/avatars";

/**
 * Pin de alerta ciudadana estilo Waze (personaje / foto + insignia).
 * `markerKind` lo lee el mapa web. La punta del globo es el ancla.
 */
export function CitizenPin({
  userId,
  character,
  avatarUrl,
  category,
  username,
  showName = false,
  showBadge = true,
  markerKind: _markerKind,
}: {
  userId: string;
  character?: string | null;
  avatarUrl?: string | null;
  category?: string | null;
  username?: string | null;
  showName?: boolean;
  /** En listas/perfil: sin insignia. En mapa: con insignia de categoría. */
  showBadge?: boolean;
  markerKind?: "citizen";
}) {
  const characterId: CitizenCharacterId = useMemo(
    () => resolveCitizenCharacter({ userId, character, avatarUrl }),
    [userId, character, avatarUrl],
  );
  const photoCandidate = isHttpAvatar(avatarUrl) ? avatarUrl! : null;
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoCandidate]);

  const photoUrl = photoCandidate && !photoFailed ? photoCandidate : null;

  const name =
    username && username.trim()
      ? username.startsWith("@")
        ? username.trim()
        : `@${username.trim()}`
      : null;

  const { w, h } = balloonPinDisplaySize(showName);
  const xml = useMemo(
    () =>
      citizenPinSvg({
        characterId,
        category,
        photoUrl,
        name,
        showName,
        showBadge,
      }),
    [characterId, category, photoUrl, name, showName, showBadge],
  );

  return (
    <View style={{ width: w, height: h }}>
      {photoCandidate ? (
        <Image
          source={{ uri: photoCandidate }}
          style={{ width: 1, height: 1, position: "absolute", opacity: 0 }}
          onError={() => setPhotoFailed(true)}
        />
      ) : null}
      <SvgXml xml={xml} width={w} height={h} />
    </View>
  );
}
