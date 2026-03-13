import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./auth";
import { secureApiFetch } from "./integrity"; // Optional anti-tampering header addition
import { Order, MarketEvent, Expense, OrderItem } from "./storage"; // Reusing schemas from existing storage for now

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

export const useCloudApi = () => {
    const { session } = useAuth();
    const token = session?.access_token;
    const userId = session?.user?.id;

    const authHeaders = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "x-user-id": userId || "",
    };

    return {
        // --- Orders ---
        fetchOrders: async (): Promise<Order[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch orders");
            return res.json();
        },
        createOrder: async (order: Partial<Order>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders`, { method: "POST", headers: authHeaders, body: JSON.stringify(order) });
            if (!res.ok) throw new Error("Failed to create order");
            return res.json();
        },
        updateOrder: async (id: string, order: Partial<Order>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(order) });
            if (!res.ok) throw new Error("Failed to update order");
            return res.json();
        },
        deleteOrder: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/orders/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete order");
            return res.json();
        },

        // --- Order Items ---
        fetchOrderItems: async (): Promise<OrderItem[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch order items");
            return res.json();
        },
        createOrderItem: async (item: Partial<OrderItem>) => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items`, { method: "POST", headers: authHeaders, body: JSON.stringify(item) });
            if (!res.ok) throw new Error("Failed to create order item");
            return res.json();
        },
        deleteOrderItem: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/order_items/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete order item");
            return res.json();
        },

        // --- Markets ---
        fetchMarkets: async (): Promise<MarketEvent[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/markets`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch markets");
            const data = await res.json();
            return data.map((m: any) => ({
                ...m,
                standFee: m.stand_fee,
                travelCost: m.travel_cost,
                quickItems: m.quick_items,
            }));
        },
        createMarket: async (market: Partial<MarketEvent>) => {
            const payload = {
                ...market,
                stand_fee: market.standFee,
                travel_cost: market.travelCost,
                quick_items: market.quickItems,
            };
            const res = await secureApiFetch(`${API_BASE_URL}/markets`, { method: "POST", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to create market");
            const m = await res.json();
            return { ...m, standFee: m.stand_fee, travelCost: m.travel_cost, quickItems: m.quick_items } as MarketEvent;
        },
        updateMarket: async (id: string, market: Partial<MarketEvent>) => {
            const payload = {
                ...market,
                ...(market.standFee !== undefined && { stand_fee: market.standFee }),
                ...(market.travelCost !== undefined && { travel_cost: market.travelCost }),
                ...(market.quickItems !== undefined && { quick_items: market.quickItems }),
            };
            const res = await secureApiFetch(`${API_BASE_URL}/markets/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to update market");
            return res.json();
        },
        deleteMarket: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/markets/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete market");
            return res.json();
        },

        // --- Market Sales ---
        fetchMarketSales: async (): Promise<any[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch market sales");
            const data = await res.json();
            return data.map((s: any) => ({
                ...s,
                marketId: s.market_id,
            }));
        },
        createMarketSale: async (sale: any) => {
            const payload = {
                ...sale,
                market_id: sale.marketId,
            };
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales`, { method: "POST", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to create market sale");
            return res.json();
        },
        updateMarketSale: async (id: string, sale: any) => {
            const payload = {
                ...sale,
                ...(sale.marketId && { market_id: sale.marketId }),
            };
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to update market sale");
            return res.json();
        },
        deleteMarketSale: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/market_sales/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete market sale");
            return res.json();
        },

        // --- Expenses ---
        fetchExpenses: async (): Promise<Expense[]> => {
            const res = await secureApiFetch(`${API_BASE_URL}/expenses`, { headers: authHeaders });
            if (!res.ok) throw new Error("Failed to fetch expenses");
            const data = await res.json();
            return data.map((e: any) => ({
                ...e,
                expenseDate: e.expense_date,
            }));
        },
        createExpense: async (expense: Partial<Expense>) => {
            const payload = {
                ...expense,
                expense_date: expense.expenseDate,
            };
            const res = await secureApiFetch(`${API_BASE_URL}/expenses`, { method: "POST", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to create expense");
            const e = await res.json();
            return { ...e, expenseDate: e.expense_date } as Expense;
        },
        updateExpense: async (id: string, expense: Partial<Expense>) => {
            const payload = {
                ...expense,
                ...(expense.expenseDate !== undefined && { expense_date: expense.expenseDate }),
            };
            const res = await secureApiFetch(`${API_BASE_URL}/expenses/${id}`, { method: "PUT", headers: authHeaders, body: JSON.stringify(payload) });
            if (!res.ok) throw new Error("Failed to update expense");
            return res.json();
        },
        deleteExpense: async (id: string) => {
            const res = await secureApiFetch(`${API_BASE_URL}/expenses/${id}`, { method: "DELETE", headers: authHeaders });
            if (!res.ok) throw new Error("Failed to delete expense");
            return res.json();
        },
    };
};

export function useOrdersQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["orders"], queryFn: api.fetchOrders, enabled: isAuthenticated });
}

export function useCreateOrderMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createOrder,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders"] }),
    });
}

export function useUpdateOrderMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Order> }) => api.updateOrder(id, data),
        onMutate: async ({ id, data }) => {
            await queryClient.cancelQueries({ queryKey: ["orders"] });
            const previousOrders = queryClient.getQueryData<Order[]>(["orders"]);
            if (previousOrders) {
                queryClient.setQueryData<Order[]>(["orders"], old =>
                    old?.map(order => order.id === id ? { ...order, ...data } : order)
                );
            }
            return { previousOrders };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["orders"], context.previousOrders);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });
}

export function useDeleteOrderMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteOrder,
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey: ["orders"] });
            const previousOrders = queryClient.getQueryData<Order[]>(["orders"]);
            if (previousOrders) {
                queryClient.setQueryData<Order[]>(["orders"], old => old?.filter(order => order.id !== id));
            }
            return { previousOrders };
        },
        onError: (err, newTodo, context) => {
            if (context?.previousOrders) {
                queryClient.setQueryData(["orders"], context.previousOrders);
            }
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
        },
    });
}

export function useMarketsQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["markets"], queryFn: api.fetchMarkets, enabled: isAuthenticated });
}

export function useCreateMarketMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createMarket,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["markets"] }),
    });
}

export function useUpdateMarketMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<MarketEvent> }) => api.updateMarket(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["markets"] }),
    });
}

export function useDeleteMarketMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteMarket,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["markets"] }),
    });
}

export function useExpensesQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["expenses"], queryFn: api.fetchExpenses, enabled: isAuthenticated });
}

export function useCreateExpenseMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createExpense,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    });
}

export function useUpdateExpenseMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Expense> }) => api.updateExpense(id, data),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    });
}

export function useDeleteExpenseMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteExpense,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["expenses"] }),
    });
}

export function useOrderItemsQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["order_items"], queryFn: api.fetchOrderItems, enabled: isAuthenticated });
}

export function useMarketSalesQuery() {
    const api = useCloudApi();
    const { isAuthenticated } = useAuth();
    return useQuery({ queryKey: ["market_sales"], queryFn: api.fetchMarketSales, enabled: isAuthenticated });
}

export function useCreateMarketSaleMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.createMarketSale,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["market_sales"] }),
    });
}

export function useDeleteMarketSaleMutation() {
    const api = useCloudApi();
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.deleteMarketSale,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["market_sales"] }),
    });
}
