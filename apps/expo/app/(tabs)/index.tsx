import { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Platform,
  RefreshControl,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { useThemeContext } from "@/lib/ThemeContext";
import { useLanguage } from "@/lib/LanguageContext";
import { Card } from "@/components/Card";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  ordersStorage,
  marketsStorage,
  marketSalesStorage,
  expensesStorage,
  Order,
  MarketEvent,
  MarketSale,
  Expense,
} from "@/lib/storage";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { generateFinancialReportHtml } from "@/lib/reportTemplate";
import { useSubscription } from "@/lib/subscription";

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [markets, setMarkets] = useState<MarketEvent[]>([]);
  const [marketSales, setMarketSales] = useState<MarketSale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

  const loadData = useCallback(async () => {
    const [o, m, ms, e] = await Promise.all([
      ordersStorage.getAll(),
      marketsStorage.getAll(),
      marketSalesStorage.getAll(),
      expensesStorage.getAll(),
    ]);
    setOrders(o);
    setMarkets(m);
    setMarketSales(ms);
    setExpenses(e);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    orders.forEach((o) => yearSet.add(getDateYear(o.orderDate || o.createdAt)));
    markets.forEach((m) => yearSet.add(getDateYear(m.date)));
    marketSales.forEach((s) => yearSet.add(getDateYear(s.createdAt)));
    expenses.forEach((e) => yearSet.add(getDateYear(e.expenseDate || e.date)));
    if (yearSet.size === 0) yearSet.add(new Date().getFullYear());
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [orders, markets, marketSales, expenses]);

  const yearStr = selectedYear ? `${selectedYear}` : null;

  const matchesYear = (dateStr: string) => {
    if (!yearStr) return true;
    return dateStr.startsWith(yearStr);
  };

  const filteredOrders = useMemo(
    () => orders.filter((o) => matchesYear(o.orderDate || o.createdAt)),
    [orders, yearStr],
  );
  const filteredMarkets = useMemo(
    () => markets.filter((m) => matchesYear(m.date)),
    [markets, yearStr],
  );
  const filteredMarketSales = useMemo(
    () => marketSales.filter((s) => matchesYear(s.createdAt)),
    [marketSales, yearStr],
  );
  const filteredExpenses = useMemo(
    () => expenses.filter((e) => matchesYear(e.expenseDate || e.date)),
    [expenses, yearStr],
  );

  const totalOrderRevenue = filteredOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);

  const totalMarketRevenue = filteredMarketSales.reduce((sum, s) => sum + s.amount * s.quantity, 0);
  const totalRevenue = totalOrderRevenue + totalMarketRevenue;

  const totalMarketCosts = filteredMarkets.reduce((sum, m) => sum + m.standFee + m.travelCost, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0) + totalMarketCosts;
  const netProfit = totalRevenue - totalExpenses;

  const openOrders = filteredOrders.filter((o) => o.status === "open").length;
  const paidOrders = filteredOrders.filter((o) => o.status === "paid").length;

  const getMonthlyData = (): MonthlyData[] => {
    const data: MonthlyData[] = [];
    const year = selectedYear || new Date().getFullYear();

    if (selectedYear) {
      for (let m = 0; m < 12; m++) {
        const monthStr = `${year}-${String(m + 1).padStart(2, "0")}`;

        const monthRevenue =
          filteredOrders
            .filter((o) => o.status !== "cancelled" && (o.orderDate || o.createdAt).startsWith(monthStr))
            .reduce((sum, o) => sum + o.total, 0) +
          filteredMarketSales
            .filter((s) => s.createdAt.startsWith(monthStr))
            .reduce((sum, s) => sum + s.amount * s.quantity, 0);

        const monthExpenses =
          filteredExpenses
            .filter((e) => (e.expenseDate || e.date).startsWith(monthStr))
            .reduce((sum, e) => sum + e.amount, 0) +
          filteredMarkets
            .filter((mk) => mk.date.startsWith(monthStr))
            .reduce((sum, mk) => sum + mk.standFee + mk.travelCost, 0);

        data.push({
          month: t.months[m],
          revenue: monthRevenue,
          expenses: monthExpenses,
        });
      }
    } else {
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        const monthRevenue =
          orders
            .filter((o) => o.status !== "cancelled" && (o.orderDate || o.createdAt).startsWith(monthStr))
            .reduce((sum, o) => sum + o.total, 0) +
          marketSales
            .filter((s) => s.createdAt.startsWith(monthStr))
            .reduce((sum, s) => sum + s.amount * s.quantity, 0);

        const monthExpenses =
          expenses
            .filter((e) => (e.expenseDate || e.date).startsWith(monthStr))
            .reduce((sum, e) => sum + e.amount, 0) +
          markets
            .filter((mk) => mk.date.startsWith(monthStr))
            .reduce((sum, mk) => sum + mk.standFee + mk.travelCost, 0);

        data.push({
          month: t.months[date.getMonth()],
          revenue: monthRevenue,
          expenses: monthExpenses,
        });
      }
    }
    return data;
  };

  const monthlyData = getMonthlyData();
  const maxValue = Math.max(...monthlyData.map((d) => Math.max(d.revenue, d.expenses)), 1);

  const exportReport = async () => {
    setGeneratingReport(true);
    try {
      // Pass the fully assembled data to the HTML template generator
      const html = generateFinancialReportHtml(
        selectedYear,
        totalRevenue,
        totalExpenses,
        netProfit,
        monthlyData,
        t,
      );

      if (Platform.OS === "web") {
        // Fallback for Web to avoid printing the app UI instead of the document
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
          Alert.alert(t.dashboard.shareReport, "PDF Export: " + uri);
        }
      }
    } catch (e) {
      console.error("Report generation error:", e);
      Alert.alert(t.dashboard.reportError);
    } finally {
      setGeneratingReport(false);
    }
  };

  const webTopInset = Platform.OS === "web" ? 67 : 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + webTopInset + 16, paddingBottom: insets.bottom + 100 },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.gold} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400).delay(0)}>
          <View style={styles.headerRow}>
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.greeting, { color: theme.textSecondary }]}>{t.dashboard.overview}</Text>
                {isSubscribed && (
                  <View style={{ backgroundColor: theme.gold + "20", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: theme.gold }}>
                    <Text style={{ color: theme.gold, fontSize: 10, fontFamily: "Inter_700Bold" }}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.heading, { color: theme.text }]}>{t.dashboard.dashboard}</Text>
            </View>
            <Pressable
              onPress={exportReport}
              disabled={generatingReport}
              style={({ pressed }) => [
                styles.exportBtn,
                { backgroundColor: theme.card, borderColor: theme.border },
                pressed && { opacity: 0.7 },
                generatingReport && { opacity: 0.5 },
              ]}
            >
              {generatingReport ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <Ionicons name="document-text-outline" size={24} color={theme.text} />
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
                  backgroundColor: selectedYear === null ? theme.gold + "20" : theme.card,
                  borderColor: selectedYear === null ? theme.gold : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.yearChipText,
                  { color: selectedYear === null ? theme.gold : theme.textSecondary },
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
                    backgroundColor: selectedYear === year ? theme.gold + "20" : theme.card,
                    borderColor: selectedYear === year ? theme.gold : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.yearChipText,
                    { color: selectedYear === year ? theme.gold : theme.textSecondary },
                  ]}
                >
                  {year}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)} style={styles.statsRow}>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.success + "20" }]}>
              <Ionicons name="trending-up" size={20} color={theme.success} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.dashboard.revenue}</Text>
            <Text style={[styles.statValue, { color: theme.success }]}>
              {formatCurrency(totalRevenue)}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: theme.error + "20" }]}>
              <Ionicons name="trending-down" size={20} color={theme.error} />
            </View>
            <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{t.dashboard.expenses}</Text>
            <Text style={[styles.statValue, { color: theme.error }]}>
              {formatCurrency(totalExpenses)}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Card style={styles.profitCard}>
            <View style={styles.profitRow}>
              <View>
                <Text style={[styles.profitLabel, { color: theme.textSecondary }]}>{t.dashboard.netProfit}</Text>
                <Text
                  style={[
                    styles.profitValue,
                    { color: netProfit >= 0 ? theme.gold : theme.error },
                  ]}
                >
                  {formatCurrency(netProfit)}
                </Text>
              </View>
              <View style={[styles.profitIconCircle, { backgroundColor: theme.gold + "15" }]}>
                <Image
                  source={isDark ? require("@/assets/images/vendora-logo-dark.png") : require("@/assets/images/vendora-logo-light.png")}
                  style={{ width: 36, height: 36, borderRadius: 18 }}
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
              {monthlyData.map((d, i) => (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.barContainer}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((d.revenue / maxValue) * 100, 2)}%` as any,
                          backgroundColor: theme.gold,
                          borderRadius: 4,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        {
                          height: `${Math.max((d.expenses / maxValue) * 100, 2)}%` as any,
                          backgroundColor: theme.error + "80",
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartLabel, { color: theme.textSecondary }]}>{d.month}</Text>
                </View>
              ))}
            </View>
            <View style={styles.legend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.gold }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{t.dashboard.revenue}</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: theme.error + "80" }]} />
                <Text style={[styles.legendText, { color: theme.textSecondary }]}>{t.dashboard.expenses}</Text>
              </View>
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.statsRow}>
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.statusOpen }]}>{openOrders}</Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>{t.dashboard.openOrders}</Text>
          </Card>
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.statusPaid }]}>{paidOrders}</Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>{t.dashboard.paidOrders}</Text>
          </Card>
          <Card style={styles.miniCard}>
            <Text style={[styles.miniValue, { color: theme.gold }]}>{filteredMarkets.length}</Text>
            <Text style={[styles.miniLabel, { color: theme.textSecondary }]}>{t.dashboard.markets}</Text>
          </Card>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  exportBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  greeting: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 2 },
  heading: { fontSize: 28, fontFamily: "Inter_700Bold", marginBottom: 12 },
  yearScroll: { gap: 8, paddingBottom: 4 },
  yearChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  yearChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 12 },
  statCard: { flex: 1 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  profitCard: {},
  profitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profitLabel: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  profitValue: { fontSize: 32, fontFamily: "Inter_700Bold" },
  profitIconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  chartTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 16 },
  chart: { flexDirection: "row", justifyContent: "space-between", height: 140, gap: 8 },
  chartCol: { flex: 1, alignItems: "center", gap: 8 },
  barContainer: { flex: 1, width: "100%", flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 3 },
  bar: { width: "40%", minHeight: 2 },
  chartLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  legend: { flexDirection: "row", justifyContent: "center", gap: 20, marginTop: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  miniCard: { flex: 1, alignItems: "center", paddingVertical: 20 },
  miniValue: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 4 },
  miniLabel: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
});
