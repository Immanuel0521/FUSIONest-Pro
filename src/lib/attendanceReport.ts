import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  STATUS_COLORS,
  STATUS_LABEL,
  hoursToHM,
  round2,
  type DayCell,
  type DayStatus,
} from "@/lib/attendanceMetrics";

export interface MatrixRow {
  workerId: string;
  name: string;
  designation: string | null;
  cells: Record<string, DayCell>; // keyed by yyyy-mm-dd
  presentDays: number;
  sundayWorkedDays: number;
  holidayWorkedDays: number;
  halfDays: number;
  absentDays: number;
  totalDaysWorked: number;
  totalHours: number;
  totalOT: number;
  lateCount: number;
  earlyCount: number;
}

export interface MatrixData {
  monthLabel: string;
  dates: string[];
  rows: MatrixRow[];
  workingDaysCount?: number;
  sundaysCount?: number;
  holidaysCount?: number;
  companyName?: string;
}

const dayNum = (d: string) => String(Number(d.split("-")[2]));
const weekday = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "narrow" });

/* ------------------------------- EXCEL ---------------------------------- */
export async function exportMatrixExcel(data: MatrixData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = data.companyName || "Workforce SaaS";

  const ws = wb.addWorksheet("Attendance Matrix", {
    views: [{ state: "frozen", xSplit: 2, ySplit: 3 }],
  });

  const totalCols = 2 + data.dates.length + 8;

  ws.mergeCells(1, 1, 1, totalCols);
  const title = ws.getCell(1, 1);
  title.value = `Attendance Report — ${data.monthLabel}`;
  title.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F766E" } };
  title.alignment = { horizontal: "center" };

  ws.mergeCells(2, 1, 2, totalCols);
  const legend = ws.getCell(2, 1);
  legend.value = "P = Present (Workday)   HD = Half day   A = Absent   SW = Sunday Worked (OT)   HW = Holiday Worked (OT)   S = Sunday (Off)   H = Holiday (Off)";
  legend.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF6B7280" } };
  legend.alignment = { horizontal: "center" };

  const header = [
    "#",
    "Worker Name",
    ...data.dates.map((d) => `${dayNum(d)} ${weekday(d)}`),
    "Workdays Present",
    "Sunday OT",
    "Holiday OT",
    "Total Worked",
    "Absent",
    "Total Regular Hours",
    "Total OT Hours",
    "Late (Days)",
  ];
  const headerRow = ws.addRow([]);
  ws.spliceRows(3, 1, header);
  const hr = ws.getRow(3);
  hr.eachCell((cell) => {
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFCBD5E1" } } };
  });
  hr.height = 22;
  void headerRow;

  data.rows.forEach((row, idx) => {
    const values: any[] = [idx + 1, row.name];
    data.dates.forEach((d) => {
      const cell = row.cells[d];
      values.push(cell ? STATUS_LABEL[cell.status] : STATUS_LABEL.absent);
    });
    values.push(
      row.presentDays,
      row.sundayWorkedDays || 0,
      row.holidayWorkedDays || 0,
      row.totalDaysWorked || row.presentDays,
      row.absentDays,
      round2(row.totalHours),
      round2(row.totalOT),
      row.lateCount
    );
    const r = ws.addRow(values);
    r.font = { name: "Arial", size: 9 };
    r.alignment = { horizontal: "center", vertical: "middle" };
    r.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    r.getCell(2).font = { name: "Arial", size: 9, bold: true };

    data.dates.forEach((d, i) => {
      const cell = row.cells[d];
      const status: DayStatus = cell ? cell.status : "absent";
      const c = r.getCell(3 + i);
      const colors = STATUS_COLORS[status];
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.bg } };
      c.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF" + colors.text } };
      if (cell && cell.status !== "absent") {
        const hol = cell.holidayName ? `\nHoliday: ${cell.holidayName}` : "";
        c.note = `In: ${cell.timeIn || "—"}\nOut: ${cell.timeOut || "—"}\nHours: ${hoursToHM(cell.hours)}\nOT: ${hoursToHM(cell.ot)}${hol}`;
      }
    });

    // OT column highlight
    const otCell = r.getCell(2 + data.dates.length + 7);
    if (row.totalOT > 0) {
      otCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
      otCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF6D28D9" } };
    }
  });

  ws.getColumn(1).width = 5;
  ws.getColumn(2).width = 26;
  data.dates.forEach((_, i) => (ws.getColumn(3 + i).width = 5));
  for (let i = 0; i < 8; i++) ws.getColumn(3 + data.dates.length + i).width = 13;

  /* --- detail sheet: one row per worker per day --- */
  const detail = wb.addWorksheet("Daily Detail");
  detail.addRow(["Worker", "Date", "Day", "Status", "Check In", "Check Out", "Worked (h)", "Worked", "OT (h)", "OT", "Late (min)", "Early Exit"]);
  detail.getRow(1).font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
  detail.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  data.rows.forEach((row) => {
    data.dates.forEach((d) => {
      const cell = row.cells[d];
      const status: DayStatus = cell ? cell.status : "absent";
      const r = detail.addRow([
        row.name,
        d,
        new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" }),
        status === "half_day" ? "Half Day" : status === "in_progress" ? "No Check-out" : status.charAt(0).toUpperCase() + status.slice(1),
        cell?.timeIn || "—",
        cell?.timeOut || "—",
        cell ? round2(cell.hours) : 0,
        cell ? hoursToHM(cell.hours) : "0m",
        cell ? round2(cell.ot) : 0,
        cell ? hoursToHM(cell.ot) : "0m",
        cell?.late ? "Yes" : "No",
        cell?.early ? "Yes" : "No",
      ]);
      r.font = { name: "Arial", size: 9 };
      const colors = STATUS_COLORS[status];
      r.getCell(4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.bg } };
      r.getCell(4).font = { name: "Arial", size: 9, bold: true, color: { argb: "FF" + colors.text } };
    });
  });
  detail.columns.forEach((c) => (c.width = 14));
  detail.getColumn(1).width = 26;
  detail.autoFilter = { from: "A1", to: "L1" };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, `Attendance-Report-${data.monthLabel.replace(/\s/g, "-")}.xlsx`);
}

/* -------------------------------- PDF ----------------------------------- */
const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(0, 2), 16),
  parseInt(hex.slice(2, 4), 16),
  parseInt(hex.slice(4, 6), 16),
];

export function exportMatrixPdf(data: MatrixData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 118, 110);
  doc.rect(0, 0, pageWidth, 20, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`${data.companyName || "Workforce"} — Full Attendance Report`, 12, 9);
  doc.setFontSize(10);
  doc.text(data.monthLabel, 12, 16);

  // summary KPIs
  const totals = data.rows.reduce(
    (acc, r) => ({
      present: acc.present + r.presentDays,
      half: acc.half + r.halfDays,
      absent: acc.absent + r.absentDays,
      hours: acc.hours + r.totalHours,
      ot: acc.ot + r.totalOT,
    }),
    { present: 0, half: 0, absent: 0, hours: 0, ot: 0 }
  );

  const kpis: [string, string, [number, number, number]][] = [
    ["Workers", String(data.rows.length), [15, 118, 110]],
    ["Present days", String(totals.present), [4, 120, 87]],
    ["Half days", String(totals.half), [146, 64, 14]],
    ["Absent days", String(totals.absent), [185, 28, 28]],
    ["Hours worked", hoursToHM(totals.hours), [29, 78, 216]],
    ["OT hours", hoursToHM(totals.ot), [109, 40, 217]],
  ];
  let x = 12;
  kpis.forEach(([label, value, color]) => {
    doc.setFillColor(color[0], color[1], color[2]);
    doc.roundedRect(x, 24, 48, 16, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(label, x + 4, 30);
    doc.setFontSize(12);
    doc.text(value, x + 4, 37);
    x += 52;
  });

  const head = [["#", "Worker", ...data.dates.map((d) => dayNum(d)), "P", "SW", "HW", "Tot", "A", "Hrs", "OT"]];
  const body = data.rows.map((row, idx) => [
    idx + 1,
    row.name,
    ...data.dates.map((d) => {
      const c = row.cells[d];
      return c ? STATUS_LABEL[c.status] : STATUS_LABEL.absent;
    }),
    row.presentDays,
    row.sundayWorkedDays || 0,
    row.holidayWorkedDays || 0,
    row.totalDaysWorked || row.presentDays,
    row.absentDays,
    hoursToHM(row.totalHours),
    hoursToHM(row.totalOT),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: 45,
    styles: { fontSize: 6.5, cellPadding: 1, halign: "center", lineWidth: 0.1, lineColor: [226, 232, 240] },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontSize: 6.5 },
    columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 34, halign: "left", fontStyle: "bold" } },
    didParseCell: (hook) => {
      if (hook.section !== "body") return;
      const dateIdx = hook.column.index - 2;
      if (dateIdx >= 0 && dateIdx < data.dates.length) {
        const row = data.rows[hook.row.index];
        const cell = row.cells[data.dates[dateIdx]];
        const status: DayStatus = cell ? cell.status : "absent";
        hook.cell.styles.fillColor = hexToRgb(STATUS_COLORS[status].bg);
        hook.cell.styles.textColor = hexToRgb(STATUS_COLORS[status].text);
        hook.cell.styles.fontStyle = "bold";
      }
    },
  });

  const afterY = (doc as any).lastAutoTable?.finalY || 60;
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    "Legend: P = Workday Present   SW = Sunday Worked (OT)   HW = Holiday Worked (OT)   S = Sunday (Off)   H = Holiday (Off)   A = Absent (Workday)",
    12,
    Math.min(afterY + 6, doc.internal.pageSize.getHeight() - 8)
  );

  // per-worker OT breakdown page
  const otRows = data.rows.filter((r) => r.totalOT > 0);
  if (otRows.length) {
    doc.addPage();
    doc.setFontSize(13);
    doc.setTextColor(15, 118, 110);
    doc.text("Overtime Breakdown (early OT before 8:50 AM + evening OT after 6:00 PM)", 12, 14);
    autoTable(doc, {
      startY: 20,
      head: [["Worker", "Date", "In", "Out", "Worked", "OT"]],
      body: otRows.flatMap((r) =>
        data.dates
          .filter((d) => (r.cells[d]?.ot || 0) > 0)
          .map((d) => {
            const c = r.cells[d];
            return [r.name, d, c.timeIn || "—", c.timeOut || "—", hoursToHM(c.hours), hoursToHM(c.ot)];
          })
      ),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [109, 40, 217], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 243, 255] },
    });
  }

  doc.save(`Attendance-Report-${data.monthLabel.replace(/\s/g, "-")}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
