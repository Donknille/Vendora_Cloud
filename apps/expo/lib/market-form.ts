import type { MarketDto } from "@vendora/shared";

import { parseAmount } from "./formatCurrency";

export type EditableQuickItem = {
  name: string;
  priceText: string;
};

export type MarketFormState = {
  name: string;
  location: string;
  date: string;
  standFee: string;
  travelCost: string;
  notes: string;
  quickItems: EditableQuickItem[];
};

export function createEmptyQuickItem(): EditableQuickItem {
  return { name: "", priceText: "" };
}

export function createInitialMarketFormState(): MarketFormState {
  const today = new Date();
  const date = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");

  return {
    name: "",
    location: "",
    date,
    standFee: "",
    travelCost: "",
    notes: "",
    quickItems: [createEmptyQuickItem()],
  };
}

export function createMarketFormStateFromMarket(
  market: MarketDto,
): MarketFormState {
  const quickItems =
    market.quickItems?.map((item) => ({
      name: item.name,
      priceText: item.price.toString().replace(".", ","),
    })) ?? [createEmptyQuickItem()];

  return {
    name: market.name,
    location: market.location,
    date: market.date,
    standFee: market.standFee.toString().replace(".", ","),
    travelCost: market.travelCost.toString().replace(".", ","),
    notes: market.notes,
    quickItems: quickItems.length > 0 ? quickItems : [createEmptyQuickItem()],
  };
}

export function addEditableQuickItem(
  items: EditableQuickItem[],
): EditableQuickItem[] {
  return [...items, createEmptyQuickItem()];
}

export function updateEditableQuickItem(
  items: EditableQuickItem[],
  index: number,
  field: "name" | "price",
  value: string,
): EditableQuickItem[] {
  return items.map((item, itemIndex) => {
    if (itemIndex !== index) {
      return item;
    }

    return field === "name"
      ? { ...item, name: value }
      : { ...item, priceText: value };
  });
}

export function removeEditableQuickItem(
  items: EditableQuickItem[],
  index: number,
): EditableQuickItem[] {
  if (items.length <= 1) {
    return [createEmptyQuickItem()];
  }

  return items.filter((_, itemIndex) => itemIndex !== index);
}

export function buildMarketMutationInput(
  formState: MarketFormState,
  options: { status?: MarketDto["status"] } = {},
) {
  return {
    name: formState.name.trim(),
    date: formState.date,
    location: formState.location.trim(),
    standFee: parseAmount(formState.standFee),
    travelCost: parseAmount(formState.travelCost),
    notes: formState.notes.trim(),
    status: options.status,
    quickItems: formState.quickItems
      .filter((item) => item.name.trim() && item.priceText.trim())
      .map((item) => ({
        name: item.name.trim(),
        price: parseAmount(item.priceText),
      })),
  };
}
