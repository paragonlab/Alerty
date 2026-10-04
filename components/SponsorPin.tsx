import { View } from "react-native";
import { SvgXml } from "react-native-svg";
import type { PinShape } from "../lib/alerty/types";
import { SPONSOR_PIN_H, SPONSOR_PIN_W, sponsorPinSvg } from "../lib/alerty/pinArt";

export type { PinShape };

/**
 * Pin de un Aliado. `markerKind` lo lee el mapa web para dibujar el mismo
 * SVG. La aguja marca el lugar (anchor abajo, en la punta).
 */
export function SponsorPin({
  color,
  shape,
  logoUrl,
  markerKind: _markerKind,
}: {
  color: string;
  shape: PinShape;
  logoUrl?: string | null;
  markerKind?: "sponsor";
}) {
  return (
    <View style={{ width: SPONSOR_PIN_W, height: SPONSOR_PIN_H }}>
      <SvgXml
        xml={sponsorPinSvg({ color, shape, logoUrl })}
        width={SPONSOR_PIN_W}
        height={SPONSOR_PIN_H}
      />
    </View>
  );
}
