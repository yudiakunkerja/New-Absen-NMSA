import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { INITIAL_WORKERS, DEFAULT_OFFICE_LOCATION, INDONESIAN_MONTHS } from "./src/constants";
import { processAiAttendanceQuery } from "./server/ai-assistant";
import {
  initWhatsApp,
  getWhatsAppStatus,
  disconnectWhatsApp,
  sendWhatsAppMessage,
  broadcastAttendanceLinks,
  resetWhatsAppSession,
  requestPairingCode,
  handleKeepAlivePing,
} from "./server/wa-bot";
import {
  generateHumanDailyMessage,
  generateAiPersonalizedMessage,
  getJakartaDayOfWeek,
} from "./server/humanized-messages";
import {
  checkDayStatus,
  DEFAULT_INDONESIAN_HOLIDAYS_2026,
  HolidayEntry,
} from "./server/holidays";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const DATA_FILE = path.join(process.cwd(), "data-store.json");

// Helper: Jakarta Date string (YYYY-MM-DD)
function getJakartaDateStr(): string {
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

// Helper: Jakarta Time Details
function getJakartaTimeDetails() {
  const d = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    weekday: "short", // "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
  return { weekday, hour, minute };
}

// Helper: Get Monday date string from any date
function getMondayDateStr(dateStr: string): string {
  const parts = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12, 0, 0));
  const day = d.getUTCDay();
  const diffToMonday = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(parts[0], parts[1] - 1, diffToMonday, 12, 0, 0));

  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Helper: Read and ensure data-store structure
function readState(): any {
  const todayDate = getJakartaDateStr();
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      let changed = false;

      // Ensure Deasy Annisa Syahdane is updated
      if (parsed.workers) {
        const deasy = parsed.workers.find((w: any) => w.id === "W03");
        if (deasy && deasy.name !== "Deasy Annisa Syahdane") {
          deasy.name = "Deasy Annisa Syahdane";
          changed = true;
        }
      } else {
        parsed.workers = INITIAL_WORKERS;
        changed = true;
      }

      if (!parsed.attendanceRecords) {
        parsed.attendanceRecords = [];
        changed = true;
      }
      if (!parsed.attendanceLogs) {
        parsed.attendanceLogs = [];
        changed = true;
      }
      if (!parsed.fridayReports) {
        parsed.fridayReports = [];
        changed = true;
      }
      if (!parsed.officeLocation) {
        parsed.officeLocation = DEFAULT_OFFICE_LOCATION;
        changed = true;
      }
      if (parsed.registeredAdminPhone === undefined) {
        parsed.registeredAdminPhone = "";
        changed = true;
      }
      if (parsed.waMethod === undefined) {
        parsed.waMethod = "baileys";
        changed = true;
      }
      if (!parsed.botDispatchSettings) {
        parsed.botDispatchSettings = {
          autoDispatchEnabled: true,
          dispatchTime: "08:00",
          workDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
          typingDelayMin: 3,
          typingDelayMax: 6,
          messageStyle: "human_dynamic",
          includeLocationReminder: true,
          lastAutoDispatchDate: "",
        };
        changed = true;
      }
      if (!parsed.botMessageLogs) {
        parsed.botMessageLogs = [];
        changed = true;
      }

      if (changed) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(parsed, null, 2), "utf-8");
      }
      return parsed;
    }
  } catch (e) {
    console.error("Error reading state:", e);
  }

  // Initial State
  const initial = {
    workers: INITIAL_WORKERS,
    attendanceRecords: [],
    attendanceLogs: [],
    fridayReports: [],
    officeLocation: DEFAULT_OFFICE_LOCATION,
    registeredAdminPhone: "",
    waMethod: "baileys",
    lastFridayAutoSaveDate: "",
    botDispatchSettings: {
      autoDispatchEnabled: true,
      dispatchTime: "08:00",
      workDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
      typingDelayMin: 3,
      typingDelayMax: 6,
      messageStyle: "human_dynamic",
      includeLocationReminder: true,
      lastAutoDispatchDate: "",
    },
    botMessageLogs: [],
  };
  fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), "utf-8");
  return initial;
}

function writeState(state: any) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ==================== API ROUTES ====================

// Health & Anti-Disconnect Keep-Alive (UptimeRobot, cron-job.org, Freshping)
app.get("/api/health", async (req, res) => {
  const pingData = await handleKeepAlivePing(`${req.protocol}://${req.get("host")}`);
  res.json({ status: "ok", timestamp: new Date().toISOString(), ...pingData });
});

// Dedicated UptimeRobot / Anti-Disconnect Ping Endpoint
app.get("/api/wa/keep-alive", async (req, res) => {
  try {
    const pingData = await handleKeepAlivePing(`${req.protocol}://${req.get("host")}`);
    res.json(pingData);
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.head("/api/wa/keep-alive", async (req, res) => {
  await handleKeepAlivePing();
  res.status(200).end();
});

// Shared State
app.get("/api/shared-state", (req, res) => {
  const state = readState();
  res.json(state);
});

app.post("/api/shared-state", (req, res) => {
  try {
    const currentState = readState();
    const merged = { ...currentState, ...req.body };
    writeState(merged);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Streamlined PIN-Less Attendance endpoint for Worker web links
app.post("/api/quick-self-attend", (req, res) => {
  try {
    const { workerId, latitude, longitude, customStatus, reason } = req.body;
    if (!workerId) {
      return res.status(400).json({ success: false, error: "workerId is required" });
    }

    const state = readState();
    const worker = (state.workers || []).find((w: any) => w.id === workerId);
    if (!worker) {
      return res.status(404).json({ success: false, error: "Karyawan tidak ditemukan" });
    }

    const office = state.officeLocation || DEFAULT_OFFICE_LOCATION;
    const todayDate = getJakartaDateStr();
    const timeNowStr = new Date().toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    let distance = 0;
    let isWithinRange = false;

    if (latitude && longitude) {
      // Calculate Haversine distance
      const R = 6371e3;
      const phi1 = (latitude * Math.PI) / 180;
      const phi2 = (office.latitude * Math.PI) / 180;
      const deltaPhi = ((office.latitude - latitude) * Math.PI) / 180;
      const deltaLambda = ((office.longitude - longitude) * Math.PI) / 180;
      const a =
        Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      distance = Math.round(R * c);
      isWithinRange = distance <= office.radiusMeters;
    }

    // Find or create attendance record
    if (!state.attendanceRecords) state.attendanceRecords = [];
    let record = state.attendanceRecords.find((r: any) => r.workerId === workerId);
    if (!record) {
      record = {
        workerId,
        attendance: {},
        dailyAllowance: worker.dailyAllowance || 50000,
        customStatus: {},
        reasons: {},
      };
      state.attendanceRecords.push(record);
    }
    if (!record.attendance) record.attendance = {};
    if (!record.customStatus) record.customStatus = {};
    if (!record.reasons) record.reasons = {};

    let finalStatus: string;
    if (customStatus) {
      // Worker explicitly chose a status (e.g. Sakit, Meeting, Izin, Cuti, Lainnya)
      finalStatus = customStatus;
      record.attendance[todayDate] = false;
      record.customStatus[todayDate] = customStatus;
      record.reasons[todayDate] = reason || "Dicatat via Web Presensi Karyawan";
    } else if (isWithinRange) {
      // Normal Hadir within range
      finalStatus = "Hadir";
      record.attendance[todayDate] = true;
      delete record.customStatus[todayDate];
      delete record.reasons[todayDate];
    } else {
      return res.status(400).json({
        success: false,
        error: `Anda berada di luar jangkauan area kantor (${distance}m, batas: ${office.radiusMeters}m). Silakan pilih status Sakit/Meeting/Izin/Lainnya.`,
        isWithinRange: false,
        distance,
      });
    }

    // Add log
    if (!state.attendanceLogs) state.attendanceLogs = [];
    state.attendanceLogs.unshift({
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      workerId,
      workerName: worker.name,
      date: todayDate,
      time: timeNowStr,
      latitude: latitude || 0,
      longitude: longitude || 0,
      distance: distance || 0,
      address: isWithinRange
        ? `Area Kantor NMSA (${distance}m)`
        : `Luar Kantor (${distance}m) - Status ${finalStatus}`,
      status: finalStatus,
      notes: reason || (isWithinRange ? "Presensi Hadir Mandiri Tanpa PIN" : `Presensi ${finalStatus}`),
    });

    if (state.attendanceLogs.length > 500) {
      state.attendanceLogs = state.attendanceLogs.slice(0, 500);
    }

    writeState(state);

    res.json({
      success: true,
      workerName: worker.name,
      date: todayDate,
      time: timeNowStr,
      status: finalStatus,
      distance,
      isWithinRange,
    });
  } catch (err: any) {
    console.error("Error in quick-self-attend:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Gemini AI Chat for WhatsApp Bot & Web Console
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { prompt, senderPhone, isAdmin } = req.body;
    if (!prompt) {
      return res.status(400).json({ success: false, error: "Prompt is required" });
    }

    const result = await processAiAttendanceQuery(prompt, senderPhone, isAdmin ?? true);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error("Error in AI chat endpoint:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// WhatsApp Bot Endpoints
app.get("/api/wa/status", (req, res) => {
  const status = getWhatsAppStatus();
  // Auto-init WhatsApp in background if currently disconnected so QR code is generated right away!
  if (status.status === "disconnected") {
    initWhatsApp().catch((e) => console.log("Background WA socket startup:", e.message));
  }
  res.json(getWhatsAppStatus());
});

app.post("/api/wa/init", async (req, res) => {
  try {
    await initWhatsApp(true);
    res.json({ success: true, ...getWhatsAppStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/reset", async (req, res) => {
  try {
    await resetWhatsAppSession();
    // Allow brief moment for Baileys to emit fresh QR
    await new Promise((r) => setTimeout(r, 1500));
    res.json({ success: true, ...getWhatsAppStatus() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/pairing-code", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ success: false, error: "Nomor WhatsApp diperlukan" });
    }
    const result = await requestPairingCode(phone);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/disconnect", async (req, res) => {
  const result = await disconnectWhatsApp();
  res.json(result);
});

app.post("/api/wa/save-admin-phone", (req, res) => {
  try {
    const { phone } = req.body;
    const state = readState();
    state.registeredAdminPhone = phone || "";
    writeState(state);
    res.json({ success: true, registeredAdminPhone: state.registeredAdminPhone });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/save-bot-settings", (req, res) => {
  try {
    const state = readState();
    state.botDispatchSettings = {
      ...(state.botDispatchSettings || {}),
      ...req.body,
    };
    writeState(state);
    res.json({ success: true, botDispatchSettings: state.botDispatchSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/wa/preview-messages", async (req, res) => {
  try {
    const state = readState();
    const appUrl = (req.query.appUrl as string) || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const day = (req.query.day as string) || undefined;
    const style = (req.query.style as any) || state.botDispatchSettings?.messageStyle || "human_dynamic";
    const workers = (state.workers || []).filter((w: any) => w.isActive);

    const previews = workers.map((w: any, idx: number) => {
      const url = `${appUrl.replace(/\/$/, "")}/?worker=${w.id}`;
      const message = generateHumanDailyMessage({
        workerName: w.name,
        role: w.role,
        attendUrl: url,
        dayOfWeek: day,
        variationIndex: idx,
      });
      return {
        workerId: w.id,
        workerName: w.name,
        role: w.role,
        phoneNumber: w.phoneNumber,
        attendUrl: url,
        message,
      };
    });

    const { dayName, dateFormatted } = getJakartaDayOfWeek();
    res.json({ success: true, dayName: day || dayName, dateFormatted, previews });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/broadcast-links", async (req, res) => {
  try {
    const { appUrl, targetWorkerIds, style } = req.body;
    const url = appUrl || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const state = readState();
    const effectiveStyle = style || state.botDispatchSettings?.messageStyle || "human_dynamic";
    const result = await broadcastAttendanceLinks({
      appUrl: url,
      targetWorkerIds,
      style: effectiveStyle,
      isAutoScheduled: false,
    });
    res.json({ success: true, count: result.count, logs: result.logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/send-test-preview", async (req, res) => {
  try {
    const { phone, workerId, style, day } = req.body;
    const state = readState();
    const targetPhone = phone || state.registeredAdminPhone;
    if (!targetPhone) {
      return res.status(400).json({ success: false, error: "Nomor WhatsApp tujuan atau admin belum diatur" });
    }

    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const targetWorker = (state.workers || []).find((w: any) => w.id === (workerId || "W01")) || state.workers[0];
    const url = `${appUrl.replace(/\/$/, "")}/?worker=${targetWorker?.id || "W01"}`;

    const testMessage = `[CONTOH PRATINJAU PESAN BOT]\n\n` +
      generateHumanDailyMessage({
        workerName: targetWorker?.name || "Karyawan NMSA",
        role: targetWorker?.role,
        attendUrl: url,
        dayOfWeek: day,
        style: style || state.botDispatchSettings?.messageStyle || "human_dynamic",
      });

    const success = await sendWhatsAppMessage(targetPhone, testMessage);
    res.json({ success, messageSent: testMessage, targetPhone });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/wa/send-test", async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: "Phone and message required" });
    }
    const success = await sendWhatsAppMessage(phone, message);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Google Drive token persistence on server
app.post("/api/drive/save-token", (req, res) => {
  try {
    const { token } = req.body;
    const state = readState();
    state.googleDriveToken = token;
    writeState(state);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== HOLIDAYS & WORK SCHEDULE ENDPOINTS ====================
app.get("/api/holidays", (req, res) => {
  const state = readState();
  const workDays = state.botDispatchSettings?.workDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
  const customHolidays = state.holidays || [];
  const allHolidays = [...DEFAULT_INDONESIAN_HOLIDAYS_2026];
  for (const ch of customHolidays) {
    const idx = allHolidays.findIndex((h) => h.date === ch.date);
    if (idx >= 0) allHolidays[idx] = ch;
    else allHolidays.push(ch);
  }
  allHolidays.sort((a, b) => a.date.localeCompare(b.date));
  const todayStatus = checkDayStatus(undefined, customHolidays, workDays);
  res.json({ holidays: allHolidays, customHolidays, todayStatus });
});

app.post("/api/holidays/add", (req, res) => {
  try {
    const { date, name, type, notes } = req.body;
    if (!date || !name) {
      return res.status(400).json({ success: false, error: "Tanggal dan Nama Libur wajib diisi" });
    }
    const state = readState();
    if (!state.holidays) state.holidays = [];
    const newEntry: HolidayEntry = {
      id: `HOL-${Date.now()}`,
      date,
      name,
      type: type || "sudden_government",
      notes: notes || "Ditambahkan via Pengaturan",
      addedBy: "admin",
      createdAt: new Date().toISOString(),
    };
    const existingIdx = state.holidays.findIndex((h: any) => h.date === date);
    if (existingIdx >= 0) {
      state.holidays[existingIdx] = newEntry;
    } else {
      state.holidays.push(newEntry);
    }
    writeState(state);
    res.json({ success: true, holiday: newEntry });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/holidays/delete", (req, res) => {
  try {
    const { date } = req.body;
    const state = readState();
    if (state.holidays) {
      state.holidays = state.holidays.filter((h: any) => h.date !== date);
      writeState(state);
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ==================== FEATURE REQUESTS (WHATSAPP & AI STUDIO BACKLOG) ====================
app.get("/api/feature-requests", (req, res) => {
  const state = readState();
  res.json({ featureRequests: state.featureRequests || [] });
});

app.post("/api/feature-requests/add", (req, res) => {
  try {
    const { title, description, category, requestedVia, senderName, senderPhone } = req.body;
    const state = readState();
    if (!state.featureRequests) state.featureRequests = [];
    const newReq = {
      id: `REQ-${Date.now()}`,
      title: title || "Permintaan Fitur Baru",
      description: description || "",
      category: category || "general",
      requestedVia: requestedVia || "web",
      senderName: senderName || "Admin",
      senderPhone: senderPhone || "",
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    state.featureRequests.unshift(newReq);
    writeState(state);
    res.json({ success: true, featureRequest: newReq });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/feature-requests/update-status", (req, res) => {
  try {
    const { id, status, notes } = req.body;
    const state = readState();
    if (state.featureRequests) {
      const item = state.featureRequests.find((f: any) => f.id === id);
      if (item) {
        item.status = status;
        if (notes) item.notes = notes;
        writeState(state);
      }
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Trigger Friday Archive manually or programmatically
app.post("/api/friday/save-report", (req, res) => {
  try {
    const state = readState();
    const todayDate = getJakartaDateStr();
    const mondayDate = getMondayDateStr(todayDate);

    // Calculate Friday date
    const mParts = mondayDate.split("-").map(Number);
    const mObj = new Date(Date.UTC(mParts[0], mParts[1] - 1, mParts[2] + 4, 12, 0, 0));
    const yStr = mObj.getUTCFullYear();
    const mStr = String(mObj.getUTCMonth() + 1).padStart(2, "0");
    const dStr = String(mObj.getUTCDate()).padStart(2, "0");
    const fridayDate = `${yStr}-${mStr}-${dStr}`;

    const monthIndex = mObj.getUTCMonth();
    const monthNameIndo = `${INDONESIAN_MONTHS[monthIndex]} ${yStr}`;
    const periodName = `Periode ${mondayDate.slice(8)}-${fridayDate.slice(8)} ${INDONESIAN_MONTHS[monthIndex]} ${yStr}`;

    const reportId = `REP-${mondayDate}-${fridayDate}`;
    const existingIndex = (state.fridayReports || []).findIndex((r: any) => r.id === reportId);

    const workers = state.workers || [];
    const validRecords = (state.attendanceRecords || []).map((r: any) => ({ ...r }));

    const totalCost = validRecords.reduce((sum: number, r: any) => {
      const presentDays = Object.keys(r.attendance || {}).filter(
        (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
      ).length;
      return sum + presentDays * (r.dailyAllowance || 50000);
    }, 0);

    const totalPresent = validRecords.reduce((sum: number, r: any) => {
      const presentDays = Object.keys(r.attendance || {}).filter(
        (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
      ).length;
      return sum + presentDays;
    }, 0);

    const reportObj = {
      id: reportId,
      weekStartDate: mondayDate,
      weekEndDate: fridayDate,
      periodName,
      monthName: monthNameIndo,
      records: validRecords,
      isSubmitted: true,
      submittedAt: new Date().toISOString(),
      autoSavedAt: `${todayDate} ${new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
      totalCost,
      totalPresent,
      driveUrl: req.body.driveUrl || undefined,
      pdfDriveUrl: req.body.pdfDriveUrl || undefined,
    };

    if (existingIndex >= 0) {
      state.fridayReports[existingIndex] = { ...state.fridayReports[existingIndex], ...reportObj };
    } else {
      if (!state.fridayReports) state.fridayReports = [];
      state.fridayReports.unshift(reportObj);
    }

    state.lastFridayAutoSaveDate = todayDate;
    writeState(state);

    res.json({ success: true, report: reportObj, folderPath: `absen > ${monthNameIndo} > ${periodName}` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== FRIDAY 17:00 AUTO-SAVE BACKGROUND CRON ====================
function runFridayAutoSaveCheck() {
  try {
    const { weekday, hour, minute } = getJakartaTimeDetails();
    const todayDate = getJakartaDateStr();

    // Is it Friday and hour >= 17 (jam 5 sore)?
    if (weekday === "Fri" && hour >= 17) {
      const state = readState();
      if (state.lastFridayAutoSaveDate !== todayDate) {
        console.log(`[Auto-Archive] Friday 17:00 reached! Auto-saving weekly attendance for ${todayDate}...`);

        const mondayDate = getMondayDateStr(todayDate);
        const mParts = mondayDate.split("-").map(Number);
        const mObj = new Date(Date.UTC(mParts[0], mParts[1] - 1, mParts[2] + 4, 12, 0, 0));
        const yStr = mObj.getUTCFullYear();
        const monthIndex = mObj.getUTCMonth();
        const monthNameIndo = `${INDONESIAN_MONTHS[monthIndex]} ${yStr}`;
        const periodName = `Periode ${mondayDate.slice(8)}-${todayDate.slice(8)} ${INDONESIAN_MONTHS[monthIndex]} ${yStr}`;

        const reportId = `REP-${mondayDate}-${todayDate}`;
        const validRecords = (state.attendanceRecords || []).map((r: any) => ({ ...r }));

        const totalCost = validRecords.reduce((sum: number, r: any) => {
          const presentDays = Object.keys(r.attendance || {}).filter(
            (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
          ).length;
          return sum + presentDays * (r.dailyAllowance || 50000);
        }, 0);

        const totalPresent = validRecords.reduce((sum: number, r: any) => {
          const presentDays = Object.keys(r.attendance || {}).filter(
            (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
          ).length;
          return sum + presentDays;
        }, 0);

        const newReport = {
          id: reportId,
          weekStartDate: mondayDate,
          weekEndDate: todayDate,
          periodName,
          monthName: monthNameIndo,
          records: validRecords,
          isSubmitted: true,
          submittedAt: new Date().toISOString(),
          autoSavedAt: `${todayDate} 17:00 WIB (Otomatis Jam Pulang Jumat)`,
          totalCost,
          totalPresent,
        };

        if (!state.fridayReports) state.fridayReports = [];
        const existingIdx = state.fridayReports.findIndex((r: any) => r.id === reportId);
        if (existingIdx >= 0) {
          state.fridayReports[existingIdx] = newReport;
        } else {
          state.fridayReports.unshift(newReport);
        }

        state.lastFridayAutoSaveDate = todayDate;

        if (!state.attendanceLogs) state.attendanceLogs = [];
        state.attendanceLogs.unshift({
          id: `LOG-AUTO-${Date.now()}`,
          workerId: "SYSTEM",
          workerName: "Sistem Otomatis NMSA",
          date: todayDate,
          time: "17:00:00",
          latitude: 0,
          longitude: 0,
          distance: 0,
          address: `Server Background Auto-Save`,
          status: "BERHASIL",
          notes: `Laporan Mingguan Jumat disimpan otomatis pada jam pulang kerja (Folder: absen > ${monthNameIndo} > ${periodName})`,
        });

        writeState(state);
        console.log(`[Auto-Archive] Successfully recorded Friday report into riwayat laporan jumat.`);
      }
    }
  } catch (err) {
    console.error("Error in Friday auto-save cron check:", err);
  }
}

// ==================== DAILY MORNING BOT DISPATCH CRON ====================
function runMorningBotDispatchCheck() {
  try {
    const { hour, minute } = getJakartaTimeDetails();
    const todayDate = getJakartaDateStr();
    const { dayName } = getJakartaDayOfWeek();

    const state = readState();
    const settings = state.botDispatchSettings;
    if (!settings || !settings.autoDispatchEnabled) return;

    // Check holiday & weekend status
    const workDays = settings.workDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    const customHolidays = state.holidays || [];
    const dayCheck = checkDayStatus(todayDate, customHolidays, workDays);

    if (!dayCheck.canSendAttendance) {
      // Don't dispatch on weekends or holidays
      return;
    }

    // Parse dispatch time e.g. "08:00"
    const [targetHStr, targetMStr] = (settings.dispatchTime || "08:00").split(":");
    const targetH = parseInt(targetHStr, 10);
    const targetM = parseInt(targetMStr, 10);

    const isMatchTime = hour === targetH && minute >= targetM && minute <= targetM + 15;
    const alreadyDispatched = settings.lastAutoDispatchDate === todayDate;

    if (isMatchTime && !alreadyDispatched) {
      console.log(`[Auto-Bot] Morning dispatch triggered for ${dayName}, ${todayDate} (${dayCheck.reason}) at ${hour}:${minute} WIB...`);
      const status = getWhatsAppStatus();
      if (status.status === "connected") {
        settings.lastAutoDispatchDate = todayDate;
        writeState(state);

        broadcastAttendanceLinks({
          appUrl: process.env.APP_URL || "http://localhost:3000",
          style: settings.messageStyle || "human_dynamic",
          isAutoScheduled: true,
        }).then((res) => {
          console.log(`[Auto-Bot] Dispatched humanized attendance links to ${res.count} employees.`);
        }).catch((err) => {
          console.error(`[Auto-Bot] Error in morning broadcast:`, err);
        });
      } else {
        console.warn(`[Auto-Bot] Scheduled time reached (${settings.dispatchTime} WIB) but WhatsApp socket not connected.`);
      }
    }
  } catch (err) {
    console.error("Error in morning bot dispatch check:", err);
  }
}

// Run checks every 60 seconds
setInterval(runFridayAutoSaveCheck, 60000);
setInterval(runMorningBotDispatchCheck, 60000);

// ==================== VITE & PRODUCTION SERVER ====================
async function start() {
  // Ensure state exists
  readState();

  // Initialize WhatsApp Baileys in background
  initWhatsApp().catch((err) => console.log("Initial WA init:", err.message));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Absen Harian NMSA server running on http://0.0.0.0:${PORT}`);
  });
}

start();
