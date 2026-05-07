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
import { ALERT_CATEGORIES, CATEGORY_LABELS, REPUTATION_LEVELS } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { supabase } from "../../lib/supabase";

export default function SettingsScreen() {
  const {
    lowConnection,
    setLowConnection,
    pushEnabled,
    setPushEnabled,
    activeCategories,
    toggleCategory,
    setCategoryDefaults,
    themeMode,
    setThemeMode,
    showHeatmap,
    setShowHeatmap,
    currentUser,
  } = useAlertyStore();

  const theme = useAlertyTheme();
  const styles = createStyles(theme);

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

  const isDark = themeMode === "darkHighVisibility";
  const levelKey = (currentUser.level as keyof typeof REPUTATION_LEVELS) || "CIUDADANO";
  const levelInfo = REPUTATION_LEVELS[levelKey];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>Personaliza tu experiencia en Alerty.</Text>
        </View>

        {/* Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.avatarCircle}>
            <Ionicons name="person" size={26} color={theme.colors.textMuted} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.accountUsername}>{currentUser.username}</Text>
            <View style={[styles.levelBadge, { backgroundColor: levelInfo.color + "22" }]}>
              <Ionicons name={levelInfo.icon as any} size={10} color={levelInfo.color} />
              <Text style={[styles.levelText, { color: levelInfo.color }]}>{levelInfo.label}</Text>
            </View>
          </View>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={15} color={theme.colors.danger} />
            <Text style={styles.signOutText}>Salir</Text>
          </Pressable>
        </View>

        {/* Appearance */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="contrast-outline" size={15} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>Apariencia</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Modo Nocturno (Alta Visibilidad)</Text>
              <Text style={styles.helperText}>Neon de alto contraste para situaciones de poca luz.</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={(val) => setThemeMode(val ? "darkHighVisibility" : "light")}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + "80" }}
              thumbColor={isDark ? theme.colors.accent : "#C9BBA8"}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="notifications-outline" size={15} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>Notificaciones</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Push críticas</Text>
              <Text style={styles.helperText}>Avisos inmediatos si ocurre algo a menos de 2 km.</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={setPushEnabled}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + "80" }}
              thumbColor={pushEnabled ? theme.colors.accent : "#C9BBA8"}
            />
          </View>
        </View>

        {/* Map */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="map-outline" size={15} color={theme.colors.accent} />
            <Text style={styles.cardTitle}>Mapa</Text>
          </View>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Mapa de Calor</Text>
              <Text style={styles.helperText}>Visualiza zonas de alta actividad de reportes.</Text>
            </View>
            <Switch
              value={showHeatmap}
              onValueChange={setShowHeatmap}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + "80" }}
              thumbColor={showHeatmap ? theme.colors.accent : "#C9BBA8"}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Modo baja conexión</Text>
              <Text style={styles.helperText}>Reduce animaciones y consumo de datos en mala señal.</Text>
            </View>
            <Switch
              value={lowConnection}
              onValueChange={setLowConnection}
              trackColor={{ false: theme.colors.border, true: theme.colors.accent + "80" }}
              thumbColor={lowConnection ? theme.colors.accent : "#C9BBA8"}
            />
          </View>
        </View>

        {/* Category Filters */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardHeader}>
              <Ionicons name="filter-outline" size={15} color={theme.colors.accent} />
              <Text style={styles.cardTitle}>Filtros por categoría</Text>
            </View>
            <Pressable style={styles.selectAll} onPress={handleSelectAll}>
              <Text style={styles.selectAllText}>
                {allSelected ? "Limpiar" : "Todas"}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    paddingTop: 4,
    gap: 12,
  },
  header: {
    marginTop: 8,
    gap: 4,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontFamily: theme.fonts.heading,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.body,
  },
  accountCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  accountUsername: {
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  levelText: {
    fontSize: 10,
    fontFamily: theme.fonts.heading,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingLabel: {
    color: theme.colors.text,
    fontSize: 14,
    fontFamily: theme.fonts.body,
    marginBottom: 2,
  },
  helperText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    opacity: 0.6,
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
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: theme.colors.surfaceAlt,
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
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: theme.colors.surfaceAlt,
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
    borderColor: theme.colors.danger + "50",
    borderRadius: theme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.colors.danger + "12",
  },
  signOutText: {
    color: theme.colors.danger,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
});
