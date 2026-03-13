import { z } from "zod";

import {
  expenses,
  markets,
  market_sales,
  order_items,
  orders,
  users,
} from "./schema";

export const orderStatusSchema = z.enum([
  "open",
  "paid",
  "shipped",
  "delivered",
  "cancelled",
]);

export const marketStatusSchema = z.enum(["open", "closed"]);
export const subscriptionStatusSchema = z.enum([
  "trialing",
  "active",
  "canceled",
  "past_due",
  "expired",
  "free",
]);

export const TRIAL_LENGTH_DAYS = 14;

const numberInputSchema = z.coerce.number().finite();
const optionalNumberInputSchema = z
  .union([numberInputSchema, z.null(), z.undefined()])
  .optional()
  .transform((value) => (value == null ? undefined : value));

const optionalStringInputSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .optional()
  .transform((value) => {
    if (typeof value !== "string") {
      return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

export const quickItemSchema = z.object({
  name: z.string().trim().min(1),
  price: numberInputSchema,
});

export type QuickItemDto = z.infer<typeof quickItemSchema>;

export const orderItemDtoSchema = z.object({
  id: z.string(),
  orderId: z.string().optional(),
  name: z.string(),
  quantity: z.number(),
  price: z.number(),
  notes: z.string().optional(),
  isCompleted: z.boolean().optional(),
});

export const orderDtoSchema = z.object({
  id: z.string(),
  customerName: z.string(),
  customerEmail: z.string(),
  customerAddress: z.string(),
  items: z.array(orderItemDtoSchema),
  status: orderStatusSchema,
  invoiceNumber: z.string(),
  notes: z.string(),
  orderDate: z.string(),
  serviceDate: z.string().optional(),
  shippingCost: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  total: z.number(),
});

export const marketDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  location: z.string(),
  standFee: z.number(),
  travelCost: z.number(),
  notes: z.string(),
  createdAt: z.string(),
  quickItems: z.array(quickItemSchema).optional(),
  status: marketStatusSchema.optional(),
});

export const marketSaleDtoSchema = z.object({
  id: z.string(),
  marketId: z.string(),
  description: z.string(),
  amount: z.number(),
  quantity: z.number(),
  createdAt: z.string(),
});

export const expenseDtoSchema = z.object({
  id: z.string(),
  description: z.string(),
  amount: z.number(),
  category: z.string(),
  date: z.string(),
  expenseDate: z.string(),
  createdAt: z.string(),
});

export const subscriptionStateDtoSchema = z.object({
  status: subscriptionStatusSchema,
  isSubscribed: z.boolean(),
  isInTrial: z.boolean(),
  canCreateNewItems: z.boolean(),
  daysUntilTrialEnds: z.number().int().min(0),
  trialEndsAt: z.string().optional(),
  subscriptionExpiresAt: z.string().optional(),
  entitlementId: z.string().optional(),
});

export type OrderItemDto = z.infer<typeof orderItemDtoSchema>;
export type OrderDto = z.infer<typeof orderDtoSchema>;
export type MarketDto = z.infer<typeof marketDtoSchema>;
export type MarketSaleDto = z.infer<typeof marketSaleDtoSchema>;
export type ExpenseDto = z.infer<typeof expenseDtoSchema>;
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;
export type SubscriptionStateDto = z.infer<typeof subscriptionStateDtoSchema>;

export const orderItemWriteSchema = z.object({
  id: z.string().trim().min(1).optional(),
  orderId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  quantity: numberInputSchema,
  price: numberInputSchema,
  notes: optionalStringInputSchema,
  isCompleted: z.boolean().optional(),
});

export const createOrderRequestSchema = z.object({
  id: z.string().trim().min(1).optional(),
  customerName: z.string().trim().min(1),
  customerEmail: optionalStringInputSchema,
  customerAddress: optionalStringInputSchema,
  items: z.array(orderItemWriteSchema).default([]),
  status: orderStatusSchema.default("open"),
  invoiceNumber: optionalStringInputSchema,
  notes: optionalStringInputSchema,
  orderDate: z.string().trim().min(1),
  serviceDate: optionalStringInputSchema,
  shippingCost: optionalNumberInputSchema,
  total: optionalNumberInputSchema,
  createdAt: optionalStringInputSchema,
  updatedAt: optionalStringInputSchema,
});

export const updateOrderRequestSchema = createOrderRequestSchema.partial();

export const createMarketRequestSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  date: z.string().trim().min(1),
  location: optionalStringInputSchema,
  standFee: optionalNumberInputSchema,
  travelCost: optionalNumberInputSchema,
  notes: optionalStringInputSchema,
  createdAt: optionalStringInputSchema,
  status: marketStatusSchema.optional(),
  quickItems: z.array(quickItemSchema).optional(),
});

export const updateMarketRequestSchema = createMarketRequestSchema.partial();

export const createMarketSaleRequestSchema = z.object({
  id: z.string().trim().min(1).optional(),
  marketId: z.string().trim().min(1),
  description: z.string().trim().min(1),
  amount: numberInputSchema,
  quantity: numberInputSchema,
  createdAt: optionalStringInputSchema,
});

export const updateMarketSaleRequestSchema = createMarketSaleRequestSchema
  .omit({ marketId: true })
  .partial();

const expenseRequestBaseSchema = z.object({
  id: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  amount: numberInputSchema,
  category: z.string().trim().min(1),
  date: optionalStringInputSchema,
  expenseDate: optionalStringInputSchema,
  createdAt: optionalStringInputSchema,
});

export const createExpenseRequestSchema = expenseRequestBaseSchema.refine(
  (value) => value.expenseDate || value.date,
  {
    message: "expenseDate or date is required",
    path: ["expenseDate"],
  },
);

export const updateExpenseRequestSchema = expenseRequestBaseSchema.partial();

export const createOrderItemRequestSchema = orderItemWriteSchema.extend({
  orderId: z.string().trim().min(1),
});

export const updateOrderItemRequestSchema = orderItemWriteSchema
  .omit({ orderId: true })
  .partial();

export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof updateOrderRequestSchema>;
export type CreateMarketRequest = z.infer<typeof createMarketRequestSchema>;
export type UpdateMarketRequest = z.infer<typeof updateMarketRequestSchema>;
export type CreateMarketSaleRequest = z.infer<typeof createMarketSaleRequestSchema>;
export type UpdateMarketSaleRequest = z.infer<typeof updateMarketSaleRequestSchema>;
export type CreateExpenseRequest = z.infer<typeof createExpenseRequestSchema>;
export type UpdateExpenseRequest = z.infer<typeof updateExpenseRequestSchema>;
export type CreateOrderItemRequest = z.infer<typeof createOrderItemRequestSchema>;
export type UpdateOrderItemRequest = z.infer<typeof updateOrderItemRequestSchema>;

type OrderRow = typeof orders.$inferSelect;
type OrderItemRow = typeof order_items.$inferSelect;
type MarketRow = typeof markets.$inferSelect;
type MarketSaleRow = typeof market_sales.$inferSelect;
type ExpenseRow = typeof expenses.$inferSelect;
type UserRow = typeof users.$inferSelect;

type OrderInsert = typeof orders.$inferInsert;
type OrderItemInsert = typeof order_items.$inferInsert;
type MarketInsert = typeof markets.$inferInsert;
type MarketSaleInsert = typeof market_sales.$inferInsert;
type ExpenseInsert = typeof expenses.$inferInsert;

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function calculateDaysUntil(target: Date | null, now: Date): number {
  if (!target) {
    return 0;
  }

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return 0;
  }

  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

export function normalizeSubscriptionStatus(
  value: string | null | undefined,
): SubscriptionStatus {
  switch (value) {
    case "trialing":
    case "active":
    case "canceled":
    case "past_due":
    case "expired":
    case "free":
      return value;
    default:
      return "free";
  }
}

function toNumber(value: string | null | undefined, fallback = 0): number {
  if (value == null || value === "") {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(value: string | null | undefined): number | undefined {
  if (value == null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toRequiredText(value: string | null | undefined, fallback = ""): string {
  return value ?? fallback;
}

function toOptionalText(value: string | undefined): string | null {
  return value ?? null;
}

function parseQuickItems(value: string | null | undefined): QuickItemDto[] | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    return z.array(quickItemSchema).parse(parsed);
  } catch {
    return undefined;
  }
}

function serializeQuickItems(items: QuickItemDto[] | undefined): string | null {
  if (!items || items.length === 0) {
    return null;
  }

  return JSON.stringify(items);
}

export function calculateOrderTotal(
  items: Pick<OrderItemDto, "quantity" | "price">[],
  shippingCost = 0,
): number {
  return (
    items.reduce((sum, item) => sum + item.quantity * item.price, 0) +
    shippingCost
  );
}

export function mapUserRecordToSubscriptionState(
  record: UserRow,
  now = new Date(),
): SubscriptionStateDto {
  const normalizedStatus = normalizeSubscriptionStatus(record.subscription_status);
  const createdAt = parseIsoDate(record.created_at) ?? now;
  const trialEndsAtDate = addDays(createdAt, TRIAL_LENGTH_DAYS);
  const subscriptionExpiresAtDate = parseIsoDate(record.subscription_expires_at);

  const isSubscribed =
    normalizedStatus === "active"
      ? !subscriptionExpiresAtDate ||
        subscriptionExpiresAtDate.getTime() > now.getTime()
      : (normalizedStatus === "canceled" || normalizedStatus === "past_due") &&
        subscriptionExpiresAtDate !== null &&
        subscriptionExpiresAtDate.getTime() > now.getTime();

  const daysUntilTrialEnds = isSubscribed
    ? 0
    : calculateDaysUntil(trialEndsAtDate, now);
  const isInTrial = !isSubscribed && daysUntilTrialEnds > 0;

  const status: SubscriptionStatus = isSubscribed
    ? normalizedStatus
    : isInTrial
      ? "trialing"
      : normalizedStatus === "free"
        ? "free"
        : "expired";

  return {
    status,
    isSubscribed,
    isInTrial,
    canCreateNewItems: isSubscribed || isInTrial,
    daysUntilTrialEnds,
    trialEndsAt: trialEndsAtDate.toISOString(),
    subscriptionExpiresAt: record.subscription_expires_at ?? undefined,
    entitlementId: "pro",
  };
}

export function mapOrderItemRecordToDto(record: OrderItemRow): OrderItemDto {
  return {
    id: record.id,
    orderId: record.order_id,
    name: record.name,
    quantity: toNumber(record.quantity, 1),
    price: toNumber(record.price),
    notes: record.notes ?? undefined,
    isCompleted: record.is_completed ?? false,
  };
}

export function mapOrderRecordToDto(
  record: OrderRow,
  itemRecords: OrderItemRow[],
): OrderDto {
  const items = itemRecords.map(mapOrderItemRecordToDto);
  const shippingCost = toOptionalNumber(record.shipping_cost);
  const total =
    toOptionalNumber(record.total) ?? calculateOrderTotal(items, shippingCost ?? 0);
  const createdAt = record.created_at ?? record.order_date ?? "";

  return {
    id: record.id,
    customerName: record.customer_name,
    customerEmail: toRequiredText(record.customer_email),
    customerAddress: toRequiredText(record.customer_address),
    items,
    status: orderStatusSchema.catch("open").parse(record.status),
    invoiceNumber: toRequiredText(record.invoice_number),
    notes: toRequiredText(record.notes),
    orderDate: record.order_date,
    serviceDate: record.service_date ?? undefined,
    shippingCost,
    createdAt,
    updatedAt: record.updated_at ?? createdAt,
    total,
  };
}

export function mapMarketRecordToDto(record: MarketRow): MarketDto {
  return {
    id: record.id,
    name: record.name,
    date: record.date,
    location: toRequiredText(record.location),
    standFee: toNumber(record.stand_fee),
    travelCost: toNumber(record.travel_cost),
    notes: toRequiredText(record.notes),
    createdAt: record.created_at ?? record.date ?? "",
    quickItems: parseQuickItems(record.quick_items),
    status: record.status
      ? marketStatusSchema.catch("open").parse(record.status)
      : undefined,
  };
}

export function mapMarketSaleRecordToDto(record: MarketSaleRow): MarketSaleDto {
  return {
    id: record.id,
    marketId: record.market_id,
    description: record.description,
    amount: toNumber(record.amount),
    quantity: toNumber(record.quantity, 1),
    createdAt: record.created_at ?? "",
  };
}

export function mapExpenseRecordToDto(record: ExpenseRow): ExpenseDto {
  const expenseDate = record.expense_date ?? record.date;
  return {
    id: record.id,
    description: record.description,
    amount: toNumber(record.amount),
    category: record.category,
    date: record.date,
    expenseDate,
    createdAt: record.created_at ?? expenseDate,
  };
}

export function mapOrderRequestToInsert(
  input: CreateOrderRequest & { id: string },
  userId: string,
): OrderInsert {
  const shippingCost = input.shippingCost ?? 0;
  const total = input.total ?? calculateOrderTotal(input.items, shippingCost);

  return {
    id: input.id,
    user_id: userId,
    customer_name: input.customerName,
    customer_email: toOptionalText(input.customerEmail),
    customer_address: toOptionalText(input.customerAddress),
    status: input.status,
    invoice_number: toOptionalText(input.invoiceNumber),
    notes: toOptionalText(input.notes),
    order_date: input.orderDate,
    service_date: toOptionalText(input.serviceDate),
    shipping_cost:
      input.shippingCost == null ? null : input.shippingCost.toString(),
    total: total.toString(),
    created_at: input.createdAt ?? new Date().toISOString(),
    updated_at: input.updatedAt ?? input.createdAt ?? new Date().toISOString(),
  };
}

export function mapOrderUpdateToRecord(
  input: UpdateOrderRequest,
): Partial<OrderInsert> {
  const update: Partial<OrderInsert> = {};

  if (input.customerName !== undefined) update.customer_name = input.customerName;
  if (input.customerEmail !== undefined) {
    update.customer_email = toOptionalText(input.customerEmail);
  }
  if (input.customerAddress !== undefined) {
    update.customer_address = toOptionalText(input.customerAddress);
  }
  if (input.status !== undefined) update.status = input.status;
  if (input.invoiceNumber !== undefined) {
    update.invoice_number = toOptionalText(input.invoiceNumber);
  }
  if (input.notes !== undefined) update.notes = toOptionalText(input.notes);
  if (input.orderDate !== undefined) update.order_date = input.orderDate;
  if (input.serviceDate !== undefined) {
    update.service_date = toOptionalText(input.serviceDate);
  }
  if (input.shippingCost !== undefined) {
    update.shipping_cost =
      input.shippingCost == null ? null : input.shippingCost.toString();
  }
  if (input.total !== undefined) {
    update.total = input.total == null ? null : input.total.toString();
  }
  if (input.createdAt !== undefined) update.created_at = input.createdAt;
  if (input.updatedAt !== undefined) update.updated_at = input.updatedAt;

  return update;
}

export function mapOrderItemRequestToInsert(
  input: CreateOrderItemRequest & { id: string; orderId: string },
  userId: string,
): OrderItemInsert {
  return {
    id: input.id,
    user_id: userId,
    order_id: input.orderId,
    name: input.name,
    quantity: input.quantity.toString(),
    price: input.price.toString(),
    notes: toOptionalText(input.notes),
    is_completed: input.isCompleted ?? false,
  };
}

export function mapOrderItemUpdateToRecord(
  input: UpdateOrderItemRequest,
): Partial<OrderItemInsert> {
  const update: Partial<OrderItemInsert> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.quantity !== undefined) update.quantity = input.quantity.toString();
  if (input.price !== undefined) update.price = input.price.toString();
  if (input.notes !== undefined) update.notes = toOptionalText(input.notes);
  if (input.isCompleted !== undefined) update.is_completed = input.isCompleted;

  return update;
}

export function mapMarketRequestToInsert(
  input: CreateMarketRequest & { id: string },
  userId: string,
): MarketInsert {
  return {
    id: input.id,
    user_id: userId,
    name: input.name,
    date: input.date,
    location: toOptionalText(input.location),
    stand_fee: input.standFee == null ? null : input.standFee.toString(),
    travel_cost: input.travelCost == null ? null : input.travelCost.toString(),
    notes: toOptionalText(input.notes),
    quick_items: serializeQuickItems(input.quickItems),
    status: input.status ?? "open",
    created_at: input.createdAt ?? input.date,
  };
}

export function mapMarketUpdateToRecord(
  input: UpdateMarketRequest,
): Partial<MarketInsert> {
  const update: Partial<MarketInsert> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.date !== undefined) update.date = input.date;
  if (input.location !== undefined) update.location = toOptionalText(input.location);
  if (input.standFee !== undefined) {
    update.stand_fee = input.standFee == null ? null : input.standFee.toString();
  }
  if (input.travelCost !== undefined) {
    update.travel_cost =
      input.travelCost == null ? null : input.travelCost.toString();
  }
  if (input.notes !== undefined) update.notes = toOptionalText(input.notes);
  if (input.quickItems !== undefined) {
    update.quick_items = serializeQuickItems(input.quickItems);
  }
  if (input.status !== undefined) update.status = input.status;
  if (input.createdAt !== undefined) update.created_at = input.createdAt;

  return update;
}

export function mapMarketSaleRequestToInsert(
  input: CreateMarketSaleRequest & { id: string },
  userId: string,
): MarketSaleInsert {
  return {
    id: input.id,
    user_id: userId,
    market_id: input.marketId,
    description: input.description,
    amount: input.amount.toString(),
    quantity: input.quantity.toString(),
    created_at: input.createdAt ?? new Date().toISOString(),
  };
}

export function mapMarketSaleUpdateToRecord(
  input: UpdateMarketSaleRequest,
): Partial<MarketSaleInsert> {
  const update: Partial<MarketSaleInsert> = {};

  if (input.description !== undefined) update.description = input.description;
  if (input.amount !== undefined) update.amount = input.amount.toString();
  if (input.quantity !== undefined) update.quantity = input.quantity.toString();
  if (input.createdAt !== undefined) update.created_at = input.createdAt;

  return update;
}

export function mapExpenseRequestToInsert(
  input: CreateExpenseRequest & { id: string },
  userId: string,
): ExpenseInsert {
  const expenseDate = input.expenseDate ?? input.date!;

  return {
    id: input.id,
    user_id: userId,
    description: input.description,
    amount: input.amount.toString(),
    category: input.category,
    date: input.date ?? expenseDate,
    expense_date: expenseDate,
    created_at: input.createdAt ?? expenseDate,
  };
}

export function mapExpenseUpdateToRecord(
  input: UpdateExpenseRequest,
): Partial<ExpenseInsert> {
  const update: Partial<ExpenseInsert> = {};

  if (input.description !== undefined) update.description = input.description;
  if (input.amount !== undefined) update.amount = input.amount.toString();
  if (input.category !== undefined) update.category = input.category;
  if (input.date !== undefined) update.date = input.date;
  if (input.expenseDate !== undefined) update.expense_date = input.expenseDate;
  if (input.createdAt !== undefined) update.created_at = input.createdAt;

  return update;
}
