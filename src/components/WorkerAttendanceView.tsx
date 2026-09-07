import React, { useState, useEffect } from "react";
import {
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Building2,
  ArrowLeft,
  Navigation,
  Sparkles,
  Send,
  HelpCircle,
  Stethoscope,
  Briefcase,
  FileEdit,
  Palmtree,
  MessageCircle,
} from "lucide-react";
import { Worker, OfficeLocation } from "../types";

interface WorkerAttendanceViewProps {
  worker: Worker;
  officeLocation: OfficeLocation;
  onBackToDashboard?: () => void;
  onAttendanceComplete?: () => void;
}

export const WorkerAttendanceView: React.FC<WorkerAttendanceViewProps> = ({
  worker,
  officeLocation,
  onBackToDashboard,
  onAttendanceComplete,
}) => {
  const [geoState, setGeoState] = useState<{
    loading: boolean;
    lat: number | null;
    lon: number | null;
    distance: number | null;
    error: string | null;
  }>({
    loading: true,
    lat: null,
    lon: null,
    distance: null,
    error: null,
  });

  const [selectedStatus, setSelectedStatus] = useState<"Sakit" | "Meeting" | "Izin" | "Cuti" | "Lainnya">("Sakit");
  const [reasonNote, setReasonNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    status: string;
    message: string;
  } | null>(null);
  const [countdown, setCountdown] = useState(3);

  // Haversine distance calculator
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  };

  // Detect location on mount
  const detectLocation = () => {
    setGeoState((prev) => ({ ...prev, loading: true, error: null }));
    if (!navigator.geolocation) {
      setGeoState({
        loading: false,
        lat: null,
        lon: null,
        distance: null,
        error: "Peramban Anda tidak mendukung sensor Geolocation GPS.",
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;
        const dist = calculateDistance(
          userLat,
          userLon,
          officeLocation.latitude,
          officeLocation.longitude
        );

        setGeoState({
          loading: false,
          lat: userLat,
          lon: userLon,
          distance: dist,
          error: null,
        });
      },
      (err) => {
        setGeoState({
          loading: false,
          lat: null,
          lon: null,
          distance: 9999, // default to outside range if denied
          error: "Izin lokasi tidak diberikan atau GPS belum aktif. Anda tetap dapat mengisi presensi dengan status di luar kantor.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    detectLocation();
  }, [officeLocation.latitude, officeLocation.longitude]);

  // Handle countdown & auto-close back to WhatsApp
  useEffect(() => {
    if (!submitResult?.success) return;

    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          // Return to WhatsApp
          handleReturnToWhatsApp();
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [submitResult]);

  const handleReturnToWhatsApp = () => {
    try {
      // If opened in popup/tab, try to close
      window.close();
    } catch {}
    // Or redirect to WhatsApp
    window.location.href = "https://wa.me/";
  };

  // Submit Hadir (within range)
  const handleQuickPresent = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/quick-self-attend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: worker.id,
          latitude: geoState.lat,
          longitude: geoState.lon,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mencatat presensi");
      }

      setSubmitResult({
        success: true,
        status: "Hadir",
        message: `Presensi Hadir berhasil dicatat pada ${data.time} WIB. Lokasi Anda terverifikasi di kantor (jarak ${data.distance}m).`,
      });
      onAttendanceComplete?.();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat memproses presensi.");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Outside Range (Sakit, Meeting, Izin, Cuti, Lainnya)
  const handleOutsideStatusSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/quick-self-attend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: worker.id,
          latitude: geoState.lat,
          longitude: geoState.lon,
          customStatus: selectedStatus,
          reason: reasonNote.trim() || `Presensi ${selectedStatus}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal mencatat presensi");
      }

      setSubmitResult({
        success: true,
        status: selectedStatus,
        message: `Status ${selectedStatus} berhasil dicatat pada ${data.time} WIB.`,
      });
      onAttendanceComplete?.();
    } catch (err: any) {
      alert(err.message || "Terjadi kesalahan saat memproses presensi.");
    } finally {
      setSubmitting(false);
    }
  };

  const isWithinRange =
    geoState.distance !== null && geoState.distance <= officeLocation.radiusMeters;

  // Render Success screen if submitted
  if (submitResult?.success) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-xl border border-slate-200 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-sm">
            <CheckCircle2 className="w-12 h-12" />
          </div>

          <h2 className="text-2xl font-bold text-slate-800 mb-2">Presensi Berhasil!</h2>
          <p className="text-emerald-700 font-semibold text-lg mb-3">Status: {submitResult.status}</p>

          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Terima kasih, <strong>{worker.name}</strong>. Presensi harian Anda telah tersimpan secara otomatis di sistem
            PT. Nusantara Mineral Sukses Abadi.
          </p>

          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 mb-6">
            <p className="text-xs text-emerald-800 font-medium">
              Mengalihkan kembali ke WhatsApp dalam <strong>{countdown}</strong> detik...
            </p>
          </div>

          <div className="space-y-2">
            <button
              onClick={handleReturnToWhatsApp}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-2 shadow-md transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <span>Kembali ke WhatsApp Sekarang</span>
            </button>

            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="w-full py-2.5 px-4 text-slate-500 hover:text-slate-700 text-xs font-medium transition-colors"
              >
                Buka Dasbor Admin
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        {/* Header Banner */}
        <div className="bg-slate-900 text-white p-6 relative">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="absolute top-4 left-4 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Kembali ke Dasbor"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="text-center pt-2">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-3 shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Presensi Mandiri NMSA</h1>
            <p className="text-xs text-slate-300 mt-1">PT. Nusantara Mineral Sukses Abadi</p>
          </div>
        </div>

        {/* Worker Info Card */}
        <div className="p-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-6 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider block">
                Karyawan Terverifikasi (Tanpa PIN)
              </span>
              <h2 className="text-lg font-bold text-slate-800">{worker.name}</h2>
              <p className="text-xs text-slate-500">
                ID: {worker.id} • {worker.role}
              </p>
            </div>
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center text-base border border-emerald-500/20">
              {worker.name.charAt(0)}
            </div>
          </div>

          {/* GPS Location Status */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700 flex items-center space-x-1.5">
                <Navigation className="w-3.5 h-3.5 text-emerald-600" />
                <span>Status Lokasi Presensi</span>
              </span>
              <button
                onClick={detectLocation}
                disabled={geoState.loading}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium underline flex items-center space-x-1"
              >
                <span>Perbarui GPS</span>
              </button>
            </div>

            {geoState.loading ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-600">Mendeteksi lokasi koordinat GPS Anda...</p>
              </div>
            ) : isWithinRange ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                      Lokasi Terverifikasi (Dalam Kantor)
                    </span>
                    <p className="text-sm font-semibold text-emerald-950 mt-0.5">
                      Jarak: {geoState.distance} meter dari kantor
                    </p>
                    <p className="text-xs text-emerald-700 mt-1">
                      Batas radius: {officeLocation.radiusMeters}m. Anda memenuhi syarat untuk absen Hadir langsung.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                      Di Luar Jangkauan Kantor
                    </span>
                    <p className="text-sm font-semibold text-amber-950 mt-0.5">
                      Jarak: {geoState.distance === 9999 ? "Tidak terdeteksi" : `${geoState.distance} meter`}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Batas jangkauan kantor: {officeLocation.radiusMeters}m. Silakan pilih status ketidakhadiran Anda di bawah ini.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Conditional Action: In Range (Hadir) vs Out of Range (Sakit/Meeting/Izin/Cuti/Lainnya) */}
          {isWithinRange ? (
            <div className="space-y-4">
              <button
                onClick={handleQuickPresent}
                disabled={submitting || geoState.loading}
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-base rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-3 transition-all disabled:opacity-50"
              >
                <CheckCircle2 className="w-6 h-6" />
                <span>{submitting ? "Memproses Absensi..." : "KLIK ABSEN HADIR SEKARANG"}</span>
              </button>
              <p className="text-center text-xs text-slate-500">
                Setelah klik absen, aplikasi akan mencatat kehadiran dan otomatis kembali ke WhatsApp.
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Pilih Alasan / Status Hari Ini
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "Sakit", label: "Sakit", icon: Stethoscope, color: "rose" },
                    { id: "Meeting", label: "Meeting", icon: Briefcase, color: "blue" },
                    { id: "Izin", label: "Izin", icon: FileEdit, color: "amber" },
                    { id: "Cuti", label: "Cuti", icon: Palmtree, color: "purple" },
                    { id: "Lainnya", label: "Lainnya", icon: HelpCircle, color: "slate" },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = selectedStatus === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedStatus(item.id as any)}
                        className={`p-3 rounded-xl border text-left flex items-center space-x-2.5 transition-all ${
                          isSelected
                            ? "bg-slate-900 border-slate-900 text-white shadow-sm ring-2 ring-slate-900/20"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
                        <span className="text-xs font-semibold">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Keterangan Tambahan (Opsional)
                </label>
                <textarea
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  placeholder="Contoh: Sakit demam, meeting dengan klien di Jakarta Barat, izin urusan keluarga..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <button
                onClick={handleOutsideStatusSubmit}
                disabled={submitting}
                className="w-full py-3.5 px-6 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>{submitting ? "Menyimpan Status..." : `Kirim Presensi (${selectedStatus})`}</span>
              </button>
            </div>
          )}

          {/* Quick FAQ info */}
          <div className="mt-8 pt-4 border-t border-slate-200 text-center">
            <p className="text-[11px] text-slate-400">
              Absensi tanpa PIN • PT. Nusantara Mineral Sukses Abadi • Terhubung dengan Asisten WhatsApp AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
