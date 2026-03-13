import { Order, CompanyProfile } from "@/lib/storage";
import { Translations } from "@/lib/i18n";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>");
}

function formatEur(amount: number): string {
  return `${amount.toFixed(2).replace(".", ",")} \u20AC`;
}

export function generateInvoiceHtml(
  order: Order,
  profile: CompanyProfile,
  t: Translations,
): string {
  const orderDate = order.orderDate || order.createdAt;
  const dateStr = new Date(orderDate).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const itemRows = order.items
    .map(
      (item) => `
      <tr>
        <td class="item-desc">${escapeHtml(item.name)}</td>
        <td class="item-qty">${item.quantity}</td>
        <td class="item-price">${formatEur(item.price)}</td>
        <td class="item-total">${formatEur(item.price * item.quantity)}</td>
      </tr>`,
    )
    .join("");

  const thankYouText = t.orders.invoiceThankYou || "Vielen Dank f\u00FCr Ihren Einkauf!";

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 30mm 20mm 25mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #333;
    font-size: 12px;
    line-height: 1.5;
    padding: 40px 48px;
    background: #fff;
    position: relative;
    min-height: 100vh;
  }

  .page-wrapper {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 80px);
  }
  .content { flex: 1; }

  /* Header */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 48px;
  }
  .company-block h1 {
    font-size: 26px;
    font-weight: 800;
    color: #1a2744;
    margin-bottom: 4px;
    line-height: 1.2;
  }
  .company-block .company-details {
    font-size: 11px;
    color: #666;
    line-height: 1.6;
  }
  .invoice-title-block {
    text-align: right;
  }
  .invoice-title-block h2 {
    font-size: 28px;
    font-weight: 800;
    color: #1a2744;
    letter-spacing: 1px;
    margin-bottom: 6px;
  }
  .invoice-meta {
    font-size: 11px;
    color: #555;
    line-height: 1.8;
  }
  .invoice-meta span {
    color: #333;
    font-weight: 600;
  }

  /* Recipient */
  .recipient-section {
    margin-bottom: 36px;
  }
  .recipient-box {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 14px 18px;
    display: inline-block;
    min-width: 240px;
  }
  .recipient-label {
    font-size: 10px;
    color: #888;
    margin-bottom: 6px;
  }
  .recipient-name {
    font-size: 15px;
    font-weight: 700;
    color: #1a2744;
    margin-bottom: 2px;
  }
  .recipient-detail {
    font-size: 12px;
    color: #555;
    line-height: 1.6;
  }

  /* Items table */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  thead tr {
    background: #1a2744;
  }
  thead th {
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    padding: 10px 14px;
    text-align: left;
  }
  thead th.item-qty,
  thead th.item-price,
  thead th.item-total {
    text-align: right;
  }
  tbody td {
    padding: 12px 14px;
    font-size: 12px;
    border-bottom: 1px solid #e8e8e8;
    color: #444;
  }
  tbody td.item-qty,
  tbody td.item-price,
  tbody td.item-total {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  tbody tr:last-child td {
    border-bottom: 2px solid #1a2744;
  }

  /* Total */
  .total-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
    margin-bottom: 32px;
  }
  .total-label {
    font-size: 14px;
    font-weight: 700;
    color: #333;
    margin-right: 16px;
  }
  .total-value {
    font-size: 16px;
    font-weight: 800;
    color: #1a2744;
  }

  /* Footer */
  .footer-section {
    margin-top: auto;
    padding-top: 40px;
    text-align: center;
    border-top: 1px solid #e0e0e0;
  }
  .tax-note {
    font-size: 11px;
    font-weight: 700;
    color: #333;
    margin-bottom: 6px;
  }
  .thank-you {
    font-size: 11px;
    color: #888;
    font-style: italic;
  }
</style>
</head>
<body>
  <div class="page-wrapper">
    <div class="content">

      <div class="header">
        <div class="company-block">
          ${profile.name ? `<h1>${escapeHtml(profile.name)}</h1>` : ""}
          <div class="company-details">
            ${profile.address ? escapeHtml(profile.address) + "<br/>" : ""}
            ${profile.email ? "E-Mail: " + escapeHtml(profile.email) : ""}
            ${profile.phone ? "<br/>" + escapeHtml(profile.phone) : ""}
          </div>
        </div>
        <div class="invoice-title-block">
          <h2>${escapeHtml(t.orders.invoiceTitle)}</h2>
          <div class="invoice-meta">
            ${escapeHtml(t.orders.invoiceNumber)} <span>${escapeHtml(order.invoiceNumber)}</span><br/>
            ${escapeHtml(t.orders.invoiceDate)} <span>${dateStr}</span><br/>
            ${order.serviceDate ? `Leistungsdatum: <span>${new Date(order.serviceDate).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>` : ""}
          </div>
        </div>
      </div>

      <div class="recipient-section">
        <div class="recipient-box">
          <div class="recipient-label">${escapeHtml(t.orders.invoiceTo)}:</div>
          <div class="recipient-name">${escapeHtml(order.customerName)}</div>
          <div class="recipient-detail">
            ${order.customerAddress ? escapeHtml(order.customerAddress) : ""}
            ${order.customerEmail ? (order.customerAddress ? "<br/>" : "") + escapeHtml(order.customerEmail) : ""}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>${escapeHtml(t.orders.invoiceItem)}</th>
            <th class="item-qty">${escapeHtml(t.orders.invoiceQty)}</th>
            <th class="item-price">${escapeHtml(t.orders.invoiceUnitPrice)}</th>
            <th class="item-total">${escapeHtml(t.orders.invoiceAmount)}</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="total-row" style="margin-bottom: 4px;">
        <span class="total-label" style="font-weight: normal;">Zwischensumme:</span>
        <span class="total-value" style="font-weight: normal;">${formatEur(order.total - (order.shippingCost || 0))}</span>
      </div>
      <div class="total-row" style="margin-bottom: 4px;">
        <span class="total-label" style="font-weight: normal;">Versandkosten:</span>
        <span class="total-value" style="font-weight: normal;">${formatEur(order.shippingCost || 0)}</span>
      </div>

      <div class="total-row">
        <span class="total-label">${escapeHtml(t.orders.invoiceTotal)}:</span>
        <span class="total-value">${formatEur(order.total)}</span>
      </div>

    </div>

    <div class="footer-section">
      ${profile.smallBusinessNote ? `<div class="tax-note">${escapeHtml(profile.smallBusinessNote)}</div>` : (profile.taxNote ? `<div class="tax-note">${escapeHtml(profile.taxNote)}</div>` : "")}
      <div class="thank-you">${escapeHtml(thankYouText)}</div>
    </div>
  </div>
</body>
</html>`;
}
