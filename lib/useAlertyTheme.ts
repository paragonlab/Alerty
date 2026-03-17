import { useAlertyStore } from "./alerty/store";
import { lightTheme, darkHighVisibility } from "./theme";

export function useAlertyTheme() {
  const mode = useAlertyStore(state => state.themeMode);
  return mode === "darkHighVisibility" ? darkHighVisibility : lightTheme;
}
