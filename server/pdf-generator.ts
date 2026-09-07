import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { NMSA_LOGO_BASE64 } from "../src/lib/logoBase64";

export interface PdfReportRecord {
  workerId: string;
  attendance: { [date: string]: boolean };
  dailyAllowance: number;
  customStatus?: { [date: string]: string };
  reasons?: { [date: string]: string };
}

export interface PdfReportData {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  periodName?: string;
  monthName?: string;
  records: PdfReportRecord[];
}

export interface PdfWorker {
  id: string;
  name: string;
  role: string;
  dailyAllowance?: number;
}

export function generateReportPdfBuffer(report: PdfReportData, workers: PdfWorker[]): Buffer {
  const doc = new jsPDF("landscape", "pt", "a4");

  // Company Logo & Header
  try {
    doc.addImage(NMSA_LOGO_BASE64, "JPEG", 40, 15, 44, 42.5);
  } catch (err) {
    console.warn("Could not add logo to server PDF:", err);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text("PT. NUSANTARA MINERAL SUKSES ABADI (NMSA)", 94, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("LAPORAN REKAPITULASI PRESENSI & UANG MAKAN KARYAWAN", 94, 46);

  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Sistem Presensi Resmi Terverifikasi Geofencing Kantor • Uang Makan Rp 25.000 / Hari Hadir", 94, 58);

  // Divider line
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(1.5);
  doc.line(40, 68, 802, 68);

  const workerMap = new Map(workers.map((w) => [w.id, w]));
  const uniqueRecordsMap = new Map<string, PdfReportRecord>();

  (report.records || []).forEach((r) => {
    if (!uniqueRecordsMap.has(r.workerId)) {
      uniqueRecordsMap.set(r.workerId, { ...r });
    } else {
      const existing = uniqueRecordsMap.get(r.workerId)!;
      existing.attendance = { ...existing.attendance, ...r.attendance };
      existing.customStatus = { ...existing.customStatus, ...r.customStatus };
      existing.reasons = { ...existing.reasons, ...r.reasons };
    }
  });

  workers.forEach((w) => {
    if (!uniqueRecordsMap.has(w.id)) {
      uniqueRecordsMap.set(w.id, {
        workerId: w.id,
        attendance: {},
        dailyAllowance: w.dailyAllowance || 25000,
        customStatus: {},
        reasons: {},
      });
    }
  });

  const validRecords = Array.from(uniqueRecordsMap.values());

  doc.setFontSize(9.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`Periode: ${report.periodName || `${report.weekStartDate} s/d ${report.weekEndDate}`}`, 40, 88);
  doc.text(`Bulan: ${report.monthName || "Periode Berjalan"}`, 40, 102);
  doc.text(`Jumlah Karyawan: ${validRecords.length} Orang`, 40, 116);

  const totalAllCost = validRecords.reduce((sum, r) => {
    const presentDays = Object.keys(r.attendance || {}).filter(
      (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
    ).length;
    const allowance = r.dailyAllowance || 25000;
    return sum + presentDays * allowance;
  }, 0);

  const totalAllPresentDays = validRecords.reduce((sum, r) => {
    const presentDays = Object.keys(r.attendance || {}).filter(
      (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
    ).length;
    return sum + presentDays;
  }, 0);

  doc.text(`Total Kehadiran: ${totalAllPresentDays} Hari Kerja`, 420, 88);
  doc.setFont("helvetica", "bold");
  doc.text(`Total Uang Makan: Rp ${totalAllCost.toLocaleString("id-ID")} (Rp 25.000/hari)`, 420, 104);
  doc.setFont("helvetica", "normal");
  doc.text(`Dicetak Otomatis: ${new Date().toLocaleString("id-ID")}`, 420, 118);

  const getWeekDates = (startDateStr: string) => {
    const dates: string[] = [];
    const base = new Date(startDateStr);
    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${day}`);
    }
    return dates;
  };

  const weekDates = getWeekDates(report.weekStartDate);

  const getStatusTextForDate = (rec: any, dateKey: string) => {
    if (!rec) return "-";
    const customVal = rec.customStatus?.[dateKey];
    if (customVal) {
      if (customVal === "Sakit") return "Sakit (S)";
      if (customVal === "Izin") return "Izin (I)";
      if (customVal === "Meeting") return "Meeting (M)";
      if (customVal === "Cuti") return "Cuti (C)";
      return customVal;
    }
    if (rec.attendance && rec.attendance[dateKey] === true) {
      return "Hadir (H)";
    }
    if (rec.attendance && rec.attendance[dateKey] === false) {
      return "Alpa (A)";
    }
    return "-";
  };

  const tableData: any[] = validRecords.map((r: any, index) => {
    const worker = workerMap.get(r.workerId);
    const presentDays = Object.keys(r.attendance || {}).filter(
      (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
    ).length;
    const allowance = r.dailyAllowance || 25000;
    const totalWage = presentDays * allowance;

    return [
      index + 1,
      worker?.id || r.workerId,
      worker?.name || "Karyawan NMSA",
      worker?.role || "Karyawan",
      getStatusTextForDate(r, weekDates[0]),
      getStatusTextForDate(r, weekDates[1]),
      getStatusTextForDate(r, weekDates[2]),
      getStatusTextForDate(r, weekDates[3]),
      getStatusTextForDate(r, weekDates[4]),
      presentDays,
      `Rp ${allowance.toLocaleString("id-ID")}`,
      `Rp ${totalWage.toLocaleString("id-ID")}`,
    ];
  });

  tableData.push([
    "",
    "",
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    totalAllPresentDays,
    "-",
    `Rp ${totalAllCost.toLocaleString("id-ID")}`,
  ]);

  autoTable(doc, {
    startY: 132,
    head: [
      [
        "No",
        "ID",
        "Nama Karyawan",
        "Jabatan",
        `Senin\n${weekDates[0].slice(5)}`,
        `Selasa\n${weekDates[1].slice(5)}`,
        `Rabu\n${weekDates[2].slice(5)}`,
        `Kamis\n${weekDates[3].slice(5)}`,
        `Jumat\n${weekDates[4].slice(5)}`,
        "Hadir",
        "Tarif/Hari",
        "Total (Rp)",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { cellWidth: 26, halign: "center" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 150, fontStyle: "bold" },
      3: { cellWidth: 75 },
      4: { cellWidth: 64, halign: "center" },
      5: { cellWidth: 64, halign: "center" },
      6: { cellWidth: 64, halign: "center" },
      7: { cellWidth: 64, halign: "center" },
      8: { cellWidth: 64, halign: "center" },
      9: { cellWidth: 46, halign: "center", fontStyle: "bold" },
      10: { cellWidth: 70, halign: "right" },
      11: { cellWidth: 80, halign: "right", fontStyle: "bold" },
    },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      valign: "middle",
    },
    didParseCell: function (data: any) {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 25 : 450;
  if (finalY < 500) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Keterangan Status: (H) Hadir | (S) Sakit | (I) Izin | (M) Meeting | (C) Cuti | (A) Alpa", 40, finalY);

    const signY = finalY + 20;
    doc.text("Dibuat & Diverifikasi oleh:", 120, signY);
    doc.text("Admin HRD PT. NMSA", 120, signY + 55);

    doc.text("Mengetahui & Menyetujui:", 580, signY);
    doc.text("Pimpinan PT. Nusantara Mineral Sukses Abadi", 580, signY + 55);
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}
