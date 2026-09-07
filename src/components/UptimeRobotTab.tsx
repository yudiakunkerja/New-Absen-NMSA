import React, { useState } from "react";
import {
  Activity,
  Radio,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Zap,
  Clock,
  Wifi,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { WhatsAppStatus } from "../types";

interface UptimeRobotTabProps {
  waStatus: WhatsAppStatus;
  onRefresh: () => void;
}

export const UptimeRobotTab: React.FC<UptimeRobotTabProps> = ({
  waStatus,
  onRefresh,
}) => {
  const [copied, setCopied] = useState(false);
  const [testingPing, setTestingPing] = useState(false);
  const [pingResult, setPingResult] = useState<any | null>(null);

  // Dynamic Keep-Alive URL
  const keepAliveUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/wa/keep-alive`
    : "http://localhost:3000/api/wa/keep-alive";

  const metrics = waStatus.keepAliveMetrics;
  const isConnected = waStatus.status === "connected";
  const hasSavedSession = metrics?.sessionPersisted ?? false;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(keepAliveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleTestPing = async () => {
    setTestingPing(true);
    setPingResult(null);
    const start = performance.now();
    try {
      const res = await fetch("/api/wa/keep-alive");
      const durationMs = Math.round(performance.now() - start);
      const data = await res.json();
      setPingResult({
        success: true,
        durationMs,
        data,
      });
      onRefresh();
    } catch (err: any) {
      setPingResult({
        success: false,
        error: err.message || "Gagal melakukan uji ping",
      });
    } finally {
      setTestingPing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: 1x Scan Selamanya */}
      <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-900 text-white rounded-2xl p-6 border border-emerald-500/30 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center font-bold text-emerald-400 shadow-inner shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold">Koneksi Permanen 24/7 (1 Kali Scan Untuk Selamanya)</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Anti-Disconnect
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1.5 leading-relaxed max-w-2xl">
                Solusi agar WhatsApp Web tidak pernah terputus secara otomatis: Layanan ini didukung oleh sistem <strong>Session Shield</strong>, backup kredensial otomatis, heartbeat watchdog 25 detik, dan integrasi pemantau eksternal seperti <strong>UptimeRobot</strong> untuk menjaga server dan koneksi selalu online tanpa pernah tertidur (sleep).
              </p>
            </div>
          </div>

          <button
            onClick={onRefresh}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center space-x-2 transition-colors shrink-0 self-start md:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Cek Status Terkini</span>
          </button>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-700/60">
          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1 mb-1">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span>Status Koneksi WA</span>
            </span>
            <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
              <span>{isConnected ? "Terkoneksi Aktif" : hasSavedSession ? "Sesi Siap Sambung" : "Menunggu QR"}</span>
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1 mb-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" />
              <span>Sesi Permanen</span>
            </span>
            <span className="text-xs font-bold text-slate-200">
              {hasSavedSession ? "Tersimpan di Server" : "Belum Tersimpan"}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1 mb-1">
              <Clock className="w-3 h-3 text-blue-400" />
              <span>Server Uptime</span>
            </span>
            <span className="text-xs font-bold text-slate-200">
              {metrics?.uptimeFormatted || "Aktif"}
            </span>
          </div>

          <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
            <span className="text-[11px] text-slate-400 flex items-center space-x-1 mb-1">
              <Radio className="w-3 h-3 text-purple-400" />
              <span>Ping Diterima</span>
            </span>
            <span className="text-xs font-bold text-purple-300">
              {metrics?.totalPings ?? 0} Kali Diping
            </span>
          </div>
        </div>
      </div>

      {/* Keep-Alive URL & Copy Section */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>Link Keep-Alive untuk UptimeRobot</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Salin URL di bawah ini ke pemantau gratis seperti UptimeRobot. UptimeRobot akan mengirim ping setiap 1-5 menit sehingga server tidak pernah masuk mode tidur (sleep).
            </p>
          </div>

          <button
            onClick={handleTestPing}
            disabled={testingPing}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors shrink-0 disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-500 ${testingPing ? "animate-spin" : ""}`} />
            <span>{testingPing ? "Menguji..." : "Uji Ping Sekarang"}</span>
          </button>
        </div>

        {/* URL Input with Copy Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              readOnly
              value={keepAliveUrl}
              className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={handleCopyUrl}
            className={`px-5 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2 transition-all shadow-sm shrink-0 ${
              copied
                ? "bg-emerald-600 text-white"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Link Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Salin Link</span>
              </>
            )}
          </button>
        </div>

        {/* Ping Test Feedback */}
        {pingResult && (
          <div
            className={`p-3.5 rounded-xl text-xs border transition-all ${
              pingResult.success
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-start space-x-2">
              {pingResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {pingResult.success
                    ? `Ping Berhasil Diterima! (${pingResult.durationMs}ms)`
                    : `Gagal Uji Ping`}
                </p>
                {pingResult.success && (
                  <p className="text-[11px] text-emerald-700">
                    Pesan server: <em>"{pingResult.data?.message}"</em> • Status WA:{" "}
                    <strong>{pingResult.data?.waStatus}</strong> • Total ping saat ini:{" "}
                    <strong>{pingResult.data?.totalPingsReceived}</strong>
                  </p>
                )}
                {pingResult.error && <p>{pingResult.error}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tutorial: Cara Memasang di UptimeRobot (Langkah demi Langkah) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <ExternalLink className="w-4 h-4 text-blue-600" />
            <span>Panduan Mudah Memasang ke UptimeRobot (100% Gratis)</span>
          </h4>
          <a
            href="https://uptimerobot.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1"
          >
            <span>Buka UptimeRobot.com</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Step 1 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-2.5">
                1
              </div>
              <h5 className="text-xs font-bold text-slate-900 mb-1">Daftar / Login UptimeRobot</h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Buka <a href="https://uptimerobot.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">uptimerobot.com</a> dan buat akun gratis (menyediakan 50 monitor gratis 24/7).
              </p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 bg-white p-2 rounded border border-slate-200">
              Akun gratis sudah lebih dari cukup untuk menjaga server aktif selamanya.
            </div>
          </div>

          {/* Step 2 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mb-2.5">
                2
              </div>
              <h5 className="text-xs font-bold text-slate-900 mb-1">Klik "+ Add New Monitor"</h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Pilih <strong>Monitor Type: HTTP(s)</strong>, beri nama <strong>Friendly Name: Absensi NMSA</strong>, lalu tempel link keep-alive tadi pada kolom <strong>URL (or IP)</strong>.
              </p>
            </div>
            <div className="mt-3 text-[10px] text-slate-400 bg-white p-2 rounded border border-slate-200">
              Monitoring Interval: pilih <strong>5 minutes</strong> (atau 1 minute).
            </div>
          </div>

          {/* Step 3 */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold mb-2.5">
                3
              </div>
              <h5 className="text-xs font-bold text-slate-900 mb-1">Klik "Create Monitor" & Selesai!</h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                UptimeRobot akan otomatis mengirimkan request keep-alive secara terus-menerus. Server Anda dan WhatsApp Web tidak akan pernah tidur atau terputus lagi!
              </p>
            </div>
            <div className="mt-3 text-[10px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200 font-semibold">
              Cukup 1 kali scan QR code untuk selamanya!
            </div>
          </div>
        </div>
      </div>

      {/* Fitur Keamanan & Penjelasan Teknis */}
      <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>Mengapa Sesi Ini Dijamin Tidak Pernah Terputus Otomatis?</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block mb-0.5">Durable Session Backup</strong>
              Sesi Baileys (<code>creds.json</code>) disimpan dengan perlindungan backup permanen di disk server sehingga tidak terhapus saat server di-restart.
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block mb-0.5">Zero-Wipe Policy</strong>
              Server tidak akan menghapus kredensial login secara sepihak saat terjadi gangguan sinyal atau timeout jaringan, melainkan menyambung ulang secara mulus.
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block mb-0.5">Heartbeat Presence Ping (25s)</strong>
              Server mengirimkan sinyal status aktif (available presence) ke server WhatsApp setiap 25 detik agar WhatsApp tidak menganggap browser telah idle.
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-start space-x-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900 block mb-0.5">Instant Auto-Reconnect</strong>
              Jika ada restart router atau jaringan sekejap, watchdog otomatis membangun kembali socket WhatsApp tanpa meminta scan ulang.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
