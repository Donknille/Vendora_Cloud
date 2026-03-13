import type { Express, NextFunction, Request, Response } from "express";
import { createServer, type Server } from "node:http";
import crypto from "crypto";
import {
  calculateOrderTotal,
  createExpenseRequestSchema,
  createMarketRequestSchema,
  createMarketSaleRequestSchema,
  createOrderItemRequestSchema,
  createOrderRequestSchema,
  expenses,
  markets,
  market_sales,
  mapExpenseRecordToDto,
  mapExpenseRequestToInsert,
  mapExpenseUpdateToRecord,
  mapMarketRecordToDto,
  mapMarketRequestToInsert,
  mapMarketSaleRecordToDto,
  mapMarketSaleRequestToInsert,
  mapMarketSaleUpdateToRecord,
  mapMarketUpdateToRecord,
  mapOrderItemRecordToDto,
  mapOrderItemRequestToInsert,
  mapOrderItemUpdateToRecord,
  mapOrderRecordToDto,
  mapOrderRequestToInsert,
  mapOrderUpdateToRecord,
  order_items,
  orders,
  subscriptionStateDtoSchema,
  type CreateOrderRequest,
  updateExpenseRequestSchema,
  updateMarketRequestSchema,
  updateMarketSaleRequestSchema,
  updateOrderItemRequestSchema,
  updateOrderRequestSchema,
  users,
} from "@vendora/shared";
import { and, eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { ZodError } from "zod";

import { getAuthenticatedUser, requireAuth } from "./middleware/auth";
import { requireIntegrity } from "./middleware/integrity";
import { db } from "./db";
import {
  deleteAccount,
  ensureUserRecord,
  getSubscriptionStateForAuthenticatedUser,
  refreshSubscriptionStateForUser,
} from "./services/billing";

const authRouteGuards = [requireIntegrity, requireAuth] as const;
const cloudRouteGuards = [requireIntegrity, requireAuth, requireSubscription] as const;

function getUserId(req: Request): string {
  return getAuthenticatedUser(req).userId;
}

function getRouteParam(req: Request, key: string): string {
  const value = req.params[key];
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseStoredNumber(value: string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sendRouteError(
  res: Response,
  error: unknown,
  fallbackMessage: string,
) {
  console.error(error);

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: "Validation failed",
      details: error.flatten(),
    });
  }

  if (error instanceof Error && error.message) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(500).json({ error: fallbackMessage });
}

async function requireSubscription(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (req.method === "GET") {
    return next();
  }

  try {
    const { subscriptionState } = await getSubscriptionStateForAuthenticatedUser(
      getAuthenticatedUser(req),
    );

    if (subscriptionState.canCreateNewItems) {
      return next();
    }

    return res.status(403).json({
      error:
        "Premium subscription required. Your 14-day trial has expired.",
    });
  } catch (error) {
    return sendRouteError(res, error, "Failed to verify subscription.");
  }
}

function buildOrderItemInserts(
  userId: string,
  orderId: string,
  items: CreateOrderRequest["items"],
) {
  return items.map((item) =>
    mapOrderItemRequestToInsert(
      {
        ...item,
        id: item.id ?? crypto.randomUUID(),
        orderId,
      },
      userId,
    ),
  );
}

async function loadOrderDto(userId: string, orderId: string) {
  const [orderRecord] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.user_id, userId)));

  if (!orderRecord) {
    return null;
  }

  const itemRecords = await db
    .select()
    .from(order_items)
    .where(
      and(eq(order_items.order_id, orderId), eq(order_items.user_id, userId)),
    );

  return mapOrderRecordToDto(orderRecord, itemRecords);
}

async function loadAllOrderDtos(userId: string) {
  const orderRecords = await db
    .select()
    .from(orders)
    .where(eq(orders.user_id, userId));

  if (orderRecords.length === 0) {
    return [];
  }

  const itemRecords = await db
    .select()
    .from(order_items)
    .where(eq(order_items.user_id, userId));

  const itemsByOrderId = itemRecords.reduce<Record<string, typeof itemRecords>>(
    (acc, item) => {
      if (!acc[item.order_id]) {
        acc[item.order_id] = [];
      }
      acc[item.order_id].push(item);
      return acc;
    },
    {},
  );

  return orderRecords.map((orderRecord) =>
    mapOrderRecordToDto(orderRecord, itemsByOrderId[orderRecord.id] ?? []),
  );
}

export async function registerRoutes(app: Express): Promise<Server> {
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: {
      error: "Too many requests from this IP, please try again later.",
    },
  });

  app.use("/api", apiLimiter);

  app.post("/api/users/sync", ...authRouteGuards, async (req, res) => {
    try {
      const { user, subscriptionState } =
        await getSubscriptionStateForAuthenticatedUser(getAuthenticatedUser(req));
      return res.status(200).json({
        userId: user.supabase_id,
        email: user.email,
        subscription: subscriptionStateDtoSchema.parse(subscriptionState),
      });
    } catch (error) {
      return sendRouteError(res, error, "Failed to sync user.");
    }
  });

  app.get("/api/subscription/status", ...authRouteGuards, async (req, res) => {
    try {
      const { subscriptionState } = await getSubscriptionStateForAuthenticatedUser(
        getAuthenticatedUser(req),
      );
      return res.json(subscriptionStateDtoSchema.parse(subscriptionState));
    } catch (error) {
      return sendRouteError(
        res,
        error,
        "Failed to fetch subscription status.",
      );
    }
  });

  app.post("/api/subscription/refresh", ...authRouteGuards, async (req, res) => {
    try {
      const user = await ensureUserRecord(getAuthenticatedUser(req));
      const subscriptionState = await refreshSubscriptionStateForUser(
        user.supabase_id ?? getUserId(req),
      );
      return res.json(subscriptionStateDtoSchema.parse(subscriptionState));
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "REVENUECAT_CONFIG_MISSING"
      ) {
        return res.status(500).json({
          error: "RevenueCat server configuration is incomplete.",
        });
      }

      return sendRouteError(
        res,
        error,
        "Failed to refresh subscription status.",
      );
    }
  });

  app.delete("/api/account", ...authRouteGuards, async (req, res) => {
    try {
      await deleteAccount(getAuthenticatedUser(req));
      return res.json({ success: true });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "REVENUECAT_CONFIG_MISSING"
      ) {
        return res.status(500).json({
          error: "RevenueCat server configuration is incomplete.",
        });
      }

      if (
        error instanceof Error &&
        error.message === "SUPABASE_ADMIN_CONFIG_MISSING"
      ) {
        return res.status(500).json({
          error: "Supabase admin configuration is incomplete.",
        });
      }

      return sendRouteError(res, error, "Failed to delete account.");
    }
  });

  app.post("/api/webhooks/revenuecat", async (req, res) => {
    const signature = req.headers["x-revenuecat-signature"];
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

    if (webhookSecret && signature) {
      const payload =
        typeof req.rawBody === "string"
          ? req.rawBody
          : (req.rawBody as Buffer)?.toString("utf-8");

      if (payload) {
        const expectedSignature = crypto
          .createHash("sha1")
          .update(webhookSecret + payload)
          .digest("hex");

        if (expectedSignature !== signature) {
          return res.status(401).send("Invalid signature");
        }
      }
    }

    try {
      const { event } = req.body;
      const appUserId = event.app_user_id;
      const expectedEntitlementId =
        process.env.REVENUECAT_ENTITLEMENT_ID || "pro";
      const entitlementId = event.entitlement_ids
        ? event.entitlement_ids[0]
        : null;

      if (!appUserId || entitlementId !== expectedEntitlementId) {
        return res.sendStatus(200);
      }

      let newStatus = "active";

      switch (event.type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "UNCANCELLATION":
          newStatus = "active";
          break;
        case "CANCELLATION":
          newStatus = "canceled";
          break;
        case "EXPIRATION":
          newStatus = "expired";
          break;
        case "BILLING_ISSUE":
          newStatus = "past_due";
          break;
        default:
          return res.sendStatus(200);
      }

      const expiresAt = event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

      await db
        .update(users)
        .set({
          subscription_status: newStatus,
          subscription_expires_at: expiresAt,
        })
        .where(eq(users.revenuecat_app_user_id, appUserId));

      console.log(
        `Updated user ${appUserId} to subscription status: ${newStatus}`,
      );

      return res.sendStatus(200);
    } catch (error) {
      console.error("Webhook processing error:", error);
      return res.status(500).send("Error processing webhook");
    }
  });

  app.get("/api/orders", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      return res.json(await loadAllOrderDtos(userId));
    } catch (error) {
      return sendRouteError(res, error, "Failed to fetch orders.");
    }
  });

  app.post("/api/orders", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payload = createOrderRequestSchema.parse(req.body);
      const orderId = payload.id ?? crypto.randomUUID();

      await db.transaction(async (tx) => {
        await tx
          .insert(orders)
          .values(mapOrderRequestToInsert({ ...payload, id: orderId }, userId));

        const itemRecords = buildOrderItemInserts(userId, orderId, payload.items);
        if (itemRecords.length > 0) {
          await tx.insert(order_items).values(itemRecords);
        }
      });

      const createdOrder = await loadOrderDto(userId, orderId);
      if (!createdOrder) {
        return res.status(500).json({ error: "Failed to load created order." });
      }

      return res.status(201).json(createdOrder);
    } catch (error) {
      return sendRouteError(res, error, "Failed to create order.");
    }
  });

  app.put("/api/orders/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const orderId = getRouteParam(req, "id");
      const payload = updateOrderRequestSchema.parse(req.body);
      const [existingOrder] = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, orderId), eq(orders.user_id, userId)));

      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found." });
      }

      await db.transaction(async (tx) => {
        const updateData = mapOrderUpdateToRecord({
          ...payload,
          updatedAt: payload.updatedAt ?? new Date().toISOString(),
        });

        if (payload.items !== undefined || payload.shippingCost !== undefined) {
          const itemsForTotal =
            payload.items ??
            (
              await tx
                .select()
                .from(order_items)
                .where(
                  and(
                    eq(order_items.order_id, orderId),
                    eq(order_items.user_id, userId),
                  ),
                )
            ).map(mapOrderItemRecordToDto);
          const shippingCost =
            payload.shippingCost ??
            parseStoredNumber(existingOrder.shipping_cost);
          const recalculatedTotal =
            payload.total ?? calculateOrderTotal(itemsForTotal, shippingCost);
          updateData.total = recalculatedTotal.toString();
        }

        if (Object.keys(updateData).length > 0) {
          await tx
            .update(orders)
            .set(updateData)
            .where(and(eq(orders.id, orderId), eq(orders.user_id, userId)));
        }

        if (payload.items !== undefined) {
          await tx
            .delete(order_items)
            .where(
              and(
                eq(order_items.order_id, orderId),
                eq(order_items.user_id, userId),
              ),
            );

          const itemRecords = buildOrderItemInserts(userId, orderId, payload.items);
          if (itemRecords.length > 0) {
            await tx.insert(order_items).values(itemRecords);
          }
        }
      });

      const updatedOrder = await loadOrderDto(userId, orderId);
      if (!updatedOrder) {
        return res.status(404).json({ error: "Order not found." });
      }

      return res.json(updatedOrder);
    } catch (error) {
      return sendRouteError(res, error, "Failed to update order.");
    }
  });

  app.delete("/api/orders/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      await db
        .delete(orders)
        .where(and(eq(orders.id, getRouteParam(req, "id")), eq(orders.user_id, userId)));

      return res.json({ success: true });
    } catch (error) {
      return sendRouteError(res, error, "Failed to delete order.");
    }
  });

  app.get("/api/order_items", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const itemRecords = await db
        .select()
        .from(order_items)
        .where(eq(order_items.user_id, userId));
      return res.json(itemRecords.map(mapOrderItemRecordToDto));
    } catch (error) {
      return sendRouteError(res, error, "Failed to fetch order items.");
    }
  });

  app.post("/api/order_items", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payload = createOrderItemRequestSchema.parse(req.body);
      const itemId = payload.id ?? crypto.randomUUID();

      await db.insert(order_items).values(
        mapOrderItemRequestToInsert(
          { ...payload, id: itemId, orderId: payload.orderId },
          userId,
        ),
      );

      const [createdItem] = await db
        .select()
        .from(order_items)
        .where(and(eq(order_items.id, itemId), eq(order_items.user_id, userId)));

      if (!createdItem) {
        return res
          .status(500)
          .json({ error: "Failed to load created order item." });
      }

      return res.status(201).json(mapOrderItemRecordToDto(createdItem));
    } catch (error) {
      return sendRouteError(res, error, "Failed to create order item.");
    }
  });

  app.put("/api/order_items/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const itemId = getRouteParam(req, "id");
      const payload = updateOrderItemRequestSchema.parse(req.body);
      const [existingItem] = await db
        .select()
        .from(order_items)
        .where(and(eq(order_items.id, itemId), eq(order_items.user_id, userId)));

      if (!existingItem) {
        return res.status(404).json({ error: "Order item not found." });
      }

      const updateData = mapOrderItemUpdateToRecord(payload);
      if (Object.keys(updateData).length > 0) {
        await db
          .update(order_items)
          .set(updateData)
          .where(and(eq(order_items.id, itemId), eq(order_items.user_id, userId)));
      }

      const [updatedItem] = await db
        .select()
        .from(order_items)
        .where(and(eq(order_items.id, itemId), eq(order_items.user_id, userId)));

      if (!updatedItem) {
        return res.status(404).json({ error: "Order item not found." });
      }

      return res.json(mapOrderItemRecordToDto(updatedItem));
    } catch (error) {
      return sendRouteError(res, error, "Failed to update order item.");
    }
  });

  app.delete("/api/order_items/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      await db
        .delete(order_items)
        .where(and(eq(order_items.id, getRouteParam(req, "id")), eq(order_items.user_id, userId)));

      return res.json({ success: true });
    } catch (error) {
      return sendRouteError(res, error, "Failed to delete order item.");
    }
  });

  app.get("/api/markets", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const marketRecords = await db
        .select()
        .from(markets)
        .where(eq(markets.user_id, userId));
      return res.json(marketRecords.map(mapMarketRecordToDto));
    } catch (error) {
      return sendRouteError(res, error, "Failed to fetch markets.");
    }
  });

  app.post("/api/markets", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payload = createMarketRequestSchema.parse(req.body);
      const marketId = payload.id ?? crypto.randomUUID();

      await db
        .insert(markets)
        .values(mapMarketRequestToInsert({ ...payload, id: marketId }, userId));

      const [createdMarket] = await db
        .select()
        .from(markets)
        .where(and(eq(markets.id, marketId), eq(markets.user_id, userId)));

      if (!createdMarket) {
        return res.status(500).json({ error: "Failed to load created market." });
      }

      return res.status(201).json(mapMarketRecordToDto(createdMarket));
    } catch (error) {
      return sendRouteError(res, error, "Failed to create market.");
    }
  });

  app.put("/api/markets/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const marketId = getRouteParam(req, "id");
      const payload = updateMarketRequestSchema.parse(req.body);
      const [existingMarket] = await db
        .select()
        .from(markets)
        .where(and(eq(markets.id, marketId), eq(markets.user_id, userId)));

      if (!existingMarket) {
        return res.status(404).json({ error: "Market not found." });
      }

      const updateData = mapMarketUpdateToRecord(payload);
      if (Object.keys(updateData).length > 0) {
        await db
          .update(markets)
          .set(updateData)
          .where(and(eq(markets.id, marketId), eq(markets.user_id, userId)));
      }

      const [updatedMarket] = await db
        .select()
        .from(markets)
        .where(and(eq(markets.id, marketId), eq(markets.user_id, userId)));

      if (!updatedMarket) {
        return res.status(404).json({ error: "Market not found." });
      }

      return res.json(mapMarketRecordToDto(updatedMarket));
    } catch (error) {
      return sendRouteError(res, error, "Failed to update market.");
    }
  });

  app.delete("/api/markets/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      await db
        .delete(markets)
        .where(and(eq(markets.id, getRouteParam(req, "id")), eq(markets.user_id, userId)));

      return res.json({ success: true });
    } catch (error) {
      return sendRouteError(res, error, "Failed to delete market.");
    }
  });

  app.get("/api/market_sales", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const saleRecords = await db
        .select()
        .from(market_sales)
        .where(eq(market_sales.user_id, userId));
      return res.json(saleRecords.map(mapMarketSaleRecordToDto));
    } catch (error) {
      return sendRouteError(res, error, "Failed to fetch market sales.");
    }
  });

  app.post("/api/market_sales", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payload = createMarketSaleRequestSchema.parse(req.body);
      const saleId = payload.id ?? crypto.randomUUID();

      await db.insert(market_sales).values(
        mapMarketSaleRequestToInsert({ ...payload, id: saleId }, userId),
      );

      const [createdSale] = await db
        .select()
        .from(market_sales)
        .where(and(eq(market_sales.id, saleId), eq(market_sales.user_id, userId)));

      if (!createdSale) {
        return res
          .status(500)
          .json({ error: "Failed to load created market sale." });
      }

      return res.status(201).json(mapMarketSaleRecordToDto(createdSale));
    } catch (error) {
      return sendRouteError(res, error, "Failed to create market sale.");
    }
  });

  app.put("/api/market_sales/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const saleId = getRouteParam(req, "id");
      const payload = updateMarketSaleRequestSchema.parse(req.body);
      const [existingSale] = await db
        .select()
        .from(market_sales)
        .where(and(eq(market_sales.id, saleId), eq(market_sales.user_id, userId)));

      if (!existingSale) {
        return res.status(404).json({ error: "Market sale not found." });
      }

      const updateData = mapMarketSaleUpdateToRecord(payload);
      if (Object.keys(updateData).length > 0) {
        await db
          .update(market_sales)
          .set(updateData)
          .where(and(eq(market_sales.id, saleId), eq(market_sales.user_id, userId)));
      }

      const [updatedSale] = await db
        .select()
        .from(market_sales)
        .where(and(eq(market_sales.id, saleId), eq(market_sales.user_id, userId)));

      if (!updatedSale) {
        return res.status(404).json({ error: "Market sale not found." });
      }

      return res.json(mapMarketSaleRecordToDto(updatedSale));
    } catch (error) {
      return sendRouteError(res, error, "Failed to update market sale.");
    }
  });

  app.delete("/api/market_sales/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      await db
        .delete(market_sales)
        .where(
          and(eq(market_sales.id, getRouteParam(req, "id")), eq(market_sales.user_id, userId)),
        );

      return res.json({ success: true });
    } catch (error) {
      return sendRouteError(res, error, "Failed to delete market sale.");
    }
  });

  app.get("/api/expenses", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expenseRecords = await db
        .select()
        .from(expenses)
        .where(eq(expenses.user_id, userId));
      return res.json(expenseRecords.map(mapExpenseRecordToDto));
    } catch (error) {
      return sendRouteError(res, error, "Failed to fetch expenses.");
    }
  });

  app.post("/api/expenses", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payload = createExpenseRequestSchema.parse(req.body);
      const expenseId = payload.id ?? crypto.randomUUID();

      await db
        .insert(expenses)
        .values(mapExpenseRequestToInsert({ ...payload, id: expenseId }, userId));

      const [createdExpense] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)));

      if (!createdExpense) {
        return res.status(500).json({ error: "Failed to load created expense." });
      }

      return res.status(201).json(mapExpenseRecordToDto(createdExpense));
    } catch (error) {
      return sendRouteError(res, error, "Failed to create expense.");
    }
  });

  app.put("/api/expenses/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expenseId = getRouteParam(req, "id");
      const payload = updateExpenseRequestSchema.parse(req.body);
      const [existingExpense] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)));

      if (!existingExpense) {
        return res.status(404).json({ error: "Expense not found." });
      }

      const updateData = mapExpenseUpdateToRecord(payload);
      if (Object.keys(updateData).length > 0) {
        await db
          .update(expenses)
          .set(updateData)
          .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)));
      }

      const [updatedExpense] = await db
        .select()
        .from(expenses)
        .where(and(eq(expenses.id, expenseId), eq(expenses.user_id, userId)));

      if (!updatedExpense) {
        return res.status(404).json({ error: "Expense not found." });
      }

      return res.json(mapExpenseRecordToDto(updatedExpense));
    } catch (error) {
      return sendRouteError(res, error, "Failed to update expense.");
    }
  });

  app.delete("/api/expenses/:id", ...cloudRouteGuards, async (req, res) => {
    try {
      const userId = getUserId(req);
      await db
        .delete(expenses)
        .where(and(eq(expenses.id, getRouteParam(req, "id")), eq(expenses.user_id, userId)));

      return res.json({ success: true });
    } catch (error) {
      return sendRouteError(res, error, "Failed to delete expense.");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
