export function formatCurrency(amount: number, currency: string = "\u20AC"): string {
  return `${currency}${amount.toFixed(2).replace(".", ",")}`;
}

export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}
