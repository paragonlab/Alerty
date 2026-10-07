import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { PinGiro, PinShape } from "../lib/alerty/types";
import {
  sponsorPinDisplaySize,
  sponsorPinSvg,
  type SponsorZoneType,
} from "../lib/alerty/pinArt";

export type { PinShape, PinGiro };

/**
 * Pin de un Aliado / Refugio estilo Waze.
 * `markerKind` lo lee el mapa web. La punta del globo es el ancla.
 */
export function SponsorPin({
  color,
  shape,
  giro,
  zoneType,
  logoUrl,
  name,
  showName = false,
  markerKind: _markerKind,
}: {
  color: string;
  shape?: PinShape;
  giro?: PinGiro | null;
  zoneType?: SponsorZoneType;
  logoUrl?: string | null;
  name?: string | null;
  /** Etiqueta de nombre debajo de la punta (solo zoom cercano). */
  showName?: boolean;
  markerKind?: "sponsor";
}) {
  const { w, h } = sponsorPinDisplaySize(showName);
  return (
    <View style={{ width: w, height: h }}>
      <SvgXml
        xml={sponsorPinSvg({
          color,
          shape,
          giro,
          zoneType,
          logoUrl,
          name,
          showName,
        })}
        width={w}
        height={h}
      />
    </View>
  );
}
