import type { OrderDto } from "@vendora/shared";

import { parseAmount } from "./formatCurrency";

export type EditableOrderItem = {
  id: string;
  name: string;
  quantity: number;
  priceText: string;
  notes: string;
  isCompleted: boolean;
};

export type OrderFormState = {
  customerName: string;
  customerEmail: string;
  customerAddress: string;
  orderDate: string;
  serviceDate: string;
  shippingCost: string;
  notes: string;
  items: EditableOrderItem[];
};

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateInvoiceNumber(now = new Date()): string {
  const year = now.getFullYear().toString().slice(-2);
  const stamp = [
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `${year}-${stamp}`;
}

export function createEmptyOrderItem(): EditableOrderItem {
  return {
    id: createId(),
    name: "",
    quantity: 1,
    priceText: "",
    notes: "",
    isCompleted: false,
  };
}

export function createInitialOrderFormState(): OrderFormState {
  const today = toISODate(new Date());
  return {
    customerName: "",
    customerEmail: "",
    customerAddress: "",
    orderDate: today,
    serviceDate: today,
    shippingCost: "",
    notes: "",
    items: [createEmptyOrderItem()],
  };
}

export function createOrderFormStateFromOrder(order: OrderDto): OrderFormState {
  const fallbackDate = order.createdAt.split("T")[0];
  const items =
    order.items.length > 0
      ? order.items.map((item) => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          priceText: item.price.toString().replace(".", ","),
          notes: item.notes ?? "",
          isCompleted: item.isCompleted ?? false,
        }))
      : [createEmptyOrderItem()];

  return {
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerAddress: order.customerAddress,
    orderDate: order.orderDate || fallbackDate,
    serviceDate: order.serviceDate || order.orderDate || fallbackDate,
    shippingCost:
      order.shippingCost != null
        ? order.shippingCost.toString().replace(".", ",")
        : "",
    notes: order.notes,
    items,
  };
}

export function addEditableOrderItem(
  items: EditableOrderItem[],
): EditableOrderItem[] {
  return [...items, createEmptyOrderItem()];
}

export function updateEditableOrderItem(
  items: EditableOrderItem[],
  index: number,
  field: "name" | "quantity" | "price" | "notes",
  value: string,
): EditableOrderItem[] {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    if (field === "name") {
      return { ...item, name: value };
    }

    if (field === "quantity") {
      return {
        ...item,
        quantity: parseInt(value, 10) || 1,
      };
    }

    if (field === "price") {
      return { ...item, priceText: value };
    }

    return { ...item, notes: value };
  });
}

export function removeEditableOrderItem(
  items: EditableOrderItem[],
  index: number,
): EditableOrderItem[] {
  if (items.length <= 1) {
    return items;
  }

  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function calculateOrderFormTotal(formState: OrderFormState): number {
  const itemsTotal = formState.items.reduce(
    (sum, item) => sum + parseAmount(item.priceText) * item.quantity,
    0,
  );
  return itemsTotal + parseAmount(formState.shippingCost);
}

export function buildOrderMutationInput(
  formState: OrderFormState,
  options: {
    status?: OrderDto["status"];
    invoiceNumber?: string;
    createdAt?: string;
    updatedAt?: string;
  } = {},
) {
  const items = formState.items.map((item) => ({
    id: item.id,
    name: item.name.trim(),
    quantity: item.quantity,
    price: parseAmount(item.priceText),
    notes: item.notes.trim(),
    isCompleted: item.isCompleted,
  }));
  const shippingCost = parseAmount(formState.shippingCost);

  return {
    customerName: formState.customerName.trim(),
    customerEmail: formState.customerEmail.trim(),
    customerAddress: formState.customerAddress.trim(),
    items,
    status: options.status,
    invoiceNumber: options.invoiceNumber,
    notes: formState.notes.trim(),
    orderDate: formState.orderDate,
    serviceDate: formState.serviceDate,
    shippingCost,
    total: items.reduce((sum, item) => sum + item.price * item.quantity, 0) + shippingCost,
    createdAt: options.createdAt,
    updatedAt: options.updatedAt,
  };
}
