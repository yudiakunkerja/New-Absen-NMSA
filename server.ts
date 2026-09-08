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
  sendWhatsAppDocument,
  broadcastAttendanceLinks,
  resetWhatsAppSession,
  requestPairingCode,
  handleKeepAlivePing,
  hasStoredCredentials,
} from "./server/wa-bot";
import { generateReportPdfBuffer } from "./server/pdf-generator";
import {
  uploadPdfBufferToGoogleDrive,
  refreshGoogleDriveToken,
  testGoogleDriveConnection,
} from "./server/google-drive";
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

// In Google Cloud Run (AI Studio dev container), internal nginx reverse proxy requires port 3000.
// On Railway or other cloud PaaS (detected via RAILWAY_* or process.env.PORT when not on Cloud Run K_SERVICE),
// bind to the dynamically assigned process.env.PORT.
const isAiStudioContainer = Boolean(
  process.env.K_SERVICE && !process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_PROJECT_ID
);
const PORT = isAiStudioContainer
  ? 3000
  : (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const STORAGE_DIR = process.env.STORAGE_DIR || process.env.RAILWAY_VOLUME_MOUNT_PATH || process.cwd();
const DATA_FILE = path.join(STORAGE_DIR, "data-store.json");

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

      // Ensure Deasy Annisa Syahdane is updated and workers dailyAllowance is 25000
      if (parsed.workers) {
        const deasy = parsed.workers.find((w: any) => w.id === "W03");
        if (deasy && deasy.name !== "Deasy Annisa Syahdane") {
          deasy.name = "Deasy Annisa Syahdane";
          changed = true;
        }
        parsed.workers.forEach((w: any) => {
          if (!w.dailyAllowance || w.dailyAllowance === 50000) {
            w.dailyAllowance = 25000;
            changed = true;
          }
        });
      } else {
        parsed.workers = INITIAL_WORKERS;
        changed = true;
      }

      if (!parsed.attendanceRecords) {
        parsed.attendanceRecords = [];
        changed = true;
      } else {
        parsed.attendanceRecords.forEach((r: any) => {
          if (!r.dailyAllowance || r.dailyAllowance === 50000) {
            r.dailyAllowance = 25000;
            changed = true;
          }
        });
      }
      if (!parsed.attendanceLogs) {
        parsed.attendanceLogs = [];
        changed = true;
      }
      if (!parsed.fridayReports) {
        parsed.fridayReports = [];
        changed = true;
      }
      if (parsed.lastDailyClosingAutoSaveDate === undefined) {
        parsed.lastDailyClosingAutoSaveDate = "";
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

// Dedicated QR Code Web Viewer (For Easy Scanning in Cloud / Railway Environments)
app.get("/qr", (req, res) => {
  const status = getWhatsAppStatus();
  if (status.status === "connected") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>WhatsApp Bot - Status Terhubung</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; max-width: 440px; width: 90%; border: 1px solid #334155; }
            .badge { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.25rem; border-radius: 9999px; background: rgba(16, 185, 129, 0.15); color: #34d399; font-weight: 700; font-size: 0.875rem; border: 1px solid rgba(16, 185, 129, 0.3); margin-bottom: 1.25rem; }
            h1 { font-size: 1.5rem; margin: 0 0 0.75rem; font-weight: 700; }
            p { color: #94a3b8; font-size: 0.9375rem; line-height: 1.6; margin: 0 0 1.75rem; }
            .user-info { background: #0f172a; border-radius: 0.75rem; padding: 0.875rem; margin-bottom: 1.5rem; font-size: 0.875rem; color: #cbd5e1; border: 1px solid #334155; }
            a { display: inline-block; padding: 0.75rem 1.5rem; background: #10b981; color: #022c22; text-decoration: none; border-radius: 0.75rem; font-size: 0.875rem; font-weight: 700; transition: all 0.2s; }
            a:hover { background: #34d399; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="badge">🟢 WhatsApp Terhubung</div>
            <h1>WhatsApp Bot 100% Aktif</h1>
            <p>Sesi bot WhatsApp PT. Nusantara Mineral Sukses Abadi sedang online dan siap mengirim link presensi harian otomatis.</p>
            ${status.user?.id ? `<div class="user-info">ID Akun: <strong>${status.user.id}</strong></div>` : ""}
            <a href="/">Buka Dashboard Presensi</a>
          </div>
        </body>
      </html>
    `);
    return;
  }

  if (status.qr) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`
      <!DOCTYPE html>
      <html lang="id">
        <head>
          <meta charset="utf-8">
          <title>Scan WhatsApp QR Code - NMSA</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <meta http-equiv="refresh" content="6">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
            .card { background: #1e293b; padding: 2rem; border-radius: 1.25rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); text-align: center; max-width: 440px; width: 90%; border: 1px solid #334155; }
            h1 { font-size: 1.35rem; margin: 0 0 0.5rem; font-weight: 700; }
            p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin: 0 0 1.25rem; }
            .qr-wrapper { background: white; padding: 1rem; border-radius: 1rem; display: inline-block; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); margin-bottom: 1rem; }
            img { display: block; width: 260px; height: 260px; border-radius: 0.5rem; }
            .hint { font-size: 0.75rem; color: #64748b; margin-top: 0.5rem; }
            .steps { text-align: left; background: #0f172a; border: 1px solid #334155; border-radius: 0.75rem; padding: 0.875rem 1rem; margin: 1.25rem 0; font-size: 0.8125rem; color: #cbd5e1; }
            .steps ol { margin: 0; padding-left: 1.25rem; }
            .steps li { margin: 0.25rem 0; }
            .refresh-btn { display: inline-block; padding: 0.625rem 1.25rem; background: #10b981; color: #022c22; text-decoration: none; border-radius: 0.5rem; font-size: 0.8125rem; font-weight: 700; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Pindai QR Code WhatsApp</h1>
            <p>Tautkan nomor WhatsApp pengirim bot PT. NMSA dengan memindai QR Code di bawah:</p>
            <div class="qr-wrapper">
              <img src="${status.qr}" alt="WhatsApp QR Code" />
            </div>
            <div class="steps">
              <ol>
                <li>Buka aplikasi WhatsApp di HP Anda</li>
                <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong></li>
                <li>Klik <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR ini</li>
              </ol>
            </div>
            <div class="hint">Halaman otomatis memperbarui QR setiap 6 detik</div>
          </div>
        </body>
      </html>
    `);
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`
    <!DOCTYPE html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>WhatsApp Bot - Menyiapkan QR</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="refresh" content="3">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; }
          .card { background: #1e293b; padding: 2.5rem; border-radius: 1.25rem; text-align: center; max-width: 420px; width: 90%; border: 1px solid #334155; }
          .spinner { width: 44px; height: 44px; border: 4px solid #334155; border-top-color: #10b981; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 1.25rem; }
          @keyframes spin { to { transform: rotate(360deg); } }
          h2 { font-size: 1.25rem; margin: 0 0 0.5rem; }
          p { color: #94a3b8; font-size: 0.875rem; margin: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Menyiapkan QR Code WhatsApp...</h2>
          <p>Sedang menghubungkan ke server WhatsApp. Halaman ini akan memuat otomatis dalam 3 detik.</p>
        </div>
      </body>
    </html>
  `);
});

// Direct PNG image endpoint for QR Code
app.get("/api/wa/qr.png", (req, res) => {
  const status = getWhatsAppStatus();
  if (!status.qr) {
    return res.status(404).send("QR code not ready or WhatsApp already connected");
  }
  const base64Data = status.qr.replace(/^data:image\/png;base64,/, "");
  const imgBuffer = Buffer.from(base64Data, "base64");
  res.writeHead(200, {
    "Content-Type": "image/png",
    "Content-Length": imgBuffer.length,
    "Cache-Control": "no-store, no-cache, must-revalidate",
  });
  res.end(imgBuffer);
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

// Worker Management: Add Worker
app.post("/api/workers/add", (req, res) => {
  try {
    const { id, name, role, phoneNumber, dailyAllowance } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: "Nama lengkap karyawan wajib diisi." });
    }
    const state = readState();
    if (!state.workers) state.workers = [];

    const finalId = (id && id.trim()) || `W${String(state.workers.length + 1).padStart(2, "0")}`;
    if (state.workers.some((w: any) => w.id.toLowerCase() === finalId.toLowerCase())) {
      return res.status(400).json({ success: false, error: `ID Karyawan "${finalId}" sudah digunakan.` });
    }

    const newWorker = {
      id: finalId,
      name: name.trim(),
      role: (role && role.trim()) || "Karyawan",
      phoneNumber: (phoneNumber && phoneNumber.trim()) || "",
      dailyAllowance: Number(dailyAllowance) || 25000,
      isActive: true,
      updatedAt: Date.now(),
    };

    state.workers.push(newWorker);

    // Also initialize attendance record for current week
    if (!state.attendanceRecords) state.attendanceRecords = [];
    if (!state.attendanceRecords.some((r: any) => r.workerId === finalId)) {
      state.attendanceRecords.push({
        workerId: finalId,
        attendance: {},
        dailyAllowance: newWorker.dailyAllowance,
        customStatus: {},
        reasons: {},
      });
    }

    writeState(state);
    res.json({ success: true, worker: newWorker });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Worker Management: Delete Worker
app.post("/api/workers/delete", (req, res) => {
  try {
    const { workerId } = req.body;
    if (!workerId) {
      return res.status(400).json({ success: false, error: "workerId is required" });
    }
    const state = readState();
    if (!state.workers) state.workers = [];
    state.workers = state.workers.filter((w: any) => w.id !== workerId);
    writeState(state);
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
  // Only auto-init if we have an existing authenticated session to restore, or explicitly requested
  if (req.query.init === "true" || (status.status === "disconnected" && hasStoredCredentials())) {
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

// Helper: Get or automatically refresh Google Drive access token
export async function getOrRefreshDriveAccessToken(state: any): Promise<string | null> {
  const now = Date.now();
  const isExpiringSoon =
    !state.googleDriveToken ||
    (state.googleDriveTokenExpiresAt && now >= state.googleDriveTokenExpiresAt - 300000);

  if (state.googleDriveRefreshToken && isExpiringSoon) {
    try {
      console.log("[Google Drive] Refreshing access token via refresh_token...");
      const refreshed = await refreshGoogleDriveToken(
        state.googleDriveRefreshToken,
        state.googleDriveClientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
        state.googleDriveClientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
      );
      state.googleDriveToken = refreshed.accessToken;
      state.googleDriveTokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
      writeState(state);
      console.log("[Google Drive] Token berhasil di-refresh otomatis! Berlaku hingga:", new Date(state.googleDriveTokenExpiresAt).toISOString());
      return state.googleDriveToken;
    } catch (err: any) {
      console.error("[Google Drive] Gagal auto-refresh token:", err.message);
    }
  }

  return state.googleDriveToken || null;
}

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

// Configure Google Drive credentials (permanent auto-refresh or direct token)
app.post("/api/drive/config", async (req, res) => {
  try {
    const { token, refreshToken, clientId, clientSecret } = req.body;
    const state = readState();

    if (token !== undefined) state.googleDriveToken = token;
    if (refreshToken !== undefined) state.googleDriveRefreshToken = refreshToken;
    if (clientId !== undefined) state.googleDriveClientId = clientId;
    if (clientSecret !== undefined) state.googleDriveClientSecret = clientSecret;

    let testResult: any = null;
    let activeToken = state.googleDriveToken;

    // If refreshToken provided but no active token, refresh immediately
    if (state.googleDriveRefreshToken && (!activeToken || activeToken.trim() === "")) {
      try {
        const refreshed = await refreshGoogleDriveToken(
          state.googleDriveRefreshToken,
          state.googleDriveClientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          state.googleDriveClientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
        );
        state.googleDriveToken = refreshed.accessToken;
        state.googleDriveTokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
        activeToken = refreshed.accessToken;
      } catch (refErr: any) {
        console.warn("Peringatan refresh token:", refErr.message);
      }
    }

    if (activeToken) {
      try {
        testResult = await testGoogleDriveConnection(activeToken);
        if (testResult?.userEmail) {
          state.googleDriveUserEmail = testResult.userEmail;
        }
      } catch (testErr: any) {
        console.warn("Test koneksi Drive gagal:", testErr.message);
      }
    }

    writeState(state);

    res.json({
      success: true,
      isConnected: Boolean(activeToken),
      isPermanent: Boolean(state.googleDriveRefreshToken),
      testResult,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get Google Drive connection status
app.get("/api/drive/status", (req, res) => {
  const state = readState();
  const hasToken = Boolean(state.googleDriveToken);
  const hasRefreshToken = Boolean(state.googleDriveRefreshToken);
  const resolvedClientId = state.googleDriveClientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "";
  res.json({
    isConnected: hasToken || hasRefreshToken,
    isPermanent: hasRefreshToken,
    hasToken,
    hasRefreshToken,
    clientId: resolvedClientId ? `${resolvedClientId.slice(0, 12)}...` : undefined,
    rawClientId: resolvedClientId,
    userEmail: state.googleDriveUserEmail,
    expiresAt: state.googleDriveTokenExpiresAt,
  });
});

// Test live Google Drive connection
app.post("/api/drive/test-connection", async (req, res) => {
  try {
    const state = readState();
    const token = await getOrRefreshDriveAccessToken(state);
    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Belum ada token Google Drive yang tersimpan. Hubungkan Google Drive terlebih dahulu.",
      });
    }
    const result = await testGoogleDriveConnection(token);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a report from fridayReports
app.post("/api/friday/delete-report", (req, res) => {
  try {
    const { reportId } = req.body;
    if (!reportId) {
      return res.status(400).json({ success: false, error: "reportId diperlukan" });
    }
    const state = readState();
    const beforeCount = (state.fridayReports || []).length;
    state.fridayReports = (state.fridayReports || []).filter((r: any) => r.id !== reportId);
    writeState(state);
    res.json({
      success: true,
      deletedCount: beforeCount - state.fridayReports.length,
      fridayReports: state.fridayReports,
    });
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

// ==================== DAILY CLOSING AUTO-SAVE & FRIDAY ADMIN BOT DISPATCH ====================

interface ClosingAutoSaveResult {
  success: boolean;
  report: any;
  driveUrl?: string;
  driveUploadSuccess: boolean;
  fileName: string;
  pdfBufferLength: number;
  sentToAdminWa: boolean;
  adminPhone?: string;
  error?: string;
}

export async function executeDailyWorkdayClosingAutoSave(forcedDate?: string): Promise<ClosingAutoSaveResult> {
  const todayDate = forcedDate || getJakartaDateStr();
  const { weekday } = getJakartaTimeDetails();
  const state = readState();

  // Consistent 1-week period: Monday to Friday
  const mondayDate = getMondayDateStr(todayDate);
  const mParts = mondayDate.split("-").map(Number);
  const fridayObj = new Date(Date.UTC(mParts[0], mParts[1] - 1, mParts[2] + 4, 12, 0, 0));
  const fridayDate = fridayObj.toISOString().slice(0, 10);
  const yStr = fridayObj.getUTCFullYear();
  const monthIndex = fridayObj.getUTCMonth();
  const monthNameIndo = `${INDONESIAN_MONTHS[monthIndex]} ${yStr}`;
  const periodName = `Periode ${mondayDate.slice(8, 10)}-${fridayDate.slice(8, 10)} ${monthNameIndo}`;

  // Report ID is uniform for the entire week: Monday to Friday
  const reportId = `REP-${mondayDate}-${fridayDate}`;
  const validRecords = (state.attendanceRecords || []).map((r: any) => ({
    ...r,
    dailyAllowance: r.dailyAllowance || 25000,
  }));

  const totalCost = validRecords.reduce((sum: number, r: any) => {
    const presentDays = Object.keys(r.attendance || {}).filter(
      (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
    ).length;
    return sum + presentDays * (r.dailyAllowance || 25000);
  }, 0);

  const totalPresent = validRecords.reduce((sum: number, r: any) => {
    const presentDays = Object.keys(r.attendance || {}).filter(
      (k) => r.attendance[k] && (!r.customStatus || !r.customStatus[k] || r.customStatus[k] === "Hadir")
    ).length;
    return sum + presentDays;
  }, 0);

  const fileName = `Laporan_Absensi_NMSA_${periodName.replace(/\s+/g, "_")}.pdf`;

  const reportObj: any = {
    id: reportId,
    weekStartDate: mondayDate,
    weekEndDate: fridayDate,
    periodName,
    monthName: monthNameIndo,
    records: validRecords,
    isSubmitted: true,
    submittedAt: new Date().toISOString(),
    autoSavedAt: `${todayDate} 17:00 WIB (Otomatis Jam Pulang Kerja NMSA)`,
    totalCost,
    totalPresent,
  };

  // 1. Generate PDF buffer on server
  let pdfBuffer: Buffer;
  try {
    pdfBuffer = generateReportPdfBuffer(reportObj, state.workers || INITIAL_WORKERS);
  } catch (err: any) {
    console.error("[PDF Generator] Gagal generate PDF:", err);
    throw new Error(`Gagal membuat PDF: ${err.message}`);
  }

  // 2. Upload/Update to Google Drive (Anti-duplicate: Updates 1 file per period)
  let driveUploadSuccess = false;
  let driveUrl = "";
  const driveAccessToken = await getOrRefreshDriveAccessToken(state);

  if (driveAccessToken) {
    try {
      console.log(`[Google Drive] Memeriksa & mengupdate PDF absensi ke folder (absen > ${monthNameIndo} > ${periodName})...`);
      let uploadResult;
      try {
        uploadResult = await uploadPdfBufferToGoogleDrive(
          driveAccessToken,
          monthNameIndo,
          periodName,
          fileName,
          pdfBuffer
        );
      } catch (uploadErr: any) {
        // If 401 Unauthorized, auto-refresh token and retry upload once
        if (state.googleDriveRefreshToken && (uploadErr.message?.includes("401") || uploadErr.message?.includes("UNAUTHENTICATED"))) {
          console.log("[Google Drive] Mendeteksi token expired (401), melakukan auto-refresh token & retry...");
          const refreshed = await refreshGoogleDriveToken(
            state.googleDriveRefreshToken,
            state.googleDriveClientId || process.env.GOOGLE_DRIVE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
            state.googleDriveClientSecret || process.env.GOOGLE_DRIVE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
          );
          state.googleDriveToken = refreshed.accessToken;
          state.googleDriveTokenExpiresAt = Date.now() + refreshed.expiresIn * 1000;
          writeState(state);

          uploadResult = await uploadPdfBufferToGoogleDrive(
            refreshed.accessToken,
            monthNameIndo,
            periodName,
            fileName,
            pdfBuffer
          );
        } else {
          throw uploadErr;
        }
      }

      driveUploadSuccess = true;
      driveUrl = uploadResult.driveUrl;
      reportObj.driveUrl = driveUrl;
      reportObj.driveFileId = uploadResult.fileId;
      reportObj.pdfDriveUrl = driveUrl;
      console.log(`[Google Drive] Sukses ${uploadResult.isUpdated ? "mengupdate" : "mengunggah"} PDF ke Drive: ${driveUrl}`);
    } catch (err: any) {
      console.error(`[Google Drive] Gagal upload ke Drive:`, err.message || err);
    }
  } else {
    console.log(`[Google Drive] Catatan: Token Google Drive belum terhubung; PDF disimpan di arsip laporan server.`);
  }

  // Save report into state
  if (!state.fridayReports) state.fridayReports = [];
  const existingIdx = state.fridayReports.findIndex((r: any) => r.id === reportId);
  if (existingIdx >= 0) {
    state.fridayReports[existingIdx] = { ...state.fridayReports[existingIdx], ...reportObj };
  } else {
    state.fridayReports.unshift(reportObj);
  }

  state.lastDailyClosingAutoSaveDate = todayDate;
  if (weekday === "Fri") {
    state.lastFridayAutoSaveDate = todayDate;
  }

  // 3. Log into Attendance Logs
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
    address: `Server Auto-Save Jam Pulang Kerja`,
    status: "BERHASIL",
    notes: `Laporan Absensi PDF berhasil disimpan otomatis pada jam pulang kerja${
      driveUploadSuccess ? ` ke Google Drive: ${driveUrl}` : " (Tersimpan di arsip server)"
    }`,
  });

  // 4. Send document to Admin WhatsApp if Friday (or if explicitly triggered)
  let sentToAdminWa = false;
  const adminPhone = state.registeredAdminPhone || state.botDispatchSettings?.adminPhone;

  if (adminPhone) {
    const caption = [
      `📄 *LAPORAN PRESENSI & UANG MAKAN PT. NMSA*`,
      `🏢 *PT. Nusantara Mineral Sukses Abadi*`,
      `📅 *Periode:* ${periodName}`,
      `👥 *Total Karyawan:* ${validRecords.length} orang`,
      `✅ *Total Kehadiran:* ${totalPresent} hari kerja`,
      `💰 *Total Uang Makan:* Rp ${totalCost.toLocaleString("id-ID")} (Rp 25.000 /hari)`,
      ``,
      driveUrl
        ? `🔗 *Link Google Drive:*\n${driveUrl}`
        : `📁 *Folder:* absen > ${monthNameIndo} > ${periodName}`,
      ``,
      `📌 *Catatan:* Berkas dokumen PDF absensi resmi terlampir di atas dan otomatis diarsipkan ke Google Drive pada jam pulang kerja.`,
    ].join("\n");

    try {
      sentToAdminWa = await sendWhatsAppDocument(adminPhone, pdfBuffer, fileName, caption);
      console.log(`[WA-Bot Admin Dispatch] Mengirim PDF ke nomor admin (${adminPhone}): ${sentToAdminWa ? "BERHASIL" : "GAGAL"}`);

      if (!state.botMessageLogs) state.botMessageLogs = [];
      state.botMessageLogs.unshift({
        id: `BOT-DOC-${Date.now()}`,
        timestamp: new Date().toISOString(),
        targetPhone: adminPhone,
        targetName: "Admin PT. NMSA",
        messageText: caption,
        status: sentToAdminWa ? "sent" : "failed",
        style: "friday_weekly_report",
      });
    } catch (waErr: any) {
      console.error("[WA-Bot Admin Dispatch] Gagal kirim dokumen WA:", waErr.message || waErr);
    }
  } else {
    console.log(`[WA-Bot Admin Dispatch] Nomor admin WhatsApp belum terdaftar di aplikasi.`);
  }

  writeState(state);

  return {
    success: true,
    report: reportObj,
    driveUrl: driveUrl || undefined,
    driveUploadSuccess,
    fileName,
    pdfBufferLength: pdfBuffer.length,
    sentToAdminWa,
    adminPhone,
  };
}

// Endpoint: Manual trigger of Daily Workday Closing Auto-Save
app.post("/api/daily/trigger-closing-autosave", async (req, res) => {
  try {
    const result = await executeDailyWorkdayClosingAutoSave(req.body?.targetDate);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint: Trigger Friday Report sending to WhatsApp Admin
app.post("/api/friday/send-to-wa-admin", async (req, res) => {
  try {
    const result = await executeDailyWorkdayClosingAutoSave(req.body?.targetDate);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== BACKGROUND CRON: DAILY CLOSING (17:00 WIB) ====================
async function runDailyClosingAutoSaveCheck() {
  try {
    const { weekday, hour } = getJakartaTimeDetails();
    const todayDate = getJakartaDateStr();
    const state = readState();

    const workDays = state.botDispatchSettings?.workDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
    const { dayName } = getJakartaDayOfWeek();
    const isWorkDay = workDays.includes(dayName);

    // Closing time: 17:00 WIB (hour >= 17) on workdays
    if (isWorkDay && hour >= 17) {
      if (state.lastDailyClosingAutoSaveDate !== todayDate) {
        console.log(`[Closing Auto-Save] Jam pulang kerja 17:00 WIB tercapai untuk ${dayName}, ${todayDate}! Memulai auto-save PDF absensi...`);
        await executeDailyWorkdayClosingAutoSave(todayDate);
      }
    }
  } catch (err) {
    console.error("Error in daily closing auto-save cron check:", err);
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
setInterval(runDailyClosingAutoSaveCheck, 60000);
setInterval(runMorningBotDispatchCheck, 60000);

// ==================== VITE & PRODUCTION SERVER ====================
async function start() {
  // Ensure state exists
  readState();

  // Initialize WhatsApp Baileys in background
  initWhatsApp().catch((err) => console.log("Initial WA init:", err.message));

  // Check production build: either NODE_ENV=production or dist/index.html exists
  const isProduction =
    process.env.NODE_ENV === "production" ||
    fs.existsSync(path.join(process.cwd(), "dist", "index.html"));

  if (!isProduction) {
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
    console.log(`Open app in browser: http://0.0.0.0:${PORT}`);
    console.log(`Scan WhatsApp QR in browser: http://0.0.0.0:${PORT}/qr`);
  });
}

start();
