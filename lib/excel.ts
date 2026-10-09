import "server-only";
import ExcelJS from "exceljs";
import type { Currency, Stage } from "./calc";
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

/**
 * One truck laid out like the father's Excel sheet: header, product table,
 * then the expense tables. Totals are real formulas, so editing a number in
 * Excel recalculates everything.
 */
export function addTruckSheet(wb: ExcelJS.Workbook, truck: TruckRow, t: Messages) {
  const r = calculateSavedTruck(truck);
  const hasTashkent = r.tashkent.CNY > 0;
  const ws = wb.addWorksheet(sheetName(wb, `${formatDate(truck.arrived_at)} ${truckTitle(truck, t.untitled)}`));
  const lastCol = hasTashkent ? 16 : 12;

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
    ...(hasTashkent
      ? [
          `${t.expenseShare} (${t.tashkentExpenses}), ¥`,
          `${t.boxAtTashkent}, ¥`,
          `${t.boxAtTashkent}, $`,
          `${t.boxAtTashkent}, ${t.som}`,
        ]
      : []),
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
  const khorgosRows = truck.truck_expenses.filter((e) => e.stage === "khorgos").length;
  const khorgosTotalRow = khorgosStart + 1 + khorgosRows;
  const tashkentStart = khorgosTotalRow + 4;
  const tashkentRows = truck.truck_expenses.filter((e) => e.stage === "tashkent").length;
  const tashkentTotalRow = tashkentStart + 1 + tashkentRows;
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
      ...(hasTashkent
        ? [
            f(share(`$F$${tashkentTotalRow}`), it.shareTashkentCny),
            f(`IF(C${n}=0,0,J${n}+M${n}/C${n})`, it.boxAtTashkent.CNY),
            f(`N${n}/${RATE_CNY}`, it.boxAtTashkent.USD),
            f(`O${n}*${RATE_UZS}`, it.boxAtTashkent.UZS),
          ]
        : []),
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
  if (hasTashkent) tr.getCell(13).value = sum("M", r.tashkent.CNY);
  styleRow(tr, 1, lastCol, { bold: true, fill: TOTAL_FILL });

  ws.getRow(totalRow + 1).getCell(2).value = `${t.leftKhorgos}: ${truck.left_khorgos_at ? formatDate(truck.left_khorgos_at) : "—"}`;
  ws.getRow(totalRow + 2).getCell(2).value =
    `${t.enteredTashkent}: ${truck.entered_tashkent_at ? formatDate(truck.entered_tashkent_at) : "—"}`;
  ws.getRow(totalRow + 2).getCell(2).font = { bold: true, color: { argb: "FFC00000" } };

  // ── Expense tables ──────────────────────────────────────────────────
  const toCnyFormula = (n: number, currency: Currency) =>
    currency === "CNY" ? `D${n}` : currency === "USD" ? `D${n}*${RATE_CNY}` : `D${n}*${RATE_CNY}/${RATE_UZS}`;

  const expenseTable = (stage: Stage, start: number, totalAt: number, heading: string, totalCny: number) => {
    const head = ws.getRow(start);
    head.values = [t.number, `${heading} — ${t.expenseName}`, t.expenseNote, t.amount, "", "¥"];
    styleRow(head, 1, 6, { bold: true, fill: HEADER_FILL });
    truck.truck_expenses
      .filter((e) => e.stage === stage)
      .forEach((e, i) => {
        const n = start + 1 + i;
        const row = ws.getRow(n);
        const symbol = e.currency === "CNY" ? "¥" : e.currency === "USD" ? "$" : t.som;
        const cny = e.currency === "CNY" ? e.amount : e.currency === "USD" ? e.amount * truck.usd_cny : (e.amount * truck.usd_cny) / truck.usd_uzs;
        row.values = [i + 1, e.name, e.note, e.amount, symbol, f(toCnyFormula(n, e.currency), cny)];
        styleRow(row, 1, 6);
      });
    const total = ws.getRow(totalAt);
    total.getCell(2).value = t.total;
    total.getCell(6).value = totalAt > start + 1 ? f(`SUM(F${start + 1}:F${totalAt - 1})`, totalCny) : 0;
    styleRow(total, 1, 6, { bold: true, fill: TOTAL_FILL });
  };

  expenseTable("khorgos", khorgosStart, khorgosTotalRow, t.expensesKhorgos, r.khorgos.CNY);
  const goodsRow = ws.getRow(khorgosTotalRow + 1);
  goodsRow.getCell(2).value = t.goodsMoney;
  goodsRow.getCell(6).value = f(`G${totalRow}`, r.goods.CNY);
  if (truck.goods_paid_usd > 0) {
    goodsRow.getCell(3).value = `$${truck.goods_paid_usd}`;
  }
  const toKhorgosRow = ws.getRow(khorgosTotalRow + 2);
  toKhorgosRow.getCell(2).value = t.toKhorgosTotal;
  toKhorgosRow.getCell(6).value = f(`F${khorgosTotalRow}+F${khorgosTotalRow + 1}`, r.toKhorgos.CNY);
  toKhorgosRow.getCell(6).font = { bold: true, color: { argb: "FFC00000" } };
  styleRow(goodsRow, 1, 6);
  styleRow(toKhorgosRow, 1, 6, { bold: true });
  toKhorgosRow.getCell(6).font = { bold: true, color: { argb: "FFC00000" } };

  expenseTable("tashkent", tashkentStart, tashkentTotalRow, t.expensesTashkent, r.tashkent.CNY);

  const grandAt = tashkentTotalRow + 2;
  const grand = (offset: number, label: string, formula: string, result: number, fmt: string) => {
    const row = ws.getRow(grandAt + offset);
    row.getCell(2).value = label;
    row.getCell(6).value = f(formula, result);
    row.getCell(6).numFmt = fmt;
    styleRow(row, 1, 6, { bold: true, fill: TOTAL_FILL });
  };
  const grandCny = `F${khorgosTotalRow + 2}+F${tashkentTotalRow}`;
  grand(0, `${t.grandTotal}, ¥`, grandCny, r.grand.CNY, MONEY);
  grand(1, `${t.grandTotal}, $`, `(${grandCny})/${RATE_CNY}`, r.grand.USD, MONEY);
  grand(2, `${t.grandTotal}, ${t.som}`, `(${grandCny})/${RATE_CNY}*${RATE_UZS}`, r.grand.UZS, WHOLE);

  if (truck.notes) {
    ws.getRow(grandAt + 4).getCell(2).value = `${t.notes}: ${truck.notes}`;
  }

  // ── Column formats ──────────────────────────────────────────────────
  const widths = [5, 28, 12, 12, 12, 14, 14, 12, 16, 14, 14, 16, 16, 14, 14, 16];
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
    for (const c of [12, 16]) row.getCell(c).numFmt = WHOLE;
  }
  for (let n = khorgosStart; n <= tashkentTotalRow; n++) {
    ws.getRow(n).getCell(4).numFmt = MONEY;
    ws.getRow(n).getCell(6).numFmt = MONEY;
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
