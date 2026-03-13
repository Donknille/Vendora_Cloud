import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";

import { DateInput } from "@/components/DateInput";
import { useCreateMarketMutation } from "@/lib/cloud-queries";
import { useLanguage } from "@/lib/LanguageContext";
import {
  addEditableQuickItem,
  buildMarketMutationInput,
  createInitialMarketFormState,
  removeEditableQuickItem,
  updateEditableQuickItem,
  type MarketFormState,
} from "@/lib/market-form";
import { useTheme } from "@/lib/useTheme";

export default function NewMarketScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const createMarket = useCreateMarketMutation();
  const [formState, setFormState] = useState<MarketFormState>(
    createInitialMarketFormState,
  );

  const addQuickItem = () => {
    setFormState((currentForm) => ({
      ...currentForm,
      quickItems: addEditableQuickItem(currentForm.quickItems),
    }));
  };

  const updateQuickItem = (
    index: number,
    field: "name" | "price",
    value: string,
  ) => {
    setFormState((currentForm) => ({
      ...currentForm,
      quickItems: updateEditableQuickItem(
        currentForm.quickItems,
        index,
        field,
        value,
      ),
    }));
  };

  const removeQuickItem = (index: number) => {
    setFormState((currentForm) => ({
      ...currentForm,
      quickItems: removeEditableQuickItem(currentForm.quickItems, index),
    }));
  };

  const saveMarket = async () => {
    if (!formState.name.trim()) {
      Alert.alert(t.orders.missingInfo, t.markets.marketName);
      return;
    }

    try {
      await createMarket.mutateAsync(
        buildMarketMutationInput(formState, { status: "open" }),
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error("Failed to create market", error);
      Alert.alert("Fehler", "Der Markt konnte nicht gespeichert werden.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.markets.eventDetails}
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={formState.name}
            onChangeText={(name) =>
              setFormState((currentForm) => ({ ...currentForm, name }))
            }
            placeholder={t.markets.marketName}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={formState.location}
            onChangeText={(location) =>
              setFormState((currentForm) => ({ ...currentForm, location }))
            }
            placeholder={t.markets.location}
            placeholderTextColor={theme.textSecondary}
          />
          <DateInput
            value={formState.date}
            onChange={(date) =>
              setFormState((currentForm) => ({ ...currentForm, date }))
            }
            placeholder="YYYY-MM-DD"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.markets.costs}
          </Text>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t.markets.standFee}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formState.standFee}
                onChangeText={(standFee) =>
                  setFormState((currentForm) => ({ ...currentForm, standFee }))
                }
                placeholder="0,00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                {t.markets.travelCost}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={formState.travelCost}
                onChangeText={(travelCost) =>
                  setFormState((currentForm) => ({
                    ...currentForm,
                    travelCost,
                  }))
                }
                placeholder="0,00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.markets.notes}
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.multiline,
              {
                backgroundColor: theme.inputBg,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={formState.notes}
            onChangeText={(notes) =>
              setFormState((currentForm) => ({ ...currentForm, notes }))
            }
            placeholder={t.markets.additionalNotes}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        <View style={styles.section}>
          <View style={styles.quickItemsHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Schnellwahltasten
            </Text>
            <Pressable onPress={addQuickItem}>
              <Ionicons name="add-circle" size={24} color={theme.gold} />
            </Pressable>
          </View>
          <Text style={[styles.quickItemsHint, { color: theme.textSecondary }]}>
            Lege Artikel fest, die du auf dem Markt haeufig verkaufst, um sie
            spaeter mit einem Klick zu erfassen.
          </Text>

          {formState.quickItems.map((item, index) => (
            <View key={`${index}-${item.name}`} style={styles.quickItemRow}>
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 2,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={item.name}
                onChangeText={(value) => updateQuickItem(index, "name", value)}
                placeholder="Artikelname (z.B. Tasse)"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[
                  styles.input,
                  {
                    flex: 1,
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={item.priceText}
                onChangeText={(value) => updateQuickItem(index, "price", value)}
                placeholder="Preis"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <Pressable
                onPress={() => removeQuickItem(index)}
                style={styles.quickItemDelete}
              >
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={saveMarket}
          disabled={createMarket.isPending}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.gold },
            (pressed || createMarket.isPending) && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="checkmark" size={20} color="#0D0D0D" />
          <Text style={styles.saveBtnText}>{t.markets.createMarket}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, gap: 24 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0D0D0D",
  },
  quickItemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quickItemsHint: { fontSize: 13, marginBottom: 8 },
  quickItemRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  quickItemDelete: { justifyContent: "center" },
});
