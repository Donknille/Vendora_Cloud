import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  ORDERS: "vendora_orders",
  MARKETS: "vendora_markets",
  MARKET_SALES: "vendora_market_sales",
  EXPENSES: "vendora_expenses",
  COMPANY_PROFILE: "vendora_company_profile",
  SETTINGS: "vendora_settings",
  INVOICE_COUNTER: "vendora_invoice_counter",
};

export interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  items: OrderItem[];
  status: "open" | "paid" | "shipped" | "delivered" | "cancelled";
  invoiceNumber: string;
  notes: string;
  orderDate: string;
  serviceDate?: string;
  shippingCost?: number;
  createdAt: string;
  updatedAt: string;
  total: number;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
  isCompleted?: boolean;
}

export interface MarketEvent {
  id: string;
  name: string;
  date: string;
  location: string;
  standFee: number;
  travelCost: number;
  notes: string;
  createdAt: string;
  quickItems?: { name: string; price: number }[];
  status?: "open" | "closed";
}

export interface MarketSale {
  id: string;
  marketId: string;
  description: string;
  amount: number;
  quantity: number;
  createdAt: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  expenseDate: string;
  createdAt: string;
}

export interface CompanyProfile {
  name: string;
  address: string;
  email: string;
  phone: string;
  taxNote: string;
  smallBusinessNote?: string;
  defaultShippingCost?: number;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
  currency: string;
  biometricsEnabled?: boolean;
}

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

async function getAll<T>(key: string): Promise<T[]> {
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

async function saveAll<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

export async function getNextInvoiceNumber(): Promise<string> {
  const counterStr = await AsyncStorage.getItem(KEYS.INVOICE_COUNTER);
  const counter = counterStr ? parseInt(counterStr, 10) : 0;
  const next = counter + 1;
  await AsyncStorage.setItem(KEYS.INVOICE_COUNTER, next.toString());
  const year = new Date().getFullYear().toString().slice(-2);
  return `${year}-${next.toString().padStart(3, "0")}`;
}

export const ordersStorage = {
  getAll: () => getAll<Order>(KEYS.ORDERS),
  save: (orders: Order[]) => saveAll(KEYS.ORDERS, orders),
  add: async (order: Omit<Order, "id" | "createdAt" | "updatedAt" | "invoiceNumber" | "total">): Promise<Order> => {
    const orders = await getAll<Order>(KEYS.ORDERS);
    const invoiceNumber = await getNextInvoiceNumber();
    const total = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const now = new Date().toISOString();
    const newOrder: Order = {
      ...order,
      id: generateId(),
      invoiceNumber,
      total,
      orderDate: order.orderDate || now,
      createdAt: now,
      updatedAt: now,
    };
    orders.unshift(newOrder);
    await saveAll(KEYS.ORDERS, orders);
    return newOrder;
  },
  update: async (id: string, updates: Partial<Order>): Promise<Order | null> => {
    const orders = await getAll<Order>(KEYS.ORDERS);
    const index = orders.findIndex((o) => o.id === id);
    if (index === -1) return null;
    if (updates.items) {
      updates.total = updates.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    orders[index] = { ...orders[index], ...updates, updatedAt: new Date().toISOString() };
    await saveAll(KEYS.ORDERS, orders);
    return orders[index];
  },
  delete: async (id: string): Promise<void> => {
    const orders = await getAll<Order>(KEYS.ORDERS);
    await saveAll(KEYS.ORDERS, orders.filter((o) => o.id !== id));
  },
};

export const marketsStorage = {
  getAll: () => getAll<MarketEvent>(KEYS.MARKETS),
  save: (markets: MarketEvent[]) => saveAll(KEYS.MARKETS, markets),
  add: async (market: Omit<MarketEvent, "id" | "createdAt">): Promise<MarketEvent> => {
    const markets = await getAll<MarketEvent>(KEYS.MARKETS);
    const newMarket: MarketEvent = {
      ...market,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    markets.unshift(newMarket);
    await saveAll(KEYS.MARKETS, markets);
    return newMarket;
  },
  update: async (id: string, updates: Partial<MarketEvent>): Promise<MarketEvent | null> => {
    const markets = await getAll<MarketEvent>(KEYS.MARKETS);
    const index = markets.findIndex((m) => m.id === id);
    if (index === -1) return null;
    markets[index] = { ...markets[index], ...updates };
    await saveAll(KEYS.MARKETS, markets);
    return markets[index];
  },
  delete: async (id: string): Promise<void> => {
    const markets = await getAll<MarketEvent>(KEYS.MARKETS);
    await saveAll(KEYS.MARKETS, markets.filter((m) => m.id !== id));
  },
};

export const marketSalesStorage = {
  getAll: () => getAll<MarketSale>(KEYS.MARKET_SALES),
  getByMarket: async (marketId: string): Promise<MarketSale[]> => {
    const sales = await getAll<MarketSale>(KEYS.MARKET_SALES);
    return sales.filter((s) => s.marketId === marketId);
  },
  add: async (sale: Omit<MarketSale, "id" | "createdAt">): Promise<MarketSale> => {
    const sales = await getAll<MarketSale>(KEYS.MARKET_SALES);
    const newSale: MarketSale = {
      ...sale,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    sales.unshift(newSale);
    await saveAll(KEYS.MARKET_SALES, sales);
    return newSale;
  },
  delete: async (id: string): Promise<void> => {
    const sales = await getAll<MarketSale>(KEYS.MARKET_SALES);
    await saveAll(KEYS.MARKET_SALES, sales.filter((s) => s.id !== id));
  },
};

export const expensesStorage = {
  getAll: () => getAll<Expense>(KEYS.EXPENSES),
  save: (expenses: Expense[]) => saveAll(KEYS.EXPENSES, expenses),
  add: async (expense: Omit<Expense, "id" | "createdAt">): Promise<Expense> => {
    const expenses = await getAll<Expense>(KEYS.EXPENSES);
    const now = new Date().toISOString();
    const newExpense: Expense = {
      ...expense,
      id: generateId(),
      expenseDate: expense.expenseDate || expense.date || now.split("T")[0],
      createdAt: now,
    };
    expenses.unshift(newExpense);
    await saveAll(KEYS.EXPENSES, expenses);
    return newExpense;
  },
  delete: async (id: string): Promise<void> => {
    const expenses = await getAll<Expense>(KEYS.EXPENSES);
    await saveAll(KEYS.EXPENSES, expenses.filter((e) => e.id !== id));
  },
};

export const profileStorage = {
  get: async (): Promise<CompanyProfile> => {
    const data = await AsyncStorage.getItem(KEYS.COMPANY_PROFILE);
    return data
      ? JSON.parse(data)
      : { name: "", address: "", email: "", phone: "", taxNote: "" };
  },
  save: async (profile: CompanyProfile): Promise<void> => {
    await AsyncStorage.setItem(KEYS.COMPANY_PROFILE, JSON.stringify(profile));
  },
};

export const settingsStorage = {
  get: async (): Promise<AppSettings> => {
    const data = await AsyncStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : { theme: "system", currency: "\u20AC" };
  },
  save: async (settings: AppSettings): Promise<void> => {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
};

export async function exportAllData(): Promise<string> {
  const orders = await ordersStorage.getAll();
  const markets = await marketsStorage.getAll();
  const marketSales = await marketSalesStorage.getAll();
  const expenses = await expensesStorage.getAll();
  const profile = await profileStorage.get();
  const settings = await settingsStorage.get();
  const counter = await AsyncStorage.getItem(KEYS.INVOICE_COUNTER);

  return JSON.stringify(
    {
      version: 1,
      exportDate: new Date().toISOString(),
      data: { orders, markets, marketSales, expenses, profile, settings, invoiceCounter: counter },
    },
    null,
    2,
  );
}

export async function importAllData(jsonString: string): Promise<void> {
  const parsed = JSON.parse(jsonString);
  const { data } = parsed;
  if (data.orders) await ordersStorage.save(data.orders);
  if (data.markets) await marketsStorage.save(data.markets);
  if (data.marketSales) await saveAll(KEYS.MARKET_SALES, data.marketSales);
  if (data.expenses) await expensesStorage.save(data.expenses);
  if (data.profile) await profileStorage.save(data.profile);
  if (data.settings) await settingsStorage.save(data.settings);
  if (data.invoiceCounter) await AsyncStorage.setItem(KEYS.INVOICE_COUNTER, data.invoiceCounter);
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove(Object.values(KEYS));
}
