import React, { useState } from "react";
import {
  Check,
  X,
  FileDown,
  CloudUpload,
  Calendar,
  Share2,
  Copy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  MapPin,
  Clock,
  Send,
} from "lucide-react";
import { Worker, AttendanceRecord, AttendanceLog, WeeklyReport, OfficeLocation } from "../types";
import { INDONESIAN_DAYS } from "../constants";
import { downloadWeeklyReportPDF } from "../lib/attendanceSheetGeneratorPDF";

interface AttendanceTableProps {
  workers: Worker[];
  attendanceRecords: AttendanceRecord[];
  attendanceLogs: AttendanceLog[];
  officeLocation: OfficeLocation;
  currentMondayStr: string;
  onUpdateRecord: (
    workerId: string,
    dateKey: string,
    status: "Hadir" | "Sakit" | "Izin" | "Meeting" | "Cuti" | "Alpa" | "Clear",
    reason?: string
  ) => void;
  onOpenWorkerAttendance: (worker: Worker) => void;
  onSaveToGoogleDrive: () => void;
  savingToDrive: boolean;
  driveUploadSuccessUrl?: string;
  onWeekChange: (offset: number) => void;
  weekOffset: number;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  workers,
  attendanceRecords,
  attendanceLogs,
  officeLocation,
  currentMondayStr,
  onUpdateRecord,
  onOpenWorkerAttendance,
  onSaveToGoogleDrive,
  savingToDrive,
  driveUploadSuccessUrl,
  onWeekChange,
  weekOffset,
}) => {
  const [copiedWorkerId, setCopiedWorkerId] = useState<string | null>(null);
  const [activeDropdown, setActiveDropdown] = useState<{ workerId: string; dateKey: string } | null>(null);

  // Generate 5 work days (Senin - Jumat) from Monday date
  const getWorkDays = (mondayDateStr: string) => {
    const dates: { dateKey: string; dayName: string; formatted: string }[] = [];
    const base = new Date(mondayDateStr);
    const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];

    for (let i = 0; i < 5; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const dateKey = `${y}-${m}-${day}`;
      dates.push({
        dateKey,
        dayName: dayNames[i],
        formatted: `${day}/${m}`,
      });
    }
    return dates;
  };

  const workDays = getWorkDays(currentMondayStr);
  const fridayDateStr = workDays[4]?.dateKey || currentMondayStr;

  // Build current WeeklyReport object for PDF printing
  const currentReport: WeeklyReport = {
    id: `REP-${currentMondayStr}-${fridayDateStr}`,
    weekStartDate: currentMondayStr,
    weekEndDate: fridayDateStr,
    periodName: `Periode ${currentMondayStr.slice(8)}-${fridayDateStr.slice(8)} ${workDays[0]?.dateKey.slice(0, 7)}`,
    monthName: new Date(currentMondayStr).toLocaleString("id-ID", { month: "long", year: "numeric" }),
    records: attendanceRecords,
    isSubmitted: false,
  };

  // Copy worker attendance link
  const handleCopyLink = (workerId: string) => {
    const origin = window.location.origin;
    const link = `${origin}/?worker=${workerId}`;
    navigator.clipboard.writeText(link);
    setCopiedWorkerId(workerId);
    setTimeout(() => setCopiedWorkerId(null), 2500);
  };

  // Helper to extract status for specific worker and date
  const getCellStatus = (workerId: string, dateKey: string) => {
    const rec = attendanceRecords.find((r) => r.workerId === workerId);
    if (!rec) return { status: "Empty", label: "-", color: "slate" };

    const custom = rec.customStatus?.[dateKey];
    if (custom) {
      if (custom === "Sakit") return { status: "Sakit", label: "Sakit", color: "rose" };
      if (custom === "Izin") return { status: "Izin", label: "Izin", color: "amber" };
      if (custom === "Meeting") return { status: "Meeting", label: "Meeting", color: "blue" };
      if (custom === "Cuti") return { status: "Cuti", label: "Cuti", color: "purple" };
      return { status: custom, label: custom, color: "slate" };
    }

    if (rec.attendance?.[dateKey] === true) {
      return { status: "Hadir", label: "Hadir", color: "emerald" };
    }
    if (rec.attendance?.[dateKey] === false) {
      return { status: "Alpa", label: "Alpa", color: "slate" };
    }

    return { status: "Empty", label: "-", color: "slate" };
  };

  // Compute summary stats
  const totalEmployees = workers.length;
  const todayDateStr = new Date().toISOString().split("T")[0];

  const todayHadir = workers.filter((w) => {
    const rec = attendanceRecords.find((r) => r.workerId === w.id);
    return rec?.attendance?.[todayDateStr] === true;
  }).length;

  const todaySpecial = workers.filter((w) => {
    const rec = attendanceRecords.find((r) => r.workerId === w.id);
    return Boolean(rec?.customStatus?.[todayDateStr]);
  }).length;

  const todayBelum = totalEmployees - todayHadir - todaySpecial;

  // Total weekly meal allowances
  const totalWeeklyAllowance = workers.reduce((sum, w) => {
    const rec = attendanceRecords.find((r) => r.workerId === w.id);
    const presentDays = workDays.filter((d) => rec?.attendance?.[d.dateKey] === true).length;
    return sum + presentDays * (w.dailyAllowance || 50000);
  }, 0);

  return (
    <div className="space-y-6">
      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Karyawan</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{totalEmployees} <span className="text-xs font-normal text-slate-500">Orang</span></p>
          <span className="text-[11px] text-emerald-600 font-medium mt-1 block">PT. Nusantara Mineral Sukses Abadi</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Hadir Hari Ini</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{todayHadir} <span className="text-xs font-normal text-slate-500">Karyawan</span></p>
          <span className="text-[11px] text-slate-400 mt-1 block">Terverifikasi sistem</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Sakit / Izin / Meeting</span>
          <p className="text-2xl font-bold text-amber-600 mt-1">{todaySpecial} <span className="text-xs font-normal text-slate-500">Karyawan</span></p>
          <span className="text-[11px] text-slate-400 mt-1 block">Dengan keterangan</span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 block">Total Uang Makan Minggu Ini</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">
            Rp {(totalWeeklyAllowance / 1000).toLocaleString("id-ID")}k
          </p>
          <span className="text-[11px] text-slate-400 mt-1 block">Rp 50.000 / hari kerja</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Table Controls & Action Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Week Navigation */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => onWeekChange(-1)}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                title="Minggu Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => onWeekChange(0)}
                disabled={weekOffset === 0}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white text-slate-700 transition-colors disabled:opacity-50"
              >
                Minggu Ini
              </button>
              <button
                onClick={() => onWeekChange(1)}
                className="p-1.5 rounded-lg hover:bg-white text-slate-700 transition-colors"
                title="Minggu Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {workDays[0]?.formatted} s/d {workDays[4]?.formatted} (Senin - Jumat)
              </h3>
              <p className="text-xs text-slate-500">
                Bulan: {new Date(currentMondayStr).toLocaleString("id-ID", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => downloadWeeklyReportPDF(currentReport, workers)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Cetak / Unduh PDF</span>
            </button>

            <button
              onClick={onSaveToGoogleDrive}
              disabled={savingToDrive}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors disabled:opacity-50"
              title="Simpan otomatis ke Google Drive (folder: absen > Bulan > Periode)"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{savingToDrive ? "Menyimpan ke Drive..." : "Simpan PDF ke Google Drive"}</span>
            </button>
          </div>
        </div>

        {driveUploadSuccessUrl && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-xs text-emerald-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Laporan berhasil disimpan ke Google Drive dalam format PDF!</span>
            </div>
            <a
              href={driveUploadSuccessUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline text-emerald-700 hover:text-emerald-900 flex items-center space-x-1"
            >
              <span>Buka di Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        )}

        {/* Attendance Matrix Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-3.5 px-4 w-12 text-center">No</th>
                <th className="py-3.5 px-4">Nama Karyawan</th>
                <th className="py-3.5 px-4">Jabatan</th>
                {workDays.map((day) => (
                  <th key={day.dateKey} className="py-3.5 px-3 text-center min-w-[85px]">
                    <div>{day.dayName}</div>
                    <div className="text-[10px] font-normal text-slate-400">{day.formatted}</div>
                  </th>
                ))}
                <th className="py-3.5 px-3 text-center font-bold">Hadir</th>
                <th className="py-3.5 px-4 text-right">Uang Makan</th>
                <th className="py-3.5 px-4 text-center">Link Absensi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {workers.map((worker, index) => {
                const rec = attendanceRecords.find((r) => r.workerId === worker.id);
                const presentCount = workDays.filter(
                  (d) => rec?.attendance?.[d.dateKey] === true
                ).length;
                const allowanceRate = worker.dailyAllowance || 50000;
                const totalAllowance = presentCount * allowanceRate;

                return (
                  <tr key={worker.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-center font-medium text-slate-400">{index + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{worker.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {worker.id} • {worker.phoneNumber || "-"}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{worker.role}</td>

                    {/* Monday - Friday Cells */}
                    {workDays.map((day) => {
                      const cell = getCellStatus(worker.id, day.dateKey);
                      const isDropdownOpen =
                        activeDropdown?.workerId === worker.id &&
                        activeDropdown?.dateKey === day.dateKey;

                      return (
                        <td key={day.dateKey} className="py-3 px-2 text-center relative">
                          <button
                            onClick={() =>
                              setActiveDropdown(
                                isDropdownOpen
                                  ? null
                                  : { workerId: worker.id, dateKey: day.dateKey }
                              )
                            }
                            className={`w-full py-1.5 px-2 rounded-lg font-semibold text-[11px] transition-all border ${
                              cell.status === "Hadir"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100"
                                : cell.status === "Sakit"
                                ? "bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
                                : cell.status === "Izin"
                                ? "bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100"
                                : cell.status === "Meeting"
                                ? "bg-blue-50 text-blue-700 border-blue-300 hover:bg-blue-100"
                                : cell.status === "Cuti"
                                ? "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                                : cell.status === "Alpa"
                                ? "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
                                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                            }`}
                            title={`Ubah status ${day.dayName} untuk ${worker.name}`}
                          >
                            {cell.label}
                          </button>

                          {/* Inline Dropdown for Status Override */}
                          {isDropdownOpen && (
                            <div className="absolute z-30 top-full left-1/2 -translate-x-1/2 mt-1 w-36 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 space-y-1 text-left">
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Hadir");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-emerald-50 text-emerald-700 font-medium text-xs flex items-center space-x-1.5"
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span>Hadir</span>
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Sakit");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-rose-50 text-rose-700 font-medium text-xs flex items-center space-x-1.5"
                              >
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span>Sakit</span>
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Izin");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-amber-50 text-amber-700 font-medium text-xs flex items-center space-x-1.5"
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                                <span>Izin</span>
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Meeting");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-blue-50 text-blue-700 font-medium text-xs flex items-center space-x-1.5"
                              >
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>Meeting</span>
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Cuti");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-purple-50 text-purple-700 font-medium text-xs flex items-center space-x-1.5"
                              >
                                <span className="w-2 h-2 rounded-full bg-purple-500" />
                                <span>Cuti</span>
                              </button>
                              <button
                                onClick={() => {
                                  onUpdateRecord(worker.id, day.dateKey, "Clear");
                                  setActiveDropdown(null);
                                }}
                                className="w-full px-2.5 py-1 text-left rounded-md hover:bg-slate-100 text-slate-500 font-medium text-xs"
                              >
                                Kosongkan (-)
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Total Present */}
                    <td className="py-3 px-3 text-center font-bold text-slate-900 bg-slate-50/50">
                      {presentCount} <span className="text-[10px] text-slate-400 font-normal">hari</span>
                    </td>

                    {/* Wage Allowance */}
                    <td className="py-3 px-4 text-right font-bold text-slate-800">
                      Rp {totalAllowance.toLocaleString("id-ID")}
                    </td>

                    {/* Action link */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => onOpenWorkerAttendance(worker)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
                          title="Buka Halaman Presensi Mandiri (Tanpa PIN)"
                        >
                          Buka Absen
                        </button>
                        <button
                          onClick={() => handleCopyLink(worker.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Salin Tautan Absensi Karyawan"
                        >
                          {copiedWorkerId === worker.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-100/80 font-bold text-slate-800 border-t border-slate-200">
              <tr>
                <td colSpan={8} className="py-3 px-4 text-right">
                  TOTAL BIAYA UANG MAKAN MINGGU INI:
                </td>
                <td className="py-3 px-3 text-center">
                  {workers.reduce((acc, w) => {
                    const rec = attendanceRecords.find((r) => r.workerId === w.id);
                    return (
                      acc +
                      workDays.filter((d) => rec?.attendance?.[d.dateKey] === true).length
                    );
                  }, 0)}{" "}
                  hari
                </td>
                <td className="py-3 px-4 text-right text-emerald-700 text-sm">
                  Rp {totalWeeklyAllowance.toLocaleString("id-ID")}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Live Attendance Logs Stream */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Riwayat Catatan Presensi Real-Time</h3>
          </div>
          <span className="text-xs text-slate-400">
            Terakhir diperbarui: {new Date().toLocaleTimeString("id-ID")} WIB
          </span>
        </div>

        {attendanceLogs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Belum ada aktivitas presensi yang tercatat hari ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
            {attendanceLogs.slice(0, 15).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      log.status === "Hadir"
                        ? "bg-emerald-500"
                        : log.status === "Sakit"
                        ? "bg-rose-500"
                        : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <span className="font-semibold text-slate-800">{log.workerName}</span>
                    <span className="text-slate-400 ml-2">({log.status})</span>
                    <p className="text-[11px] text-slate-400">{log.address || log.notes || "-"}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 font-mono">
                  {log.date} • {log.time}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
