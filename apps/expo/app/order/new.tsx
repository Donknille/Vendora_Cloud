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
import { profileStorage, ordersStorage, OrderItem } from "@/lib/storage";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { DateInput } from "@/components/DateInput";
import { useCallback } from "react";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function NewOrderScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderDate, setOrderDate] = useState(toISODate(new Date()));
  const [serviceDate, setServiceDate] = useState(toISODate(new Date()));
  const [shippingCost, setShippingCost] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<{ id: string; name: string; quantity: number; priceText: string; notes: string }[]>([
    { id: "1", name: "", quantity: 1, priceText: "", notes: "" },
  ]);

  useFocusEffect(
    useCallback(() => {
      profileStorage.get().then((profile) => {
        if (profile.defaultShippingCost && !shippingCost) {
          setShippingCost(profile.defaultShippingCost.toString().replace('.', ','));
        }
      });
    }, [])
  );

  const addItem = () => {
    setItems([
      ...items,
      { id: Date.now().toString(), name: "", quantity: 1, priceText: "", notes: "" },
    ]);
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const updated = [...items];
    if (field === "name") {
      updated[index] = { ...updated[index], name: value as string };
    } else if (field === "quantity") {
      updated[index] = { ...updated[index], quantity: parseInt(value as string, 10) || 1 };
    } else if (field === "price") {
      updated[index] = { ...updated[index], priceText: value as string };
    } else if (field === "notes") {
      updated[index] = { ...updated[index], notes: value as string };
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const saveOrder = async () => {
    if (!customerName.trim()) {
      Alert.alert(t.orders.missingInfo, t.orders.enterCustomerName);
      return;
    }
    if (items.some((item) => !item.name.trim())) {
      Alert.alert(t.orders.missingInfo, t.orders.fillItemNames);
      return;
    }

    const parsedItems: OrderItem[] = items.map((item) => ({
      id: item.id,
      name: item.name.trim(),
      quantity: item.quantity,
      price: parseAmount(item.priceText),
      notes: item.notes?.trim() || "",
      isCompleted: false,
    }));

    await ordersStorage.add({
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerAddress: customerAddress.trim(),
      items: parsedItems,
      status: "open",
      notes: notes.trim(),
      orderDate: orderDate,
      serviceDate: serviceDate,
      shippingCost: parseAmount(shippingCost),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const itemsTotal = items.reduce((sum, item) => sum + parseAmount(item.priceText) * item.quantity, 0);
  const total = itemsTotal + parseAmount(shippingCost);

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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.customer}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder={t.orders.customerName}
            placeholderTextColor={theme.textSecondary}
          />
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={customerEmail}
            onChangeText={setCustomerEmail}
            placeholder={t.orders.email}
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={customerAddress}
            onChangeText={setCustomerAddress}
            placeholder={t.orders.address}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <View style={styles.dateRow}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t.orders.orderDate}</Text>
            <DateInput
              value={orderDate}
              onChange={setOrderDate}
              placeholder={t.orders.orderDatePlaceholder}
            />
          </View>
          <View style={styles.dateRow}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Leistungsdatum / -zeitraum</Text>
            <DateInput
              value={serviceDate}
              onChange={setServiceDate}
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.items}</Text>
            <Pressable onPress={addItem}>
              <Ionicons name="add-circle" size={28} color={theme.gold} />
            </Pressable>
          </View>

          {items.map((item, index) => (
            <View
              key={item.id}
              style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemNum, { color: theme.gold }]}>#{index + 1}</Text>
                {items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)}>
                    <Ionicons name="close-circle" size={22} color={theme.error} />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                value={item.name}
                onChangeText={(v) => updateItem(index, "name", v)}
                placeholder={t.orders.itemName}
                placeholderTextColor={theme.textSecondary}
              />
              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t.orders.qty}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={item.quantity.toString()}
                    onChangeText={(v) => updateItem(index, "quantity", v)}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.itemField, { flex: 2 }]}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{t.orders.price}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                    value={item.priceText}
                    onChangeText={(v) => updateItem(index, "price", v)}
                    placeholder="0,00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border, marginTop: 4 }]}
                value={item.notes}
                onChangeText={(v) => updateItem(index, "notes", v)}
                placeholder={t.orders.additionalNotes || "Notizen zum Artikel (optional)"}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          ))}

          <View style={styles.itemCard}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Versandkosten</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              value={shippingCost}
              onChangeText={setShippingCost}
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{t.orders.notes}</Text>
          <TextInput
            style={[styles.input, styles.multiline, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t.orders.additionalNotes}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>{t.orders.total}</Text>
          <Text style={[styles.totalValue, { color: theme.gold }]}>
            {formatCurrency(total)}
          </Text>
        </View>

        <Pressable
          onPress={saveOrder}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.gold },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="checkmark" size={20} color="#0D0D0D" />
          <Text style={styles.saveBtnText}>{t.orders.createOrder}</Text>
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
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  input: { borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", borderWidth: 1 },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  itemCard: { borderRadius: 14, padding: 14, gap: 10, borderWidth: 1 },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemRow: { flexDirection: "row", gap: 12 },
  itemField: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dateRow: { gap: 6 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingTop: 16 },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  totalValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: 14 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0D0D0D" },
});
