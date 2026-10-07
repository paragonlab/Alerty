import { useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import { SvgXml } from "react-native-svg";
import {
  balloonPinDisplaySize,
  pulsoPinSvg,
  type CommunitySourceKind,
} from "../lib/alerty/pinArt";

/**
 * Pin de Pulso (X / RSS) estilo Waze.
 * A = logo + insignia. B = categoría + chip de fuente. C = +N fuentes.
 */
export function PulsoPin({
  categoryGuess,
  authorAvatarUrl,
  source = "x",
  authorName,
  extraSources = 0,
  showName = false,
  isDemo,
  markerKind: _markerKind,
}: {
  categoryGuess?: string | null;
  authorAvatarUrl?: string | null;
  source?: CommunitySourceKind;
  authorName?: string | null;
  /** Fuentes adicionales en el cluster (muestra +N). */
  extraSources?: number;
  showName?: boolean;
  isDemo?: boolean;
  markerKind?: "community";
}) {
  const logoCandidate =
    authorAvatarUrl && /^https?:\/\//i.test(authorAvatarUrl) ? authorAvatarUrl : null;
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setLogoFailed(false);
  }, [logoCandidate]);

  const logoUrl = logoCandidate && !logoFailed ? logoCandidate : null;
  const { w, h } = balloonPinDisplaySize(showName);
  const xml = useMemo(
    () =>
      pulsoPinSvg({
        category: categoryGuess,
        logoUrl,
        source,
        extraSources,
        name: authorName,
        showName,
      }),
    [categoryGuess, logoUrl, source, extraSources, authorName, showName],
  );

  return (
    <View
      style={{ width: w, height: h }}
      accessibilityLabel={isDemo ? "Pulso DEMO" : "Pulso"}
    >
      {logoCandidate ? (
        <Image
          source={{ uri: logoCandidate }}
          style={{ width: 1, height: 1, position: "absolute", opacity: 0 }}
          onError={() => setLogoFailed(true)}
        />
      ) : null}
      <SvgXml xml={xml} width={w} height={h} />
    </View>
  );
}
