import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { TIME_FILTER_PILL_LABEL, TIME_FILTERS } from "../lib/alerty/constants";
import { useAlertyStore } from "../lib/alerty/store";

/** Horario en Videos: el mismo timeFilter del mapa y la lista, en estilo oscuro. */
export function ReelsTimeFilter() {
  const { timeFilter, setTimeFilter } = useAlertyStore();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      <Pressable
        style={styles.pill}
        onPress={() => {
          void Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        accessibilityLabel={`Horario: ${TIME_FILTER_PILL_LABEL[timeFilter]}. Cambiar`}
      >
        <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.9)" />
        <Text style={styles.pillText}>{TIME_FILTER_PILL_LABEL[timeFilter]}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={12} color="rgba(255,255,255,0.7)" />
      </Pressable>

      {open ? (
        <View style={styles.menu}>
          {TIME_FILTERS.map((filter) => {
            const active = filter === timeFilter;
            return (
              <Pressable
                key={filter}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => {
                  void Haptics.selectionAsync();
                  setTimeFilter(filter);
                  setOpen(false);
                }}
                accessibilityLabel={`Ver ${TIME_FILTER_PILL_LABEL[filter]}`}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>
                  {TIME_FILTER_PILL_LABEL[filter]}
                </Text>
                {active ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 11,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  pillText: {
    fontSize: 13,
    color: "#FFFFFF",
    fontFamily: "SpaceGrotesk_700Bold",
  },
  menu: {
    marginTop: 6,
    minWidth: 140,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "rgba(12,12,12,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
  },
  optionActive: {
    backgroundColor: "#FF4500",
  },
  optionText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    fontFamily: "SpaceGrotesk_500Medium",
  },
  optionTextActive: {
    color: "#FFFFFF",
    fontFamily: "SpaceGrotesk_700Bold",
  },
});
