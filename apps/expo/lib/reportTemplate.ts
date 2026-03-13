import { Translations } from "@/lib/i18n";
import { formatCurrency } from "@/lib/formatCurrency";

interface MonthlyData {
    month: string;
    revenue: number;
    expenses: number;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/\n/g, "<br/>");
}

export function generateFinancialReportHtml(
    year: number | null,
    totalRevenue: number,
    totalExpenses: number,
    netProfit: number,
    monthlyData: MonthlyData[],
    t: Translations,
): string {
    const currentYear = year || new Date().getFullYear();
    const reportTitle = `${escapeHtml(t.dashboard.reportTitle || "Finanzbericht")} ${currentYear}`;

    const summaryTitle = escapeHtml(t.dashboard.summary || "Zusammenfassung");
    const monthTitle = escapeHtml(t.dashboard.month || "Monat");
    const revTitle = escapeHtml(t.dashboard.revenue || "Umsatz");
    const expTitle = escapeHtml(t.dashboard.expenses || "Ausgaben");
    const profitTitle = escapeHtml(t.dashboard.netProfit || "Gewinn");

    const totalRevLabel = escapeHtml(t.dashboard.totalRevenue || "Gesamtumsatz:");
    const totalExpLabel = escapeHtml(t.dashboard.totalExpenses || "Gesamtausgaben:");

    // Reorder monthly data: map from Dec -> Jan to Jan -> Dec
    // Since we know the index.tsx gives us data starting from the earliest or latest depending on year filter,
    // we ensure it is chronological. In index.tsx it's generated Jan->Dec for explicit year,
    // but for "All years" (rolling last 6 months) it's earliest -> latest. We will just use it as given.

    const itemRows = monthlyData
        .map((item) => {
            const profit = item.revenue - item.expenses;
            return `
      <tr>
        <td class="item-month">${escapeHtml(item.month)}</td>
        <td class="item-val">${formatCurrency(item.revenue)}</td>
        <td class="item-val">${formatCurrency(item.expenses)}</td>
        <td class="item-val">${formatCurrency(profit)}</td>
      </tr>`;
        })
        .join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 25mm 20mm 25mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #000;
    font-size: 14px;
    line-height: 1.5;
    background: #fff;
    padding: 20px;
  }

  h1 {
    font-size: 32px;
    font-weight: 700;
    margin-bottom: 40px;
    color: #000;
  }

  h2 {
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 16px;
    color: #000;
    margin-top: 40px;
  }

  /* Summary Section */
  .summary-table {
    width: 100%;
    margin-bottom: 16px;
    border-collapse: collapse;
  }
  .summary-table td {
    padding: 6px 0;
    font-size: 15px;
  }
  .summary-table td.val {
    text-align: right;
  }
  .summary-total {
    border-top: 1px solid #000;
    margin-top: 8px;
    padding-top: 12px;
    display: flex;
    justify-content: space-between;
    font-weight: 700;
    font-size: 16px;
  }

  /* Monthly Table */
  table.monthly-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 12px;
  }
  table.monthly-table th {
    background: #e6e6e6;
    color: #000;
    font-weight: 700;
    font-size: 14px;
    padding: 10px 12px;
    text-align: left;
    border: 1px solid #000;
  }
  table.monthly-table th.right-align {
    text-align: right;
  }
  table.monthly-table td {
    padding: 10px 12px;
    font-size: 14px;
    border: 1px solid #000;
  }
  table.monthly-table td.item-val {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  
  /* Footer row */
  tr.total-row {
    font-weight: 700;
  }
</style>
</head>
<body>
  <h1>${reportTitle}</h1>

  <h2>${summaryTitle}</h2>
  <table class="summary-table">
    <tr>
      <td>${totalRevLabel}</td>
      <td class="val">${formatCurrency(totalRevenue)}</td>
    </tr>
    <tr>
      <td>${totalExpLabel}</td>
      <td class="val">${formatCurrency(totalExpenses)}</td>
    </tr>
  </table>
  <div class="summary-total">
    <span>${profitTitle}:</span>
    <span>${formatCurrency(netProfit)}</span>
  </div>

  <h2>${escapeHtml(t.dashboard.monthlyBreakdown || "Monatliche Aufschlüsselung")}</h2>
  <table class="monthly-table">
    <thead>
      <tr>
        <th>${monthTitle}</th>
        <th class="right-align">${revTitle}</th>
        <th class="right-align">${expTitle}</th>
        <th class="right-align">${profitTitle}</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="total-row">
        <td>Gesamt ${currentYear}</td>
        <td class="item-val">${formatCurrency(totalRevenue)}</td>
        <td class="item-val">${formatCurrency(totalExpenses)}</td>
        <td class="item-val">${formatCurrency(netProfit)}</td>
      </tr>
    </tbody>
  </table>

</body>
</html>`;
}
