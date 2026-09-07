import React, { useState, useEffect, useRef } from "react";
import {
  Bot,
  QrCode,
  CheckCircle2,
  RefreshCw,
  Send,
  Sparkles,
  Phone,
  Share2,
  Users,
  LogOut,
  Clock,
  Check,
  Calendar,
  Settings,
  Sliders,
  FileText,
  KeyRound,
  AlertCircle,
  HelpCircle,
  Eye,
  ShieldCheck,
  Volume2,
  MessageCircle,
  ChevronRight,
  UserCheck,
  Activity,
  Radio,
} from "lucide-react";
import { Worker, WhatsAppStatus, BotDispatchSettings, BotMessageLog } from "../types";
import { HolidaysScheduleTab } from "./HolidaysScheduleTab";
import { FeatureRequestsTab } from "./FeatureRequestsTab";
import { UptimeRobotTab } from "./UptimeRobotTab";

interface WhatsAppAssistantModalProps {
  workers: Worker[];
  waStatus: WhatsAppStatus;
  onRefreshStatus: () => void;
  onSaveAdminPhone: (phone: string) => Promise<void>;
  onBroadcastLinks: () => Promise<number>;
  onStateUpdated: () => void;
}

const INDO_DAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export const WhatsAppAssistantModal: React.FC<WhatsAppAssistantModalProps> = ({
  workers,
  waStatus,
  onRefreshStatus,
  onSaveAdminPhone,
  onBroadcastLinks,
  onStateUpdated,
}) => {
  // Navigation tabs
  const [activeSubTab, setActiveSubTab] = useState<
    "connection" | "uptime" | "bot_settings" | "holidays" | "features" | "ai_console" | "logs"
  >("connection");

  // Phone settings
  const [adminPhone, setAdminPhone] = useState(waStatus.registeredAdminPhone || "");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneSavedAlert, setPhoneSavedAlert] = useState(false);

  // Connection management
  const [resettingSession, setResettingSession] = useState(false);
  const [connectMethod, setConnectMethod] = useState<"qr" | "pairing">("qr");
  const [pairingPhone, setPairingPhone] = useState(waStatus.registeredAdminPhone || "");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [requestingPairing, setRequestingPairing] = useState(false);
  const [pairingError, setPairingError] = useState<string | null>(null);

  // Bot dispatch settings
  const [botSettings, setBotSettings] = useState<BotDispatchSettings>(
    waStatus.botDispatchSettings || {
      autoDispatchEnabled: true,
      dispatchTime: "08:00",
      workDays: ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"],
      typingDelayMin: 3,
      typingDelayMax: 6,
      messageStyle: "human_dynamic",
      includeLocationReminder: true,
      lastAutoDispatchDate: "",
    }
  );
  const [savingBotSettings, setSavingBotSettings] = useState(false);
  const [botSettingsSaved, setBotSettingsSaved] = useState(false);

  // Live preview settings
  const [previewDay, setPreviewDay] = useState<string>("Senin");
  const [previewWorkerId, setPreviewWorkerId] = useState<string>(workers[0]?.id || "W01");
  const [previewList, setPreviewList] = useState<any[]>([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Broadcast
  const [broadcasting, setBroadcasting] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  // Simulated live WhatsApp AI Chat
  const [chatMessages, setChatMessages] = useState<
    { id: string; sender: "admin" | "ai"; text: string; time: string }[]
  >([
    {
      id: "1",
      sender: "ai",
      text: "Halo Admin PT. NMSA! 👋\nSaya adalah Asisten AI WhatsApp Presensi yang siap membantu Anda.\n\nAnda dapat menanyakan data kehadiran hari ini atau memberikan perintah seperti:\n• *Siapa saja yang sudah absen hari ini?*\n• *Siapa yang belum absen?*\n• *Catat Deasy Annisa Syahdane hadir hari ini*\n• *Ubah status Nur Wahyudi jadi Izin*\n• *Rekap presensi minggu ini*",
      time: "08:00",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-polling for QR code and WA status every 2.5 seconds when not connected
  useEffect(() => {
    if (waStatus.status !== "connected") {
      const pollTimer = setInterval(() => {
        onRefreshStatus();
      }, 2500);
      return () => clearInterval(pollTimer);
    }
  }, [waStatus.status, onRefreshStatus]);

  // Synchronize admin phone
  useEffect(() => {
    if (waStatus.registeredAdminPhone) {
      setAdminPhone(waStatus.registeredAdminPhone);
      if (!pairingPhone) setPairingPhone(waStatus.registeredAdminPhone);
    }
    if (waStatus.botDispatchSettings) {
      setBotSettings(waStatus.botDispatchSettings);
    }
  }, [waStatus.registeredAdminPhone, waStatus.botDispatchSettings]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Load preview messages
  const fetchPreviews = async (day: string, style: string) => {
    setLoadingPreview(true);
    try {
      const res = await fetch(`/api/wa/preview-messages?day=${encodeURIComponent(day)}&style=${encodeURIComponent(style)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewList(data.previews || []);
      }
    } catch (e) {
      console.error("Error fetching preview messages:", e);
    } finally {
      setLoadingPreview(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === "bot_settings") {
      fetchPreviews(previewDay, botSettings.messageStyle);
    }
  }, [activeSubTab, previewDay, botSettings.messageStyle]);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPhone(true);
    try {
      await onSaveAdminPhone(adminPhone);
      setPhoneSavedAlert(true);
      setTimeout(() => setPhoneSavedAlert(false), 3000);
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan nomor admin");
    } finally {
      setSavingPhone(false);
    }
  };

  const handleResetSession = async () => {
    if (!confirm("Reset sesi WhatsApp? Ini akan membersihkan berkas autentikasi lama dan membuat QR Code baru yang segar.")) {
      return;
    }
    setResettingSession(true);
    setPairingCode(null);
    setPairingError(null);
    try {
      const res = await fetch("/api/wa/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        onRefreshStatus();
      } else {
        alert(data.error || "Gagal mereset sesi");
      }
    } catch (err: any) {
      alert("Error reset session: " + err.message);
    } finally {
      setResettingSession(false);
    }
  };

  const handleRequestPairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairingPhone.trim()) return;
    setRequestingPairing(true);
    setPairingCode(null);
    setPairingError(null);
    try {
      const res = await fetch("/api/wa/pairing-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: pairingPhone }),
      });
      const data = await res.json();
      if (data.success && data.code) {
        setPairingCode(data.code);
      } else {
        setPairingError(data.error || "Gagal mendapatkan kode tautan. Silakan coba kembali atau gunakan scan QR.");
      }
    } catch (err: any) {
      setPairingError(err.message || "Koneksi terganggu.");
    } finally {
      setRequestingPairing(false);
    }
  };

  const handleSaveBotSettings = async () => {
    setSavingBotSettings(true);
    try {
      const res = await fetch("/api/wa/save-bot-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(botSettings),
      });
      const data = await res.json();
      if (data.success) {
        setBotSettingsSaved(true);
        setTimeout(() => setBotSettingsSaved(false), 3000);
        onRefreshStatus();
      } else {
        alert(data.error || "Gagal menyimpan setelan");
      }
    } catch (err: any) {
      alert("Gagal menyimpan setelan bot: " + err.message);
    } finally {
      setSavingBotSettings(false);
    }
  };

  const handleBroadcastNow = async () => {
    if (
      !confirm(
        `Kirimkan link presensi ke semua karyawan aktif sekarang dengan gaya "${
          botSettings.messageStyle === "human_dynamic"
            ? "Alami & Variatif Harian"
            : botSettings.messageStyle
        }"?`
      )
    ) {
      return;
    }
    setBroadcasting(true);
    setBroadcastResult(null);
    try {
      const res = await fetch("/api/wa/broadcast-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appUrl: window.location.origin,
          style: botSettings.messageStyle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setBroadcastResult(`Berhasil mengirimkan pesan presensi bervariasi ke ${data.count} karyawan via WhatsApp!`);
        onRefreshStatus();
      } else {
        throw new Error(data.error || "Gagal broadcast");
      }
    } catch (err: any) {
      setBroadcastResult(`Gagal broadcast: ${err.message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleSendTestPreview = async (workerId?: string) => {
    setSendingTest(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/wa/send-test-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: adminPhone || pairingPhone,
          workerId: workerId || previewWorkerId,
          day: previewDay,
          style: botSettings.messageStyle,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTestResult(`Pesan contoh berhasil dikirim ke WhatsApp Anda (${data.targetPhone})! Silakan periksa HP Anda.`);
        setTimeout(() => setTestResult(null), 7000);
      } else {
        alert(data.error || "Gagal mengirim tes");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendAiMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || loadingAi) return;

    const timeNow = new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
    const userMsg = {
      id: Date.now().toString(),
      sender: "admin" as const,
      text: textToSend,
      time: timeNow,
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery("");
    setLoadingAi(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: textToSend,
          senderPhone: adminPhone,
          isAdmin: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses AI");
      }

      const aiReply = {
        id: (Date.now() + 1).toString(),
        sender: "ai" as const,
        text: data.replyText,
        time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      };
      setChatMessages((prev) => [...prev, aiReply]);

      if (data.actionTaken === "UPDATE_ATTENDANCE") {
        onStateUpdated();
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "ai" as const,
          text: `⚠️ Maaf, terjadi kesalahan: ${err.message}`,
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoadingAi(false);
    }
  };

  const isConnected = waStatus.status === "connected";

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
              <Bot className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold">Asisten WhatsApp AI & Pengirim Link Presensi</h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isConnected
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {isConnected ? "WhatsApp Terhubung" : "Belum Terhubung"}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Bot otomatis mengirimkan link presensi harian dengan variasi kalimat manusiawi, melayani pertanyaan absensi dari nomor Anda, dan mencatat absensi via perintah chat.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onRefreshStatus}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors"
              title="Perbarui status koneksi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleBroadcastNow}
              disabled={broadcasting || !isConnected}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-md flex items-center space-x-2 transition-all disabled:opacity-40"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{broadcasting ? "Mengirim ke Karyawan..." : "Kirim Link ke Semua Karyawan"}</span>
            </button>
          </div>
        </div>

        {broadcastResult && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between">
            <span>{broadcastResult}</span>
            <button onClick={() => setBroadcastResult(null)} className="text-emerald-400 font-bold ml-2">
              ×
            </button>
          </div>
        )}

        {testResult && (
          <div className="mt-4 p-3 rounded-xl bg-blue-950/60 border border-blue-500/40 text-xs text-blue-200 flex items-center justify-between">
            <span>{testResult}</span>
            <button onClick={() => setTestResult(null)} className="text-blue-400 font-bold ml-2">
              ×
            </button>
          </div>
        )}
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          onClick={() => setActiveSubTab("connection")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "connection"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>1. Sambung WhatsApp (QR & Pairing)</span>
          {isConnected && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveSubTab("uptime")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "uptime"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-500" />
          <span>2. Koneksi Selamanya (UptimeRobot 24/7)</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-bold">
            1x Scan Selamanya
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("bot_settings")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "bot_settings"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-500" />
          <span>3. Stelan Bot & Variasi Pesan Harian</span>
          <span className="px-1.5 py-0.5 text-[10px] bg-emerald-100 text-emerald-800 rounded font-bold">
            Stelan Bot
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab("holidays")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "holidays"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>4. Kalender Libur & Akhir Pekan</span>
          {waStatus.todayHolidayStatus?.isHoliday && (
            <span className="px-1.5 py-0.2 text-[9px] bg-rose-500 text-white rounded-full font-bold">
              Hari Ini Libur
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("features")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "features"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-500" />
          <span>5. Request Fitur & AI Studio</span>
          {Boolean(waStatus.featureRequests?.length) && (
            <span className="px-1.5 py-0.2 text-[9px] bg-purple-600 text-white rounded-full font-bold">
              {waStatus.featureRequests?.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab("ai_console")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "ai_console"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <Bot className="w-4 h-4 text-emerald-500" />
          <span>6. Live Console AI & Tanya Absensi</span>
        </button>

        <button
          onClick={() => setActiveSubTab("logs")}
          className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-colors ${
            activeSubTab === "logs"
              ? "bg-slate-900 text-white shadow-sm"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>7. Riwayat Pesan Bot ({waStatus.recentLogs?.length || 0})</span>
        </button>
      </div>

      {/* TAB 1: CONNECTION & QR CODE */}
      {activeSubTab === "connection" && (
        <div className="space-y-4">
          {/* Anti-Disconnect Notice */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 border border-emerald-500/30 rounded-2xl p-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center space-x-2">
                  <span>Jaminan 1 Kali Scan Selamanya & Anti-Disconnect 24/7</span>
                  <span className="px-1.5 py-0.5 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-semibold border border-emerald-500/30">
                    Aktif
                  </span>
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Sesi kredensial disimpan permanen di server & dilengkapi watchdog 25 detik. Pasang link keep-alive ke UptimeRobot agar bot aktif 24/7 tanpa pernah terputus.
                </p>
              </div>
            </div>
            <button
              onClick={() => setActiveSubTab("uptime")}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 self-start sm:self-auto"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Buka Panduan UptimeRobot</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* QR Code / Pairing Code Card */}
          <div className="lg:col-span-7 bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>Penyambungan Perangkat WhatsApp</span>
              </h3>

              {!isConnected && (
                <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setConnectMethod("qr")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      connectMethod === "qr" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600"
                    }`}
                  >
                    Scan QR Code
                  </button>
                  <button
                    onClick={() => setConnectMethod("pairing")}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      connectMethod === "pairing" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-600"
                    }`}
                  >
                    Kode Tautan (Pairing Code)
                  </button>
                </div>
              )}
            </div>

            {isConnected ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="font-bold text-emerald-950 text-base">WhatsApp Gateway Aktif & Terhubung!</h4>
                <p className="text-xs text-emerald-800 mt-1">
                  Akun: <strong>{waStatus.user?.name || "Admin WhatsApp PT. NMSA"}</strong>
                </p>
                <p className="text-xs text-emerald-700 mt-2 max-w-md mx-auto">
                  Bot siap menerima perintah input absen, menjawab pertanyaan absensi ke nomor sendiri, dan mengirim link presensi harian otomatis setiap pagi.
                </p>

                <div className="mt-5 pt-4 border-t border-emerald-200 flex justify-center space-x-3">
                  <button
                    onClick={async () => {
                      if (confirm("Putuskan koneksi WhatsApp dari aplikasi?")) {
                        await fetch("/api/wa/disconnect", { method: "POST" });
                        onRefreshStatus();
                      }
                    }}
                    className="px-4 py-2 text-xs text-rose-600 hover:text-rose-700 font-semibold bg-white border border-rose-200 rounded-xl shadow-xs flex items-center space-x-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Putuskan Koneksi</span>
                  </button>
                  <button
                    onClick={handleResetSession}
                    disabled={resettingSession}
                    className="px-4 py-2 text-xs text-slate-700 hover:text-slate-900 font-semibold bg-white border border-slate-200 rounded-xl shadow-xs flex items-center space-x-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${resettingSession ? "animate-spin" : ""}`} />
                    <span>Reset Sesi & Sambung Ulang</span>
                  </button>
                </div>
              </div>
            ) : connectMethod === "qr" ? (
              <div className="text-center">
                {waStatus.qr ? (
                  <div>
                    <div className="p-3 bg-white border-2 border-dashed border-emerald-500 rounded-2xl inline-block shadow-sm">
                      <img src={waStatus.qr} alt="Scan WhatsApp QR" className="w-64 h-64 mx-auto" />
                    </div>

                    <div className="mt-3 flex items-center justify-center space-x-2 text-[11px] text-slate-500">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>QR Code aktif. Aplikasi memantau status scan secara otomatis...</span>
                    </div>

                    <div className="mt-4 space-y-1.5 text-xs text-slate-600 text-left bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="font-bold text-slate-800">Langkah Menghubungkan:</p>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600">
                        <li>Buka aplikasi WhatsApp di HP Anda</li>
                        <li>Ketuk menu Titik Tiga (Android) atau Pengaturan (iPhone)</li>
                        <li>Pilih <strong>Perangkat Tertaut (Linked Devices)</strong></li>
                        <li>Ketuk <strong>Tautkan Perangkat</strong> lalu pindai QR Code di atas</li>
                      </ol>
                    </div>

                    <div className="mt-4 flex items-center justify-center space-x-3">
                      <button
                        onClick={handleResetSession}
                        disabled={resettingSession}
                        className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors flex items-center space-x-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${resettingSession ? "animate-spin" : ""}`} />
                        <span>{resettingSession ? "Mereset..." : "QR Kadaluarsa? Buat QR Baru"}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 bg-slate-50 rounded-2xl border border-slate-200 p-6">
                    <RefreshCw className="w-10 h-10 text-emerald-600 animate-spin mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-800">Menghasilkan QR Code WhatsApp...</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Sistem sedang membuat soket Baileys dan kunci enkripsi WhatsApp. Harap tunggu beberapa detik.
                    </p>

                    <div className="mt-6 flex justify-center space-x-3">
                      <button
                        onClick={handleResetSession}
                        disabled={resettingSession}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center space-x-1.5"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${resettingSession ? "animate-spin" : ""}`} />
                        <span>{resettingSession ? "Sedang Mereset..." : "Reset Sesi & Munculkan QR Sekarang"}</span>
                      </button>
                      <button
                        onClick={() => setConnectMethod("pairing")}
                        className="px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-medium"
                      >
                        Gunakan Kode Tautan (Tanpa Kamera)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Pairing Code Mode (Alternative without camera) */
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 leading-relaxed">
                  <p className="font-bold flex items-center space-x-1.5 mb-1">
                    <KeyRound className="w-4 h-4 text-blue-600" />
                    <span>Tautkan Perangkat dengan Nomor HP (Tanpa Scan Kamera)</span>
                  </p>
                  Masukkan nomor WhatsApp Admin Anda, lalu masukkan 8 digit kode yang muncul ke aplikasi WhatsApp Anda di menu <em>Perangkat Tertaut &gt; Tautkan dengan nomor telepon</em>.
                </div>

                <form onSubmit={handleRequestPairingCode} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nomor WhatsApp Admin untuk Ditautkan:
                    </label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder="Contoh: 081342993880 atau 62813..."
                        className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <button
                        type="submit"
                        disabled={requestingPairing || !pairingPhone.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs disabled:opacity-50 flex items-center space-x-1.5 whitespace-nowrap"
                      >
                        {requestingPairing ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Membuat Kode...</span>
                          </>
                        ) : (
                          <>
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>Minta Kode Tautan</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>

                {pairingError && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                    <span>{pairingError}</span>
                    <button
                      onClick={handleResetSession}
                      className="text-xs underline font-bold ml-2 text-rose-900"
                    >
                      Reset Sesi
                    </button>
                  </div>
                )}

                {pairingCode && (
                  <div className="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-center space-y-2">
                    <p className="text-xs text-emerald-800 font-medium">
                      Masukkan 8 karakter kode ini di WhatsApp HP Anda:
                    </p>
                    <div className="text-3xl font-mono font-black text-emerald-950 tracking-widest bg-white py-3 px-6 rounded-xl inline-block border border-emerald-300 shadow-sm">
                      {pairingCode}
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Buka WhatsApp &gt; Perangkat Tertaut &gt; Tautkan Perangkat &gt; <strong>Tautkan dengan nomor telepon saja</strong> &gt; Masukkan kode di atas.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Phone & Diagnostics (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Registered Admin Phone Setting Card */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center space-x-2">
                <Phone className="w-4 h-4 text-emerald-600" />
                <span>Nomor WhatsApp Admin Terdaftar</span>
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                Nomor ini memiliki otorisasi penuh untuk menanyakan rekap data absensi dan memberikan perintah pencatatan/pengubahan status secara otomatis ke Asisten AI via chat WhatsApp (atau pesan ke nomor sendiri).
              </p>

              <form onSubmit={handleSavePhone} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Nomor HP / WhatsApp Admin
                  </label>
                  <input
                    type="text"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Contoh: 081342993880 atau 62813..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingPhone}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5"
                >
                  {phoneSavedAlert ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>Nomor Tersimpan!</span>
                    </>
                  ) : (
                    <span>{savingPhone ? "Menyimpan..." : "Simpan Nomor Admin"}</span>
                  )}
                </button>
              </form>
            </div>

            {/* Diagnostic & Troubleshooting Card */}
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 text-xs space-y-3">
              <h4 className="font-bold text-slate-800 flex items-center space-x-1.5">
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Mengapa QR Code Tidak Muncul? Solusi Cepat:</span>
              </h4>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>
                  <strong>Sesi Lama Belum Dibersihkan:</strong> Klik tombol <em>"Reset Sesi &amp; Buat QR Baru"</em> di atas untuk membersihkan kredensial lama.
                </li>
                <li>
                  <strong>Koneksi Lambat:</strong> Halaman kini melakukan sinkronisasi otomatis tiap 2,5 detik tanpa perlu me-refresh browser.
                </li>
                <li>
                  <strong>Gunakan Pairing Code:</strong> Jika kamera bermasalah, gunakan opsi <em>Kode Tautan</em> dengan mengetikkan nomor HP Anda.
                </li>
              </ul>
            </div>
          </div>
        </div>
        </div>
      )}

      {/* TAB 2: UPTIMEROBOT & PERMANENT CONNECTION */}
      {activeSubTab === "uptime" && (
        <UptimeRobotTab waStatus={waStatus} onRefresh={onRefreshStatus} />
      )}

      {/* TAB 3: STELAN BOT PENGIRIMAN & VARIASI PESAN HARIAN */}
      {activeSubTab === "bot_settings" && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-200 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Sliders className="w-5 h-5 text-emerald-600" />
                  <span>Stelan Bot Pengiriman &amp; Variasi Pesan Harian</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Atur jadwal pengiriman otomatis link presensi ke setiap karyawan dan sesuaikan gaya bahasa pesan agar berbeda setiap harinya seperti manusia pada umumnya.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSaveBotSettings}
                  disabled={savingBotSettings}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-colors flex items-center space-x-1.5"
                >
                  {botSettingsSaved ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-200" />
                      <span>Stelan Tersimpan!</span>
                    </>
                  ) : (
                    <span>{savingBotSettings ? "Menyimpan..." : "Simpan Pengaturan Bot"}</span>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Schedule & Style Options (6 cols) */}
              <div className="lg:col-span-6 space-y-6">
                {/* Auto-Dispatch Toggle */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Kirim Otomatis Setiap Pagi</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Bot WhatsApp akan mengirimkan link presensi pribadi ke seluruh nomor karyawan aktif setiap pagi sesuai jadwal.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer ml-3 mt-1">
                    <input
                      type="checkbox"
                      checked={botSettings.autoDispatchEnabled}
                      onChange={(e) => setBotSettings({ ...botSettings, autoDispatchEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Dispatch Time */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center space-x-1.5">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Waktu Pengiriman Otomatis (WIB)</span>
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="time"
                      value={botSettings.dispatchTime}
                      onChange={(e) => setBotSettings({ ...botSettings, dispatchTime: e.target.value })}
                      className="text-xs font-mono font-bold px-4 py-2.5 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-emerald-600"
                    />
                    <span className="text-xs text-slate-500">
                      Waktu standar pembagian link presensi sebelum jam masuk kerja.
                    </span>
                  </div>
                </div>

                {/* Working Days */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Hari Pengiriman Aktif</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {INDO_DAYS.map((day) => {
                      const isChecked = botSettings.workDays.includes(day);
                      return (
                        <label
                          key={day}
                          className={`flex items-center space-x-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-bold"
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setBotSettings({ ...botSettings, workDays: [...botSettings.workDays, day] });
                              } else {
                                setBotSettings({
                                  ...botSettings,
                                  workDays: botSettings.workDays.filter((d) => d !== day),
                                });
                              }
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{day}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Message Style Selection (The core request) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2 flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>Gaya Bahasa &amp; Variasi Kalimat Tiap Hari</span>
                  </label>

                  <div className="space-y-2.5">
                    <label
                      className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                        botSettings.messageStyle === "human_dynamic"
                          ? "bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="msgStyle"
                          value="human_dynamic"
                          checked={botSettings.messageStyle === "human_dynamic"}
                          onChange={() => setBotSettings({ ...botSettings, messageStyle: "human_dynamic" })}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            🌿 Alami &amp; Bervariasi Tiap Hari (Rekomendasi Utama)
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Kalimat berubah tiap harinya sesuai hari kerja (Senin semangat awal pekan, Selasa fokus, Rabu tengah minggu, Kamis konsisten, Jumat berkah &amp; akhir pekan). Menyapa dengan panggilan santun (Pak, Bu, Mas, Mbak) dan kata-kata layaknya manusia sungguhan.
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                        botSettings.messageStyle === "ai_generative"
                          ? "bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="msgStyle"
                          value="ai_generative"
                          checked={botSettings.messageStyle === "ai_generative"}
                          onChange={() => setBotSettings({ ...botSettings, messageStyle: "ai_generative" })}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            ✨ AI Generatif (Gemini 2.5 Flash)
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Setiap pagi Gemini AI menyusun kalimat unik dan personal untuk masing-masing karyawan secara real-time tanpa pola template yang sama.
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                        botSettings.messageStyle === "formal"
                          ? "bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="msgStyle"
                          value="formal"
                          checked={botSettings.messageStyle === "formal"}
                          onChange={() => setBotSettings({ ...botSettings, messageStyle: "formal" })}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            💼 Santun &amp; Formal Korporat
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Bahasa resmi institusi PT. Nusantara Mineral Sukses Abadi dengan nada sopan dan terstruktur.
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`block p-3.5 rounded-xl border cursor-pointer transition-all ${
                        botSettings.messageStyle === "friendly"
                          ? "bg-emerald-50/70 border-emerald-400 ring-1 ring-emerald-400"
                          : "bg-white border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <input
                          type="radio"
                          name="msgStyle"
                          value="friendly"
                          checked={botSettings.messageStyle === "friendly"}
                          onChange={() => setBotSettings({ ...botSettings, messageStyle: "friendly" })}
                          className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">
                            ☀️ Hangat &amp; Bersahabat
                          </span>
                          <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                            Sapaan ramah dan kasual untuk menciptakan suasana kerja yang akrab dan menyenangkan.
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Anti-Spam Human Typing Simulator */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Simulasi Mengetik Manusia (Anti-Ban &amp; Natural Typing)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Saat mengirim pesan ke banyak karyawan, bot WhatsApp menampilkan indikator <em>"sedang mengetik..."</em> selama 3 sampai 5 detik bergantian antar karyawan. Hal ini memastikan WhatsApp menganggap aktivitas sebagai interaksi manusia alami dan mencegah pemblokiran.
                  </p>
                </div>
              </div>

              {/* Right Column: Live Interactive Preview Per Day (6 cols) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      <span>Pratinjau Pesan Harian Karyawan</span>
                    </h4>

                    {/* Day selector for preview */}
                    <div className="flex items-center space-x-1.5">
                      <span className="text-[11px] text-slate-500 font-medium">Pilih Hari:</span>
                      <select
                        value={previewDay}
                        onChange={(e) => setPreviewDay(e.target.value)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-600"
                      >
                        {INDO_DAYS.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Berikut adalah contoh kata-kata yang akan dikirimkan bot pada hari <strong>{previewDay}</strong> untuk masing-masing karyawan:
                  </p>

                  {/* Worker Previews Tabs */}
                  <div className="flex space-x-1 overflow-x-auto pb-1">
                    {workers
                      .filter((w) => w.isActive)
                      .map((w) => (
                        <button
                          key={w.id}
                          onClick={() => setPreviewWorkerId(w.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                            previewWorkerId === w.id
                              ? "bg-emerald-600 text-white font-bold shadow-xs"
                              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                          }`}
                        >
                          {w.name}
                        </button>
                      ))}
                  </div>

                  {/* WhatsApp Chat Balloon Preview */}
                  {(() => {
                    const selectedPreview =
                      previewList.find((p) => p.workerId === previewWorkerId) || previewList[0];
                    const selectedWorker = workers.find((w) => w.id === previewWorkerId) || workers[0];

                    return (
                      <div className="p-4 bg-[#efeae2] rounded-2xl border border-slate-300 shadow-inner space-y-3">
                        <div className="flex items-center justify-between text-[11px] text-slate-600 border-b border-slate-300/60 pb-2">
                          <span>
                            Penerima: <strong>{selectedWorker?.name}</strong> ({selectedWorker?.role})
                          </span>
                          <span className="font-mono text-slate-500">{selectedWorker?.phoneNumber || "-"}</span>
                        </div>

                        {loadingPreview ? (
                          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center space-x-2">
                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
                            <span>Memuat kalimat variasi hari {previewDay}...</span>
                          </div>
                        ) : selectedPreview ? (
                          <div className="bg-white rounded-2xl rounded-tl-none p-4 shadow-sm text-xs text-slate-800 whitespace-pre-line leading-relaxed border border-slate-200/80">
                            {selectedPreview.message}
                            <div className="text-[10px] text-slate-400 font-mono text-right mt-2">
                              {botSettings.dispatchTime} WIB • Terkirim via WhatsApp
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 bg-white rounded-xl text-xs text-slate-500 text-center">
                            Memilih pratinjau karyawan...
                          </div>
                        )}

                        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500">
                            Setiap karyawan mendapatkan variasi kalimat pembuka yang unik.
                          </span>
                          <button
                            onClick={() => handleSendTestPreview(selectedWorker?.id)}
                            disabled={sendingTest || !isConnected}
                            className="w-full sm:w-auto px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors disabled:opacity-40"
                            title="Kirim pesan ini ke WhatsApp Admin untuk melihat tampilannya di HP Anda"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{sendingTest ? "Mengirim Tes..." : "Kirim Contoh ke HP Admin"}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Friday Auto-Save Notice Card */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                  <span className="font-bold flex items-center space-x-1.5 text-amber-950">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span>Penyimpanan Otomatis Hari Jumat Jam 17:00 WIB</span>
                  </span>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Sesuai instruksi, pada hari Jumat pukul 17:00 WIB (jam pulang kantor), server otomatis mengunci dan menyimpan rekap laporan mingguan ke dalam riwayat mingguan dan Google Drive pada struktur folder <em>absen &gt; Bulan &gt; Periode</em>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: HOLIDAYS & WEEKEND SCHEDULE */}
      {activeSubTab === "holidays" && (
        <HolidaysScheduleTab waStatus={waStatus} onRefresh={onRefreshStatus} />
      )}

      {/* TAB 4: FEATURE REQUESTS & AI STUDIO BRIDGE */}
      {activeSubTab === "features" && (
        <FeatureRequestsTab waStatus={waStatus} onRefresh={onRefreshStatus} />
      )}

      {/* TAB 5: LIVE AI CHAT CONSOLE */}
      {activeSubTab === "ai_console" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-[650px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center font-bold text-white shadow-sm">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold flex items-center space-x-2">
                  <span>Asisten WhatsApp AI Presensi & Operasional (Gemini 2.5 Flash)</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </h4>
                <p className="text-[11px] text-slate-300">
                  Terhubung ke Database Presensi NMSA, Kalender Libur Pemerintah & AI Studio • Anda juga bisa chat langsung dari WhatsApp di HP Anda
                </p>
              </div>
            </div>
          </div>

          {/* Quick Command Pills */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 overflow-x-auto flex space-x-2 shrink-0">
            <span className="text-[11px] text-slate-500 font-semibold self-center whitespace-nowrap">
              Coba Perintah AI:
            </span>
            {[
              "Apakah hari ini atau besok libur?",
              "Tetapkan besok libur nasional mendadak Pilkada",
              "Tolong buatkan fitur slip gaji PDF",
              "Ubah jam kirim bot jadi jam 07:30",
              "Siapa saja yang sudah absen hari ini?",
              "Siapa yang belum absen?",
              "Catat Deasy Annisa Syahdane hadir hari ini",
              "Ubah status Nur Wahyudi jadi Izin",
              "Rekap kehadiran minggu ini",
            ].map((query, idx) => (
              <button
                key={idx}
                onClick={() => handleSendAiMessage(query)}
                disabled={loadingAi}
                className="px-2.5 py-1 rounded-full bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-[11px] font-medium whitespace-nowrap transition-colors shadow-2xs"
              >
                {query}
              </button>
            ))}
          </div>

          {/* Message Thread (WhatsApp Style) */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#efeae2]/35">
            {chatMessages.map((msg) => {
              const isAi = msg.sender === "ai";
              return (
                <div key={msg.id} className={`flex ${isAi ? "justify-start" : "justify-end"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-xs text-xs whitespace-pre-line leading-relaxed ${
                      isAi
                        ? "bg-white text-slate-800 rounded-tl-none border border-slate-200"
                        : "bg-emerald-600 text-white rounded-tr-none"
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span
                      className={`text-[10px] block text-right mt-1 font-mono ${
                        isAi ? "text-slate-400" : "text-emerald-100"
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                </div>
              );
            })}
            {loadingAi && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-xs flex items-center space-x-2 text-xs text-slate-500">
                  <Sparkles className="w-4 h-4 text-emerald-600 animate-spin" />
                  <span>Asisten AI sedang membaca data presensi &amp; memproses jawaban...</span>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendAiMessage();
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2 shrink-0"
          >
            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Tanyakan absensi hari ini atau perintahkan AI (contoh: 'Catat Faisal hadir')..."
              className="flex-1 text-xs px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 bg-slate-50"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() || loadingAi}
              className="p-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors disabled:opacity-50"
              title="Kirim Pesan"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* TAB 4: DISPATCH LOGS */}
      {activeSubTab === "logs" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Riwayat Pengiriman Link &amp; Pesan Bot WhatsApp</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Catatan seluruh pesan presensi yang berhasil dikirimkan ke nomor WhatsApp masing-masing karyawan.
              </p>
            </div>
            <button
              onClick={onRefreshStatus}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center space-x-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Log</span>
            </button>
          </div>

          {!waStatus.recentLogs || waStatus.recentLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              Belum ada riwayat pengiriman pesan bot hari ini. Klik "Kirim Link ke Semua Karyawan" untuk memulai.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Karyawan</th>
                    <th className="py-3 px-4">Nomor WhatsApp</th>
                    <th className="py-3 px-4">Cuplikan Pesan</th>
                    <th className="py-3 px-4">Tipe</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {waStatus.recentLogs.map((log: BotMessageLog) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                        {log.time}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{log.workerName}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{log.phoneNumber}</td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={log.messageText}>
                        {log.messageText}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                          {log.isAutoScheduled ? "Otomatis Pagi" : "Manual Dispatch"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === "sent"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.status === "sent" ? "Terkirim" : "Gagal"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
