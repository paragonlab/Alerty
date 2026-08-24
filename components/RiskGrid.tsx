// Overlay de cuadrantes de riesgo (feature Plus). Dibuja un polígono coloreado
// por cada celda de la cuadrícula con alertas.
import { Polygon } from "./ExpoMapView";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { riskColor, type GridCell } from "../lib/alerty/risk";

export function RiskGrid({ cells }: { cells: GridCell[] }) {
  const theme = useAlertyTheme();

  return (
    <>
      {cells.map((cell) => {
        const color = riskColor(cell.level, theme.colors);
        return (
          <Polygon
            key={cell.id}
            coordinates={cell.coordinates}
            fillColor={`${color}55`}
            strokeColor={`${color}AA`}
            strokeWidth={1}
          />
        );
      })}
    </>
  );
}
