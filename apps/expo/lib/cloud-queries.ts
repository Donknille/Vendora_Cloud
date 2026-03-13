import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  createExpenseRequestSchema,
  createMarketRequestSchema,
  createMarketSaleRequestSchema,
  createOrderItemRequestSchema,
  createOrderRequestSchema,
  expenseDtoSchema,
  marketDtoSchema,
  marketSaleDtoSchema,
  orderDtoSchema,
  orderItemDtoSchema,
  subscriptionStateDtoSchema,
  updateExpenseRequestSchema,
  updateMarketRequestSchema,
  updateMarketSaleRequestSchema,
  updateOrderRequestSchema,
  type ExpenseDto as Expense,
  type MarketDto as MarketEvent,
  type MarketSaleDto as MarketSale,
  type OrderDto as Order,
  type OrderItemDto as OrderItem,
  type SubscriptionStateDto as SubscriptionState,
} from "@vendora/shared";

import { useAuth } from "./auth";
import { createCloudClient } from "./cloud-client";

const QUERY_KEYS = {
  orders: ["orders"] as const,
  orderItems: ["order_items"] as const,
  markets: ["markets"] as const,
  marketSales: ["market_sales"] as const,
  expenses: ["expenses"] as const,
  subscriptionStatus: ["subscription", "status"] as const,
};

const orderArraySchema = z.array(orderDtoSchema);
const orderItemArraySchema = z.array(orderItemDtoSchema);
const marketArraySchema = z.array(marketDtoSchema);
const marketSaleArraySchema = z.array(marketSaleDtoSchema);
const expenseArraySchema = z.array(expenseDtoSchema);

export const useCloudApi = () => {
  const { session } = useAuth();
  const client = createCloudClient(session?.access_token);

  return {
    fetchOrders: () =>
      client.get("/orders", orderArraySchema, "Failed to fetch orders"),
    createOrder: (order: Partial<Order>) =>
      client.post(
        "/orders",
        createOrderRequestSchema.parse(order),
        orderDtoSchema,
        "Failed to create order",
      ),
    updateOrder: (id: string, order: Partial<Order>) =>
      client.put(
        `/orders/${id}`,
        updateOrderRequestSchema.parse(order),
        orderDtoSchema,
        "Failed to update order",
      ),
    deleteOrder: (id: string) =>
      client.delete(`/orders/${id}`, "Failed to delete order"),

    fetchOrderItems: () =>
      client.get(
        "/order_items",
        orderItemArraySchema,
        "Failed to fetch order items",
      ),
    createOrderItem: (item: Partial<OrderItem>) =>
      client.post(
        "/order_items",
        createOrderItemRequestSchema.parse(item),
        orderItemDtoSchema,
        "Failed to create order item",
      ),
    deleteOrderItem: (id: string) =>
      client.delete(`/order_items/${id}`, "Failed to delete order item"),

    fetchMarkets: () =>
      client.get("/markets", marketArraySchema, "Failed to fetch markets"),
    createMarket: (market: Partial<MarketEvent>) =>
      client.post(
        "/markets",
        createMarketRequestSchema.parse(market),
        marketDtoSchema,
        "Failed to create market",
      ),
    updateMarket: (id: string, market: Partial<MarketEvent>) =>
      client.put(
        `/markets/${id}`,
        updateMarketRequestSchema.parse(market),
        marketDtoSchema,
        "Failed to update market",
      ),
    deleteMarket: (id: string) =>
      client.delete(`/markets/${id}`, "Failed to delete market"),

    fetchMarketSales: () =>
      client.get(
        "/market_sales",
        marketSaleArraySchema,
        "Failed to fetch market sales",
      ),
    createMarketSale: (sale: Partial<MarketSale>) =>
      client.post(
        "/market_sales",
        createMarketSaleRequestSchema.parse(sale),
        marketSaleDtoSchema,
        "Failed to create market sale",
      ),
    updateMarketSale: (id: string, sale: Partial<MarketSale>) =>
      client.put(
        `/market_sales/${id}`,
        updateMarketSaleRequestSchema.parse(sale),
        marketSaleDtoSchema,
        "Failed to update market sale",
      ),
    deleteMarketSale: (id: string) =>
      client.delete(`/market_sales/${id}`, "Failed to delete market sale"),

    fetchExpenses: () =>
      client.get("/expenses", expenseArraySchema, "Failed to fetch expenses"),
    createExpense: (expense: Partial<Expense>) =>
      client.post(
        "/expenses",
        createExpenseRequestSchema.parse(expense),
        expenseDtoSchema,
        "Failed to create expense",
      ),
    updateExpense: (id: string, expense: Partial<Expense>) =>
      client.put(
        `/expenses/${id}`,
        updateExpenseRequestSchema.parse(expense),
        expenseDtoSchema,
        "Failed to update expense",
      ),
    deleteExpense: (id: string) =>
      client.delete(`/expenses/${id}`, "Failed to delete expense"),

    fetchSubscriptionState: () =>
      client.get(
        "/subscription/status",
        subscriptionStateDtoSchema,
        "Failed to fetch subscription status",
      ),
    refreshSubscriptionState: () =>
      client.post(
        "/subscription/refresh",
        undefined,
        subscriptionStateDtoSchema,
        "Failed to refresh subscription status",
      ),
    deleteAccount: () => client.delete("/account", "Failed to delete account"),
  };
};

function useAuthedQuery<TData>(
  queryKey: readonly string[],
  queryFn: () => Promise<TData>,
) {
  const { isAuthenticated } = useAuth();
  return useQuery({
    queryKey,
    queryFn,
    enabled: isAuthenticated,
  });
}

function useInvalidateOnSuccessMutation<TVariables, TData = unknown>(
  queryKey: readonly string[],
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useOrdersQuery() {
  const api = useCloudApi();
  return useAuthedQuery(QUERY_KEYS.orders, api.fetchOrders);
}

export function useCreateOrderMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(QUERY_KEYS.orders, api.createOrder);
}

export function useSubscriptionStatusQuery() {
  const api = useCloudApi();
  return useAuthedQuery(
    QUERY_KEYS.subscriptionStatus,
    api.fetchSubscriptionState,
  );
}

export function useRefreshSubscriptionMutation() {
  const api = useCloudApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.refreshSubscriptionState,
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.subscriptionStatus, data);
    },
  });
}

export function useDeleteAccountMutation() {
  const api = useCloudApi();
  return useMutation({
    mutationFn: api.deleteAccount,
  });
}

export function useUpdateOrderMutation() {
  const api = useCloudApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Order> }) =>
      api.updateOrder(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.orders });
      const previousOrders = queryClient.getQueryData<Order[]>(QUERY_KEYS.orders);

      if (previousOrders) {
        queryClient.setQueryData<Order[]>(QUERY_KEYS.orders, (old) =>
          old?.map((order) => (order.id === id ? { ...order, ...data } : order)),
        );
      }

      return { previousOrders };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(QUERY_KEYS.orders, context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    },
  });
}

export function useDeleteOrderMutation() {
  const api = useCloudApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteOrder,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.orders });
      const previousOrders = queryClient.getQueryData<Order[]>(QUERY_KEYS.orders);

      if (previousOrders) {
        queryClient.setQueryData<Order[]>(QUERY_KEYS.orders, (old) =>
          old?.filter((order) => order.id !== id),
        );
      }

      return { previousOrders };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(QUERY_KEYS.orders, context.previousOrders);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orders });
    },
  });
}

export function useMarketsQuery() {
  const api = useCloudApi();
  return useAuthedQuery(QUERY_KEYS.markets, api.fetchMarkets);
}

export function useCreateMarketMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(QUERY_KEYS.markets, api.createMarket);
}

export function useUpdateMarketMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(
    QUERY_KEYS.markets,
    ({ id, data }: { id: string; data: Partial<MarketEvent> }) =>
      api.updateMarket(id, data),
  );
}

export function useDeleteMarketMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(QUERY_KEYS.markets, api.deleteMarket);
}

export function useExpensesQuery() {
  const api = useCloudApi();
  return useAuthedQuery(QUERY_KEYS.expenses, api.fetchExpenses);
}

export function useCreateExpenseMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(QUERY_KEYS.expenses, api.createExpense);
}

export function useUpdateExpenseMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(
    QUERY_KEYS.expenses,
    ({ id, data }: { id: string; data: Partial<Expense> }) =>
      api.updateExpense(id, data),
  );
}

export function useDeleteExpenseMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(QUERY_KEYS.expenses, api.deleteExpense);
}

export function useOrderItemsQuery() {
  const api = useCloudApi();
  return useAuthedQuery(QUERY_KEYS.orderItems, api.fetchOrderItems);
}

export function useMarketSalesQuery() {
  const api = useCloudApi();
  return useAuthedQuery(QUERY_KEYS.marketSales, api.fetchMarketSales);
}

export function useCreateMarketSaleMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(
    QUERY_KEYS.marketSales,
    api.createMarketSale,
  );
}

export function useDeleteMarketSaleMutation() {
  const api = useCloudApi();
  return useInvalidateOnSuccessMutation(
    QUERY_KEYS.marketSales,
    api.deleteMarketSale,
  );
}
