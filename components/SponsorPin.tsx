import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { PinShape } from "../lib/alerty/types";
import { SPONSOR_PIN_H, SPONSOR_PIN_W, sponsorPinSvg } from "../lib/alerty/pinArt";

export type { PinShape };

/**
 * Pin de un Aliado. `markerKind` lo lee el mapa web para dibujar el mismo
 * SVG. El punto de suelo marca el lugar (anchor abajo, al centro).
 */
export function SponsorPin({
  color,
  shape,
  logoUrl,
  name,
  markerKind: _markerKind,
}: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
  name?: string | null;
  markerKind?: "sponsor";
}) {
  return (
    <View style={{ width: SPONSOR_PIN_W, height: SPONSOR_PIN_H }}>
      <SvgXml
        xml={sponsorPinSvg({ color, shape, logoUrl, name })}
        width={SPONSOR_PIN_W}
        height={SPONSOR_PIN_H}
      />
    </View>
  );
}
