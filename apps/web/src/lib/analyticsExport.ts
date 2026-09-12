import type { PDFFont, PDFPage } from 'pdf-lib';

export interface AnalyticsExportData {
  start: string; // ISO yyyy-mm-dd
  end: string;   // ISO yyyy-mm-dd
  currency: string;
  summary: {
    revenue: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
    pendingTotal: number;
    pendingCount: number;
  };
  buckets: {
    label: string;
    revenue: number;
    expenses: number;
  }[];
  topClients: {
    name: string;
    revenue: number;
    percentage: number;
  }[];
  categories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

function escapeCsvCell(val: string | number | null | undefined): string {
  let s = String(val ?? '');
  // Spec constraint 6: Guard against CSV injection: prefix any cell starting with = + - @ with '
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    s = `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportAnalyticsToCsv(data: AnalyticsExportData) {
  const rows: (string | number)[][] = [];

  // Title & Period
  rows.push(['FlowLedger Analytics Export']);
  rows.push(['Period Start', data.start]);
  rows.push(['Period End', data.end]);
  rows.push(['Currency', data.currency]);
  rows.push([]);

  // KPI Summary
  rows.push(['Summary Metric', 'Value']);
  rows.push(['Revenue', data.summary.revenue]);
  rows.push(['Expenses', data.summary.expenses]);
  rows.push(['Net Profit', data.summary.netProfit]);
  rows.push(['Profit Margin (%)', `${data.summary.profitMargin}%`]);
  rows.push(['Pending Payments Total', data.summary.pendingTotal]);
  rows.push(['Pending Payments Count', data.summary.pendingCount]);
  rows.push([]);

  // Income vs Expenses
  rows.push(['Income vs Expenses Breakdown']);
  rows.push(['Period / Bucket', 'Revenue', 'Expenses', 'Net']);
  data.buckets.forEach((b) => {
    rows.push([b.label, b.revenue, b.expenses, b.revenue - b.expenses]);
  });
  rows.push([]);

  // Top Clients
  rows.push(['Top Clients by Revenue']);
  rows.push(['Rank', 'Client Name', 'Revenue', 'Share (%)']);
  data.topClients.forEach((c, idx) => {
    rows.push([idx + 1, c.name, c.revenue, `${c.percentage}%`]);
  });
  rows.push([]);

  // Categories
  rows.push(['Expenses by Category']);
  rows.push(['Category', 'Amount', 'Share (%)']);
  data.categories.forEach((cat) => {
    rows.push([cat.category, cat.amount, `${cat.percentage}%`]);
  });

  // Spec constraint 6: Prefix with \uFEFF BOM for Excel compatibility with Arabic
  const csvContent = '\uFEFF' + rows.map((r) => r.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const filename = `analytics-${data.start}-to-${data.end}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// PDF Sanitizer: WinAnsi fonts only support Latin-1 supplement + printable ASCII.
const sanitizePdfText = (value: string): string =>
  (value ?? '')
    .replace(/[     ⁠]/g, ' ')
    .replace(/[‘’′]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\t\n\r\x20-\x7E¡-ÿ€•]/g, '');

const ACCENT_RGB = [0.427, 0.369, 0.988] as const; // #6D5EFC
const INK_RGB = [0.094, 0.094, 0.106] as const; // #18181B
const MUTED_RGB = [0.443, 0.443, 0.478] as const; // #71717A
const BORDER_RGB = [0.906, 0.906, 0.925] as const; // #E7E7EC
const BG_SURFACE_RGB = [0.97, 0.97, 0.98] as const;

export async function exportAnalyticsToPdf(data: AnalyticsExportData) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const ACCENT = rgb(ACCENT_RGB[0], ACCENT_RGB[1], ACCENT_RGB[2]);
  const INK = rgb(INK_RGB[0], INK_RGB[1], INK_RGB[2]);
  const MUTED = rgb(MUTED_RGB[0], MUTED_RGB[1], MUTED_RGB[2]);
  const BORDER = rgb(BORDER_RGB[0], BORDER_RGB[1], BORDER_RGB[2]);
  const BG_SURFACE = rgb(BG_SURFACE_RGB[0], BG_SURFACE_RGB[1], BG_SURFACE_RGB[2]);

  const pdfDoc = await PDFDocument.create();
  let page: PDFPage = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font: PDFFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold: PDFFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = height - 50;
  const marginX = 40;
  const contentWidth = width - marginX * 2;

  // Title
  page.drawText('FlowLedger — Analytics Report', {
    x: marginX,
    y,
    size: 20,
    font: fontBold,
    color: INK,
  });
  y -= 22;

  // Subtitle / period
  page.drawText(`Period: ${data.start} to ${data.end}  |  Currency: ${data.currency}`, {
    x: marginX,
    y,
    size: 11,
    font,
    color: MUTED,
  });
  y -= 25;

  // Divider
  page.drawLine({
    start: { x: marginX, y },
    end: { x: width - marginX, y },
    thickness: 1,
    color: BORDER,
  });
  y -= 25;

  // Helper to check page break
  const checkPageBreak = (neededHeight: number) => {
    if (y - neededHeight < 40) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    }
  };

  // KPI Summary Strip (4 cards)
  const kpis = [
    { label: 'Revenue', value: `${data.currency} ${data.summary.revenue.toLocaleString()}` },
    { label: 'Expenses', value: `${data.currency} ${data.summary.expenses.toLocaleString()}` },
    { label: 'Net Profit', value: `${data.currency} ${data.summary.netProfit.toLocaleString()}` },
    { label: 'Pending', value: `${data.currency} ${data.summary.pendingTotal.toLocaleString()} (${data.summary.pendingCount})` },
  ];

  const colW = contentWidth / 4;
  kpis.forEach((kpi, idx) => {
    const boxX = marginX + idx * colW;
    page.drawRectangle({
      x: boxX + 2,
      y: y - 48,
      width: colW - 4,
      height: 52,
      color: BG_SURFACE,
      borderColor: BORDER,
      borderWidth: 1,
    });
    page.drawText(kpi.label, {
      x: boxX + 10,
      y: y - 16,
      size: 9,
      font: fontBold,
      color: MUTED,
    });
    page.drawText(kpi.value, {
      x: boxX + 10,
      y: y - 36,
      size: 12,
      font: fontBold,
      color: INK,
    });
  });
  y -= 75;

  // Helper to draw section header
  const drawSectionHeader = (title: string) => {
    checkPageBreak(40);
    page.drawText(title, {
      x: marginX,
      y,
      size: 13,
      font: fontBold,
      color: ACCENT,
    });
    y -= 8;
    page.drawLine({
      start: { x: marginX, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
      color: BORDER,
    });
    y -= 16;
  };

  // Section 1: Revenue vs Expenses
  drawSectionHeader('Revenue vs Expenses');
  // Table header
  page.drawText('Period / Bucket', { x: marginX + 4, y, size: 9, font: fontBold, color: MUTED });
  page.drawText('Revenue', { x: marginX + 180, y, size: 9, font: fontBold, color: MUTED });
  page.drawText('Expenses', { x: marginX + 300, y, size: 9, font: fontBold, color: MUTED });
  page.drawText('Net', { x: marginX + 420, y, size: 9, font: fontBold, color: MUTED });
  y -= 14;

  data.buckets.forEach((b) => {
    checkPageBreak(18);
    const label = sanitizePdfText(b.label) || 'Period';
    page.drawText(label, { x: marginX + 4, y, size: 9, font, color: INK });
    page.drawText(`${data.currency} ${b.revenue.toLocaleString()}`, { x: marginX + 180, y, size: 9, font, color: INK });
    page.drawText(`${data.currency} ${b.expenses.toLocaleString()}`, { x: marginX + 300, y, size: 9, font, color: INK });
    page.drawText(`${data.currency} ${(b.revenue - b.expenses).toLocaleString()}`, { x: marginX + 420, y, size: 9, font, color: INK });
    y -= 14;
  });
  y -= 15;

  // Section 2: Top Clients
  if (data.topClients.length > 0) {
    drawSectionHeader('Top Clients by Revenue');
    page.drawText('#', { x: marginX + 4, y, size: 9, font: fontBold, color: MUTED });
    page.drawText('Client Name', { x: marginX + 30, y, size: 9, font: fontBold, color: MUTED });
    page.drawText('Revenue', { x: marginX + 300, y, size: 9, font: fontBold, color: MUTED });
    page.drawText('Share (%)', { x: marginX + 420, y, size: 9, font: fontBold, color: MUTED });
    y -= 14;

    data.topClients.forEach((c, i) => {
      checkPageBreak(18);
      const name = sanitizePdfText(c.name) || `Client ${i + 1}`;
      page.drawText(String(i + 1), { x: marginX + 4, y, size: 9, font, color: MUTED });
      page.drawText(name, { x: marginX + 30, y, size: 9, font, color: INK });
      page.drawText(`${data.currency} ${c.revenue.toLocaleString()}`, { x: marginX + 300, y, size: 9, font, color: INK });
      page.drawText(`${c.percentage}%`, { x: marginX + 420, y, size: 9, font, color: INK });
      y -= 14;
    });
    y -= 15;
  }

  // Section 3: Expenses by Category
  if (data.categories.length > 0) {
    drawSectionHeader('Expenses by Category');
    page.drawText('Category', { x: marginX + 4, y, size: 9, font: fontBold, color: MUTED });
    page.drawText('Amount', { x: marginX + 300, y, size: 9, font: fontBold, color: MUTED });
    page.drawText('Share (%)', { x: marginX + 420, y, size: 9, font: fontBold, color: MUTED });
    y -= 14;

    data.categories.forEach((cat) => {
      checkPageBreak(18);
      const categoryName = sanitizePdfText(cat.category) || 'Category';
      page.drawText(categoryName, { x: marginX + 4, y, size: 9, font, color: INK });
      page.drawText(`${data.currency} ${cat.amount.toLocaleString()}`, { x: marginX + 300, y, size: 9, font, color: INK });
      page.drawText(`${cat.percentage}%`, { x: marginX + 420, y, size: 9, font, color: INK });
      y -= 14;
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  const filename = `analytics-${data.start}-to-${data.end}.pdf`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
