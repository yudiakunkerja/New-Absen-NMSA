import React, { useState, useEffect } from "react";
import {
  FileCheck,
  FolderTree,
  CloudUpload,
  FileDown,
  ExternalLink,
  Clock,
  CheckCircle2,
  Calendar,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Send,
  Trash2,
  Key,
  HelpCircle,
  AlertCircle,
  HardDrive,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { WeeklyReport, Worker } from "../types";
import { downloadWeeklyReportPDF } from "../lib/attendanceSheetGeneratorPDF";

interface FridayReportsViewProps {
  fridayReports: WeeklyReport[];
  workers: Worker[];
  onTriggerManualArchive: () => Promise<void>;
  onUploadReportToDrive: (report: WeeklyReport) => Promise<string | undefined>;
  onDeleteReport?: (reportId: string) => Promise<void>;
  onSendToAdminWa?: () => Promise<void>;
  driveConnected: boolean;
  googleDriveToken?: string;
}

export const FridayReportsView: React.FC<FridayReportsViewProps> = ({
  fridayReports,
  workers,
  onTriggerManualArchive,
  onUploadReportToDrive,
  onDeleteReport,
  onSendToAdminWa,
  driveConnected,
  googleDriveToken,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [manualArchiving, setManualArchiving] = useState(false);
  const [sendingToWa, setSendingToWa] = useState(false);

  // Google Drive Permanent Connection State
  const [showDriveConfig, setShowDriveConfig] = useState(false);
  const [driveStatus, setDriveStatus] = useState<{
    isConnected: boolean;
    isPermanent: boolean;
    userEmail?: string;
    accountEmail?: string;
    clientId?: string;
    rawClientId?: string;
    expiresAt?: number;
    hasRefreshToken?: boolean;
    hasToken?: boolean;
  }>({
    isConnected: driveConnected,
    isPermanent: false,
  });
  const [loadingDriveStatus, setLoadingDriveStatus] = useState(false);
  const [loggingInGoogle, setLoggingInGoogle] = useState(false);
  const [testingDrive, setTestingDrive] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    email?: string;
  } | null>(null);

  // Inputs for Permanent Connection
  const [inputRefreshToken, setInputRefreshToken] = useState("");
  const [inputAccessToken, setInputAccessToken] = useState("");
  const [inputClientId, setInputClientId] = useState("");
  const [inputClientSecret, setInputClientSecret] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState("");

  // Fetch Drive status from server
  const fetchDriveStatus = async () => {
    setLoadingDriveStatus(true);
    try {
      const res = await fetch("/api/drive/status");
      if (res.ok) {
        const data = await res.json();
        setDriveStatus(data);
      }
    } catch (e) {
      console.error("Gagal memuat status Google Drive:", e);
    } finally {
      setLoadingDriveStatus(false);
    }
  };

  useEffect(() => {
    fetchDriveStatus();
  }, []);

  const handleManualArchive = async () => {
    if (!confirm("Simpan sekarang absensi PDF hari ini ke Google Drive (simulasi jam pulang kerja 17:00 WIB)?\n\nCatatan: Jika berkas untuk periode minggu ini sudah ada, sistem akan mengupdate file tersebut tanpa membuat duplikat.")) return;
    setManualArchiving(true);
    try {
      const res = await fetch("/api/daily/trigger-closing-autosave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan ke Google Drive");
      }
      alert(`Berhasil! Laporan absensi PDF telah disimpan ke Google Drive / arsip server:\n${data.driveUrl || "Folder: absen > " + data.report?.monthName + " > " + data.report?.periodName}`);
      await onTriggerManualArchive();
    } catch (e: any) {
      alert(e.message || "Gagal mengarsipkan laporan");
    } finally {
      setManualArchiving(false);
    }
  };

  const handleSendToAdminWa = async () => {
    if (!confirm("Kirim dokumen PDF mingguan dan tautan Google Drive ke nomor WhatsApp Admin sekarang?")) return;
    setSendingToWa(true);
    try {
      const res = await fetch("/api/friday/send-to-wa-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mengirim ke WhatsApp Admin");
      }
      if (data.sentToAdminWa) {
        alert(`Sukses! Dokumen PDF dan tautan Google Drive berhasil dikirimkan ke WhatsApp Admin (${data.adminPhone}).`);
      } else {
        alert(`Laporan tersimpan di Google Drive, namun pengiriman WhatsApp gagal atau nomor admin belum terdaftar/koneksi bot belum aktif.`);
      }
      await onTriggerManualArchive();
    } catch (e: any) {
      alert(e.message || "Gagal mengirim ke WhatsApp Admin");
    } finally {
      setSendingToWa(false);
    }
  };

  const handleUploadDrive = async (report: WeeklyReport) => {
    setProcessingId(report.id);
    try {
      const url = await onUploadReportToDrive(report);
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e: any) {
      alert(e.message || "Gagal mengunggah ke Google Drive");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteReport = async (report: WeeklyReport) => {
    const periodName = report.periodName || report.id;
    if (!confirm(`Hapus laporan "${periodName}" dari daftar riwayat laporan absen?`)) {
      return;
    }

    setDeletingId(report.id);
    try {
      if (onDeleteReport) {
        await onDeleteReport(report.id);
      } else {
        const res = await fetch("/api/friday/delete-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId: report.id }),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || "Gagal menghapus laporan");
        }
        await onTriggerManualArchive();
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus laporan");
    } finally {
      setDeletingId(null);
    }
  };

  // Test live connection
  const handleTestConnection = async () => {
    setTestingDrive(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/drive/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setTestResult({
          success: false,
          message: data.error || "Gagal terhubung ke Google Drive",
        });
      } else {
        setTestResult({
          success: true,
          message: `Koneksi Google Drive Berhasil Aktif! Folder utama '${data.folderStatus}'.`,
          email: data.userEmail,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || "Gagal menghubungi server",
      });
    } finally {
      setTestingDrive(false);
    }
  };

  // 1-Click Google Sign-In via Google Identity Services
  const handleGoogleSignIn = () => {
    const targetClientId =
      driveStatus?.rawClientId ||
      inputClientId.trim() ||
      "1013398485215-gdtkp63vcjc0rehojrrjriqi42epp9hp.apps.googleusercontent.com";

    if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
      setLoggingInGoogle(true);
      setConfigSuccessMsg("");
      try {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: targetClientId,
          scope: "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email",
          callback: async (response: any) => {
            if (response.error) {
              alert(
                `Gagal otorisasi Google: ${response.error}\n\nCatatan: Jika muncul 'Access Blocked', pastikan email Anda (akuncoding211@gmail.com / yudiakunkerja@gmail.com) sudah dimasukkan ke daftar 'Test users' pada Google Cloud Console, atau ubah status OAuth menjadi 'Publish App'.`
              );
              setLoggingInGoogle(false);
              return;
            }
            try {
              const res = await fetch("/api/drive/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token: response.access_token,
                  clientId: targetClientId,
                }),
              });
              const data = await res.json();
              if (data.success) {
                setConfigSuccessMsg(
                  `Akun Google Drive berhasil terhubung! ${
                    data.testResult?.userEmail ? `(Akun: ${data.testResult.userEmail})` : ""
                  }`
                );
                await fetchDriveStatus();
                if (data.testResult?.success) {
                  setTestResult({
                    success: true,
                    message: `Koneksi Google Drive Aktif! (${data.testResult.folderStatus})`,
                    email: data.testResult.userEmail,
                  });
                }
              } else {
                alert(data.error || "Gagal menyimpan token Google Drive.");
              }
            } catch (err: any) {
              alert("Gagal menyimpan ke server: " + err.message);
            } finally {
              setLoggingInGoogle(false);
            }
          },
        });
        client.requestAccessToken({ prompt: "consent" });
      } catch (err: any) {
        alert("Gagal memunculkan popup Google Login: " + err.message);
        setLoggingInGoogle(false);
      }
    } else {
      alert(
        "Google Identity Services belum siap. Mohon tunggu beberapa detik atau pastikan koneksi internet aktif, lalu muat ulang halaman."
      );
    }
  };

  // Save permanent credentials
  const handleSaveDriveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setConfigSuccessMsg("");
    try {
      const payload: any = {};
      if (inputRefreshToken.trim()) payload.refreshToken = inputRefreshToken.trim();
      if (inputAccessToken.trim()) payload.token = inputAccessToken.trim();
      if (inputClientId.trim()) payload.clientId = inputClientId.trim();
      if (inputClientSecret.trim()) payload.clientSecret = inputClientSecret.trim();

      const res = await fetch("/api/drive/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menyimpan konfigurasi");
      }

      setConfigSuccessMsg("Pengaturan Google Drive berhasil disimpan dan terhubung!");
      await fetchDriveStatus();
      if (data.testResult?.success) {
        setTestResult({
          success: true,
          message: `Koneksi Google Drive Aktif! (${data.testResult.folderStatus})`,
          email: data.testResult.userEmail,
        });
      }
    } catch (err: any) {
      alert(err.message || "Gagal menyimpan konfigurasi");
    } finally {
      setSavingConfig(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily 17:00 Closing & Anti-Duplicate Guarantee Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-1.5">
                <h2 className="text-xl font-bold">Riwayat Laporan Absen (Auto-Save 17:00 WIB)</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Anti-Duplikat Aktif
                </span>
                {driveStatus.isPermanent ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-500/20 text-teal-300 border border-teal-500/40 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-ping mr-1" />
                    Token Permanen 24/7
                  </span>
                ) : driveStatus.isConnected ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Drive Terhubung
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Drive Belum Terhubung
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-300 mt-1.5 max-w-2xl leading-relaxed">
                Setiap hari kerja pada <strong>jam pulang kerja (17:00 WIB)</strong>, aplikasi otomatis menyimpan rekap absensi berformat <strong>PDF ke Google Drive</strong>.
                Dari hari <strong>Senin sampai Jumat</strong>, sistem selalu mengupdate <strong>1 file yang sama</strong> pada periode tersebut tanpa membuat duplikat baru. Khusus hari Jumat, admin bot WA otomatis menerima file PDF beserta tautannya.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-emerald-300">
                <div className="flex items-center space-x-1.5">
                  <FolderTree className="w-4 h-4" />
                  <span className="font-mono font-semibold">
                    Folder: absen &gt; [Bulan] &gt; [Periode]
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-teal-300">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1 Periode = 1 Berkas Terupdate (0 Duplikasi)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowDriveConfig(!showDriveConfig)}
              className="w-full sm:w-auto px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
              title="Konfigurasi token Google Drive permanen tanpa expired"
            >
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pengaturan Google Drive</span>
              {showDriveConfig ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
            </button>

            <button
              onClick={handleManualArchive}
              disabled={manualArchiving}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              title="Simpan berkas PDF absensi hari ini ke Google Drive langsung"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualArchiving ? "animate-spin" : ""}`} />
              <span>{manualArchiving ? "Menyimpan ke Drive..." : "Simpan PDF ke Drive (Jam Pulang)"}</span>
            </button>

            <button
              onClick={handleSendToAdminWa}
              disabled={sendingToWa}
              className="w-full sm:w-auto px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              title="Kirim file PDF mingguan dan link Drive ke WA Admin bot"
            >
              <Send className={`w-3.5 h-3.5 ${sendingToWa ? "animate-pulse" : ""}`} />
              <span>{sendingToWa ? "Mengirim ke WA..." : "Kirim PDF ke WA Admin"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Google Drive Permanent Connection Panel */}
      {showDriveConfig && (
        <div className="bg-white rounded-2xl shadow-sm border border-emerald-200 p-6 space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-emerald-600" />
                <span>Koneksi Google Drive Permanen (Auto-Refresh 24 Jam)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Token Google Drive dan akun Anda akan selalu terhubung dan tidak pernah habis, sehingga server dapat menyimpan absensi harian otomatis pada jam pulang kerja (17:00 WIB) sekalipun aplikasi web sedang tidak dibuka.
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingDrive}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${testingDrive ? "animate-spin text-emerald-600" : ""}`} />
                <span>{testingDrive ? "Menguji Koneksi..." : "Tes Koneksi Google Drive"}</span>
              </button>
            </div>
          </div>

          {/* Status Indicator */}
          <div className={`p-4 rounded-xl border text-xs flex items-start space-x-3 ${
            driveStatus.isPermanent
              ? "bg-teal-50 border-teal-200 text-teal-900"
              : driveStatus.isConnected
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}>
            <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${
              driveStatus.isPermanent ? "text-teal-600" : driveStatus.isConnected ? "text-emerald-600" : "text-amber-600"
            }`} />
            <div className="space-y-1">
              <p className="font-bold text-sm">
                Status Koneksi:{" "}
                {driveStatus.isPermanent
                  ? "🟢 Terhubung Permanen (Auto-Refresh 24/7 Aktif)"
                  : driveStatus.isConnected
                  ? "🟢 Terhubung (Token Aktif)"
                  : "⚪ Belum Terhubung"}
              </p>
              <p className="leading-relaxed">
                {driveStatus.isPermanent
                  ? "Sistem memiliki Refresh Token aktif. Token akses akan di-refresh otomatis setiap saat oleh server sebelum kedaluwarsa. Anda tidak perlu menghubungkan ulang kapan pun."
                  : driveStatus.isConnected
                  ? "Sistem memiliki token akses aktif. Untuk memastikan token tidak pernah habis, masukkan Refresh Token di bawah."
                  : "Silakan masukkan Refresh Token atau Access Token Google Drive di formulir bawah untuk menghubungkan akun."}
              </p>
            </div>
          </div>

          {/* Test Result Message */}
          {testResult && (
            <div className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2 ${
              testResult.success ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {testResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />}
              <span>{testResult.message} {testResult.email && `(Akun: ${testResult.email})`}</span>
            </div>
          )}

          {configSuccessMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{configSuccessMsg}</span>
            </div>
          )}

          {/* 1-Click Google Sign-In */}
          <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-white border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
            <div className="space-y-1">
              <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>Masuk & Hubungkan dengan Akun Google (1-Klik)</span>
              </h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Pilih akun Google Anda (<code>akuncoding211@gmail.com</code> atau <code>yudiakunkerja@gmail.com</code>) untuk menyambungkan Google Drive secara instan tanpa perlu menyalin token secara manual.
              </p>
              {driveStatus.userEmail && (
                <p className="text-[11px] font-semibold text-emerald-700">
                  Akun aktif saat ini: {driveStatus.userEmail}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loggingInGoogle}
              className="px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 font-semibold border border-slate-300 rounded-xl shadow-xs text-xs flex items-center space-x-2 transition-all shrink-0 hover:border-slate-400 active:scale-95 disabled:opacity-50"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>{loggingInGoogle ? "Menghubungkan..." : "Sambungkan Akun Google"}</span>
            </button>
          </div>

          {/* Form manual (opsional / lanjutan) */}
          <div className="pt-2 border-t border-slate-100">
            <details className="text-xs text-slate-500 group">
              <summary className="cursor-pointer font-semibold hover:text-slate-800 list-none flex items-center justify-between py-1">
                <span>Atau Masukkan Token Google Drive Manual (Konfigurasi Lanjutan)</span>
                <span className="text-[10px] text-slate-400 group-open:rotate-180 transition-transform">▼</span>
              </summary>
              <form onSubmit={handleSaveDriveConfig} className="space-y-4 pt-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Google Drive Refresh Token (Kunci Permanen Tidak Pernah Habis)
                </label>
                <input
                  type="text"
                  value={inputRefreshToken}
                  onChange={(e) => setInputRefreshToken(e.target.value)}
                  placeholder="Masukkan Refresh Token (misal: 1//0g...)"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Dengan Refresh Token, server dapat memperbarui token sendiri 24/7 tanpa batas waktu.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Access Token Langsung (Opsional / Sementara)
                </label>
                <input
                  type="text"
                  value={inputAccessToken}
                  onChange={(e) => setInputAccessToken(e.target.value)}
                  placeholder="Masukkan Access Token Bearer (ya29...)"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Bisa diisi jika menggunakan access token langsung (contoh dari Google OAuth Playground).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Google Client ID (Opsional jika memakai OAuth kustom)
                </label>
                <input
                  type="text"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  placeholder="xxxx.apps.googleusercontent.com"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Google Client Secret (Opsional jika memakai OAuth kustom)
                </label>
                <input
                  type="password"
                  value={inputClientSecret}
                  onChange={(e) => setInputClientSecret(e.target.value)}
                  placeholder="GOCSPX-xxxx"
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="submit"
                disabled={savingConfig || (!inputRefreshToken && !inputAccessToken && !inputClientId)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-md transition-colors disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>{savingConfig ? "Menyimpan..." : "Simpan Pengaturan Google Drive Permanen"}</span>
              </button>
            </div>
          </form>
          </details>
          </div>
        </div>
      )}

      {/* Reports List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Daftar Riwayat Laporan Absen</h3>
          </div>
          <span className="text-xs text-slate-500">Total: {fridayReports.length} Laporan Tersimpan</span>
        </div>

        {fridayReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Riwayat Laporan Tersimpan</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Laporan akan terisi otomatis setiap hari kerja pukul 17:00 WIB ke Google Drive, atau Anda dapat mengklik tombol "Simpan PDF ke Drive (Jam Pulang)" di atas.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {fridayReports.map((report) => {
              const periodStr = report.periodName || `Periode ${report.weekStartDate} s/d ${report.weekEndDate}`;
              const monthStr = report.monthName || "September 2026";
              const driveFolderDisplay = `absen > ${monthStr} > ${periodStr}`;

              return (
                <div key={report.id} className="p-5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-bold text-slate-900">{periodStr}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold text-[11px] border border-emerald-200">
                          Format PDF
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[10px] border border-blue-200">
                          1 Berkas Terupdate Otomatis
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-xs text-slate-500">
                        <div className="flex items-center space-x-2">
                          <FolderTree className="w-3.5 h-3.5 text-emerald-600" />
                          <span>
                            Folder Google Drive: <strong>{driveFolderDisplay}</strong>
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Waktu Auto-Arsip: {report.autoSavedAt || report.submittedAt || "Jam Pulang 17:00 WIB"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-700 font-medium pt-1">
                          <span>Total Kehadiran: <strong>{report.totalPresent || 0} hari</strong></span>
                          <span>•</span>
                          <span>Total Uang Makan: <strong className="text-emerald-700">Rp {(report.totalCost || 0).toLocaleString("id-ID")}</strong> (Rp 25.000 /hari)</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-1.5">
                      <button
                        onClick={() => downloadWeeklyReportPDF(report, workers)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
                        title="Unduh file PDF ke perangkat"
                      >
                        <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Unduh PDF</span>
                      </button>

                      {report.driveUrl ? (
                        <a
                          href={report.driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                          title="Buka file di Google Drive"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka di Drive</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => handleUploadDrive(report)}
                          disabled={processingId === report.id}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                          title="Simpan atau perbarui file di Google Drive"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>{processingId === report.id ? "Mengunggah..." : "Simpan ke Drive"}</span>
                        </button>
                      )}

                      {/* Tombol Hapus Laporan */}
                      <button
                        onClick={() => handleDeleteReport(report)}
                        disabled={deletingId === report.id}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        title="Hapus laporan ini dari riwayat"
                      >
                        <Trash2 className={`w-3.5 h-3.5 ${deletingId === report.id ? "animate-spin" : ""}`} />
                        <span>{deletingId === report.id ? "Menghapus..." : "Hapus"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
