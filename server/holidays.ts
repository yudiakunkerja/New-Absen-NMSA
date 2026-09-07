export interface HolidayEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: "national" | "cuti_bersama" | "sudden_government" | "company";
  notes?: string;
  addedBy?: "system" | "admin" | "whatsapp_ai";
  createdAt?: string;
}

// Official Indonesian National Holidays & Cuti Bersama for 2026
export const DEFAULT_INDONESIAN_HOLIDAYS_2026: HolidayEntry[] = [
  { id: "HOL-2026-01-01", date: "2026-01-01", name: "Tahun Baru 2026 Masehi", type: "national", addedBy: "system" },
  { id: "HOL-2026-01-16", date: "2026-01-16", name: "Isra Mi'raj Nabi Muhammad SAW", type: "national", addedBy: "system" },
  { id: "HOL-2026-02-17", date: "2026-02-17", name: "Tahun Baru Imlek 2577 Kongzili", type: "national", addedBy: "system" },
  { id: "HOL-2026-03-20", date: "2026-03-20", name: "Hari Suci Nyepi (Tahun Baru Saka 1948)", type: "national", addedBy: "system" },
  { id: "HOL-2026-03-21", date: "2026-03-21", name: "Hari Raya Idul Fitri 1447 H (Hari Pertama)", type: "national", addedBy: "system" },
  { id: "HOL-2026-03-22", date: "2026-03-22", name: "Hari Raya Idul Fitri 1447 H (Hari Kedua)", type: "national", addedBy: "system" },
  { id: "HOL-2026-03-23", date: "2026-03-23", name: "Cuti Bersama Idul Fitri 1447 H", type: "cuti_bersama", addedBy: "system" },
  { id: "HOL-2026-03-24", date: "2026-03-24", name: "Cuti Bersama Idul Fitri 1447 H", type: "cuti_bersama", addedBy: "system" },
  { id: "HOL-2026-04-03", date: "2026-04-03", name: "Wafat Yesus Kristus (Jumat Agung)", type: "national", addedBy: "system" },
  { id: "HOL-2026-04-05", date: "2026-04-05", name: "Hari Paskah", type: "national", addedBy: "system" },
  { id: "HOL-2026-05-01", date: "2026-05-01", name: "Hari Buruh Internasional (May Day)", type: "national", addedBy: "system" },
  { id: "HOL-2026-05-14", date: "2026-05-14", name: "Kenaikan Yesus Kristus", type: "national", addedBy: "system" },
  { id: "HOL-2026-05-27", date: "2026-05-27", name: "Hari Raya Idul Adha 1447 H", type: "national", addedBy: "system" },
  { id: "HOL-2026-05-31", date: "2026-05-31", name: "Hari Raya Waisak 2570 BE", type: "national", addedBy: "system" },
  { id: "HOL-2026-06-01", date: "2026-06-01", name: "Hari Lahir Pancasila", type: "national", addedBy: "system" },
  { id: "HOL-2026-06-16", date: "2026-06-16", name: "Tahun Baru Islam 1448 H (1 Muharram)", type: "national", addedBy: "system" },
  { id: "HOL-2026-08-17", date: "2026-08-17", name: "Hari Kemerdekaan Republik Indonesia (HUT RI)", type: "national", addedBy: "system" },
  { id: "HOL-2026-08-25", date: "2026-08-25", name: "Maulid Nabi Muhammad SAW", type: "national", addedBy: "system" },
  { id: "HOL-2026-12-25", date: "2026-12-25", name: "Hari Raya Natal", type: "national", addedBy: "system" },
  { id: "HOL-2026-12-26", date: "2026-12-26", name: "Cuti Bersama Hari Raya Natal", type: "cuti_bersama", addedBy: "system" },
];

export interface DayStatusCheckResult {
  date: string;
  dayName: string; // "Senin", "Selasa", ..., "Sabtu", "Minggu"
  isWeekend: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  isHoliday: boolean;
  isSuddenGovernmentHoliday: boolean;
  holiday?: HolidayEntry;
  canSendAttendance: boolean;
  reason: string;
}

/**
 * Checks whether a given date (default today Jakarta time) is a weekend,
 * a regular national holiday, or a sudden government-declared holiday.
 */
export function checkDayStatus(
  dateStr?: string,
  customHolidays: HolidayEntry[] = [],
  workDays: string[] = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
): DayStatusCheckResult {
  let targetDate: Date;
  let effectiveDateStr = dateStr;

  if (!effectiveDateStr) {
    // Get current Jakarta date
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const day = parts.find((p) => p.type === "day")?.value || "01";
    const month = parts.find((p) => p.type === "month")?.value || "01";
    const year = parts.find((p) => p.type === "year")?.value || "2026";
    effectiveDateStr = `${year}-${month}-${day}`;
    targetDate = new Date(`${year}-${month}-${day}T12:00:00+07:00`);
  } else {
    targetDate = new Date(`${effectiveDateStr}T12:00:00+07:00`);
  }

  const dayName = targetDate.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
  });

  const isSaturday = dayName === "Sabtu";
  const isSunday = dayName === "Minggu";
  const isWeekend = isSaturday || isSunday;

  // Merge default holidays with custom/sudden holidays from data-store
  const allHolidays = [...DEFAULT_INDONESIAN_HOLIDAYS_2026];
  for (const ch of customHolidays) {
    if (!allHolidays.some((h) => h.date === ch.date)) {
      allHolidays.push(ch);
    } else {
      // Replace if custom override exists
      const idx = allHolidays.findIndex((h) => h.date === ch.date);
      if (idx !== -1) allHolidays[idx] = ch;
    }
  }

  const holidayMatch = allHolidays.find((h) => h.date === effectiveDateStr);
  const isHoliday = Boolean(holidayMatch);
  const isSudden = holidayMatch?.type === "sudden_government";

  let canSend = true;
  let reason = "Hari Kerja Normal";

  if (isHoliday) {
    canSend = false;
    reason = isSudden
      ? `Hari Libur Nasional Mendadak Pemerintah (${holidayMatch?.name})`
      : `Hari Libur Nasional / Cuti Bersama (${holidayMatch?.name})`;
  } else if (isSunday) {
    canSend = false;
    reason = "Hari Minggu (Akhir Pekan / Libur Kerja)";
  } else if (isSaturday) {
    const isSaturdayWorkDay = workDays.includes("Sabtu");
    if (!isSaturdayWorkDay) {
      canSend = false;
      reason = "Hari Sabtu (Akhir Pekan / Bukan Hari Kerja Aktif)";
    } else {
      reason = "Hari Sabtu (Hari Kerja Aktif Sesuai Jadwal)";
    }
  } else if (!workDays.includes(dayName)) {
    canSend = false;
    reason = `Hari ${dayName} (Bukan Hari Kerja Sesuai Pengaturan)`;
  }

  return {
    date: effectiveDateStr,
    dayName,
    isWeekend,
    isSaturday,
    isSunday,
    isHoliday,
    isSuddenGovernmentHoliday: isSudden,
    holiday: holidayMatch,
    canSendAttendance: canSend,
    reason,
  };
}
