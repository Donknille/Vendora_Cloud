import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { confirmAction } from "@/lib/confirmAction";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext, ThemeMode } from "@/lib/ThemeContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/Card";
import {
  profileStorage,
  type CompanyProfile,
  clearAllData,
} from "@/lib/storage";
import { useFocusEffect, router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useDeleteAccountMutation } from "@/lib/cloud-queries";
import { useAuth } from "@/lib/auth";
import { useSubscription } from "@/lib/subscription";

export default function SettingsScreen() {
  const theme = useTheme();
  const { themeMode, setThemeMode } = useThemeContext();
  const { t, language, setLanguage } = useLanguage();
  const { logout } = useAuth();
  const { isSubscribed, isInTrial, daysUntilTrialEnds } = useSubscription();
  const deleteAccountMutation = useDeleteAccountMutation();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<CompanyProfile>({
    name: "",
    address: "",
    email: "",
    phone: "",
    taxNote: "",
  });
  const [editing, setEditing] = useState(false);
  const [shippingCostInput, setShippingCostInput] = useState("");

  const loadProfile = useCallback(async () => {
    const data = await profileStorage.get();
    setProfile(data);
    setShippingCostInput(
      data.defaultShippingCost?.toString().replace(".", ",") ?? "",
    );
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const saveProfile = async () => {
    const cost = parseFloat(shippingCostInput.replace(",", ".")) || 0;
    const updatedProfile = { ...profile, defaultShippingCost: cost };
    await profileStorage.save(updatedProfile);
    setProfile(updatedProfile);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditing(false);
  };

  const handleLogout = () => {
    confirmAction(
      "Abmelden",
      "Moechtest du dich wirklich abmelden? Du musst dich danach wieder mit Google anmelden.",
      "Abbrechen",
      "Abmelden",
      () => {
        void logout();
      },
    );
  };

  const handleDeleteAccount = () => {
    confirmAction(
      "Konto unwiderruflich loeschen",
      "Bist du sicher? Dies loescht deinen Account und ALLE gespeicherten Daten dauerhaft. Laufende App-Store- oder Google-Play-Abos werden dadurch nicht automatisch gekuendigt und muessen separat im jeweiligen Store beendet werden.",
      "Abbrechen",
      "Konto loeschen",
      async () => {
        try {
          await deleteAccountMutation.mutateAsync();
          await clearAllData();
          await logout();

          setTimeout(() => {
            Alert.alert(
              "Konto geloescht",
              "Dein Account und alle dazugehoerigen Daten wurden erfolgreich geloescht.",
            );
          }, 300);
        } catch (error: any) {
          Alert.alert(
            "Fehler",
            "Beim Loeschen deines Accounts ist ein Fehler aufgetreten: " +
              error.message,
          );
        }
      },
    );
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: theme.text }]}>
          {t.settings.title}
        </Text>

        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <Card
            style={{
              backgroundColor: isSubscribed ? theme.gold + "15" : theme.card,
              borderColor: isSubscribed ? theme.gold : theme.border,
              borderWidth: 1,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={[
                  styles.sectionIcon,
                  {
                    backgroundColor: isSubscribed
                      ? theme.gold + "20"
                      : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="star"
                  size={18}
                  color={isSubscribed ? theme.gold : theme.textSecondary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontFamily: "Inter_700Bold",
                    color: isSubscribed ? theme.gold : theme.text,
                  }}
                >
                  {isSubscribed
                    ? "Vendora Pro"
                    : isInTrial
                      ? "Vendora Testversion"
                      : "Vendora Free"}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    fontFamily: "Inter_400Regular",
                    color: theme.textSecondary,
                    marginTop: 2,
                  }}
                >
                  {isSubscribed
                    ? "Du hast vollen Zugriff auf alle Cloud-Features."
                    : isInTrial
                      ? `Deine kostenlose Testphase endet in ${daysUntilTrialEnds} Tag${daysUntilTrialEnds === 1 ? "" : "en"}.`
                      : "Dein Abo ist abgelaufen. Du kannst keine neuen Daten mehr anlegen."}
                </Text>
              </View>
            </View>
            {!isSubscribed && (
              <Pressable
                onPress={() => router.push("/paywall")}
                style={({ pressed }) => [
                  {
                    marginTop: 16,
                    backgroundColor: theme.gold,
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: "center",
                  },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={{
                    color: "#0D0D0D",
                    fontSize: 15,
                    fontFamily: "Inter_600SemiBold",
                  }}
                >
                  Jetzt Upgraden
                </Text>
              </Pressable>
            )}
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(50)}>
          <Card>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: theme.gold + "15" }]}
              >
                <Ionicons
                  name="language-outline"
                  size={18}
                  color={theme.gold}
                />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.settings.language}
              </Text>
            </View>
            <View style={styles.langRow}>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLanguage("en");
                }}
                style={[
                  styles.langBtn,
                  {
                    backgroundColor:
                      language === "en" ? theme.gold + "20" : theme.inputBg,
                    borderColor: language === "en" ? theme.gold : theme.border,
                  },
                ]}
              >
                <Text style={[styles.langFlag, { fontSize: 20 }]}>EN</Text>
                <Text
                  style={[
                    styles.langLabel,
                    { color: language === "en" ? theme.gold : theme.text },
                  ]}
                >
                  English
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setLanguage("de");
                }}
                style={[
                  styles.langBtn,
                  {
                    backgroundColor:
                      language === "de" ? theme.gold + "20" : theme.inputBg,
                    borderColor: language === "de" ? theme.gold : theme.border,
                  },
                ]}
              >
                <Text style={[styles.langFlag, { fontSize: 20 }]}>DE</Text>
                <Text
                  style={[
                    styles.langLabel,
                    { color: language === "de" ? theme.gold : theme.text },
                  ]}
                >
                  Deutsch
                </Text>
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Card>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: theme.gold + "15" }]}
              >
                <Ionicons
                  name="contrast-outline"
                  size={18}
                  color={theme.gold}
                />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.settings.appearance}
              </Text>
            </View>
            <View style={styles.themeRow}>
              {(["light", "dark", "system"] as ThemeMode[]).map((mode) => {
                const isActive = themeMode === mode;
                const icons: Record<ThemeMode, keyof typeof Ionicons.glyphMap> = {
                  light: "sunny",
                  dark: "moon",
                  system: "phone-portrait-outline",
                };
                const labels: Record<ThemeMode, string> = {
                  light: t.settings.light,
                  dark: t.settings.dark,
                  system: t.settings.system,
                };
                return (
                  <Pressable
                    key={mode}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setThemeMode(mode);
                    }}
                    style={[
                      styles.themeBtn,
                      {
                        backgroundColor: isActive
                          ? theme.gold + "20"
                          : theme.inputBg,
                        borderColor: isActive ? theme.gold : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={icons[mode]}
                      size={18}
                      color={isActive ? theme.gold : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.themeBtnText,
                        { color: isActive ? theme.gold : theme.text },
                      ]}
                    >
                      {labels[mode]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: theme.gold + "15" }]}
              >
                <Ionicons
                  name="business-outline"
                  size={18}
                  color={theme.gold}
                />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.settings.companyProfile}
              </Text>
              <Pressable
                onPress={() => {
                  if (editing) {
                    void saveProfile();
                  } else {
                    setEditing(true);
                  }
                }}
              >
                <Ionicons
                  name={editing ? "checkmark" : "create-outline"}
                  size={22}
                  color={theme.gold}
                />
              </Pressable>
            </View>

            <View style={styles.fields}>
              <ProfileField
                label={t.settings.companyName}
                value={profile.name}
                editing={editing}
                onChange={(value) => setProfile({ ...profile, name: value })}
                theme={theme}
                notSetLabel={t.settings.notSet}
              />
              <ProfileField
                label={t.settings.address}
                value={profile.address}
                editing={editing}
                onChange={(value) =>
                  setProfile({ ...profile, address: value })
                }
                theme={theme}
                multiline
                notSetLabel={t.settings.notSet}
              />
              <ProfileField
                label={t.settings.email}
                value={profile.email}
                editing={editing}
                onChange={(value) => setProfile({ ...profile, email: value })}
                theme={theme}
                keyboardType="email-address"
                notSetLabel={t.settings.notSet}
              />
              <ProfileField
                label={t.settings.phone}
                value={profile.phone}
                editing={editing}
                onChange={(value) => setProfile({ ...profile, phone: value })}
                theme={theme}
                keyboardType="phone-pad"
                notSetLabel={t.settings.notSet}
              />
              <ProfileField
                label={t.settings.taxNote}
                value={profile.taxNote}
                editing={editing}
                onChange={(value) => setProfile({ ...profile, taxNote: value })}
                theme={theme}
                multiline
                placeholder={t.settings.taxNotePlaceholder}
                notSetLabel={t.settings.notSet}
              />
              <ProfileField
                label="Kleinunternehmer Text (Rechnung)"
                value={
                  profile.smallBusinessNote ??
                  "Gemaess Paragraf 19 UStG wird keine Umsatzsteuer berechnet."
                }
                editing={editing}
                onChange={(value) =>
                  setProfile({ ...profile, smallBusinessNote: value })
                }
                theme={theme}
                multiline
                placeholder="Gemaess Paragraf 19 UStG wird keine Umsatzsteuer berechnet."
                notSetLabel="Standard"
              />
              <ProfileField
                label="Standard Versandkosten"
                value={
                  editing
                    ? shippingCostInput
                    : profile.defaultShippingCost?.toString().replace(".", ",") ??
                      "0"
                }
                editing={editing}
                onChange={setShippingCostInput}
                theme={theme}
                keyboardType="decimal-pad"
                placeholder="0,00"
                notSetLabel="0,00 EUR"
              />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Card>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: theme.info + "20" }]}
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={theme.info}
                />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                {t.settings.dataBackup}
              </Text>
            </View>

            <View style={styles.cloudBackupInfo}>
              <Text style={[styles.privacyText, { color: theme.text }]}>
                Deine Auftraege, Maerkte, Verkaeufe und Ausgaben werden direkt in
                der Vendora Cloud gespeichert.
              </Text>
              <Text
                style={[styles.privacyText, { color: theme.textSecondary }]}
              >
                Ein manueller Export oder Import fuer Cloud-Geschaeftsdaten ist in
                dieser Version deaktiviert, damit keine veralteten lokalen
                Datenstaende entstehen.
              </Text>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Card>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIcon, { backgroundColor: theme.gold + "15" }]}
              >
                <Ionicons name="cloud-outline" size={18} color={theme.gold} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Account
              </Text>
            </View>
            <Text
              style={[
                styles.privacyText,
                { color: theme.textSecondary, marginBottom: 16 },
              ]}
            >
              Du bist angemeldet und deine Daten werden sicher in der Vendora
              Cloud gespeichert.
            </Text>
            <Text
              style={[
                styles.privacyText,
                { color: theme.textSecondary, marginBottom: 16 },
              ]}
            >
              Wenn du dein Konto loeschst, musst du bestehende Abos zusaetzlich in
              den Store-Einstellungen kuendigen. Die App kann laufende App-Store-
              oder Google-Play-Abos nicht fuer dich beenden.
            </Text>

            <View style={styles.actionList}>
              <Pressable
                onPress={handleLogout}
                style={({ pressed }) => [
                  styles.actionRow,
                  { borderBottomColor: theme.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.text} />
                <Text style={[styles.actionText, { color: theme.text }]}>
                  Abmelden
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>

              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleteAccountMutation.isPending}
                style={({ pressed }) => [
                  styles.actionRow,
                  (pressed || deleteAccountMutation.isPending) && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color={theme.error}
                />
                <Text
                  style={[
                    styles.actionText,
                    { color: theme.error, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {deleteAccountMutation.isPending
                    ? "Konto wird geloescht..."
                    : "Konto unwiderruflich loeschen"}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.textSecondary}
                />
              </Pressable>
            </View>
          </Card>
        </Animated.View>

        <Text style={[styles.version, { color: theme.textSecondary }]}>
          Vendora v1.1.1 (Cloud)
        </Text>
      </ScrollView>
    </View>
  );
}

function ProfileField({
  label,
  value,
  editing,
  onChange,
  theme,
  multiline,
  keyboardType,
  placeholder,
  notSetLabel,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (value: string) => void;
  theme: any;
  multiline?: boolean;
  keyboardType?:
    | "default"
    | "email-address"
    | "numeric"
    | "phone-pad"
    | "decimal-pad";
  placeholder?: string;
  notSetLabel: string;
}) {
  return (
    <View style={pfStyles.field}>
      <Text style={[pfStyles.label, { color: theme.textSecondary }]}>
        {label}
      </Text>
      {editing ? (
        <TextInput
          style={[
            pfStyles.input,
            {
              backgroundColor: theme.inputBg,
              color: theme.text,
              borderColor: theme.border,
            },
            multiline && { minHeight: 60, textAlignVertical: "top" },
          ]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || label}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          keyboardType={keyboardType}
        />
      ) : (
        <Text
          style={[
            pfStyles.value,
            { color: value ? theme.text : theme.textSecondary },
          ]}
        >
          {value || notSetLabel}
        </Text>
      )}
    </View>
  );
}

const pfStyles = StyleSheet.create({
  field: { gap: 4 },
  label: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  value: { fontSize: 15, fontFamily: "Inter_400Regular" },
  input: {
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 16 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  themeRow: { flexDirection: "row", gap: 10 },
  themeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  themeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  langRow: { flexDirection: "row", gap: 12 },
  langBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  langFlag: { fontFamily: "Inter_700Bold" },
  langLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  fields: { gap: 16 },
  actionList: { gap: 0 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  cloudBackupInfo: { gap: 10 },
  actionText: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  privacyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  version: {
    textAlign: "center",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
});
