/**
 * Selector de ciudad de producto (Culiacán / Mazatlán).
 * Tonos calmados: elegir dónde mirar, no alarmar.
 */
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  getActiveCitySlug,
  listSelectableCities,
  type CitySlug,
} from "../lib/alerty/city";
import { selectCity } from "../lib/alerty/selectCity";
import { useAlertyTheme } from "../lib/useAlertyTheme";
import { useAlertyStore } from "../lib/alerty/store";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Tras cambiar ciudad (p. ej. centrar el mapa). */
  onCitySelected?: (slug: CitySlug) => void;
};

export function CityPickerModal({ visible, onClose, onCitySelected }: Props) {
  const theme = useAlertyTheme();
  const themeMode = useAlertyStore((s) => s.themeMode);
  const isDark = themeMode === "darkHighVisibility";
  const cities = useMemo(() => listSelectableCities(), []);
  const [selected, setSelected] = useState<CitySlug>(getActiveCitySlug);
  const [saving, setSaving] = useState(false);

  const handleOpen = () => {
    setSelected(getActiveCitySlug());
  };

  const handleSelect = async (slug: CitySlug) => {
    if (saving) return;
    if (slug === getActiveCitySlug()) {
      onClose();
      return;
    }
    setSaving(true);
    setSelected(slug);
    try {
      await selectCity(slug);
      onCitySelected?.(slug);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!saving) onClose();
        }}
        accessibilityLabel="Cerrar selector de ciudad"
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? "#121212" : theme.colors.surface,
              borderColor: isDark ? "#333" : theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={[styles.title, { color: theme.colors.text, fontFamily: theme.fonts.heading }]}>
            Tu ciudad
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: theme.colors.textMuted, fontFamily: theme.fonts.body },
            ]}
          >
            Elige dónde quieres ver el mapa y los pulsos. Puedes cambiar cuando quieras.
          </Text>

          <View style={styles.list}>
            {cities.map((city) => {
              const active = city.slug === selected;
              return (
                <Pressable
                  key={city.id}
                  style={[
                    styles.row,
                    {
                      borderColor: active ? theme.colors.accent : theme.colors.border,
                      backgroundColor: active
                        ? isDark
                          ? theme.colors.accentSoft
                          : "rgba(217,85,43,0.08)"
                        : isDark
                          ? theme.colors.surfaceAlt
                          : theme.colors.surfaceAlt,
                    },
                  ]}
                  onPress={() => void handleSelect(city.slug)}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${city.name}, ${city.state}`}
                >
                  <View style={styles.rowText}>
                    <Text
                      style={[
                        styles.cityName,
                        { color: theme.colors.text, fontFamily: theme.fonts.heading },
                      ]}
                    >
                      {city.name}
                    </Text>
                    <Text
                      style={[
                        styles.cityState,
                        { color: theme.colors.textMuted, fontFamily: theme.fonts.body },
                      ]}
                    >
                      {city.state}
                    </Text>
                  </View>
                  {saving && active ? (
                    <ActivityIndicator size="small" color={theme.colors.accent} />
                  ) : (
                    <Ionicons
                      name={active ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={active ? theme.colors.accent : theme.colors.textMuted}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 10,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(128,128,128,0.35)",
    marginBottom: 6,
  },
  title: {
    fontSize: 20,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  list: {
    gap: 10,
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  cityName: {
    fontSize: 17,
  },
  cityState: {
    fontSize: 13,
  },
});
