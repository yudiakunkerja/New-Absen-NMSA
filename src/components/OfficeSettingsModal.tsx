import React, { useState } from "react";
import { MapPin, Save, X, Navigation, Check } from "lucide-react";
import { OfficeLocation } from "../types";

interface OfficeSettingsModalProps {
  officeLocation: OfficeLocation;
  onSave: (location: OfficeLocation) => void;
  onClose: () => void;
}

export const OfficeSettingsModal: React.FC<OfficeSettingsModalProps> = ({
  officeLocation,
  onSave,
  onClose,
}) => {
  const [form, setForm] = useState<OfficeLocation>({ ...officeLocation });
  const [detecting, setDetecting] = useState(false);

  const handleGetCurrentGps = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung geolokasi.");
      return;
    }
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setDetecting(false);
      },
      (err) => {
        alert("Gagal membaca GPS: " + err.message);
        setDetecting(false);
      }
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <MapPin className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-slate-900">Pengaturan Lokasi Kantor NMSA</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Karyawan yang berada dalam batas radius lokasi kantor ini akan langsung dapat mencatat presensi <strong>Hadir</strong> (tanpa PIN). Di luar radius ini, aplikasi otomatis menawarkan pilihan Sakit/Meeting/Izin/Lainnya.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nama Lokasi</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((prev) => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((prev) => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Radius Jangkauan Presensi (Meter)
            </label>
            <input
              type="number"
              value={form.radiusMeters}
              onChange={(e) => setForm((prev) => ({ ...prev, radiusMeters: parseInt(e.target.value) || 150 }))}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-200"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Default: 150 meter</span>
          </div>

          <button
            type="button"
            onClick={handleGetCurrentGps}
            disabled={detecting}
            className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            <span>{detecting ? "Mendeteksi..." : "Gunakan Posisi GPS Saya Saat Ini"}</span>
          </button>

          <div className="pt-3 border-t border-slate-100 flex space-x-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span>Simpan Pengaturan</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
            >
              Batal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
