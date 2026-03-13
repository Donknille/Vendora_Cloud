import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "node:http";
import crypto from "crypto";
import {
  users, orders, markets, expenses, order_items, market_sales,
  insertOrderSchema, insertOrderItemSchema, insertMarketSchema, insertMarketSaleSchema, insertExpenseSchema
} from "@vendora/shared";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

import { requireIntegrity } from "./middleware/integrity";
import { rateLimit } from "express-rate-limit";

export async function registerRoutes(app: Express): Promise<Server> {
  // -- Rate Limiting Middleware --
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 100, // Limit each IP to 100 requests per window
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests from this IP, please try again later." }
  });

  // Apply rate limiting to all /api routes
  app.use("/api", apiLimiter);

  // -- Middleware für Subscriber-Gating --
  const requireSubscription = async (req: Request, res: Response, next: NextFunction) => {
    // GET requests are always allowed so users can read their data even if their subscription/trial expired.
    if (req.method === "GET") {
      return next();
    }

    const supabaseId = req.headers["x-user-id"]; // In der echten App JWT verifizieren
    if (!supabaseId) return res.status(401).json({ error: "Unauthorized" });

    const [user] = await db.select().from(users).where(eq(users.supabase_id, supabaseId as string));
    if (!user) {
      return res.status(403).json({ error: "User not found." });
    }

    // Check 1. Is subscription active?
    if (user.subscription_status === "active") {
      return next();
    }

    // Check 2. Is trial active?
    // Determine age of account
    const createdAt = new Date(user.created_at || Date.now());
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceCreation <= 14) {
      return next(); // Still in trial
    }

    // Trial expired and no active subscription
    return res.status(403).json({ error: "Premium subscription required. Your 14-day trial has expired." });
  };

  // -- User Sync Endpoint --
  app.post("/api/users/sync", async (req, res) => {
    try {
      const supabaseId = req.headers["x-user-id"] as string;
      const { email } = req.body;

      if (!supabaseId || !email) {
        return res.status(400).json({ error: "Missing user ID or email." });
      }

      await db.insert(users).values({
        supabase_id: supabaseId,
        email: email,
        revenuecat_app_user_id: supabaseId,
      }).onConflictDoNothing({ target: users.supabase_id });

      res.sendStatus(200);
    } catch (e) {
      console.error("User sync error:", e);
      res.status(500).json({ error: "Failed to sync user." });
    }
  });

  // -- RevenueCat Webhook Endpoint --
  app.post("/api/webhooks/revenuecat", async (req, res) => {
    // 1. Signaturprüfung (Security Check)
    const signature = req.headers["x-revenuecat-signature"];
    const webhookSecret = process.env.REVENUECAT_WEBHOOK_SECRET;

    // In der Produktion sollte immer das Secret geprüft werden, hier im POC fallbaclen wir auf console warning
    if (webhookSecret && signature) {
      const payload = typeof req.rawBody === "string" ? req.rawBody : (req.rawBody as Buffer)?.toString("utf-8");
      if (payload) {
        const expectedSignature = crypto.createHash("sha1").update(webhookSecret + payload).digest("hex");
        if (expectedSignature !== signature) {
          return res.status(401).send("Invalid signature");
        }
      }
    }

    try {
      const { event } = req.body;
      const appUserId = event.app_user_id;
      const entitlementId = event.entitlement_ids ? event.entitlement_ids[0] : null;

      if (!appUserId || entitlementId !== "pro") {
        return res.sendStatus(200); // Erfolgreich empfangen, aber nichts zu tun
      }

      let newStatus = "active";

      switch (event.type) {
        case "INITIAL_PURCHASE":
        case "RENEWAL":
        case "UNCANCELLATION":
          newStatus = "active";
          break;
        case "CANCELLATION":
        case "EXPIRATION":
          newStatus = "canceled";
          break;
        case "BILLING_ISSUE":
          newStatus = "past_due";
          break;
        default:
          // Andere Events wie TEST etc.
          return res.sendStatus(200);
      }

      // Datenbank über Drizzle aktualisieren
      const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;

      await db.update(users)
        .set({
          subscription_status: newStatus,
          subscription_expires_at: expiresAt
        })
        .where(eq(users.revenuecat_app_user_id, appUserId));

      console.log(`Updated user ${appUserId} to subscription status: ${newStatus}`);
      res.sendStatus(200);

    } catch (e) {
      console.error("Webhook processing error:", e);
      res.status(500).send("Error processing webhook");
    }
  });

  // -- Cloud Sync API Routes (Secured) --

  // --- Orders ---
  app.get("/api/orders", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userOrders = await db.select().from(orders).where(eq(orders.user_id, userId));
      res.json(userOrders);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Failed to fetch orders" });
    }
  });

  app.post("/api/orders", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderSchema.parse({ ...req.body, user_id: userId });
      await db.insert(orders).values(validatedData);
      res.status(201).json({ message: "Order created" });
    } catch (e: any) {
      console.error(e);
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create order" });
    }
  });

  app.put("/api/orders/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderSchema.partial().parse(req.body);
      await db.update(orders).set(validatedData).where(and(eq(orders.id, req.params.id as string), eq(orders.user_id, userId)));
      res.json({ message: "Order updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update order" });
    }
  });

  app.delete("/api/orders/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(orders).where(and(eq(orders.id, req.params.id as string), eq(orders.user_id, userId)));
      res.json({ message: "Order deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // --- Markets ---
  app.get("/api/markets", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userMarkets = await db.select().from(markets).where(eq(markets.user_id, userId));
      res.json(userMarkets);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch markets" });
    }
  });

  app.post("/api/markets", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSchema.parse({ ...req.body, user_id: userId });
      await db.insert(markets).values(validatedData);
      res.status(201).json({ message: "Market created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create market" });
    }
  });

  // --- Expenses ---
  app.get("/api/expenses", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userExpenses = await db.select().from(expenses).where(eq(expenses.user_id, userId));
      res.json(userExpenses);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertExpenseSchema.parse({ ...req.body, user_id: userId });
      await db.insert(expenses).values(validatedData);
      res.status(201).json({ message: "Expense created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create expense" });
    }
  });

  // --- Order Items ---
  app.get("/api/order_items", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const items = await db.select().from(order_items).where(eq(order_items.user_id, userId));
      res.json(items);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch order items" });
    }
  });

  app.post("/api/order_items", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderItemSchema.parse({ ...req.body, user_id: userId });
      await db.insert(order_items).values(validatedData);
      res.status(201).json({ message: "Order item created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create order item" });
    }
  });

  app.put("/api/order_items/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertOrderItemSchema.partial().parse(req.body);
      await db.update(order_items).set(validatedData).where(and(eq(order_items.id, req.params.id as string), eq(order_items.user_id, userId)));
      res.json({ message: "Order item updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update order item" });
    }
  });

  app.delete("/api/order_items/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(order_items).where(and(eq(order_items.id, req.params.id as string), eq(order_items.user_id, userId)));
      res.json({ message: "Order item deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete order item" });
    }
  });

  // --- Market Sales ---
  app.get("/api/market_sales", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const sales = await db.select().from(market_sales).where(eq(market_sales.user_id, userId));
      res.json(sales);
    } catch (e) {
      res.status(500).json({ error: "Failed to fetch market sales" });
    }
  });

  app.post("/api/market_sales", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSaleSchema.parse({ ...req.body, user_id: userId });
      await db.insert(market_sales).values(validatedData);
      res.status(201).json({ message: "Market sale created" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to create market sale" });
    }
  });

  app.put("/api/market_sales/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const validatedData = insertMarketSaleSchema.partial().parse(req.body);
      await db.update(market_sales).set(validatedData).where(and(eq(market_sales.id, req.params.id as string), eq(market_sales.user_id, userId)));
      res.json({ message: "Market sale updated" });
    } catch (e: any) {
      res.status(e.name === "ZodError" ? 400 : 500).json({ error: e.errors || "Failed to update market sale" });
    }
  });

  app.delete("/api/market_sales/:id", requireIntegrity, requireSubscription, async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      await db.delete(market_sales).where(and(eq(market_sales.id, req.params.id as string), eq(market_sales.user_id, userId)));
      res.json({ message: "Market sale deleted" });
    } catch (e) {
      res.status(500).json({ error: "Failed to delete market sale" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
