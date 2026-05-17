const googleMapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: "Alerty",
  slug: "alerty",
  scheme: "alerty",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#F6F2EA",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mrparagon.alerty",
    config: {
      googleMapsApiKey: googleMapsKey,
    },
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "Necesitamos tu ubicación para mostrar alertas cercanas y ubicar reportes.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Permite alertas críticas cerca de tus zonas guardadas.",
      NSPhotoLibraryUsageDescription:
        "Permite adjuntar fotos y videos a tus reportes.",
      NSCameraUsageDescription:
        "Permite capturar evidencia para tus reportes.",
      NSMicrophoneUsageDescription:
        "Permite grabar audio como evidencia en tus reportes.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "com.mrparagon.alerty",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#F6F2EA",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
    config: {
      googleMaps: {
        apiKey: googleMapsKey,
      },
    },
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Permite alertas críticas cerca de tus zonas guardadas.",
      },
    ],
    "expo-image-picker",
    "expo-camera",
    "expo-av",
    "expo-web-browser",
  ],
  extra: {
    router: {},
    eas: {
      projectId: "48ceeed2-37d4-429a-b641-0f27fe474283",
    },
  },
};
