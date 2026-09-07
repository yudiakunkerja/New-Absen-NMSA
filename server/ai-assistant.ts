import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";
import {
  checkDayStatus,
  DEFAULT_INDONESIAN_HOLIDAYS_2026,
  HolidayEntry,
  DayStatusCheckResult,
} from "./holidays.js";

const DATA_FILE = path.join(process.cwd(), "data-store.json");

// Shared GenAI client with required User-Agent header
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Read current data store
export function readDataStore(): any {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (e) {
      console.error("Failed to read data-store.json:", e);
    }
  }
  return {};
}

// Write to data store
export function writeDataStore(data: any): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write data-store.json:", e);
  }
}

// Jakarta Date helper (YYYY-MM-DD)
export function getJakartaDateStr(): string {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(d);
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2026";
  return `${year}-${month}-${day}`;
}

export function getJakartaTimeStr(): string {
  const d = new Date();
  return d.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Processes natural language commands/queries from WhatsApp (or web console)
 * using Gemini to answer questions, record attendance, manage holidays/weekends,
 * modify bot settings, and queue feature requests for AI Studio.
 */
export async function processAiAttendanceQuery(
  userQuery: string,
  senderPhone?: string,
  isAdmin: boolean = true
): Promise<{ replyText: string; actionTaken?: string; updatedData?: any }> {
  const state = readDataStore();
  const todayDate = getJakartaDateStr();
  const currentTime = getJakartaTimeStr();
  const workers = state.workers || [];
  const records = state.attendanceRecords || [];
  const customHolidays: HolidayEntry[] = state.holidays || [];
  const botSettings = state.botDispatchSettings || {
    autoDispatchEnabled: true,
    dispatchTime: "08:00",
    workDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
    typingDelayMin: 3,
    typingDelayMax: 6,
    messageStyle: "human_dynamic",
    includeLocationReminder: true,
  };

  // Day & holiday check for today
  const todayStatus: DayStatusCheckResult = checkDayStatus(
    todayDate,
    customHolidays,
    botSettings.workDays
  );

  // Build current snapshot summary of workers
  const workersSummary = workers.map((w: any) => {
    const rec = records.find((r: any) => r.workerId === w.id);
    const isPresent = rec?.attendance?.[todayDate] === true;
    const customStatus = rec?.customStatus?.[todayDate];
    const reason = rec?.reasons?.[todayDate];
    let statusText = "Belum Absen";
    if (customStatus) {
      statusText = `${customStatus}${reason ? ` (${reason})` : ""}`;
    } else if (isPresent) {
      statusText = "Hadir";
    }
    return {
      id: w.id,
      name: w.name,
      phone: w.phoneNumber,
      role: w.role,
      statusHariIni: statusText,
      isPresentToday: isPresent,
    };
  });

  // Merge default national holidays and custom/sudden holidays for context
  const allHolidays = [...DEFAULT_INDONESIAN_HOLIDAYS_2026];
  for (const ch of customHolidays) {
    if (!allHolidays.some((h) => h.date === ch.date)) {
      allHolidays.push(ch);
    } else {
      const idx = allHolidays.findIndex((h) => h.date === ch.date);
      if (idx !== -1) allHolidays[idx] = ch;
    }
  }

  // Filter nearby holidays (next 60 days)
  const sortedUpcomingHolidays = allHolidays
    .filter((h) => h.date >= todayDate)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 10);

  const systemInstruction = `Anda adalah "Asisten AI WhatsApp & Operasional NMSA" resmi untuk PT. Nusantara Mineral Sukses Abadi.
Anda terhubung secara cerdas dan real-time ke sistem data aplikasi di Google AI Studio.

Tugas dan Wewenang Anda Melalui WhatsApp:
1. INFORMASI & PENCATATAN PRESENSI:
   - Menjawab siapa saja yang sudah/belum absen, sakit, izin, meeting, atau alpa hari ini.
   - Mampu mengeksekusi pencatatan/pengubahan status presensi secara instan ("catat Deasy hadir", "Pak Faisal sakit", "Andi izin").
2. KETENTUAN JAM KERJA, AKHIR PEKAN (SABTU & MINGGU), DAN HARI LIBUR NASIONAL / MENDADAK:
   - Memahami secara mendalam kalender kerja Indonesia:
     * Hari Sabtu & Minggu adalah akhir pekan (bukan hari kerja normal bot, kecuali jika hari Sabtu diaktifkan dalam jadwal bot).
     * Hari Libur Nasional & Cuti Bersama yang telah ditetapkan pemerintah Indonesia.
     * HARI LIBUR NASIONAL YANG DITETAPKAN SECARA MENDADAK OLEH PEMERINTAH (misalnya: pengumuman cuti bersama mendadak, Pilkada serentak, Pemilu, hari berkabung nasional, kondisi cuaca ekstrem, dll).
   - Admin dapat menetapkan hari libur mendadak langsung lewat chat WhatsApp! (Contoh: "Tetapkan besok tanggal 8 September libur nasional Pilkada", "Hari ini libur mendadak", "Batalkan libur tanggal 8 September").
   - Jika hari tersebut adalah hari libur (nasional/mendadak) atau akhir pekan non-aktif, bot otomatis tidak mengirimkan link absensi pagi.
3. PENGATURAN BOT PRESENSI:
   - Admin dapat mengubah jam kirim bot ("ubah jam kirim jadi 07:30", "aktifkan bot di hari Sabtu").
4. MENERIMA PERMINTAAN FITUR BARU APLIKASI (FEATURE REQUEST VIA WHATSAPP):
   - Jika admin meminta penambahan fitur atau modifikasi aplikasi via WhatsApp (misal: "tolong tambahkan fitur slip gaji PDF", "bisa tambahkan tombol export Excel baru?", "saya ingin fitur verifikasi selfie foto"):
     * Pahami permintaan fitur tersebut dengan baik.
     * Berikan action "ADD_FEATURE_REQUEST".
     * Jelaskan dengan ramah dalam balasan WhatsApp bahwa fitur tersebut telah otomatis dimasukkan ke Antrean Request Fitur AI Studio (Dashboard aplikasi), dan jelaskan konsep singkat cara kerjanya. Beri tahu admin bahwa untuk mengompilasi kode fitur baru, admin cukup membuka AI Studio dan mengatakan "Kerjakan request fitur dari WA".
     * Ingatkan bahwa untuk perubahan data (presensi, jadwal kerja, jam bot, penetapan hari libur nasional/mendadak), perubahannya SUDAH LANGSUNG AKTIF saat ini juga tanpa perlu tunggu kompilasi kode!

INFORMASI SISTEM SAAT INI:
- Tanggal Hari Ini: ${todayDate} (${todayStatus.dayName})
- Waktu Saat Ini: ${currentTime} WIB
- Status Hari Ini: ${todayStatus.reason}
- Apakah Hari Libur / Akhir Pekan: ${
    todayStatus.isWeekend
      ? "YA (Akhir Pekan: " + todayStatus.dayName + ")"
      : todayStatus.isHoliday
      ? "YA (Hari Libur: " + (todayStatus.holiday?.name || "") + ")"
      : "TIDAK (Hari Kerja Aktif)"
  }
- Pengaturan Hari Kerja Bot: ${botSettings.workDays.join(", ")}
- Jam Kirim Bot Pagi: ${botSettings.dispatchTime} WIB (Status: ${botSettings.autoDispatchEnabled ? "Aktif" : "Nonaktif"})
- Total Karyawan: ${workers.length} orang
- Standar Uang Makan Harian: Rp 25.000 / hari kerja hadir
- Kebijakan Sistem: Setiap hari kerja saat jam pulang (17:00 WIB), sistem otomatis menyimpan berkas PDF absensi ke Google Drive terdaftar. Khusus setiap hari Jumat, admin bot WhatsApp otomatis menerima file dokumen PDF dan tautan link Google Drive tersebut.
- Daftar Hari Libur Terdekat:
${JSON.stringify(sortedUpcomingHolidays, null, 2)}
- Data Karyawan & Status Absensi Hari Ini:
${JSON.stringify(workersSummary, null, 2)}

FORMAT RESPON:
Anda HARUS menghasilkan output JSON yang valid dengan format persis:
{
  "replyText": "Teks balasan WhatsApp lengkap dengan formatting WhatsApp (*tebal*, _miring_, emoji, bullet points yang rapi)",
  "action": "NONE" | "UPDATE_ATTENDANCE" | "ADD_HOLIDAY" | "REMOVE_HOLIDAY" | "UPDATE_BOT_SETTINGS" | "ADD_FEATURE_REQUEST",
  "updates": [
    {
      "workerId": "W01",
      "status": "Hadir" | "Sakit" | "Izin" | "Meeting" | "Cuti" | "Alpa",
      "reason": "keterangan jika ada"
    }
  ],
  "holidayData": {
    "date": "YYYY-MM-DD",
    "name": "Nama Hari Libur / Alasan Pemerintah",
    "type": "sudden_government" | "national" | "cuti_bersama" | "company",
    "notes": "keterangan tambahan"
  },
  "removeHolidayDate": "YYYY-MM-DD",
  "botSettingsUpdate": {
    "dispatchTime": "08:00",
    "workDays": ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
    "autoDispatchEnabled": true
  },
  "featureData": {
    "title": "Judul Fitur Singkat",
    "description": "Deskripsi kebutuhan fitur yang diminta",
    "category": "attendance" | "reporting" | "whatsapp" | "system" | "other"
  }
}

Aturan Khusus:
- Karyawan Deasy: "Deasy Annisa Syahdane" (ID: W03).
- Jika ada tanggal relatif seperti "besok", "lusa", hitung tanggal YYYY-MM-DD yang tepat dari tanggal hari ini (${todayDate}).
- Bersikap sangat solutif, cerdas, sopan, dan jelas.`;

  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: userQuery,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    });

    const textOutput = response.text || "";
    let parsed: any;
    try {
      parsed = JSON.parse(textOutput);
    } catch {
      return {
        replyText: textOutput || "Maaf, terjadi kendala saat memproses respon AI.",
      };
    }

    let actionTaken = parsed.action || "NONE";
    let updatedData = null;

    // === ACTION 1: UPDATE ATTENDANCE ===
    if (parsed.action === "UPDATE_ATTENDANCE" && Array.isArray(parsed.updates) && parsed.updates.length > 0) {
      if (!state.attendanceRecords) state.attendanceRecords = [];
      if (!state.attendanceLogs) state.attendanceLogs = [];

      for (const item of parsed.updates) {
        const targetWorker = workers.find((w: any) => w.id === item.workerId);
        if (!targetWorker) continue;

        let record = state.attendanceRecords.find((r: any) => r.workerId === item.workerId);
        if (!record) {
          record = {
            workerId: item.workerId,
            attendance: {},
            dailyAllowance: targetWorker.dailyAllowance || 50000,
            customStatus: {},
            reasons: {},
          };
          state.attendanceRecords.push(record);
        }

        if (!record.attendance) record.attendance = {};
        if (!record.customStatus) record.customStatus = {};
        if (!record.reasons) record.reasons = {};

        const statusLower = (item.status || "").toLowerCase();
        if (statusLower === "hadir") {
          record.attendance[todayDate] = true;
          delete record.customStatus[todayDate];
          delete record.reasons[todayDate];
        } else {
          record.attendance[todayDate] = false;
          record.customStatus[todayDate] = item.status;
          record.reasons[todayDate] = item.reason || `Dicatat via Perintah AI WhatsApp`;
        }

        state.attendanceLogs.unshift({
          id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          workerId: targetWorker.id,
          workerName: targetWorker.name,
          date: todayDate,
          time: currentTime,
          latitude: 0,
          longitude: 0,
          distance: 0,
          address: "Perintah WhatsApp AI Bot",
          status: item.status,
          notes: item.reason || "Dicatat via WhatsApp Assistant AI",
        });
      }

      if (state.attendanceLogs.length > 500) {
        state.attendanceLogs = state.attendanceLogs.slice(0, 500);
      }
      writeDataStore(state);
      updatedData = parsed.updates;
    }

    // === ACTION 2: ADD HOLIDAY (SUDDEN GOVERNMENT OR NATIONAL) ===
    if (parsed.action === "ADD_HOLIDAY" && parsed.holidayData?.date) {
      if (!state.holidays) state.holidays = [];
      const newHol: HolidayEntry = {
        id: `HOL-${Date.now()}`,
        date: parsed.holidayData.date,
        name: parsed.holidayData.name || "Hari Libur Nasional Mendadak",
        type: parsed.holidayData.type || "sudden_government",
        notes: parsed.holidayData.notes || `Ditetapkan via perintah WhatsApp (${todayDate})`,
        addedBy: "whatsapp_ai",
        createdAt: new Date().toISOString(),
      };

      // Replace if date already exists
      const existingIdx = state.holidays.findIndex((h: any) => h.date === newHol.date);
      if (existingIdx >= 0) {
        state.holidays[existingIdx] = newHol;
      } else {
        state.holidays.push(newHol);
      }

      writeDataStore(state);
      updatedData = newHol;
    }

    // === ACTION 3: REMOVE HOLIDAY ===
    if (parsed.action === "REMOVE_HOLIDAY" && parsed.removeHolidayDate) {
      if (state.holidays) {
        state.holidays = state.holidays.filter((h: any) => h.date !== parsed.removeHolidayDate);
        writeDataStore(state);
      }
      updatedData = { removedDate: parsed.removeHolidayDate };
    }

    // === ACTION 4: UPDATE BOT SETTINGS ===
    if (parsed.action === "UPDATE_BOT_SETTINGS" && parsed.botSettingsUpdate) {
      if (!state.botDispatchSettings) {
        state.botDispatchSettings = botSettings;
      }
      state.botDispatchSettings = {
        ...state.botDispatchSettings,
        ...parsed.botSettingsUpdate,
      };
      writeDataStore(state);
      updatedData = state.botDispatchSettings;
    }

    // === ACTION 5: ADD FEATURE REQUEST FROM WHATSAPP ===
    if (parsed.action === "ADD_FEATURE_REQUEST" && parsed.featureData) {
      if (!state.featureRequests) state.featureRequests = [];
      const newFeature = {
        id: `REQ-${Date.now()}`,
        title: parsed.featureData.title || "Permintaan Fitur Baru",
        description: parsed.featureData.description || userQuery,
        category: parsed.featureData.category || "other",
        requestedVia: "whatsapp",
        senderPhone: senderPhone || "",
        senderName: "Admin WhatsApp",
        status: "pending",
        createdAt: new Date().toISOString(),
        notes: `Diajukan via chat WhatsApp: "${userQuery}"`,
      };
      state.featureRequests.unshift(newFeature);
      writeDataStore(state);
      updatedData = newFeature;
    }

    return {
      replyText: parsed.replyText || "Permintaan telah diproses.",
      actionTaken,
      updatedData,
    };
  } catch (err: any) {
    console.error("Gemini AI attendance query error:", err);

    // Rule-based fallback if offline or API failure
    const lower = userQuery.toLowerCase();
    if (lower.includes("libur") || lower.includes("sabtu") || lower.includes("minggu")) {
      return {
        replyText:
          `📅 *Status Hari & Jadwal Kerja NMSA*\n\n` +
          `• Hari Ini: *${todayStatus.dayName}, ${todayDate}*\n` +
          `• Status: *${todayStatus.reason}*\n` +
          `• Hari Kerja Aktif: ${botSettings.workDays.join(", ")}\n` +
          `• Pengiriman Bot Pagi: Jam ${botSettings.dispatchTime} WIB\n\n` +
          `_Catatan: Bot secara otomatis tidak akan mengirimkan link presensi pada hari Sabtu, Minggu, serta Hari Libur Nasional & Libur Mendadak Pemerintah._`,
      };
    }

    if (lower.includes("siapa") && (lower.includes("sudah") || lower.includes("hadir"))) {
      const hadirList = workersSummary.filter((w: any) => w.isPresentToday);
      if (hadirList.length === 0) {
        return { replyText: `📋 *Data Presensi ${todayDate}*\nBelum ada karyawan yang tercatat Hadir hari ini.` };
      }
      const listStr = hadirList.map((w: any, idx: number) => `${idx + 1}. *${w.name}* (${w.role})`).join("\n");
      return {
        replyText: `✅ *Daftar Karyawan Hadir Hari Ini (${todayDate})*\nTotal: *${hadirList.length} orang*\n\n${listStr}`,
      };
    }

    if (lower.includes("siapa") && (lower.includes("belum") || lower.includes("absen"))) {
      const belumList = workersSummary.filter((w: any) => w.statusHariIni === "Belum Absen");
      if (belumList.length === 0) {
        return { replyText: `🎉 Semua karyawan (*${workers.length} orang*) sudah mengisi absensi hari ini!` };
      }
      const listStr = belumList.map((w: any, idx: number) => `${idx + 1}. *${w.name}*`).join("\n");
      return {
        replyText: `⏳ *Karyawan Belum Absen (${todayDate})*\nTotal: *${belumList.length} orang*\n\n${listStr}`,
      };
    }

    return {
      replyText: `Halo Admin PT. NMSA! 👋\nAda yang bisa saya bantu terkait absensi, hari libur, atau pengaturan bot hari ini (*${todayDate}*)?\n\nAnda dapat menanyakan:\n- *"Siapa saja yang sudah absen hari ini?"*\n- *"Apakah hari ini atau besok libur?"*\n- *"Tetapkan besok libur nasional mendadak Pilkada"*\n- *"Ubah jam kirim bot jadi jam 07:30"*\n- *"Catat Deasy Annisa Syahdane hadir"*\n- *"Tolong buatkan fitur [nama fitur]"*`,
    };
  }
}
