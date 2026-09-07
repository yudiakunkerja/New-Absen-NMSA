import React from "react";
import {
  Calendar,
  Users,
  Bot,
  FileCheck,
  Building2,
  MapPin,
  Clock,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";

interface NavbarProps {
  activeTab: "attendance" | "fridayReports" | "workers" | "whatsapp";
  setActiveTab: (tab: "attendance" | "fridayReports" | "workers" | "whatsapp") => void;
  currentTimeStr: string;
  isFriday: boolean;
  isFridayPost5PM: boolean;
  waConnected: boolean;
  driveConnected: boolean;
  onOpenLocationSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentTimeStr,
  isFriday,
  isFridayPost5PM,
  waConnected,
  driveConnected,
  onOpenLocationSettings,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white shadow-md">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight">PT. NMSA</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  Presensi Karyawan
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Nusantara Mineral Sukses Abadi • Terintegrasi Asisten WhatsApp AI
              </p>
            </div>
          </div>

          {/* Time & Friday Status Banner */}
          <div className="hidden md:flex items-center space-x-3 bg-slate-800/80 px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-200 font-medium">{currentTimeStr}</span>
            {isFriday ? (
              <span
                className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                  isFridayPost5PM
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {isFridayPost5PM ? "Jumat ≥ 17:00 (Auto-Arsip Drive Aktif)" : "Jumat (Hari Rekap Mingguan)"}
              </span>
            ) : null}
          </div>

          {/* Quick Badges & Actions */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onOpenLocationSettings}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 flex items-center space-x-1.5 transition-colors"
              title="Pengaturan Radius & Lokasi Kantor"
            >
              <MapPin className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Lokasi Kantor</span>
            </button>

            {/* WA Indicator */}
            <button
              onClick={() => setActiveTab("whatsapp")}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 transition-colors ${
                waConnected
                  ? "bg-emerald-950/60 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
              }`}
            >
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WA AI Bot</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  waConnected ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 sm:space-x-4 border-t border-slate-800 pt-2 pb-2 overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab("attendance")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "attendance"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Presensi Mingguan</span>
          </button>

          <button
            onClick={() => setActiveTab("fridayReports")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "fridayReports"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FileCheck className="w-4 h-4" />
            <span>Riwayat Laporan Jumat & Drive</span>
            {isFriday && <span className="w-2 h-2 rounded-full bg-amber-400" />}
          </button>

          <button
            onClick={() => setActiveTab("whatsapp")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "whatsapp"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Bot className="w-4 h-4 text-emerald-400" />
            <span>Asisten WhatsApp AI</span>
          </button>

          <button
            onClick={() => setActiveTab("workers")}
            className={`px-3.5 py-2 rounded-md font-medium text-xs sm:text-sm flex items-center space-x-2 transition-all whitespace-nowrap ${
              activeTab === "workers"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Data Karyawan (9)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
