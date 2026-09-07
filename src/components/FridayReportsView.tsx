import React, { useState } from "react";
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
} from "lucide-react";
import { WeeklyReport, Worker } from "../types";
import { downloadWeeklyReportPDF } from "../lib/attendanceSheetGeneratorPDF";

interface FridayReportsViewProps {
  fridayReports: WeeklyReport[];
  workers: Worker[];
  onTriggerManualArchive: () => Promise<void>;
  onUploadReportToDrive: (report: WeeklyReport) => Promise<string | undefined>;
  driveConnected: boolean;
  googleDriveToken?: string;
}

export const FridayReportsView: React.FC<FridayReportsViewProps> = ({
  fridayReports,
  workers,
  onTriggerManualArchive,
  onUploadReportToDrive,
  driveConnected,
  googleDriveToken,
}) => {
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [manualArchiving, setManualArchiving] = useState(false);

  const handleManualArchive = async () => {
    if (!confirm("Simpan dan arsipkan laporan absensi minggu ini ke Riwayat Laporan Jumat sekarang?")) return;
    setManualArchiving(true);
    try {
      await onTriggerManualArchive();
    } catch (e: any) {
      alert(e.message || "Gagal mengarsipkan laporan");
    } finally {
      setManualArchiving(false);
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

  return (
    <div className="space-y-6">
      {/* Friday 17:00 Auto-Save Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold">Auto-Arsip Laporan Jumat Jam 17:00 WIB</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Otomatis Aktif
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Setiap hari <strong>Jumat sore pukul 17:00 WIB (jam pulang kerja)</strong>, baik aplikasi dibuka maupun
                tidak dibuka, sistem background server secara otomatis menyimpan rekap kehadiran mingguan ke riwayat
                laporan dan mengunggah dokumen <strong>PDF</strong> ke Google Drive.
              </p>
              <div className="mt-3 flex items-center space-x-2 text-xs text-emerald-300">
                <FolderTree className="w-4 h-4" />
                <span className="font-mono font-semibold">
                  Struktur Folder Drive: absen &gt; [Bulan] &gt; [Periode]
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <button
              onClick={handleManualArchive}
              disabled={manualArchiving}
              className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${manualArchiving ? "animate-spin" : ""}`} />
              <span>{manualArchiving ? "Mengarsipkan..." : "Arsipkan Laporan Jumat Sekarang"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-900">Daftar Riwayat Laporan Jumat & Google Drive</h3>
          </div>
          <span className="text-xs text-slate-500">Total: {fridayReports.length} Laporan Tersimpan</span>
        </div>

        {fridayReports.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">Belum Ada Riwayat Laporan Jumat</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Laporan akan terisi otomatis setiap hari Jumat pukul 17:00 WIB, atau Anda dapat mengklik tombol "Arsipkan Laporan Jumat Sekarang" di atas.
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
                            Waktu Auto-Arsip: {report.autoSavedAt || report.submittedAt || "Jumat 17:00 WIB"}
                          </span>
                        </div>
                        <div className="flex items-center space-x-3 text-slate-700 font-medium pt-1">
                          <span>Total Kehadiran: <strong>{report.totalPresent || 0} hari</strong></span>
                          <span>•</span>
                          <span>Total Uang Makan: <strong className="text-emerald-700">Rp {(report.totalCost || 0).toLocaleString("id-ID")}</strong></span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => downloadWeeklyReportPDF(report, workers)}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
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
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Buka di Drive</span>
                        </a>
                      ) : (
                        <button
                          onClick={() => handleUploadDrive(report)}
                          disabled={processingId === report.id}
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                          <span>{processingId === report.id ? "Mengunggah..." : "Simpan ke Drive"}</span>
                        </button>
                      )}
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
