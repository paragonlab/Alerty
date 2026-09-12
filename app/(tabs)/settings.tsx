import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { UserAvatar } from "../../components/UserAvatar";
import { PROFILE_PRESETS, presetAvatarUrl } from "../../lib/alerty/avatars";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { ALERT_CATEGORIES, CATEGORY_LABELS, getLevelProgress } from "../../lib/alerty/constants";
import { ALIADO_PRICE_LABEL, CIRCULO_PRICE_LABEL, circuloZoneLimit } from "../../lib/alerty/circulo";
import { useAlertyStore } from "../../lib/alerty/store";
import { useAlertyTheme } from "../../lib/useAlertyTheme";
import { requireSession } from "../../lib/alerty/session";
import { supabase } from "../../lib/supabase";
import {
  syncPushRegistration,
  removePushTokens,
  PUSH_STATUS_HINT,
  type PushStatus,
} from "../../lib/notifications";
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
    updateAvatar,
    watchedZones,
    resetGuest,
  } = useAlertyStore();

  const theme = useAlertyTheme();
  const styles = createStyles(theme);
  const router = useRouter();

  // null = aún no comprobado. El interruptor solo dice qué quiere el usuario;
  // esto dice si el aviso de verdad va a llegar.
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);

  useEffect(() => {
    if (!pushEnabled) return;
    void syncPushRegistration().then(setPushStatus);
  }, [pushEnabled]);

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
    await removePushTokens();
    await supabase.auth.signOut();
  };

  const handleTogglePush = (value: boolean) => {
    setPushEnabled(value);
    if (!value) {
      setPushStatus(null);
      return;
    }
    void syncPushRegistration().then(setPushStatus);
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

  const confirmDeleteAccount = async () => {
    if (!supabase || deletingAccount) return;
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account");
      if (error) {
        Alert.alert("No se pudo eliminar", "Intenta de nuevo en unos segundos.");
        return;
      }
      await removePushTokens();
      await supabase.auth.signOut();
      resetGuest();
      Alert.alert("Cuenta eliminada", "Tus datos de cuenta ya no están en Pulso.");
    } catch {
      Alert.alert("No se pudo eliminar", "Intenta de nuevo en unos segundos.");
    } finally {
      setDeletingAccount(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Eliminar cuenta",
      "Se borra tu perfil, zonas y votos. Los pulsos que ya publicaste quedan anónimos. Esto no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => void confirmDeleteAccount() },
      ],
    );
  };

  const handlePickAvatar = async (id: string) => {
    setSavingAvatar(true);
    const { error } = await updateAvatar(presetAvatarUrl(id));
    setSavingAvatar(false);
    if (!error) setPickingAvatar(false);
  };

  const isDark = themeMode === "darkHighVisibility";
  const isGuest = currentUser.id === "local-user";
  const levelProgress = getLevelProgress(Number(currentUser.trustScore ?? 0));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Ajustes</Text>
          <Text style={styles.subtitle}>Personaliza tu experiencia en Pulso.</Text>
        </View>

        {/* Account Card */}
        <View style={styles.accountCard}>
          <View style={styles.accountTop}>
            {isGuest ? (
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={26} color={theme.colors.textMuted} />
              </View>
            ) : (
              <Pressable
                onPress={() => setPickingAvatar((open) => !open)}
                disabled={savingAvatar}
                accessibilityLabel="Cambiar personaje de perfil"
              >
                <UserAvatar
                  url={currentUser.avatarUrl}
                  muted={theme.colors.textMuted}
                  border={theme.colors.border}
                />
              </Pressable>
            )}
            {isGuest ? (
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={styles.accountUsername}>Sin cuenta</Text>
                <Text style={styles.guestHint}>
                  Puedes ver el mapa. Entra para reportar, seguir o enviar SOS.
                </Text>
                <Pressable
                  style={styles.signInButton}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Ionicons name="log-in-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.signInText}>Entrar</Text>
                </Pressable>
              </View>
            ) : (
            <>
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
            </>
            )}
          </View>

          {!isGuest && editingUsername && (
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

          {!isGuest && pickingAvatar && (
            <View style={styles.avatarPicker}>
              <Text style={styles.helperText}>Elige un personaje. Se ve en el mapa cuando reportas.</Text>
              <View style={styles.avatarGrid}>
                {PROFILE_PRESETS.map((preset) => {
                  const selected = currentUser.avatarUrl === presetAvatarUrl(preset.id);
                  return (
                    <Pressable
                      key={preset.id}
                      style={[styles.avatarOption, selected && styles.avatarOptionActive]}
                      onPress={() => void handlePickAvatar(preset.id)}
                      disabled={savingAvatar}
                    >
                      <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
                      <Text style={styles.avatarOptionLabel}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Level Progress Card */}
        {!isGuest && (
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
                {Math.round(Number(currentUser.trustScore ?? 0))} pts de reputación
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
          <Text style={styles.helperText}>
            +5 al reportar un pulso. +1 al confirmar el de alguien. Vigía a 20, Protector a 50, Héroe a 80.
          </Text>
        </View>
        )}

        {!currentUser.isPremium && (
          <Pressable
            style={styles.premiumBanner}
            onPress={async () => {
              if (await requireSession("/premium")) router.push("/premium");
            }}
          >
            <View style={styles.premiumIconWrap}>
              <Ionicons name="people" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.premiumBannerTitle}>Círculo</Text>
              <Text style={styles.premiumBannerDesc}>
                Una zona gratis. Más zonas por {CIRCULO_PRICE_LABEL} (Apple o Google). El mapa sigue gratis.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
        )}

        <Pressable
          style={styles.card}
          onPress={async () => {
            if (await requireSession("/circulo")) router.push("/circulo");
          }}
        >
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Mis zonas</Text>
              <Text style={styles.helperText}>
                {isGuest
                  ? "Inicia sesión para vigilar una colonia."
                  : `${watchedZones.length} de ${circuloZoneLimit(Boolean(currentUser.isPremium))} zonas`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </Pressable>

        <Pressable style={styles.card} onPress={() => router.push("/business")}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Aliado en el mapa</Text>
              <Text style={styles.helperText}>
                Pin de negocio. Se paga en la web ({ALIADO_PRICE_LABEL}). En iPhone no se cobra dentro de la app.
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </Pressable>

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
              <Text
                style={[
                  styles.helperText,
                  pushEnabled && pushStatus && pushStatus !== "ok" && { color: theme.colors.danger },
                ]}
              >
                {pushEnabled && pushStatus && pushStatus !== "ok"
                  ? `No vas a recibir avisos. ${PUSH_STATUS_HINT[pushStatus]}`
                  : "Avisos inmediatos si ocurre algo a menos de 2 km."}
              </Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
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
              <Text style={styles.helperText}>
                Manchas de Pulso: más rojas y grandes si el pulso es reciente o crítico. En iPhone se ve como círculos; en Android y web como calor.
              </Text>
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

        <Pressable style={styles.card} onPress={() => router.push("/privacy")}>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingLabel}>Política de privacidad</Text>
              <Text style={styles.helperText}>Qué datos usamos y para qué.</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </Pressable>

        {!isGuest && (
          <Pressable
            style={styles.card}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
          >
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: theme.colors.danger }]}>
                  Eliminar cuenta
                </Text>
                <Text style={styles.helperText}>
                  Borra tu perfil de Pulso. Pedido por las tiendas de apps.
                </Text>
              </View>
              {deletingAccount ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
              )}
            </View>
          </Pressable>
        )}
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
  avatarPicker: {
    gap: 10,
    paddingTop: 4,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  avatarOption: {
    width: "23%",
    minWidth: 68,
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceAlt,
  },
  avatarOptionActive: {
    borderColor: theme.colors.accent,
    backgroundColor: theme.colors.accent + "18",
  },
  avatarEmoji: {
    fontSize: 22,
  },
  avatarOptionLabel: {
    fontSize: 10,
    fontFamily: theme.fonts.body,
    color: theme.colors.textMuted,
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
  guestHint: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: theme.fonts.body,
  },
  signInButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: theme.radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.accent,
  },
  signInText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: theme.fonts.heading,
  },
});
