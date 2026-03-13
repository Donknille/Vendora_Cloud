import { useEffect, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";

import { DateInput } from "@/components/DateInput";
import { useOrdersQuery, useUpdateOrderMutation } from "@/lib/cloud-queries";
import { formatCurrency } from "@/lib/formatCurrency";
import { useLanguage } from "@/lib/LanguageContext";
import {
  addEditableOrderItem,
  buildOrderMutationInput,
  calculateOrderFormTotal,
  createInitialOrderFormState,
  createOrderFormStateFromOrder,
  removeEditableOrderItem,
  updateEditableOrderItem,
  type OrderFormState,
} from "@/lib/order-form";
import { useTheme } from "@/lib/useTheme";

export default function EditOrderScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: orders = [] } = useOrdersQuery();
  const updateOrder = useUpdateOrderMutation();

  const order = orders.find((entry) => entry.id === id) || null;
  const [formState, setFormState] = useState<OrderFormState>(
    createInitialOrderFormState,
  );
  const [hydratedOrderId, setHydratedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!order || hydratedOrderId === order.id) {
      return;
    }

    setFormState(createOrderFormStateFromOrder(order));
    setHydratedOrderId(order.id);
  }, [hydratedOrderId, order]);

  const addItem = () => {
    setFormState((currentForm) => ({
      ...currentForm,
      items: addEditableOrderItem(currentForm.items),
    }));
  };

  const updateItem = (
    index: number,
    field: "name" | "quantity" | "price" | "notes",
    value: string,
  ) => {
    setFormState((currentForm) => ({
      ...currentForm,
      items: updateEditableOrderItem(currentForm.items, index, field, value),
    }));
  };

  const removeItem = (index: number) => {
    setFormState((currentForm) => ({
      ...currentForm,
      items: removeEditableOrderItem(currentForm.items, index),
    }));
  };

  const saveOrder = async () => {
    if (!id || !order) {
      return;
    }

    if (!formState.customerName.trim()) {
      Alert.alert(t.orders.missingInfo, t.orders.enterCustomerName);
      return;
    }

    if (formState.items.some((item) => !item.name.trim())) {
      Alert.alert(t.orders.missingInfo, t.orders.fillItemNames);
      return;
    }

    try {
      await updateOrder.mutateAsync({
        id,
        data: buildOrderMutationInput(formState, {
          invoiceNumber: order.invoiceNumber,
          updatedAt: new Date().toISOString(),
        }),
      });

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error("Failed to update order", error);
      Alert.alert("Fehler", "Der Auftrag konnte nicht gespeichert werden.");
    }
  };

  if (!order) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: theme.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={{ color: theme.textSecondary }}>Loading...</Text>
      </View>
    );
  }

  const total = calculateOrderFormTotal(formState);

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
            {t.orders.customer}
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
            value={formState.customerName}
            onChangeText={(customerName) =>
              setFormState((currentForm) => ({ ...currentForm, customerName }))
            }
            placeholder={t.orders.customerName}
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
            value={formState.customerEmail}
            onChangeText={(customerEmail) =>
              setFormState((currentForm) => ({ ...currentForm, customerEmail }))
            }
            placeholder={t.orders.email}
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
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
            value={formState.customerAddress}
            onChangeText={(customerAddress) =>
              setFormState((currentForm) => ({
                ...currentForm,
                customerAddress,
              }))
            }
            placeholder={t.orders.address}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <View style={styles.dateRow}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              {t.orders.orderDate}
            </Text>
            <DateInput
              value={formState.orderDate}
              onChange={(orderDate) =>
                setFormState((currentForm) => ({ ...currentForm, orderDate }))
              }
              placeholder={t.orders.orderDatePlaceholder}
            />
          </View>
          <View style={styles.dateRow}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Leistungsdatum / -zeitraum
            </Text>
            <DateInput
              value={formState.serviceDate}
              onChange={(serviceDate) =>
                setFormState((currentForm) => ({ ...currentForm, serviceDate }))
              }
              placeholder="YYYY-MM-DD"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t.orders.items}
            </Text>
            <Pressable onPress={addItem}>
              <Ionicons name="add-circle" size={28} color={theme.gold} />
            </Pressable>
          </View>

          {formState.items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.itemCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                },
              ]}
            >
              <View style={styles.itemHeader}>
                <Text style={[styles.itemNum, { color: theme.gold }]}>
                  #{index + 1}
                </Text>
                {formState.items.length > 1 && (
                  <Pressable onPress={() => removeItem(index)}>
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={theme.error}
                    />
                  </Pressable>
                )}
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={item.name}
                onChangeText={(value) => updateItem(index, "name", value)}
                placeholder={t.orders.itemName}
                placeholderTextColor={theme.textSecondary}
              />
              <View style={styles.itemRow}>
                <View style={styles.itemField}>
                  <Text
                    style={[styles.fieldLabel, { color: theme.textSecondary }]}
                  >
                    {t.orders.qty}
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
                    value={item.quantity.toString()}
                    onChangeText={(value) =>
                      updateItem(index, "quantity", value)
                    }
                    keyboardType="number-pad"
                  />
                </View>
                <View style={[styles.itemField, { flex: 2 }]}>
                  <Text
                    style={[styles.fieldLabel, { color: theme.textSecondary }]}
                  >
                    {t.orders.price}
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
                    value={item.priceText}
                    onChangeText={(value) => updateItem(index, "price", value)}
                    placeholder="0,00"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.inputBg,
                    color: theme.text,
                    borderColor: theme.border,
                    marginTop: 4,
                  },
                ]}
                value={item.notes}
                onChangeText={(value) => updateItem(index, "notes", value)}
                placeholder={t.orders.additionalNotes || "Notizen zum Artikel"}
                placeholderTextColor={theme.textSecondary}
              />
            </View>
          ))}

          <View
            style={[
              styles.itemCard,
              { borderColor: theme.border, backgroundColor: theme.card },
            ]}
          >
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
              Versandkosten
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
              value={formState.shippingCost}
              onChangeText={(shippingCost) =>
                setFormState((currentForm) => ({
                  ...currentForm,
                  shippingCost,
                }))
              }
              placeholder="0,00"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            {t.orders.notes}
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
            placeholder={t.orders.additionalNotes}
            placeholderTextColor={theme.textSecondary}
            multiline
          />
        </View>

        <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.totalLabel, { color: theme.textSecondary }]}>
            {t.orders.total}
          </Text>
          <Text style={[styles.totalValue, { color: theme.gold }]}>
            {formatCurrency(total)}
          </Text>
        </View>

        <Pressable
          onPress={saveOrder}
          disabled={updateOrder.isPending}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.gold },
            (pressed || updateOrder.isPending) && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="checkmark" size={20} color="#0D0D0D" />
          <Text style={styles.saveBtnText}>Auftrag speichern</Text>
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
  },
  multiline: { minHeight: 70, textAlignVertical: "top" },
  itemCard: { borderRadius: 14, padding: 14, gap: 10, borderWidth: 1 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  itemNum: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  itemRow: { flexDirection: "row", gap: 12 },
  itemField: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  dateRow: { gap: 6 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 16,
  },
  totalLabel: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  totalValue: { fontSize: 28, fontFamily: "Inter_700Bold" },
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
});
