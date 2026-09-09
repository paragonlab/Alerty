export const lightTheme = {
  colors: {
    background: "#F6F2EA",
    surface: "#FFFFFF",
    surfaceAlt: "#EFE6D7",
    border: "#E1D4C2",
    text: "#1B1A17",
    textMuted: "#6A6257",
    accent: "#D9552B",
    accentSoft: "#F3B8A4",
    success: "#1F9D6E",
    warning: "#D79A24",
    danger: "#B6402F",
    mapRed: "#D9342B",
    mapOrange: "#E9792F",
    mapYellow: "#E5C548",
    mapVerified: "#2C7BE5",
    mapMedia: "#5A4C3B",
    reportAction: "#E53935", // Red Alert
  },
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

export const darkHighVisibility = {
  colors: {
    background: "#000000",
    surface: "#121212",
    surfaceAlt: "#1A1A1A",
    border: "#333333",
    text: "#FFFFFF",
    textMuted: "#999999",
    accent: "#FF4500", // Neon Orange/Red
    accentSoft: "#331600",
    success: "#00FF41", // Neon Green
    warning: "#FFEA00", // Neon Yellow
    danger: "#FF0000", // Neon Red
    mapRed: "#FF0000",
    mapOrange: "#FF8C00",
    mapYellow: "#FFFF00",
    mapVerified: "#00E0FF", // Neon Cyan
    mapMedia: "#FF00FF", // Neon Magenta
    reportAction: "#FF3131", // Neon Red Alert
  },
  radius: lightTheme.radius,
  fonts: lightTheme.fonts,
};

/** Estilo Google Maps / Android para modo nocturno. */
export const DARK_MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#0b0b0b" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9a9a9a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0b0b0b" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#112018" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c1c1c" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3a2210" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a1624" }] },
];

// Default export for backward compatibility
export const theme = lightTheme;
