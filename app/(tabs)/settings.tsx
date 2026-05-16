import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ALERT_CATEGORIES, CATEGORY_LABELS, getLevelProgress } from "../../lib/alerty/constants";
import { useAlertyStore } from "../../lib/alerty/store";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { supabase } from "../../lib/supabase";
import { useRouter } from "expo-router";

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
    updateUsername,
  } = useAlertyStore();

  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);

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

  const handleStartEditUsername = () => {
    setUsernameInput(currentUser.username.replace(/^@/, ""));
    setUsernameError(null);
    setEditingUsername(true);
  };

  const handleCancelEditUsername = () => {
    setEditingUsername(false);
    setUsernameError(null);
    setUsernameInput("");
  };

  const handleUsernameChange = (text: string) => {
    // strip any @ the user pastes — el prefijo es fijo
    setUsernameInput(text.replace(/@/g, ""));
  };

  const handleSaveUsername = async () => {
    setSavingUsername(true);
    setUsernameError(null);
    const { error } = await updateUsername("@" + usernameInput.trim());
    if (error) {
      setUsernameError(error);
    } else {
      setEditingUsername(false);
      setUsernameInput("");
    }
    setSavingUsername(false);
  };

  const isDark = themeMode === "darkHighVisibility";
  const levelProgress = getLevelProgress(Number(currentUser.trustScore ?? 0));

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
          <View style={styles.accountTop}>
            <View style={styles.avatarCircle}>
              <Ionicons name="person" size={26} color={theme.colors.textMuted} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {editingUsername ? (
                <View style={styles.usernameInputRow}>
                  <Text style={styles.usernamePrefix}>@</Text>
                  <TextInput
                    value={usernameInput}
                    onChangeText={handleUsernameChange}
                    style={styles.usernameInput}
                    autoFocus
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!savingUsername}
                    maxLength={19}
                    placeholder="miNombre"
                    placeholderTextColor={theme.colors.textMuted}
                  />
                </View>
              ) : (
                <View style={styles.usernameRow}>
                  <Text style={styles.accountUsername}>{currentUser.username}</Text>
                  {currentUser.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color={theme.colors.accent} />
                  )}
                  {currentUser.isPremium && (
                    <Ionicons name="star" size={16} color="#F59E0B" />
                  )}
                  <Pressable
                    onPress={handleStartEditUsername}
                    hitSlop={8}
                    style={styles.editIconButton}
                  >
                    <Ionicons name="pencil-outline" size={14} color={theme.colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <View style={[styles.levelBadge, { backgroundColor: levelProgress.current.color + "22" }]}>
                <Ionicons name={levelProgress.current.icon as any} size={10} color={levelProgress.current.color} />
                <Text style={[styles.levelText, { color: levelProgress.current.color }]}>
                  {levelProgress.current.label}
                </Text>
              </View>
            </View>
            {!editingUsername && (
              <Pressable style={styles.signOutButton} onPress={handleSignOut}>
                <Ionicons name="log-out-outline" size={15} color={theme.colors.danger} />
                <Text style={styles.signOutText}>Salir</Text>
              </Pressable>
            )}
          </View>

          {editingUsername && (
            <View style={styles.editActions}>
              {usernameError ? (
                <Text style={styles.usernameError}>{usernameError}</Text>
              ) : (
                <Text style={styles.usernameHint}>3-19 letras, números o _</Text>
              )}
              <View style={styles.editButtonsRow}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={handleCancelEditUsername}
                  disabled={savingUsername}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveButton, savingUsername && styles.saveButtonDisabled]}
                  onPress={handleSaveUsername}
                  disabled={savingUsername}
                >
                  {savingUsername ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Guardar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Level Progress Card */}
        <View style={styles.levelCard}>
          <View style={styles.levelHeader}>
            <View style={[styles.levelIconWrap, { backgroundColor: levelProgress.current.color + "22" }]}>
              <Ionicons
                name={levelProgress.current.icon as any}
                size={18}
                color={levelProgress.current.color}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelCardLabel}>{levelProgress.current.label}</Text>
              <Text style={styles.levelCardScore}>
                {Number(currentUser.trustScore ?? 0)} pts de reputación
              </Text>
            </View>
          </View>

          {levelProgress.next ? (
            <>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(4, levelProgress.progress * 100)}%`,
                      backgroundColor: levelProgress.current.color,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressHint}>
                {levelProgress.pointsToNext} pts para {levelProgress.next.label}
              </Text>
            </>
          ) : (
            <Text style={styles.progressHint}>Has alcanzado el nivel máximo.</Text>
          )}
        </View>

        {/* Premium Banner */}
        {!currentUser.isPremium && (
          <Pressable style={styles.premiumBanner} onPress={() => router.push("/premium")}>
            <View style={styles.premiumIconWrap}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumBannerTitle}>Alerty Plus</Text>
              <Text style={styles.premiumBannerDesc}>Mejora para tener mapa de calor, alertas SMS y sin anuncios.</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        )}

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
              <Text style={styles.settingLabel}>
                Mapa de Calor 
                {!currentUser.isPremium && (
                  <Text style={{ color: theme.colors.accent }}> (Plus)</Text>
                )}
              </Text>
              <Text style={styles.helperText}>Visualiza zonas de alta actividad de reportes.</Text>
            </View>
            <Switch
              value={showHeatmap}
              onValueChange={(val) => {
                if (!currentUser.isPremium) {
                  router.push("/premium");
                  return;
                }
                setShowHeatmap(val);
              }}
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
    gap: 12,
  },
  accountTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editIconButton: {
    padding: 2,
  },
  usernameInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.accent,
    paddingVertical: 2,
  },
  usernamePrefix: {
    color: theme.colors.textMuted,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  usernameInput: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 16,
    fontFamily: theme.fonts.heading,
    padding: 0,
  },
  editActions: {
    gap: 10,
  },
  usernameHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  usernameError: {
    color: theme.colors.danger,
    fontSize: 12,
    fontFamily: theme.fonts.body,
  },
  editButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  cancelButtonText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  saveButton: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.accent,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
  levelCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    gap: 12,
  },
  levelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  levelIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  levelCardLabel: {
    color: theme.colors.text,
    fontSize: 15,
    fontFamily: theme.fonts.heading,
  },
  levelCardScore: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: theme.colors.surfaceAlt,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  progressHint: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontFamily: theme.fonts.body,
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
  premiumBanner: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.xl,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: theme.colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  premiumIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  premiumBannerTitle: {
    color: "#fff",
    fontSize: 16,
    fontFamily: theme.fonts.heading,
  },
  premiumBannerDesc: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: theme.fonts.body,
    marginTop: 2,
    lineHeight: 16,
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
