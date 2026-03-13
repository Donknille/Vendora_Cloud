import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { Card } from "@/components/Card";
import { useExpensesQuery, useMarketsQuery, useMarketSalesQuery, useOrdersQuery } from "@/lib/cloud-queries";
import { formatCurrency } from "@/lib/formatCurrency";
import { useLanguage } from "@/lib/LanguageContext";
import { generateFinancialReportHtml } from "@/lib/reportTemplate";
import { useSubscription } from "@/lib/subscription";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";

interface MonthlyData {
  month: string;
  revenue: number;
  expenses: number;
}

function getDateYear(dateStr: string): number {
  return new Date(dateStr).getFullYear();
}

export default function DashboardScreen() {
  const theme = useTheme();
  const { isDark } = useThemeContext();
  const { t } = useLanguage();
  const { isSubscribed } = useSubscription();
  const insets = useSafeAreaInsets();

  const {
    data: orders = [],
    refetch: refetchOrders,
    isRefetching: isRefetchingOrders,
  } = useOrdersQuery();
  const {
    data: markets = [],
    refetch: refetchMarkets,
    isRefetching: isRefetchingMarkets,
  } = useMarketsQuery();
  const {
    data: marketSales = [],
    refetch: refetchMarketSales,
    isRefetching: isRefetchingMarketSales,
  } = useMarketSalesQuery();
  const {
    data: expenses = [],
    refetch: refetchExpenses,
    isRefetching: isRefetchingExpenses,
  } = useExpensesQuery();

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(() => {
    refetchOrders();
    refetchMarkets();
    refetchMarketSales();
    refetchExpenses();
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchOrders(),
      refetchMarkets(),
      refetchMarketSales(),
      refetchExpenses(),
    ]);
    setRefreshing(false);
  };

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    orders.forEach((order) => yearSet.add(getDateYear(order.orderDate || order.createdAt)));
    markets.forEach((market) => yearSet.add(getDateYear(market.date)));
    marketSales.forEach((sale) => yearSet.add(getDateYear(sale.createdAt)));
    expenses.forEach((expense) => yearSet.add(getDateYear(expense.expenseDate || expense.date)));
    if (yearSet.size === 0) {
      yearSet.add(new Date().getFullYear());
    }
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [expenses, marketSales, markets, orders]);

  const yearStr = selectedYear ? `${selectedYear}` : null;

  const matchesYear = (dateStr: string) => {
    if (!yearStr) {
      return true;
    }
    return dateStr.startsWith(yearStr);
  };

  const filteredOrders = useMemo(
    () => orders.filter((order) => matchesYear(order.orderDate || order.createdAt)),
    [orders, yearStr],
  );
  const filteredMarkets = useMemo(
    () => markets.filter((market) => matchesYear(market.date)),
    [markets, yearStr],
  );
  const filteredMarketSales = useMemo(
    () => marketSales.filter((sale) => matchesYear(sale.createdAt)),
    [marketSales, yearStr],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((expense) => matchesYear(expense.expenseDate || expense.date)),
    [expenses, yearStr],
  );

  const totalOrderRevenue = filteredOrders
    .filter((order) => order.status !== "cancelled")
    .reduce((sum, order) => sum + order.total, 0);
  const totalMarketRevenue = filteredMarketSales.reduce(
    (sum, sale) => sum + sale.amount * sale.quantity,
    0,
  );
  const totalRevenue = totalOrderRevenue + totalMarketRevenue;

  const totalMarketCosts = filteredMarkets.reduce(
    (sum, market) => sum + market.standFee + market.travelCost,
    0,
  );
  const totalExpenses =
    filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0) +
    totalMarketCosts;
  const netProfit = totalRevenue - totalExpenses;

  const openOrders = filteredOrders.filter((order) => order.status === "open").length;
  const paidOrders = filteredOrders.filter((order) => order.status === "paid").length;

  const monthlyData = useMemo<MonthlyData[]>(() => {
    const data: MonthlyData[] = [];
    const year = selectedYear || new Date().getFullYear();

    if (selectedYear) {
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        const monthStr = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
        const monthRevenue =
          filteredOrders
            .filter(
              (order) =>
                order.status !== "cancelled" &&
                (order.orderDate || order.createdAt).startsWith(monthStr),
            )
            .reduce((sum, order) => sum + order.total, 0) +
          filteredMarketSales
            .filter((sale) => sale.createdAt.startsWith(monthStr))
            .reduce((sum, sale) => sum + sale.amount * sale.quantity, 0);

        const monthExpenses =
          filteredExpenses
            .filter((expense) =>
              (expense.expenseDate || expense.date).startsWith(monthStr),
            )
            .reduce((sum, expense) => sum + expense.amount, 0) +
          filteredMarkets
            .filter((market) => market.date.startsWith(monthStr))
            .reduce(
              (sum, market) => sum + market.standFee + market.travelCost,
              0,
            );

        data.push({
          month: t.months[monthIndex],
          revenue: monthRevenue,
          expenses: monthExpenses,
        });
      }

      return data;
    }

    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

      const monthRevenue =
        orders
          .filter(
            (order) =>
              order.status !== "cancelled" &&
              (order.orderDate || order.createdAt).startsWith(monthStr),
          )
          .reduce((sum, order) => sum + order.total, 0) +
        marketSales
          .filter((sale) => sale.createdAt.startsWith(monthStr))
          .reduce((sum, sale) => sum + sale.amount * sale.quantity, 0);

      const monthExpenses =
        expenses
          .filter((expense) =>
            (expense.expenseDate || expense.date).startsWith(monthStr),
          )
          .reduce((sum, expense) => sum + expense.amount, 0) +
        markets
          .filter((market) => market.date.startsWith(monthStr))
          .reduce((sum, market) => sum + market.standFee + market.travelCost, 0);

      data.push({
        month: t.months[date.getMonth()],
        revenue: monthRevenue,
        expenses: monthExpenses,
      });
    }

    return data;
  }, [
    expenses,
    filteredExpenses,
    filteredMarketSales,
    filteredMarkets,
    filteredOrders,
    marketSales,
    markets,
    orders,
    selectedYear,
    t.months,
  ]);

  const maxValue = Math.max(
    ...monthlyData.map((item) => Math.max(item.revenue, item.expenses)),
    1,
  );

  const exportReport = async () => {
    setGeneratingReport(true);

    try {
      const html = generateFinancialReportHtml(
        selectedYear,
        totalRevenue,
        totalExpenses,
        netProfit,
        monthlyData,
        t,
      );

      if (Platform.OS === "web") {
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.width = "0";
        iframe.style.height = "0";
        iframe.style.border = "none";
        document.body.appendChild(iframe);

        const doc = iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(html);
          doc.close();
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        }

        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      } else {
        const { uri } = await Print.printToFileAsync({
          html,
          base64: false,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: "application/pdf",
            dialogTitle: t.dashboard.shareReport,
            UTI: "com.adobe.pdf",
          });
        } else {
          Alert.alert(t.dashboard.shareReport, `PDF Export: ${uri}`);
        }
      }
    } catch (error) {
      console.error("Report generation error:", error);
      Alert.alert(t.dashboard.reportError);
    } finally {
      setGeneratingReport(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const isBusy =
    refreshing ||
    isRefetchingOrders ||
    isRefetchingMarkets ||
    isRefetchingMarketSales ||
    isRefetchingExpenses;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + webTopInset + 16,
            paddingBottom: insets.bottom + 100,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isBusy}
            onRefresh={onRefresh}
            tintColor={theme.gold}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <View style={styles.headerRow}>
            <View>
              <View style={styles.overviewRow}>
                <Text style={[styles.greeting, { color: theme.textSecondary }]}>
                  {t.dashboard.overview}
                </Text>
                {isSubscribed && (
                  <View
                    style={[
                      styles.proChip,
                      {
                        backgroundColor: `${theme.gold}20`,
                        borderColor: theme.gold,
                      },
                    ]}
                  >
                    <Text style={[styles.proChipText, { color: theme.gold }]}>
                      PRO
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.heading, { color: theme.text }]}>
                {t.dashboard.dashboard}
              </Text>
            </View>
            <Pressable
              onPress={exportReport}
              disabled={generatingReport}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
                (pressed || generatingReport) && { opacity: 0.7 },
              ]}
            >
              {generatingReport ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={theme.text}
                />
              )}
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.yearScroll}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedYear(null);
              }}
              style={[
                styles.yearChip,
                {
                  backgroundColor:
                    selectedYear === null ? `${theme.gold}20` : theme.card,
                  borderColor:
                    selectedYear === null ? theme.gold : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.yearChipText,
                  {
                    color:
                      selectedYear === null ? theme.gold : theme.textSecondary,
                  },
                ]}
              >
                {t.dashboard.allYears}
              </Text>
            </Pressable>
            {availableYears.map((year) => (
              <Pressable
                key={year}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedYear(year);
                }}
                style={[
                  styles.yearChip,
                  {
                    backgroundColor:
                      selectedYear === year ? `${theme.gold}20` : theme.card,
                    borderColor:
                      selectedYear === year ? theme.gold : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.yearChipText,
                    {
                      color:
                        selectedYear === year ? theme.gold : theme.textSecondary,
                    },
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(100)}
          style={styles.statsRow}
        >
          <Card style={styles.statCard}>
            <View
              style={[
                styles.statIcon,
                { backgroundColor: `${theme.success}20` },
              ]}
            >
              <Ionicons name="trending-up" size={20} color={theme.success} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t.dashboard.revenue}
            </Text>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {formatCurrency(totalRevenue)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <View
              style={[
                styles.statIcon,
                { backgroundColor: `${theme.error}20` },
              ]}
            >
              <Ionicons name="trending-down" size={20} color={theme.error} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
              {t.dashboard.expenses}
            </Text>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card style={styles.profitCard}>
            <View style={styles.profitRow}>
              <View>
                <Text style={[styles.profitLabel, { color: theme.textSecondary }]}>
                  {t.dashboard.netProfit}
                </Text>
                <Text
                  style={[
                    styles.profitValue,
                    { color: netProfit >= 0 ? theme.gold : theme.error },
                  ]}
                >
                  {formatCurrency(netProfit)}
                </Text>
              </View>
              <View
                style={[
                  styles.profitIconCircle,
                  { backgroundColor: `${theme.gold}15` },
                ]}
              >
                <Image
                  source={
                    isDark
                      ? require("@/assets/images/vendora-logo-dark.png")
                      : require("@/assets/images/vendora-logo-light.png")
                  }
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Card>
            <Text style={[styles.chartTitle, { color: theme.text }]}>
              {t.dashboard.monthlyPerformance}
              {selectedYear ? ` ${selectedYear}` : ""}
            </Text>
            <View style={styles.chart}>
              {monthlyData.map((item) => (
                <View key={item.month} style={styles.chartCol}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((item.revenue / maxValue) * 100, 2)}%`,
                          backgroundColor: theme.gold,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((item.expenses / maxValue) * 100, 2)}%`,
                          backgroundColor: `${theme.error}80`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>
                    {item.month}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View
                  style={[styles.legendDot, { backgroundColor: theme.gold }]}
                />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                  {t.dashboard.revenue}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: `${theme.error}80` },
                  ]}
                />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>
                  {t.dashboard.expenses}
                </Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(400).delay(400)}
          style={styles.statsRow}
        >
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.statusOpen }]}>
              {openOrders}
            </Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>
              {t.dashboard.openOrders}
            </Text>
          </Card>
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.statusPaid }]}>
              {paidOrders}
            </Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>
              {t.dashboard.paidOrders}
            </Text>
          </Card>
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.gold }]}>
              {filteredMarkets.length}
            </Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>
              {t.dashboard.markets}
            </Text>
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  exportBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  overviewRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 2,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
  },
  proChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  proChipText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  yearScroll: { gap: 8, paddingBottom: 4 },
  yearChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  yearChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1 },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  profitCard: {},
  profitRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profitLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  profitValue: { fontSize: 32, fontFamily: "Inter_700Bold" },
  profitIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 36, height: 36, borderRadius: 18 },
  chartTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 16,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    height: 140,
    gap: 8,
  },
  chartCol: { flex: 1, alignItems: "center", gap: 8 },
  barContainer: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 3,
  },
  bar: { width: "40%", minHeight: 2, borderRadius: 4 },
  chartLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  miniCard: { flex: 1, alignItems: "center", paddingVertical: 20 },
  miniValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  miniLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
