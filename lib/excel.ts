import "server-only";
import ExcelJS from "exceljs";
import { DEFAULT_EXPENSE_CURRENCY, type Currency, type Stage } from "./calc";
import { formatDate } from "./format";
import type { Messages } from "./i18n";
import { calculateSavedTruck, truckTitle, type TruckRow } from "./trucks";

const MONEY = "#,##0.00";
const WHOLE = "#,##0";
// "General" shows 4 / 10.9 / 279.5 — "#,##0.##" would print "4." with a stray dot.
const KG = "General";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2EFDA" } };
const TOTAL_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

const f = (formula: string, result: number): ExcelJS.CellFormulaValue => ({ formula, result });

function styleRow(row: ExcelJS.Row, from: number, to: number, opts: { bold?: boolean; fill?: ExcelJS.Fill } = {}) {
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.border = THIN;
    if (opts.bold) cell.font = { bold: true };
    if (opts.fill) cell.fill = opts.fill;
  }
}

/** Excel sheet names: max 31 chars, no []:*?/\ and unique within the workbook. */
function sheetName(wb: ExcelJS.Workbook, wanted: string) {
  const base = wanted.replace(/[\[\]:*?/\\]/g, "-").slice(0, 28) || "Sheet";
  let name = base;
  for (let i = 2; wb.getWorksheet(name); i++) name = `${base} ${i}`.slice(0, 31);
  return name;
}

type ExpenseLine = { name: string; note: string; amount: number | null; currency: Currency };

/** Saved lines of a section; if there are none, the usual names with empty amounts to fill in Excel. */
function expenseLines(truck: TruckRow, stage: Stage, defaults: string[]): ExpenseLine[] {
  const saved = truck.truck_expenses.filter((e) => e.stage === stage);
  if (saved.length) return saved;
  return defaults.map((name) => ({ name, note: "", amount: null, currency: DEFAULT_EXPENSE_CURRENCY[stage] }));
}

function toCnyValue(amount: number, currency: Currency, truck: TruckRow) {
  if (currency === "USD") return amount * truck.usd_cny;
  if (currency === "UZS") return (amount * truck.usd_cny) / truck.usd_uzs;
  return amount;
}

/**
 * One truck laid out like the father's Excel sheet: header, product table,
 * then the expense tables. Totals are real formulas, so editing a number in
 * Excel recalculates everything.
 */
export function addTruckSheet(wb: ExcelJS.Workbook, truck: TruckRow, t: Messages) {
  const r = calculateSavedTruck(truck);
  const ws = wb.addWorksheet(sheetName(wb, `${formatDate(truck.arrived_at)} ${truckTitle(truck, t.untitled)}`));
  const lastCol = 17;

  // ── Title and rates ─────────────────────────────────────────────────
  const title = [
    truck.batch_name,
    truck.truck_number,
    `${formatDate(truck.arrived_at)}`,
    truck.trailer_number,
    truck.driver_phone && `${t.driverPhone}: ${truck.driver_phone}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ws.mergeCells(1, 1, 1, lastCol);
  ws.getCell(1, 1).value = title || t.untitled;
  ws.getCell(1, 1).font = { bold: true, size: 13 };

  ws.getCell("B2").value = t.rateCny;
  ws.getCell("C2").value = truck.usd_cny;
  ws.getCell("B3").value = t.rateUzs;
  ws.getCell("C3").value = truck.usd_uzs;
  ws.getCell("C2").numFmt = "0.0000";
  ws.getCell("C3").numFmt = MONEY;
  const RATE_CNY = "$C$2";
  const RATE_UZS = "$C$3";

  // ── Products ────────────────────────────────────────────────────────
  const headerRow = 5;
  const headers = [
    t.number,
    t.productName,
    t.boxes,
    t.kgPerBox,
    t.piecesPerBox,
    t.priceUrumqi,
    `${t.totalSum}, ¥`,
    t.totalKg,
    `${t.expenseShare} (${t.khorgosExpenses}), ¥`,
    `${t.boxAtKhorgos}, ¥`,
    `${t.boxAtKhorgos}, $`,
    `${t.boxAtKhorgos}, ${t.som}`,
    `${t.expenseShare} (${t.tashkentExpenses}), ¥`,
    `${t.boxAtTashkent}, ¥`,
    `${t.boxAtTashkent}, $`,
    `${t.boxAtTashkent}, ${t.som}`,
    t.totalAtTashkentSom,
  ];
  const hr = ws.getRow(headerRow);
  hr.values = headers;
  hr.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  hr.height = 48;
  styleRow(hr, 1, lastCol, { bold: true, fill: HEADER_FILL });

  const first = headerRow + 1;
  const last = first + r.items.length - 1;
  const totalRow = last + 1;
  // Rows where the expense tables' totals will be, needed by the share formulas.
  const khorgosStart = totalRow + 5;
  const khorgosLines = expenseLines(truck, "khorgos", t.defaultKhorgosExpenses);
  const khorgosTotalRow = khorgosStart + 1 + khorgosLines.length;
  const tashkentStart = khorgosTotalRow + 4;
  const tashkentLines = expenseLines(truck, "tashkent", t.defaultTashkentExpenses);
  const tashkentTotalRow = tashkentStart + 1 + tashkentLines.length;
  // Split by kg like the sheet, or by boxes when weights are missing.
  const weightCol = r.allocation === "kg" ? "H" : "C";

  r.items.forEach((it, i) => {
    const n = first + i;
    const row = ws.getRow(n);
    const share = (totalCell: string) => `IF($${weightCol}$${totalRow}=0,0,${totalCell}*${weightCol}${n}/$${weightCol}$${totalRow})`;
    row.values = [
      i + 1,
      it.name,
      it.boxes,
      it.kgPerBox || null,
      it.piecesPerBox,
      it.priceCny,
      f(`C${n}*F${n}`, it.totalCny),
      f(`C${n}*D${n}`, it.totalKg),
      f(share(`$F$${khorgosTotalRow}`), it.shareKhorgosCny),
      f(`IF(C${n}=0,0,F${n}+I${n}/C${n})`, it.boxAtKhorgos.CNY),
      f(`J${n}/${RATE_CNY}`, it.boxAtKhorgos.USD),
      f(`K${n}*${RATE_UZS}`, it.boxAtKhorgos.UZS),
      f(share(`$F$${tashkentTotalRow}`), it.shareTashkentCny),
      f(`IF(C${n}=0,0,J${n}+M${n}/C${n})`, it.boxAtTashkent.CNY),
      f(`N${n}/${RATE_CNY}`, it.boxAtTashkent.USD),
      f(`O${n}*${RATE_UZS}`, it.boxAtTashkent.UZS),
      // Whole product line in so'm; the column total equals the grand total in so'm.
      f(`C${n}*P${n}`, it.boxes * it.boxAtTashkent.UZS),
    ];
    styleRow(row, 1, lastCol);
  });

  const tr = ws.getRow(totalRow);
  const sum = (col: string, result: number) => f(`SUM(${col}${first}:${col}${last})`, result);
  tr.getCell(2).value = t.total;
  tr.getCell(3).value = sum("C", r.totalBoxes);
  tr.getCell(7).value = sum("G", r.goods.CNY);
  tr.getCell(8).value = sum("H", r.totalKg);
  tr.getCell(9).value = sum("I", r.khorgos.CNY);
  tr.getCell(13).value = sum("M", r.tashkent.CNY);
  tr.getCell(17).value = sum("Q", r.grand.UZS);
  styleRow(tr, 1, lastCol, { bold: true, fill: TOTAL_FILL });

  ws.getRow(totalRow + 1).getCell(2).value = `${t.leftKhorgos}: ${truck.left_khorgos_at ? formatDate(truck.left_khorgos_at) : "—"}`;
  ws.getRow(totalRow + 2).getCell(2).value =
    `${t.enteredTashkent}: ${truck.entered_tashkent_at ? formatDate(truck.entered_tashkent_at) : "—"}`;
  ws.getRow(totalRow + 2).getCell(2).font = { bold: true, color: { argb: "FFC00000" } };

  // ── Expense tables: ¥ in F, then $ in G and so'm in H ───────────────
  /** Writes ¥ (formula) into F and its $ / so'm conversions into G and H. */
  const moneyCells = (n: number, cnyFormula: string, cny: number) => {
    const row = ws.getRow(n);
    row.getCell(6).value = f(cnyFormula, cny);
    row.getCell(7).value = f(`F${n}/${RATE_CNY}`, cny / truck.usd_cny);
    row.getCell(8).value = f(`G${n}*${RATE_UZS}`, (cny / truck.usd_cny) * truck.usd_uzs);
  };
  // The currency symbol in column E decides the conversion, so it can be changed in Excel.
  const toCny = (n: number) =>
    `IF(E${n}="$",D${n}*${RATE_CNY},IF(E${n}="${t.som}",D${n}*${RATE_CNY}/${RATE_UZS},D${n}))`;

  const expenseTable = (start: number, totalAt: number, heading: string, lines: ExpenseLine[], totalCny: number) => {
    const head = ws.getRow(start);
    head.values = [t.number, `${heading} — ${t.expenseName}`, t.expenseNote, t.amount, "", "¥", "$", t.som];
    styleRow(head, 1, 8, { bold: true, fill: HEADER_FILL });
    lines.forEach((e, i) => {
      const n = start + 1 + i;
      const row = ws.getRow(n);
      row.values = [i + 1, e.name, e.note, e.amount, e.currency === "CNY" ? "¥" : e.currency === "USD" ? "$" : t.som];
      moneyCells(n, toCny(n), toCnyValue(e.amount ?? 0, e.currency, truck));
      styleRow(row, 1, 8);
    });
    const total = ws.getRow(totalAt);
    total.getCell(2).value = t.total;
    moneyCells(totalAt, lines.length ? `SUM(F${start + 1}:F${totalAt - 1})` : "0", totalCny);
    styleRow(total, 1, 8, { bold: true, fill: TOTAL_FILL });
  };

  expenseTable(khorgosStart, khorgosTotalRow, t.expensesKhorgos, khorgosLines, r.khorgos.CNY);

  const goodsAt = khorgosTotalRow + 1;
  ws.getRow(goodsAt).getCell(2).value = t.goodsMoney;
  if (truck.goods_paid_usd > 0) ws.getRow(goodsAt).getCell(3).value = `$${truck.goods_paid_usd}`;
  moneyCells(goodsAt, `G${totalRow}`, r.goods.CNY);
  styleRow(ws.getRow(goodsAt), 1, 8);

  const toKhorgosAt = khorgosTotalRow + 2;
  ws.getRow(toKhorgosAt).getCell(2).value = t.toKhorgosTotal;
  moneyCells(toKhorgosAt, `F${khorgosTotalRow}+F${goodsAt}`, r.toKhorgos.CNY);
  styleRow(ws.getRow(toKhorgosAt), 1, 8, { bold: true });
  for (const c of [6, 7, 8]) ws.getRow(toKhorgosAt).getCell(c).font = { bold: true, color: { argb: "FFC00000" } };

  expenseTable(tashkentStart, tashkentTotalRow, t.expensesTashkent, tashkentLines, r.tashkent.CNY);

  const grandAt = tashkentTotalRow + 2;
  const grandHead = ws.getRow(grandAt);
  grandHead.getCell(2).value = t.grandTotal;
  grandHead.getCell(6).value = "¥";
  grandHead.getCell(7).value = "$";
  grandHead.getCell(8).value = t.som;
  styleRow(grandHead, 1, 8, { bold: true, fill: HEADER_FILL });
  ws.getRow(grandAt + 1).getCell(2).value = `${t.toKhorgosTotal} + ${t.tashkentExpenses}`;
  moneyCells(grandAt + 1, `F${toKhorgosAt}+F${tashkentTotalRow}`, r.grand.CNY);
  styleRow(ws.getRow(grandAt + 1), 1, 8, { bold: true, fill: TOTAL_FILL });

  for (let n = khorgosStart; n <= grandAt + 1; n++) {
    const row = ws.getRow(n);
    for (const c of [4, 6, 7]) row.getCell(c).numFmt = MONEY;
    row.getCell(8).numFmt = WHOLE;
  }

  if (truck.notes) {
    ws.getRow(grandAt + 3).getCell(2).value = `${t.notes}: ${truck.notes}`;
  }

  // ── Column formats ──────────────────────────────────────────────────
  const widths = [5, 34, 12, 12, 12, 14, 14, 15, 16, 14, 14, 16, 16, 14, 14, 16, 18];
  widths.slice(0, lastCol).forEach((w, i) => (ws.getColumn(i + 1).width = w));
  for (let n = first; n <= totalRow; n++) {
    const row = ws.getRow(n);
    row.getCell(3).numFmt = WHOLE;
    row.getCell(4).numFmt = KG;
    row.getCell(6).numFmt = MONEY;
    row.getCell(7).numFmt = MONEY;
    row.getCell(8).numFmt = KG;
    // Money columns; the so'm ones (L, P) are whole numbers.
    for (const c of [9, 10, 11, 13, 14, 15]) row.getCell(c).numFmt = MONEY;
    for (const c of [12, 16, 17]) row.getCell(c).numFmt = WHOLE;
  }
  ws.views = [{ state: "frozen", ySplit: headerRow }];
}

/** First sheet when exporting everything: one row per truck. */
function addSummarySheet(wb: ExcelJS.Workbook, trucks: TruckRow[], t: Messages) {
  const ws = wb.addWorksheet(sheetName(wb, t.allTrucks));
  const headers = [
    t.number,
    t.date,
    t.batchName,
    t.truckNumber,
    t.trailerNumber,
    t.driverPhone,
    t.leftKhorgos,
    t.enteredTashkent,
    t.totalBoxes,
    t.totalWeight,
    `${t.goodsMoney}, ¥`,
    `${t.khorgosExpenses}, ¥`,
    `${t.toKhorgosTotal}, ¥`,
    `${t.tashkentExpenses}, ¥`,
    `${t.grandTotal}, ¥`,
    `${t.grandTotal}, $`,
    `${t.grandTotal}, ${t.som}`,
    t.paidInUsd,
    t.status,
  ];
  const hr = ws.getRow(1);
  hr.values = headers;
  hr.alignment = { wrapText: true, vertical: "middle", horizontal: "center" };
  hr.height = 45;
  styleRow(hr, 1, headers.length, { bold: true, fill: HEADER_FILL });

  trucks.forEach((truck, i) => {
    const r = calculateSavedTruck(truck);
    const row = ws.getRow(i + 2);
    row.values = [
      i + 1,
      formatDate(truck.arrived_at),
      truck.batch_name,
      truck.truck_number,
      truck.trailer_number,
      truck.driver_phone,
      truck.left_khorgos_at ? formatDate(truck.left_khorgos_at) : "",
      truck.entered_tashkent_at ? formatDate(truck.entered_tashkent_at) : "",
      r.totalBoxes,
      r.totalKg,
      r.goods.CNY,
      r.khorgos.CNY,
      r.toKhorgos.CNY,
      r.tashkent.CNY,
      r.grand.CNY,
      r.grand.USD,
      r.grand.UZS,
      truck.goods_paid_usd || null,
      truck.archived_at ? t.archived : t.active,
    ];
    styleRow(row, 1, headers.length);
  });

  const totalAt = trucks.length + 2;
  const tr = ws.getRow(totalAt);
  tr.getCell(2).value = t.total;
  for (const c of [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]) {
    const col = ws.getColumn(c).letter;
    tr.getCell(c).value = { formula: `SUM(${col}2:${col}${totalAt - 1})` };
  }
  styleRow(tr, 1, headers.length, { bold: true, fill: TOTAL_FILL });

  [5, 12, 24, 14, 16, 18, 12, 12, 12, 12, 15, 15, 16, 15, 16, 14, 18, 14, 12].forEach(
    (w, i) => (ws.getColumn(i + 1).width = w),
  );
  for (let c = 11; c <= 16; c++) ws.getColumn(c).numFmt = MONEY;
  ws.getColumn(9).numFmt = WHOLE;
  ws.getColumn(10).numFmt = KG;
  ws.getColumn(17).numFmt = WHOLE;
  ws.getColumn(18).numFmt = MONEY;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Meva hisob-kitobi";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  return wb;
}

export async function truckWorkbook(truck: TruckRow, t: Messages) {
  const wb = newWorkbook();
  addTruckSheet(wb, truck, t);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function allTrucksWorkbook(trucks: TruckRow[], t: Messages) {
  const wb = newWorkbook();
  addSummarySheet(wb, trucks, t);
  for (const truck of trucks) addTruckSheet(wb, truck, t);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function xlsxResponse(body: Buffer, filename: string) {
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // RFC 5987 so Cyrillic file names survive.
      "Content-Disposition": `attachment; filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
