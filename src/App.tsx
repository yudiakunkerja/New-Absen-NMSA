import React, { useState, useEffect, useCallback } from "react";
import { Navbar } from "./components/Navbar";
import { AttendanceTable } from "./components/AttendanceTable";
import { WorkerAttendanceView } from "./components/WorkerAttendanceView";
import { WhatsAppAssistantModal } from "./components/WhatsAppAssistantModal";
import { FridayReportsView } from "./components/FridayReportsView";
import { WorkerManagementView } from "./components/WorkerManagementView";
import { OfficeSettingsModal } from "./components/OfficeSettingsModal";
import {
  Worker,
  AttendanceRecord,
  AttendanceLog,
  WeeklyReport,
  OfficeLocation,
  WhatsAppStatus,
} from "./types";
import { INITIAL_WORKERS, DEFAULT_OFFICE_LOCATION } from "./constants";
import { generateWeeklyReportPDFBlob } from "./lib/attendanceSheetGeneratorPDF";
import { saveFridayReportToGoogleDrive } from "./lib/googleWorkspace";

export default function App() {
  // Navigation & Modal state
  const [activeTab, setActiveTab] = useState<"attendance" | "fridayReports" | "workers" | "whatsapp">("attendance");
  const [activeWorkerAttendance, setActiveWorkerAttendance] = useState<Worker | null>(null);
  const [showLocationSettings, setShowLocationSettings] = useState(false);

  // App data state
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [fridayReports, setFridayReports] = useState<WeeklyReport[]>([]);
  const [officeLocation, setOfficeLocation] = useState<OfficeLocation>(DEFAULT_OFFICE_LOCATION);

  // WhatsApp & Drive state
  const [waStatus, setWaStatus] = useState<WhatsAppStatus>({
    status: "disconnected",
    registeredAdminPhone: "",
  });
  const [savingToDrive, setSavingToDrive] = useState(false);
  const [driveUploadSuccessUrl, setDriveUploadSuccessUrl] = useState<string | undefined>(undefined);
  const [googleDriveToken, setGoogleDriveToken] = useState<string>("");

  // Week offset state (0 = current week, -1 = last week, etc.)
  const [weekOffset, setWeekOffset] = useState(0);

  // Jakarta time & Friday check state
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  const [isFriday, setIsFriday] = useState(false);
  const [isFridayPost5PM, setIsFridayPost5PM] = useState(false);

  // Check URL query parameters for direct worker attendance link (e.g. ?worker=W03)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get("worker");
    if (workerParam) {
      const found = workers.find((w) => w.id === workerParam);
      if (found) {
        setActiveWorkerAttendance(found);
      }
    }
  }, [workers]);

  // Live Jakarta clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString("id-ID", {
        timeZone: "Asia/Jakarta",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const dayName = now.toLocaleDateString("id-ID", {
        timeZone: "Asia/Jakarta",
        weekday: "long",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      setCurrentTimeStr(`${dayName} • ${timeStr} WIB`);

      // Friday and 17:00 check
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        weekday: "short",
        hour: "numeric",
        hour12: false,
      }).formatToParts(now);

      const weekday = parts.find((p) => p.type === "weekday")?.value;
      const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);

      const fri = weekday === "Fri";
      setIsFriday(fri);
      setIsFridayPost5PM(fri && hour >= 17);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch shared state from server
  const loadState = useCallback(async () => {
    try {
      const res = await fetch("/api/shared-state");
      if (res.ok) {
        const data = await res.json();
        if (data.workers) setWorkers(data.workers);
        if (data.attendanceRecords) setAttendanceRecords(data.attendanceRecords);
        if (data.attendanceLogs) setAttendanceLogs(data.attendanceLogs);
        if (data.fridayReports) setFridayReports(data.fridayReports);
        if (data.officeLocation) setOfficeLocation(data.officeLocation);
        if (data.googleDriveToken) setGoogleDriveToken(data.googleDriveToken);
      }
    } catch (e) {
      console.error("Failed to load shared state:", e);
    }
  }, []);

  // Fetch WhatsApp status
  const loadWaStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/wa/status");
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
      }
    } catch (e) {
      console.error("Failed to load WA status:", e);
    }
  }, []);

  useEffect(() => {
    loadState();
    loadWaStatus();

    const interval = setInterval(() => {
      loadState();
      loadWaStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadState, loadWaStatus]);

  // Compute Monday Date string based on weekOffset
  const getCalculatedMonday = (offset: number) => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
    const targetMonday = new Date(d.setDate(diff));

    const y = targetMonday.getFullYear();
    const m = String(targetMonday.getMonth() + 1).padStart(2, "0");
    const dayStr = String(targetMonday.getDate()).padStart(2, "0");
    return `${y}-${m}-${dayStr}`;
  };

  const currentMondayStr = getCalculatedMonday(weekOffset);

  // Update a single attendance cell
  const handleUpdateRecord = async (
    workerId: string,
    dateKey: string,
    status: "Hadir" | "Sakit" | "Izin" | "Meeting" | "Cuti" | "Alpa" | "Clear",
    reason?: string
  ) => {
    const updatedRecords = [...attendanceRecords];
    let record = updatedRecords.find((r) => r.workerId === workerId);
    const worker = workers.find((w) => w.id === workerId);

    if (!record) {
      record = {
        workerId,
        attendance: {},
        dailyAllowance: worker?.dailyAllowance || 50000,
        customStatus: {},
        reasons: {},
      };
      updatedRecords.push(record);
    }

    if (!record.attendance) record.attendance = {};
    if (!record.customStatus) record.customStatus = {};
    if (!record.reasons) record.reasons = {};

    if (status === "Hadir") {
      record.attendance[dateKey] = true;
      delete record.customStatus[dateKey];
      delete record.reasons[dateKey];
    } else if (status === "Clear") {
      delete record.attendance[dateKey];
      delete record.customStatus[dateKey];
      delete record.reasons[dateKey];
    } else {
      record.attendance[dateKey] = false;
      record.customStatus[dateKey] = status;
      if (reason) record.reasons[dateKey] = reason;
    }

    setAttendanceRecords(updatedRecords);

    // Save to server
    try {
      await fetch("/api/shared-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceRecords: updatedRecords }),
      });
    } catch (e) {
      console.error("Failed to sync attendance records:", e);
    }
  };

  // Save / Update Worker
  const handleUpdateWorker = async (updated: Worker) => {
    const updatedList = workers.map((w) => (w.id === updated.id ? updated : w));
    setWorkers(updatedList);
    try {
      await fetch("/api/shared-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workers: updatedList }),
      });
    } catch (e) {
      console.error("Failed to update worker:", e);
    }
  };

  // Save Office Location
  const handleSaveOfficeLocation = async (newLoc: OfficeLocation) => {
    setOfficeLocation(newLoc);
    try {
      await fetch("/api/shared-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officeLocation: newLoc }),
      });
    } catch (e) {
      console.error("Failed to update office location:", e);
    }
  };

  // Save registered admin phone for WhatsApp bot
  const handleSaveAdminPhone = async (phone: string) => {
    const res = await fetch("/api/wa/save-admin-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!res.ok) throw new Error("Gagal menyimpan nomor admin");
    await loadWaStatus();
  };

  // Broadcast attendance links to all employees
  const handleBroadcastLinks = async (): Promise<number> => {
    const res = await fetch("/api/wa/broadcast-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appUrl: window.location.origin }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Gagal broadcast link");
    }
    return data.count;
  };

  // Save current week PDF to Google Drive into folder: absen > Bulan > Periode
  const handleSaveCurrentWeekToGoogleDrive = async () => {
    setSavingToDrive(true);
    setDriveUploadSuccessUrl(undefined);
    try {
      // Calculate work days
      const base = new Date(currentMondayStr);
      const friday = new Date(base);
      friday.setDate(base.getDate() + 4);
      const fridayStr = friday.toISOString().split("T")[0];

      const monthName = friday.toLocaleString("id-ID", { month: "long", year: "numeric" });
      const periodName = `Periode ${currentMondayStr.slice(8)}-${fridayStr.slice(8)} ${monthName}`;
      const fileName = `Laporan_Absensi_NMSA_${periodName.replace(/\s+/g, "_")}.pdf`;

      const currentReport: WeeklyReport = {
        id: `REP-${currentMondayStr}-${fridayStr}`,
        weekStartDate: currentMondayStr,
        weekEndDate: fridayStr,
        periodName,
        monthName,
        records: attendanceRecords,
        isSubmitted: true,
      };

      // Generate identical PDF blob as the print layout
      const pdfBlob = await generateWeeklyReportPDFBlob(currentReport, workers);

      // Upload if token is available or prompt user
      let driveUrl: string | undefined = undefined;
      const token = googleDriveToken || (window as any).gapi?.client?.getToken()?.access_token;

      if (token) {
        const uploadResult = await saveFridayReportToGoogleDrive(
          token,
          monthName,
          periodName,
          fileName,
          pdfBlob
        );
        driveUrl = uploadResult.driveUrl;
      }

      // Record in backend Friday reports database
      const saveRes = await fetch("/api/friday/save-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driveUrl }),
      });
      const saveData = await saveRes.json();

      if (driveUrl) {
        setDriveUploadSuccessUrl(driveUrl);
      }

      await loadState();
      alert(
        `Laporan mingguan berhasil disimpan dalam format PDF! \nFolder: absen > ${monthName} > ${periodName}`
      );
    } catch (err: any) {
      alert(`Gagal menyimpan ke Google Drive: ${err.message}`);
    } finally {
      setSavingToDrive(false);
    }
  };

  // Upload specific Friday report to Google Drive
  const handleUploadReportToDrive = async (report: WeeklyReport): Promise<string | undefined> => {
    const monthName = report.monthName || "September 2026";
    const periodName = report.periodName || `Periode ${report.weekStartDate} s/d ${report.weekEndDate}`;
    const fileName = `Laporan_Absensi_NMSA_${periodName.replace(/\s+/g, "_")}.pdf`;

    const pdfBlob = await generateWeeklyReportPDFBlob(report, workers);
    const token = googleDriveToken || (window as any).gapi?.client?.getToken()?.access_token;

    if (!token) {
      throw new Error(
        "Token otorisasi Google Drive belum ditemukan. Silakan hubungkan Google Drive di pengaturan."
      );
    }

    const uploadResult = await saveFridayReportToGoogleDrive(
      token,
      monthName,
      periodName,
      fileName,
      pdfBlob
    );

    // Update backend report record with Drive URL
    const updatedReports = fridayReports.map((r) =>
      r.id === report.id ? { ...r, driveUrl: uploadResult.driveUrl } : r
    );
    setFridayReports(updatedReports);

    await fetch("/api/shared-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fridayReports: updatedReports }),
    });

    return uploadResult.driveUrl;
  };

  // Trigger manual Friday archive
  const handleTriggerManualArchive = async () => {
    await handleSaveCurrentWeekToGoogleDrive();
  };

  // If worker is accessing personal link (or admin previewing worker link)
  if (activeWorkerAttendance) {
    return (
      <WorkerAttendanceView
        worker={activeWorkerAttendance}
        officeLocation={officeLocation}
        onBackToDashboard={() => setActiveWorkerAttendance(null)}
        onAttendanceComplete={() => {
          loadState();
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentTimeStr={currentTimeStr}
        isFriday={isFriday}
        isFridayPost5PM={isFridayPost5PM}
        waConnected={waStatus.status === "connected"}
        driveConnected={Boolean(googleDriveToken)}
        onOpenLocationSettings={() => setShowLocationSettings(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "attendance" && (
          <AttendanceTable
            workers={workers}
            attendanceRecords={attendanceRecords}
            attendanceLogs={attendanceLogs}
            officeLocation={officeLocation}
            currentMondayStr={currentMondayStr}
            onUpdateRecord={handleUpdateRecord}
            onOpenWorkerAttendance={(w) => setActiveWorkerAttendance(w)}
            onSaveToGoogleDrive={handleSaveCurrentWeekToGoogleDrive}
            savingToDrive={savingToDrive}
            driveUploadSuccessUrl={driveUploadSuccessUrl}
            onWeekChange={(offset) => {
              if (offset === 0) setWeekOffset(0);
              else setWeekOffset((prev) => prev + offset);
            }}
            weekOffset={weekOffset}
          />
        )}

        {activeTab === "fridayReports" && (
          <FridayReportsView
            fridayReports={fridayReports}
            workers={workers}
            onTriggerManualArchive={handleTriggerManualArchive}
            onUploadReportToDrive={handleUploadReportToDrive}
            driveConnected={Boolean(googleDriveToken)}
            googleDriveToken={googleDriveToken}
          />
        )}

        {activeTab === "whatsapp" && (
          <WhatsAppAssistantModal
            workers={workers}
            waStatus={waStatus}
            onRefreshStatus={loadWaStatus}
            onSaveAdminPhone={handleSaveAdminPhone}
            onBroadcastLinks={handleBroadcastLinks}
            onStateUpdated={loadState}
          />
        )}

        {activeTab === "workers" && (
          <WorkerManagementView
            workers={workers}
            onUpdateWorker={handleUpdateWorker}
            onOpenWorkerAttendance={(w) => setActiveWorkerAttendance(w)}
          />
        )}
      </main>

      {/* Office Geofence Settings Modal */}
      {showLocationSettings && (
        <OfficeSettingsModal
          officeLocation={officeLocation}
          onSave={handleSaveOfficeLocation}
          onClose={() => setShowLocationSettings(false)}
        />
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        <p>
          © 2026 PT. Nusantara Mineral Sukses Abadi • Sistem Presensi Karyawan & Asisten AI WhatsApp Terintegrasi
        </p>
      </footer>
    </div>
  );
}
