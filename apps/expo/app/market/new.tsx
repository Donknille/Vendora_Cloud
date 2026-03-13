import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { parseAmount } from "@/lib/formatCurrency";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useCreateMarketMutation } from "@/lib/cloud-queries";

export default function NewMarketScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [standFee, setStandFee] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [notes, setNotes] = useState("");
  const [quickItems, setQuickItems] = useState<{ name: string; priceText: string }[]>([{ name: "", priceText: "" }]);
  const createMarket = useCreateMarketMutation();

  const addQuickItem = () => {
    setQuickItems([...quickItems, { name: "", priceText: "" }]);
  };

  const updateQuickItem = (index: number, field: "name" | "price", value: string) => {
    const updated = [...quickItems];
    if (field === "name") updated[index].name = value;
    else updated[index].priceText = value;
    setQuickItems(updated);
  };

  const removeQuickItem = (index: number) => {
    if (quickItems.length <= 1) {
      setQuickItems([{ name: "", priceText: "" }]);
      return;
    }
    setQuickItems(quickItems.filter((_, i) => i !== index));
  };

  const saveMarket = async () => {
    if (!name.trim()) {
      Alert.alert(t.orders.missingInfo, t.markets.marketName);
      return;
    }

    const validQuickItems = quickItems
      .filter(i => i.name.trim() && i.priceText.trim())
      .map(i => ({ name: i.name.trim(), price: parseAmount(i.priceText) }));

    const newMarketData = {
      name: name.trim(),
      date,
      location: location.trim(),
      standFee: parseAmount(standFee),
      travelCost: parseAmount(travelCost),
      notes: notes.trim(),
      status: "open" as const,
      quickItems: validQuickItems,
    };

    await createMarket.mutateAsync(newMarketData);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.markets.eventDetails}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={name}
            onChangeText={setName}
            placeholder={t.markets.marketName}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={location}
            onChangeText={setLocation}
            placeholder={t.markets.location}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.markets.costs}</Text>
          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t.markets.standFee}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={standFee}
                onChangeText={setStandFee}
                placeholder="0,00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t.markets.travelCost}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={travelCost}
                onChangeText={setTravelCost}
                placeholder="0,00"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.markets.notes}</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.markets.additionalNotes}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Schnellwahltasten</Text>
            <Pressable onPress={addQuickItem}>
              <Ionicons name="add-circle" size={24} color={theme.gold} />
            </Pressable>
          </View>
          <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 8 }}>
            Lege Artikel fest, die du auf dem Markt häufig verkaufst, um sie später mit einem Klick zu erfassen.
          </Text>

          {quickItems.map((item, index) => (
            <View key={index} style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
              <TextInput
                style={[styles.input, { flex: 2, backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={item.name}
                onChangeText={(v) => updateQuickItem(index, "name", v)}
                placeholder="Artikelname (z.B. Tasse)"
                placeholderTextColor={theme.textSecondary}
              />
              <TextInput
                style={[styles.input, { flex: 1, backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={item.priceText}
                onChangeText={(v) => updateQuickItem(index, "price", v)}
                placeholder="Preis"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
              />
              <Pressable onPress={() => removeQuickItem(index)} style={{ justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </Pressable>
            </View>
          ))}
        </View>

        <Pressable
          onPress={saveMarket}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.gold },
            pressed && { opacity: 0.8 },
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
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: 12 },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0D0D0D" },
});
