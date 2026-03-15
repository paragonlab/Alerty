import { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../lib/theme";
import type { Theme } from "../../lib/theme";
import { ALERT_CATEGORIES, CATEGORY_LABELS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { supabase } from "../../lib/supabase";

export default function SettingsScreen() {
  const theme = useTheme();
  const {
    lowConnection,
    setLowConnection,
    pushEnabled,
    setPushEnabled,
    activeCategories,
    toggleCategory,
    setCategoryDefaults,
    themePreference,
    setThemePreference,
  } = useAlertyStore();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const allSelected = useMemo(
    () => activeCategories.length === ALERT_CATEGORIES.length,
    [activeCategories],
  );

  const handleSelectAll = () => {
    if (allSelected) {
      setCategoryDefaults([]);
      return;
    }
    setCategoryDefaults([...ALERT_CATEGORIES]);
  };

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>Personaliza alertas y consumo.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Apariencia</Text>
          <View style={styles.themeRow}>
            {(["system", "light", "dark"] as const).map((mode) => {
              const active = themePreference === mode;
              const label = mode === "system" ? "Sistema" : mode === "light" ? "Claro" : "Oscuro";
              return (
                <Pressable
                  key={mode}
                  style={[styles.themePill, active && styles.themePillActive]}
                  onPress={() => setThemePreference(mode)}
                >
                  <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.helperText}>
            Usa el modo del sistema o fuerza un estilo claro u oscuro.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Notificaciones</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.cardText}>Push críticas</Text>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.accentSoft }}
              thumbColor={pushEnabled ? theme.colors.accent : "#F2C2C7"}
            />
          </View>
          <Text style={styles.helperText}>
            Recibe avisos inmediatos si ocurre algo a menos de 2 km de tus zonas guardadas.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modo baja conexión</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.cardText}>Reducir animaciones</Text>
            <Switch
              value={lowConnection}
              onValueChange={setLowConnection}
              trackColor={{ false: theme.colors.border, true: theme.colors.accentSoft }}
              thumbColor={lowConnection ? theme.colors.accent : "#F2C2C7"}
            />
          </View>
          <Text style={styles.helperText}>
            Disminuye efectos del mapa y consumo de datos en zonas con mala señal.
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Filtros por categoría</Text>
            <Pressable style={styles.selectAll} onPress={handleSelectAll}>
              <Text style={styles.selectAllText}>
                {allSelected ? "Limpiar" : "Seleccionar todo"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.categoryWrap}>
            {ALERT_CATEGORIES.map((category) => {
              const active = activeCategories.includes(category);
              return (
                <Pressable
                  key={category}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => toggleCategory(category)}
                >
                  <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                    {CATEGORY_LABELS[category]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cuenta</Text>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.cardText}>Cuenta conectada</Text>
              <Text style={styles.helperText}>Supabase / OAuth</Text>
            </View>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={16} color={theme.colors.text} />
              <Text style={styles.signOutText}>Salir</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 14,
  },
  header: {
    marginTop: 8,
    gap: 6,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontFamily: theme.fonts.heading,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 14,
    gap: 10,
    ...theme.effects.glassCard,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  cardText: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.body,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themePill: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  themePillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  themePillText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  themePillTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  categoryWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryPill: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  categoryPillActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accentSoft,
  },
  categoryText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  categoryTextActive: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
  },
  selectAll: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  selectAllText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.colors.surfaceAlt,
    ...theme.effects.glassPill,
  },
  signOutText: {
    color: theme.colors.text,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  });
