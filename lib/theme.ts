import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";

export type ThemePreference = "system" | "light" | "dark";
export type ThemeMode = "light" | "dark";

export type Theme = {
  mode: ThemeMode;
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    success: string;
    warning: string;
    danger: string;
    mapRed: string;
    mapOrange: string;
    mapYellow: string;
    mapVerified: string;
    mapMedia: string;
  };
  effects: {
    glassCard: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
    glassPill: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
  radius: {
    md: number;
    xl: number;
    xxl: number;
    pill: number;
  };
  fonts: {
    heading: string;
    body: string;
    mono: string;
  };
};

const baseTheme = {
  radius: {
    md: 12,
    xl: 18,
    xxl: 26,
    pill: 999,
  },
  fonts: {
    heading: "SpaceGrotesk_700Bold",
    body: "SpaceGrotesk_500Medium",
    mono: "SpaceGrotesk_400Regular",
  },
};

export const lightTheme: Theme = {
  mode: "light",
  colors: {
    background: "#FFF1F2",
    surface: "rgba(255,248,248,0.82)",
    surfaceAlt: "rgba(255,239,241,0.68)",
    border: "rgba(255,255,255,0.5)",
    text: "#1A0D0F",
    textMuted: "#6B5B5E",
    accent: "#E02B3C",
    accentSoft: "rgba(224,43,60,0.18)",
    success: "#1F9D6E",
    warning: "#D79A24",
    danger: "#B6402F",
    mapRed: "#D9342B",
    mapOrange: "#E9792F",
    mapYellow: "#E5C548",
    mapVerified: "#E02B3C",
    mapMedia: "#6B3A3F",
  },
  effects: {
    glassCard: {
      shadowColor: "#FF7B86",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.18,
      shadowRadius: 20,
      elevation: 4,
    },
    glassPill: {
      shadowColor: "#FF7B86",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.16,
      shadowRadius: 14,
      elevation: 3,
    },
  },
  ...baseTheme,
};

export const darkTheme: Theme = {
  mode: "dark",
  colors: {
    background: "#0B0F14",
    surface: "rgba(18,22,28,0.82)",
    surfaceAlt: "rgba(24,28,34,0.64)",
    border: "rgba(255,255,255,0.08)",
    text: "#F6F7FB",
    textMuted: "#A3ABB5",
    accent: "#FF4D5A",
    accentSoft: "rgba(255,77,90,0.2)",
    success: "#2CCB8B",
    warning: "#F5B642",
    danger: "#E04B3C",
    mapRed: "#FF5A4E",
    mapOrange: "#FFB347",
    mapYellow: "#F9E27D",
    mapVerified: "#FF4D5A",
    mapMedia: "#B2676D",
  },
  effects: {
    glassCard: {
      shadowColor: "rgba(0,0,0,0.6)",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.28,
      shadowRadius: 20,
      elevation: 6,
    },
    glassPill: {
      shadowColor: "rgba(0,0,0,0.5)",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.24,
      shadowRadius: 14,
      elevation: 5,
    },
  },
  ...baseTheme,
};

export const getTheme = (mode: ThemeMode): Theme =>
  mode === "dark" ? darkTheme : lightTheme;

const ThemeContext = createContext<Theme>(lightTheme);

type ThemeProviderProps = {
  preference: ThemePreference;
  children: ReactNode;
};

export function ThemeProvider({ preference, children }: ThemeProviderProps) {
  const systemScheme = useColorScheme();
  const mode: ThemeMode =
    preference === "system" ? (systemScheme === "dark" ? "dark" : "light") : preference;
  const value = useMemo(() => getTheme(mode), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
