import * as baileys from "@whiskeysockets/baileys";
import pino from "pino";
import path from "path";
import fs from "fs";
import QRCode from "qrcode";
import { processAiAttendanceQuery } from "./ai-assistant";
import {
  generateHumanDailyMessage,
  generateAiPersonalizedMessage,
  getJakartaDayOfWeek,
} from "./humanized-messages";
import { checkDayStatus } from "./holidays";

// Baileys import resolver
const getBaileysModule = () => {
  if (!baileys) return {} as any;
  return baileys;
};

const getMakeWASocket = () => {
  const pkg = getBaileysModule();
  if (typeof pkg.makeWASocket === "function") return pkg.makeWASocket;
  if (pkg.default && typeof pkg.default.makeWASocket === "function") return pkg.default.makeWASocket;
  if (pkg.default && typeof pkg.default.default === "function") return pkg.default.default;
  if (typeof pkg.default === "function") return pkg.default;
  return (pkg as any).makeWASocket || (pkg as any).default;
};

const getUseMultiFileAuthState = () => {
  const pkg = getBaileysModule();
  if (typeof pkg.useMultiFileAuthState === "function") return pkg.useMultiFileAuthState;
  if (pkg.default && typeof pkg.default.useMultiFileAuthState === "function") return pkg.default.useMultiFileAuthState;
  return (pkg as any).useMultiFileAuthState;
};

const getDisconnectReason = () => {
  const pkg = getBaileysModule();
  if (pkg.DisconnectReason) return pkg.DisconnectReason;
  if (pkg.default && pkg.default.DisconnectReason) return pkg.default.DisconnectReason;
  return (pkg as any).DisconnectReason || {};
};

const getBrowsers = () => {
  const pkg = getBaileysModule();
  if (pkg.Browsers) return pkg.Browsers;
  if (pkg.default && pkg.default.Browsers) return pkg.default.Browsers;
  return (pkg as any).Browsers;
};

const makeWASocket = getMakeWASocket();
const useMultiFileAuthState = getUseMultiFileAuthState();
const DisconnectReason = getDisconnectReason();
const Browsers = getBrowsers();

const AUTH_DIR = path.join(process.cwd(), "auth_info_baileys");
const BACKUP_CREDS_FILE = path.join(process.cwd(), "auth_backup_creds.json");
const DATA_FILE = path.join(process.cwd(), "data-store.json");

// Bot global state
let sock: any = null;
let connectionStatus: "disconnected" | "connecting" | "connected" | "qr" = "disconnected";
let qrCodeDataUrl: string | null = null;
let rawQrString: string | null = null;
let qrTimestamp: number | null = null;
let connectedUser: { id: string; name?: string } | null = null;
let lastError: string | null = null;
let isInitializing = false;

// Anti-disconnect & Keep-Alive tracking
let keepAlivePingsCount = 0;
let lastExternalPingTime: string | null = null;
const serverStartTime = Date.now();

export function hasStoredCredentials(): boolean {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (fs.existsSync(credsPath)) return true;
    if (fs.existsSync(BACKUP_CREDS_FILE)) return true;
    return false;
  } catch {
    return false;
  }
}

export function restoreCredsFromBackupIfNeeded() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (!fs.existsSync(credsPath) && fs.existsSync(BACKUP_CREDS_FILE)) {
      if (!fs.existsSync(AUTH_DIR)) {
        fs.mkdirSync(AUTH_DIR, { recursive: true });
      }
      fs.copyFileSync(BACKUP_CREDS_FILE, credsPath);
      console.log("[Auth-Shield] Pulihkan sesi kredensial WhatsApp dari backup permanen.");
    }
  } catch (err: any) {
    console.error("[Auth-Shield] Gagal restore kredensial dari backup:", err.message);
  }
}

export function backupCreds() {
  try {
    const credsPath = path.join(AUTH_DIR, "creds.json");
    if (fs.existsSync(credsPath)) {
      fs.copyFileSync(credsPath, BACKUP_CREDS_FILE);
    }
  } catch (err: any) {
    console.error("[Auth-Shield] Gagal backup creds.json:", err.message);
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / (3600 * 24));
  const hours = Math.floor((seconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days} hari ${hours} jam ${minutes} menit`;
  if (hours > 0) return `${hours} jam ${minutes} menit ${secs} dtk`;
  return `${minutes} menit ${secs} detik`;
}

// Active Watchdog Heartbeat: runs every 25 seconds
setInterval(async () => {
  try {
    if (sock && connectionStatus === "connected") {
      // Periodic presence ping keeps WhatsApp WebSocket active so servers never time it out
      await sock.sendPresenceUpdate("available");
    } else if (hasStoredCredentials() && connectionStatus !== "connecting") {
      console.log("[Watchdog] Sesi tersimpan ditemukan tetapi socket belum aktif. Menghubungkan ulang...");
      await initWhatsApp();
    }
  } catch {}
}, 25000);

export async function handleKeepAlivePing(origin?: string) {
  keepAlivePingsCount++;
  lastExternalPingTime = new Date().toISOString();

  // If socket is disconnected but we have stored credentials, ensure immediate auto-reconnect
  if (hasStoredCredentials() && connectionStatus === "disconnected") {
    initWhatsApp().catch(() => {});
  }

  // Active ping to WhatsApp if connected
  if (sock && connectionStatus === "connected") {
    try {
      await sock.sendPresenceUpdate("available");
    } catch {}
  }

  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);

  return {
    status: "ok",
    keepAlive: "active",
    waStatus: connectionStatus,
    connectedUser: connectedUser?.name || connectedUser?.id || (connectionStatus === "connected" ? "WhatsApp Web Aktif" : null),
    hasPermanentSession: hasStoredCredentials(),
    totalPingsReceived: keepAlivePingsCount,
    lastPingAt: lastExternalPingTime,
    uptimeSeconds: uptimeSec,
    uptimeFormatted: formatUptime(uptimeSec),
    serverTimeJakarta: new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" }),
    message: connectionStatus === "connected"
      ? "WhatsApp Web 100% Online & Terhubung Permanen. Sesi aktif 24/7."
      : hasStoredCredentials()
      ? "Sesi WhatsApp tersimpan permanen. Sedang memulihkan koneksi otomatis..."
      : "Menunggu pemindaian QR code untuk pertama kali.",
  };
}

export function formatToWaJid(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.slice(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  if (!cleaned.endsWith("@s.whatsapp.net")) {
    return cleaned + "@s.whatsapp.net";
  }
  return cleaned;
}

export function getWhatsAppStatus() {
  let registeredAdmin = "";
  let botSettings = null;
  let botMessageLogs = [];
  let holidays = [];
  let featureRequests = [];
  let todayHolidayStatus = null;

  try {
    if (fs.existsSync(DATA_FILE)) {
      const state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      registeredAdmin = state.registeredAdminPhone || "";
      botSettings = state.botDispatchSettings || null;
      botMessageLogs = (state.botMessageLogs || []).slice(0, 50);
      holidays = state.holidays || [];
      featureRequests = state.featureRequests || [];

      const dayCheck = checkDayStatus(
        undefined,
        holidays,
        botSettings?.workDays || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
      );
      todayHolidayStatus = {
        date: dayCheck.date,
        dayName: dayCheck.dayName,
        isWeekend: dayCheck.isWeekend,
        isSaturday: dayCheck.isSaturday,
        isSunday: dayCheck.isSunday,
        isHoliday: dayCheck.isHoliday,
        isSuddenGovernmentHoliday: dayCheck.isSuddenGovernmentHoliday,
        holidayName: dayCheck.holiday?.name,
        canSendAttendance: dayCheck.canSendAttendance,
        reason: dayCheck.reason,
      };
    }
  } catch {}

  const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);

  return {
    status: connectionStatus,
    qr: qrCodeDataUrl,
    rawQr: rawQrString,
    qrTimestamp,
    user: connectedUser,
    error: lastError,
    registeredAdminPhone: registeredAdmin,
    botDispatchSettings: botSettings,
    recentLogs: botMessageLogs,
    holidays,
    featureRequests,
    todayHolidayStatus,
    keepAliveMetrics: {
      uptimeSeconds: uptimeSec,
      uptimeFormatted: formatUptime(uptimeSec),
      totalPings: keepAlivePingsCount,
      lastPingTime: lastExternalPingTime || "Belum ada ping eksternal",
      sessionPersisted: hasStoredCredentials(),
      autoReconnectActive: true,
      isAlwaysOn: connectionStatus === "connected",
    },
  };
}

export function cleanupAuthFolder() {
  try {
    if (fs.existsSync(AUTH_DIR)) {
      fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    }
    if (fs.existsSync(BACKUP_CREDS_FILE)) {
      fs.rmSync(BACKUP_CREDS_FILE, { force: true });
    }
  } catch (err) {
    console.error("Error cleaning auth folder:", err);
  }
}

export async function disconnectWhatsApp() {
  try {
    if (sock) {
      try {
        sock.end(undefined);
      } catch {}
      sock = null;
    }
    connectionStatus = "disconnected";
    qrCodeDataUrl = null;
    rawQrString = null;
    qrTimestamp = null;
    connectedUser = null;
    cleanupAuthFolder();
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export async function resetWhatsAppSession() {
  console.log("Resetting WhatsApp Baileys session and auth state...");
  await disconnectWhatsApp();
  cleanupAuthFolder();
  return await initWhatsApp(true);
}

export async function requestPairingCode(phoneNumber: string): Promise<{ success: boolean; code?: string; error?: string }> {
  try {
    if (!sock) {
      await initWhatsApp();
    }
    if (!sock) {
      throw new Error("Socket WhatsApp belum siap.");
    }
    if (connectionStatus === "connected") {
      throw new Error("WhatsApp sudah terhubung.");
    }

    let cleaned = phoneNumber.replace(/[^0-9]/g, "");
    if (cleaned.startsWith("0")) cleaned = "62" + cleaned.slice(1);
    else if (cleaned.startsWith("8")) cleaned = "62" + cleaned;

    if (sock.authState?.creds?.registered) {
      throw new Error("Akun sudah terdaftar. Silakan reset sesi untuk memasangkan nomor baru.");
    }

    const code = await sock.requestPairingCode(cleaned);
    return { success: true, code };
  } catch (err: any) {
    console.error("Failed to request pairing code:", err);
    return { success: false, error: err.message || "Gagal membuat kode tautan" };
  }
}

export async function sendWhatsAppMessage(toPhone: string, text: string): Promise<boolean> {
  if (!sock || connectionStatus !== "connected") {
    console.warn("WhatsApp socket not connected, cannot send message to:", toPhone);
    return false;
  }
  try {
    const jid = formatToWaJid(toPhone);
    await sock.sendMessage(jid, { text });
    return true;
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err);
    return false;
  }
}

export interface BroadcastOptions {
  appUrl: string;
  targetWorkerIds?: string[];
  style?: "human_dynamic" | "ai_generative" | "formal" | "friendly";
  isAutoScheduled?: boolean;
}

export async function broadcastAttendanceLinks(options: BroadcastOptions): Promise<{ count: number; logs: any[] }> {
  const { appUrl, targetWorkerIds, style = "human_dynamic", isAutoScheduled = false } = options;

  if (!sock || connectionStatus !== "connected") {
    return { count: 0, logs: [] };
  }

  let state: any = {};
  try {
    state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return { count: 0, logs: [] };
  }

  const workers = state.workers || [];
  let sentCount = 0;
  const newLogs: any[] = [];
  const { dayName } = getJakartaDayOfWeek();
  const todayDate = new Date().toISOString().split("T")[0];
  const timeNowStr = new Date().toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  for (let i = 0; i < workers.length; i++) {
    const worker = workers[i];
    if (!worker.phoneNumber || !worker.isActive) continue;
    if (targetWorkerIds && !targetWorkerIds.includes(worker.id)) continue;

    const attendUrl = `${appUrl.replace(/\/$/, "")}/?worker=${worker.id}`;

    // Generate humanized varied message tailored to today and worker
    let messageText = "";
    if (style === "ai_generative") {
      messageText = await generateAiPersonalizedMessage(worker.name, worker.role || "Karyawan", attendUrl);
    } else {
      messageText = generateHumanDailyMessage({
        workerName: worker.name,
        role: worker.role,
        attendUrl,
        style,
        variationIndex: i, // Ensure varied template per worker even on same day!
      });
    }

    const jid = formatToWaJid(worker.phoneNumber);

    try {
      // Simulate realistic human typing delay (2.5s - 5s)
      try {
        await sock.sendPresenceUpdate("composing", jid);
      } catch {}

      const typingDelay = Math.floor(Math.random() * 2500) + 2500;
      await new Promise((r) => setTimeout(r, typingDelay));

      await sock.sendMessage(jid, { text: messageText });
      sentCount++;

      const logItem = {
        id: `LOG-MSG-${Date.now()}-${worker.id}`,
        timestamp: new Date().toISOString(),
        date: todayDate,
        time: `${timeNowStr} WIB`,
        workerId: worker.id,
        workerName: worker.name,
        phoneNumber: worker.phoneNumber,
        messageText,
        status: "sent",
        dayOfWeek: dayName,
        isAutoScheduled,
      };
      newLogs.push(logItem);
    } catch (err: any) {
      console.error(`Failed to send message to ${worker.name}:`, err);
      newLogs.push({
        id: `LOG-MSG-${Date.now()}-${worker.id}`,
        timestamp: new Date().toISOString(),
        date: todayDate,
        time: `${timeNowStr} WIB`,
        workerId: worker.id,
        workerName: worker.name,
        phoneNumber: worker.phoneNumber,
        messageText,
        status: "failed",
        error: err.message,
        dayOfWeek: dayName,
        isAutoScheduled,
      });
    }
  }

  // Persist logs in state
  if (!state.botMessageLogs) state.botMessageLogs = [];
  state.botMessageLogs.unshift(...newLogs);
  if (state.botMessageLogs.length > 200) {
    state.botMessageLogs = state.botMessageLogs.slice(0, 200);
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");

  return { count: sentCount, logs: newLogs };
}

export async function initWhatsApp(forceNew = false) {
  if (isInitializing && !forceNew) {
    return sock;
  }

  try {
    if (!forceNew && connectionStatus === "connected" && sock) {
      return sock;
    }

    isInitializing = true;
    connectionStatus = "connecting";
    lastError = null;

    if (forceNew && sock) {
      try {
        sock.end(undefined);
      } catch {}
      sock = null;
    }

    restoreCredsFromBackupIfNeeded();

    if (typeof useMultiFileAuthState !== "function" || typeof makeWASocket !== "function") {
      throw new Error("Baileys functions not available");
    }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }) as any,
      browser: Browsers ? Browsers.macOS("Chrome") : ["Mac OS", "Chrome", "14.4.1"],
      connectTimeoutMs: 90000,
      defaultQueryTimeoutMs: 90000,
      keepAliveIntervalMs: 15000,
      markOnlineOnConnect: true,
      syncFullHistory: false,
    });

    sock.ev.on("creds.update", () => {
      saveCreds();
      backupCreds();
    });

    sock.ev.on("messages.upsert", async (m: any) => {
      try {
        if (m.type !== "notify") return;

        for (const msg of m.messages) {
          const senderJid = msg.key.remoteJid;
          if (!senderJid) continue;

          // Check if message is from admin (either message to self or registered admin phone)
          let state: any = {};
          try {
            if (fs.existsSync(DATA_FILE)) {
              state = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
            }
          } catch (e) {
            console.error("Error reading data store in WA bot:", e);
          }

          const normalizePhone = (p: string) => p.replace(/[^0-9]/g, "");
          const senderPhone = senderJid.split("@")[0] || "";
          const cleanSenderPhone = normalizePhone(senderPhone);

          const registeredAdmin = normalizePhone(state.registeredAdminPhone || "");
          const connectedPhone = normalizePhone(connectedUser?.id ? connectedUser.id.split(":")[0].split("@")[0] : "");
          const isSelfMessage = Boolean(msg.key.fromMe);
          const isAdminSender =
            isSelfMessage ||
            (registeredAdmin && cleanSenderPhone.endsWith(registeredAdmin.slice(-9))) ||
            (connectedPhone && cleanSenderPhone.endsWith(connectedPhone.slice(-9))) ||
            (!registeredAdmin);

          const messageText = (
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            ""
          ).trim();

          const isLocation = Boolean(msg.message?.locationMessage);

          // === 1. ADMIN QUERY TO AI ASSISTANT (INCLUDING SELF-MESSAGE) ===
          if (isAdminSender && messageText) {
            console.log("Admin WhatsApp Query received:", messageText);
            try {
              const aiResult = await processAiAttendanceQuery(messageText, cleanSenderPhone, true);
              if (aiResult.replyText) {
                // If message to self (fromMe), reply to senderJid or self JID
                await sock.sendMessage(senderJid, { text: aiResult.replyText });
              }
            } catch (aiErr) {
              console.error("Error running AI query for admin:", aiErr);
              await sock.sendMessage(senderJid, {
                text: "⚠️ Terjadi kendala saat memproses permintaan AI. Silakan coba kembali sesaat lagi.",
              });
            }
            continue;
          }

          // === 2. WORKER INTERACTION ===
          const workers = state.workers || [];
          const matchedWorker = workers.find((w: any) => {
            if (!w.phoneNumber) return false;
            let wp = normalizePhone(w.phoneNumber);
            if (wp.startsWith("0")) wp = "62" + wp.slice(1);
            if (wp.startsWith("8")) wp = "62" + wp;
            return wp === cleanSenderPhone && w.isActive;
          });

          if (!matchedWorker) {
            // Unregistered contact
            continue;
          }

          const todayDate = new Date().toISOString().split("T")[0];
          const workerName = matchedWorker.name;
          const workerId = matchedWorker.id;

          const officeLoc = state.officeLocation || {
            latitude: -6.244342,
            longitude: 106.843073,
            radiusMeters: 150,
          };

          if (isLocation) {
            const location = msg.message.locationMessage;
            const lat = location.degreesLatitude;
            const lon = location.degreesLongitude;

            // Haversine formula
            const R = 6371e3;
            const phi1 = (lat * Math.PI) / 180;
            const phi2 = (officeLoc.latitude * Math.PI) / 180;
            const deltaPhi = ((officeLoc.latitude - lat) * Math.PI) / 180;
            const deltaLambda = ((officeLoc.longitude - lon) * Math.PI) / 180;
            const a =
              Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            if (distance <= officeLoc.radiusMeters) {
              // Within office range: record Hadir!
              let records = state.attendanceRecords || [];
              let record = records.find((r: any) => r.workerId === workerId);
              if (!record) {
                record = {
                  workerId,
                  attendance: {},
                  dailyAllowance: matchedWorker.dailyAllowance || 50000,
                  customStatus: {},
                  reasons: {},
                };
                records.push(record);
              }
              if (!record.attendance) record.attendance = {};
              record.attendance[todayDate] = true;
              if (record.customStatus) delete record.customStatus[todayDate];
              if (record.reasons) delete record.reasons[todayDate];

              const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              if (!state.attendanceLogs) state.attendanceLogs = [];
              state.attendanceLogs.unshift({
                id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                workerId,
                workerName,
                date: todayDate,
                time: nowStr,
                latitude: lat,
                longitude: lon,
                distance: Math.round(distance),
                address: "Lokasi Kantor NMSA (via WhatsApp Share Location)",
                status: "Hadir",
                notes: `Terverifikasi dalam radius ${Math.round(distance)}m`,
              });

              state.attendanceRecords = records;
              fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");

              const responseText = `✅ *Presensi Hadir Diterima!* 🎉\n` +
                `Halo *${workerName}*, presensi kehadiran (Hadir) Anda hari ini tanggal *${todayDate}* berhasil dicatat.\n\n` +
                `📍 Lokasi Anda terverifikasi di area kantor (jarak: *${Math.round(distance)}* m dari kantor).\n` +
                `Selamat bekerja! 💼`;
              await sock.sendMessage(senderJid, { text: responseText });
            } else {
              // Outside range: offer options
              const responseText = `⚠️ *Di Luar Jangkauan Kantor!*\n` +
                `Halo *${workerName}*, lokasi Anda terdeteksi berada di luar jangkauan kantor (jarak: *${Math.round(distance)}* m, batas: *${officeLoc.radiusMeters}* m).\n\n` +
                `Silakan pilih status ketidakhadiran Anda hari ini dengan membalas pesan ini:\n` +
                `1️⃣ *Sakit* (Ketik: *Sakit*)\n` +
                `2️⃣ *Izin* (Ketik: *Izin*)\n` +
                `3️⃣ *Meeting* (Ketik: *Meeting*)\n` +
                `4️⃣ *Cuti* (Ketik: *Cuti*)\n` +
                `5️⃣ *Alpa* (Ketik: *Alpa*)`;
              await sock.sendMessage(senderJid, { text: responseText });
            }
          } else if (messageText) {
            const cleanMsg = messageText.toLowerCase().trim();
            let selectedStatus: string | null = null;
            if (cleanMsg === "1" || cleanMsg.includes("sakit")) selectedStatus = "Sakit";
            else if (cleanMsg === "2" || cleanMsg.includes("izin")) selectedStatus = "Izin";
            else if (cleanMsg === "3" || cleanMsg.includes("meeting")) selectedStatus = "Meeting";
            else if (cleanMsg === "4" || cleanMsg.includes("cuti")) selectedStatus = "Cuti";
            else if (cleanMsg === "5" || cleanMsg.includes("alpa") || cleanMsg.includes("absen")) selectedStatus = "Alpa";

            if (selectedStatus) {
              let records = state.attendanceRecords || [];
              let record = records.find((r: any) => r.workerId === workerId);
              if (!record) {
                record = {
                  workerId,
                  attendance: {},
                  dailyAllowance: matchedWorker.dailyAllowance || 50000,
                  customStatus: {},
                  reasons: {},
                };
                records.push(record);
              }
              if (!record.attendance) record.attendance = {};
              if (!record.customStatus) record.customStatus = {};
              if (!record.reasons) record.reasons = {};

              record.attendance[todayDate] = false;
              record.customStatus[todayDate] = selectedStatus;
              record.reasons[todayDate] = "Dipilih via balasan WhatsApp";

              const nowStr = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              if (!state.attendanceLogs) state.attendanceLogs = [];
              state.attendanceLogs.unshift({
                id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                workerId,
                workerName,
                date: todayDate,
                time: nowStr,
                latitude: 0,
                longitude: 0,
                distance: 0,
                address: `Status ${selectedStatus} via WhatsApp`,
                status: selectedStatus as any,
                notes: "Balasan chat WhatsApp",
              });

              state.attendanceRecords = records;
              fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2), "utf-8");

              await sock.sendMessage(senderJid, {
                text: `✅ *Status Presensi Dicatat!*\nHalo *${workerName}*, status presensi Anda hari ini telah dicatat sebagai *${selectedStatus}*.\n\nJika ingin memperbarui, Anda dapat membagikan Live Location Anda saat sudah di kantor.`,
              });
            } else {
              // Helpful response or AI assistant response
              const aiResult = await processAiAttendanceQuery(messageText, cleanSenderPhone, false);
              await sock.sendMessage(senderJid, { text: aiResult.replyText });
            }
          }
        }
      } catch (err) {
        console.error("Error processing WA bot message:", err);
      }
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        connectionStatus = "qr";
        rawQrString = qr;
        qrTimestamp = Date.now();
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { margin: 2, scale: 8 });
          console.log("WhatsApp QR Code generated successfully at", new Date().toLocaleTimeString());
        } catch (err) {
          console.error("Failed to generate QR data URL:", err);
          qrCodeDataUrl = null;
        }
      }

      if (connection === "open") {
        connectionStatus = "connected";
        qrCodeDataUrl = null;
        rawQrString = null;
        qrTimestamp = null;
        const user = sock?.user;
        connectedUser = user ? { id: user.id, name: user.name || "Admin WhatsApp PT. NMSA" } : { id: "admin" };
        console.log("WhatsApp connection open for:", connectedUser);
      }

      if (connection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        console.log(`[WA-Socket] WhatsApp connection closed (Status ${statusCode}). Error:`, lastDisconnect?.error?.message || lastDisconnect?.error);

        connectedUser = null;
        qrCodeDataUrl = null;
        rawQrString = null;
        qrTimestamp = null;

        const isRestartRequired = statusCode === 515;
        const isExplicitLogout = statusCode === DisconnectReason.loggedOut;

        if (isRestartRequired) {
          console.log("[WA-Socket] Status 515 (Restart Required). Reconnecting in 1.5s with preserved session...");
          connectionStatus = "connecting";
          setTimeout(() => initWhatsApp(), 1500);
        } else if (isExplicitLogout) {
          console.warn("[WA-Socket] Sesi WhatsApp telah dicabut dari aplikasi WhatsApp HP.");
          connectionStatus = "disconnected";
          lastError = "Perangkat ditautkan telah dicabut dari aplikasi WhatsApp HP. Silakan scan QR code baru.";
          cleanupAuthFolder();
        } else if (hasStoredCredentials()) {
          console.log(`[WA-Socket] Auto-reconnecting in 3s (Status: ${statusCode}). Preserving session!`);
          connectionStatus = "connecting";
          setTimeout(() => initWhatsApp(), 3000);
        } else {
          connectionStatus = "disconnected";
          setTimeout(() => initWhatsApp(), 5000);
        }
      }
    });

    isInitializing = false;
    return sock;
  } catch (err: any) {
    isInitializing = false;
    console.error("Failed to init WhatsApp:", err);
    connectionStatus = "disconnected";
    lastError = err.message || "Failed to initialize WhatsApp bot";
    return null;
  }
}
