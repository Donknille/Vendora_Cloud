import { useCallback, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Platform,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useLanguage } from "@/lib/LanguageContext";
import { useSubscription } from "@/lib/subscription";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, parseAmount } from "@/lib/formatCurrency";
import { confirmAction } from "@/lib/confirmAction";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown } from "react-native-reanimated";
import { DateInput } from "@/components/DateInput";
import { useExpensesQuery, useCreateExpenseMutation, useDeleteExpenseMutation } from "@/lib/cloud-queries";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const CATEGORIES = ["Materials", "Shipping", "Subscriptions", "Tools", "Marketing", "Packaging", "Other"];

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Materials: "color-palette-outline",
  Shipping: "car-outline",
  Subscriptions: "card-outline",
  Tools: "hammer-outline",
  Marketing: "megaphone-outline",
  Packaging: "gift-outline",
  Other: "ellipsis-horizontal-circle-outline",
};

export default function ExpensesScreen() {
  const theme = useTheme();
  const { t } = useLanguage();
  const { canCreateNewItems } = useSubscription();
  const insets = useSafeAreaInsets();

  const { data: expenses = [], refetch, isRefetching } = useExpensesQuery();
  const createExpense = useCreateExpenseMutation();
  const deleteExpenseMutation = useDeleteExpenseMutation();

  const [showModal, setShowModal] = useState(false);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Materials");
  const [expenseDate, setExpenseDate] = useState(toISODate(new Date()));

  const onRefresh = async () => {
    await refetch();
  };

  const addExpense = async () => {
    if (!description.trim() || !amount.trim()) return;
    await createExpense.mutateAsync({
      description: description.trim(),
      amount: parseAmount(amount),
      category,
      date: expenseDate,
      expenseDate: expenseDate,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDescription("");
    setAmount("");
    setCategory("Materials");
    setExpenseDate(toISODate(new Date()));
    setShowModal(false);
  };

  const deleteExpenseAction = (id: string) => {
    confirmAction(
      t.expenses.deleteExpense,
      t.expenses.areYouSure,
      t.expenses.cancel,
      t.expenses.delete,
      async () => {
        await deleteExpenseMutation.mutateAsync(id);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
    );
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    total: expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
  })).filter((c) => c.total > 0);

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  const getCategoryLabel = (cat: string) => {
    return (t.expenses.categories as Record<string, string>)[cat] || cat;
  };

  const renderExpense = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInDown.duration(300).delay(index * 40)}>
      <Pressable
        onLongPress={() => deleteExpenseAction(item.id)}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        <Card style={styles.expenseCard}>
          <View style={styles.expenseRow}>
            <View style={[styles.catIcon, { backgroundColor: theme.gold + "15" }]}>
              <Ionicons
                name={CATEGORY_ICONS[item.category] || "ellipsis-horizontal-circle-outline"}
                size={18}
                color={theme.gold}
              />
            </View>
            <View style={styles.expenseInfo}>
              <Text style={[styles.expenseDesc, { color: theme.text }]}>{item.description}</Text>
              <Text style={[styles.expenseMeta, { color: theme.textSecondary }]}>
                {getCategoryLabel(item.category)} {"\u2022"} {new Date(item.expenseDate || item.date).toLocaleDateString("de-DE")}
              </Text>
            </View>
            <Text style={[styles.expenseAmount, { color: theme.error }]}>
              -{formatCurrency(item.amount)}
            </Text>
          </View>
        </Card>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + webTopInset + 16 }]}>
        <Text style={[styles.heading, { color: theme.text }]}>{t.expenses.title}</Text>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            if (canCreateNewItems) {
              setShowModal(true);
            } else {
              router.push("/paywall");
            }
          }}
          style={({ pressed }) => [
            styles.addBtn,
            { backgroundColor: theme.gold },
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="add" size={24} color="#0D0D0D" />
        </Pressable>
      </View>

      {expenses.length > 0 && (
        <View style={styles.summaryRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryScroll}>
            <View style={[styles.summaryChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{t.expenses.total}</Text>
              <Text style={[styles.summaryValue, { color: theme.error }]}>
                {formatCurrency(totalExpenses)}
              </Text>
            </View>
            {byCategory.map((c) => (
              <View
                key={c.category}
                style={[styles.summaryChip, { backgroundColor: theme.card, borderColor: theme.border }]}
              >
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>{getCategoryLabel(c.category)}</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>
                  {formatCurrency(c.total)}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={renderExpense}
        contentContainerStyle={[
          styles.list,
          expenses.length === 0 && styles.emptyList,
          { paddingBottom: insets.bottom + 100 },
        ]}
        refreshing={isRefetching}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="wallet-outline"
            title={t.expenses.noExpenses}
            subtitle={t.expenses.noExpensesSub}
          />
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>{t.expenses.newExpense}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalForm}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t.expenses.description}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={description}
                  onChangeText={setDescription}
                  placeholder={t.expenses.whatSpent}
                  placeholderTextColor={theme.textSecondary}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t.expenses.amount}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="0,00"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t.expenses.expenseDate}</Text>
                <DateInput
                  value={expenseDate}
                  onChange={setExpenseDate}
                  placeholder={t.expenses.expenseDatePlaceholder}
                />
              </View>

              <View style={styles.field}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{t.expenses.category}</Text>
                <View style={styles.catGrid}>
                  {CATEGORIES.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: category === cat ? theme.gold + "20" : theme.inputBg,
                          borderColor: category === cat ? theme.gold : theme.border,
                        },
                      ]}
                    >
                      <Ionicons
                        name={CATEGORY_ICONS[cat] || "ellipsis-horizontal-circle-outline"}
                        size={16}
                        color={category === cat ? theme.gold : theme.textSecondary}
                      />
                      <Text
                        style={[
                          styles.catChipText,
                          { color: category === cat ? theme.gold : theme.textSecondary },
                        ]}
                      >
                        {getCategoryLabel(cat)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={addExpense}
                style={({ pressed }) => [
                  styles.saveBtn,
                  { backgroundColor: theme.gold },
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text style={styles.saveBtnText}>{t.expenses.addExpense}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold" },
  addBtn: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  summaryRow: { paddingVertical: 8 },
  summaryScroll: { paddingHorizontal: 20, gap: 8 },
  summaryChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, gap: 2 },
  summaryLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  summaryValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
  list: { padding: 20, gap: 8 },
  emptyList: { flex: 1 },
  expenseCard: { paddingVertical: 12 },
  expenseRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  catIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  expenseInfo: { flex: 1, gap: 2 },
  expenseDesc: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  expenseMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  expenseAmount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: "85%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalForm: { gap: 20, paddingBottom: 40 },
  field: { gap: 8 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  input: { borderRadius: 12, padding: 14, fontSize: 16, fontFamily: "Inter_400Regular", borderWidth: 1 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  catChipText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  saveBtn: { padding: 16, borderRadius: 14, alignItems: "center", marginTop: 8 },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#0D0D0D" },
});
