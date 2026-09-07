import React, { useState, useEffect } from "react";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  Clock,
  Sparkles,
  Info,
  CalendarDays,
  ShieldAlert,
  Bot,
  RefreshCw,
} from "lucide-react";
import { HolidayEntry, WhatsAppStatus } from "../types";

interface HolidaysScheduleTabProps {
  waStatus: WhatsAppStatus;
  onRefresh: () => void;
}

export const HolidaysScheduleTab: React.FC<HolidaysScheduleTabProps> = ({
  waStatus,
  onRefresh,
}) => {
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add form state
  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"sudden_government" | "national" | "cuti_bersama" | "company">("sudden_government");
  const [newNotes, setNewNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/holidays");
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays || []);
      }
    } catch (err) {
      console.error("Failed to load holidays:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || !newName.trim()) {
      alert("Tanggal dan Nama Libur wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/holidays/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: newDate,
          name: newName.trim(),
          type: newType,
          notes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Hari libur "${newName}" berhasil ditetapkan! Bot tidak akan mengirimkan link pada tanggal tersebut.`);
        setNewDate("");
        setNewName("");
        setNewNotes("");
        setShowAddForm(false);
        fetchHolidays();
        onRefresh();
        setTimeout(() => setNotification(null), 6000);
      } else {
        alert(data.error || "Gagal menambahkan hari libur");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteHoliday = async (date: string, name: string) => {
    if (!confirm(`Batalkan status libur untuk tanggal ${date} (${name})?`)) return;
    try {
      const res = await fetch("/api/holidays/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification(`Hari libur tanggal ${date} telah dibatalkan.`);
        fetchHolidays();
        onRefresh();
        setTimeout(() => setNotification(null), 5000);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const todayStatus = waStatus.todayHolidayStatus;
  const botSettings = waStatus.botDispatchSettings;

  return (
    <div className="space-y-6">
      {/* Notification banner */}
      {notification && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-medium flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notification}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-700 font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* TODAY STATUS HERO CARD */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <CalendarDays className="w-5 h-5 text-indigo-400" />
              <span className="text-xs uppercase tracking-wider text-indigo-300 font-bold">
                Status Kalender Kerja & Bot Hari Ini
              </span>
            </div>
            <h2 className="text-2xl font-bold">
              {todayStatus ? `${todayStatus.dayName}, ${todayStatus.date}` : "Memeriksa Status..."}
            </h2>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {todayStatus?.isHoliday && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                  <span>
                    {todayStatus.isSuddenGovernmentHoliday
                      ? `Libur Mendadak Pemerintah: ${todayStatus.holidayName || ""}`
                      : `Hari Libur Nasional: ${todayStatus.holidayName || ""}`}
                  </span>
                </span>
              )}
              {todayStatus?.isWeekend && !todayStatus?.isHoliday && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Akhir Pekan ({todayStatus.dayName})</span>
                </span>
              )}
              {todayStatus?.canSendAttendance && (
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Hari Kerja Aktif</span>
                </span>
              )}
            </div>
          </div>

          {/* Bot Behavior Decision Card */}
          <div className="bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/10 md:min-w-[280px]">
            <div className="text-xs text-slate-300 flex items-center space-x-1.5 mb-1.5 font-semibold">
              <Bot className="w-4 h-4 text-emerald-400" />
              <span>Perilaku Otomatis Bot Pagi:</span>
            </div>
            {todayStatus?.canSendAttendance ? (
              <div>
                <p className="text-sm font-bold text-emerald-300 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Aktif Mengirim Link</span>
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Jadwal: Jam <strong>{botSettings?.dispatchTime || "08:00"} WIB</strong> ke seluruh karyawan aktif.
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-bold text-amber-300 flex items-center space-x-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Otomatis Tidak Mengirim (Libur)</span>
                </p>
                <p className="text-xs text-slate-300 mt-1">
                  Alasan: <strong>{todayStatus?.reason || "Hari Libur / Akhir Pekan"}</strong>. Bot tidak mengganggu karyawan saat hari libur.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WHATSAPP AI COMMAND TIPS CARD */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-emerald-950">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-emerald-900">
              Penetapan Hari Libur Mendadak Bisa Langsung Lewat Chat WhatsApp!
            </h4>
            <p className="text-xs text-emerald-800 mt-1">
              Jika pemerintah sewaktu-waktu menetapkan hari libur nasional atau cuti bersama secara mendadak (misalnya: Pemilu, Pilkada serentak, bencana, atau pengumuman istana), Admin cukup mengirim chat ke WhatsApp AI Bot:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3 text-xs">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-300 font-mono text-emerald-900">
                💬 <em>"Tetapkan besok libur nasional mendadak Pilkada Serentak"</em>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-300 font-mono text-emerald-900">
                💬 <em>"Hari ini libur nasional mendadak pemerintah"</em>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-300 font-mono text-emerald-900">
                💬 <em>"Batalkan libur tanggal 8 September"</em>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700 mt-2">
              Bot AI akan langsung mencatatnya ke sistem dan otomatis menghentikan kiriman presensi di tanggal tersebut tanpa perlu membuka web aplikasi.
            </p>
          </div>
        </div>
      </div>

      {/* ADD HOLIDAY FORM OR BUTTON */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Daftar Hari Libur Nasional & Libur Mendadak Pemerintah (2026)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Mencakup hari libur nasional resmi, cuti bersama, serta libur mendadak yang ditetapkan pemerintah.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? "Tutup Form" : "Tambah Hari Libur Mendadak"}</span>
          </button>
        </div>

        {/* Modal / In-line Form */}
        {showAddForm && (
          <form onSubmit={handleAddHoliday} className="mb-6 p-4 rounded-xl bg-slate-50 border border-indigo-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Form Penetapan Hari Libur Khusus / Mendadak
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tanggal Libur (YYYY-MM-DD) *
                </label>
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Hari Libur / Keterangan Resmi *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pilkada Serentak / Libur Khusus"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori Libur
                </label>
                <select
                  value={newType}
                  onChange={(e: any) => setNewType(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="sudden_government">Libur Nasional Mendadak Pemerintah</option>
                  <option value="national">Hari Libur Nasional Resmi</option>
                  <option value="cuti_bersama">Cuti Bersama</option>
                  <option value="company">Libur Internal Perusahaan (NMSA)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <input
                type="text"
                placeholder="Contoh: Berdasarkan Keputusan Presiden No. XX / Surat Edaran"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Simpan Hari Libur"}
              </button>
            </div>
          </form>
        )}

        {/* HOLIDAY TABLE */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Nama Hari Libur</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Sumber / Pencatat</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {holidays.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    {loading ? "Memuat data libur..." : "Belum ada data hari libur"}
                  </td>
                </tr>
              ) : (
                holidays.map((h) => {
                  const isPast = h.date < (todayStatus?.date || "");
                  const isToday = h.date === (todayStatus?.date || "");
                  const isCustom = h.addedBy === "admin" || h.addedBy === "whatsapp_ai" || h.type === "sudden_government";

                  return (
                    <tr
                      key={h.id || h.date}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isToday ? "bg-amber-50/60 font-semibold" : isPast ? "opacity-60" : ""
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <span>{h.date}</span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-200 text-amber-900 font-bold">
                              HARI INI
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-900 font-medium">
                        <div className="flex flex-col">
                          <span>{h.name}</span>
                          {h.notes && <span className="text-[11px] text-slate-500">{h.notes}</span>}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {h.type === "sudden_government" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            🚨 Libur Mendadak Pemerintah
                          </span>
                        ) : h.type === "cuti_bersama" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            Cuti Bersama
                          </span>
                        ) : h.type === "company" ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-800">
                            Libur Perusahaan
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800">
                            Libur Nasional
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {h.addedBy === "whatsapp_ai" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1 w-fit">
                            <Bot className="w-3 h-3 text-emerald-600" />
                            <span>Chat WhatsApp AI</span>
                          </span>
                        ) : h.addedBy === "admin" ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                            Admin Web
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] text-slate-500">
                            SKB 3 Menteri
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isCustom ? (
                          <button
                            onClick={() => handleDeleteHoliday(h.date, h.name)}
                            className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Batalkan Libur"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-[11px]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
