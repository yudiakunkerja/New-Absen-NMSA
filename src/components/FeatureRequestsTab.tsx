import React, { useState, useEffect } from "react";
import {
  Sparkles,
  Bot,
  MessageCircle,
  Copy,
  Check,
  Plus,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  ListTodo,
  Layers,
  FileCode,
  Lightbulb,
} from "lucide-react";
import { FeatureRequestEntry, WhatsAppStatus } from "../types";

interface FeatureRequestsTabProps {
  waStatus: WhatsAppStatus;
  onRefresh: () => void;
}

export const FeatureRequestsTab: React.FC<FeatureRequestsTabProps> = ({
  waStatus,
  onRefresh,
}) => {
  const [featureList, setFeatureList] = useState<FeatureRequestEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<"attendance" | "reporting" | "whatsapp" | "system" | "other">("reporting");
  const [submitting, setSubmitting] = useState(false);

  const fetchFeatureRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/feature-requests");
      if (res.ok) {
        const data = await res.json();
        setFeatureList(data.featureRequests || []);
      }
    } catch (e) {
      console.error("Error fetching feature requests:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatureRequests();
  }, []);

  const handleAddFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert("Judul dan deskripsi fitur wajib diisi!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/feature-requests/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          requestedVia: "web",
          senderName: "Admin (Web Portal)",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTitle("");
        setDescription("");
        setShowAddForm(false);
        fetchFeatureRequests();
        onRefresh();
      } else {
        alert(data.error || "Gagal menyimpan request fitur");
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: "pending" | "in_progress" | "completed") => {
    try {
      const res = await fetch("/api/feature-requests/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        fetchFeatureRequests();
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const handleCopyAiPrompt = (req: FeatureRequestEntry) => {
    const promptText = `Tolong kerjakan dan implementasikan permintaan fitur berikut yang diajukan oleh Admin via WhatsApp:\n\nJudul Fitur: ${req.title}\nKategori: ${req.category}\nDeskripsi Kebutuhan: ${req.description}\n\nMohon buatkan komponen, alur kerja, dan perbarui kode aplikasi agar fitur ini aktif sempurna.`;
    navigator.clipboard.writeText(promptText);
    setCopiedId(req.id);
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* ARCHITECTURE EXPLANATION CARD */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-purple-800/50">
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold">Jembatan WhatsApp AI & Google AI Studio</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                Terhubung Otomatis
              </span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Anda bertanya: <em>"Apakah saya bisa menambah fitur melalui WhatsApp ke AI pribadi saya agar terhubung ke AI Studio?"</em>
              <br />
              <strong>Tentu bisa!</strong> Sistem ini membedakan 2 jenis perubahan secara cerdas:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              {/* Box 1: Data & Setting Changes */}
              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs mb-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>1. Perubahan Data & Jadwal (LANGSUNG AKTIF)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Perintah seperti: <em>"Catat Deasy hadir"</em>, <em>"Tetapkan besok libur nasional Pilkada"</em>, <em>"Ubah jam kirim bot jadi 07:30"</em> langsung disimpan dan aktif seketika tanpa perlu compile ulang kode!
                </p>
              </div>

              {/* Box 2: Code & Feature Requests */}
              <div className="bg-white/10 backdrop-blur-xs p-3.5 rounded-xl border border-white/10">
                <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs mb-1">
                  <FileCode className="w-4 h-4" />
                  <span>2. Penambahan Fitur Baru (ANTREAN AI STUDIO)</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Jika Anda chat di WhatsApp: <em>"Tolong buatkan fitur slip gaji PDF"</em>, bot AI WhatsApp langsung mencatat ke antrean di bawah. Anda tinggal klik <strong>"Salin Prompt AI Studio"</strong> atau perintahkan AI Studio untuk langsung mengeksekusi kodenya!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* WHATSAPP CHAT EXAMPLE BANNER */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 border border-slate-800 shadow-xs">
        <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-2 flex items-center space-x-2">
          <MessageCircle className="w-4 h-4" />
          <span>Cara Mengajukan Fitur via Chat WhatsApp</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="font-semibold text-emerald-400">Contoh 1 (Laporan):</span>
            <p className="text-slate-300 italic mt-1">
              "Tolong tambahkan fitur download slip gaji mingguan per karyawan ke format PDF"
            </p>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="font-semibold text-emerald-400">Contoh 2 (Notifikasi):</span>
            <p className="text-slate-300 italic mt-1">
              "Bisa buatkan tombol kirim notifikasi ringkasan absensi ke grup WhatsApp direksi setiap sore?"
            </p>
          </div>
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700">
            <span className="font-semibold text-emerald-400">Contoh 3 (Verifikasi):</span>
            <p className="text-slate-300 italic mt-1">
              "Saya ingin karyawan wajib melampirkan foto selfie saat mengisi link presensi"
            </p>
          </div>
        </div>
      </div>

      {/* LIST OF FEATURE REQUESTS */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <ListTodo className="w-4 h-4 text-purple-600" />
              <span>Daftar Permintaan Fitur dari WhatsApp & Web ({featureList.length})</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Antrean pengembangan yang siap dikerjakan oleh AI Coding Agent di Google AI Studio.
            </p>
          </div>

          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{showAddForm ? "Tutup Form" : "Tambah Request Fitur"}</span>
          </button>
        </div>

        {/* Add Feature Form */}
        {showAddForm && (
          <form onSubmit={handleAddFeature} className="mb-6 p-4 rounded-xl bg-purple-50/50 border border-purple-200 space-y-3">
            <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">
              Formulir Permintaan Fitur Baru
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Judul Fitur *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Fitur Slip Gaji PDF Otomatis"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kategori
                </label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="attendance">Presensi & QR Code</option>
                  <option value="reporting">Laporan & Gaji (PDF/Drive)</option>
                  <option value="whatsapp">Fitur Bot WhatsApp</option>
                  <option value="system">Keamanan & Sistem</option>
                  <option value="other">Lainnya</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Deskripsi Kebutuhan Fitur *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Jelaskan bagaimana fitur ini bekerja dan siapa yang menggunakannya..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Kirim Request Fitur"}
              </button>
            </div>
          </form>
        )}

        {/* FEATURE CARDS LIST */}
        <div className="space-y-3">
          {featureList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              {loading ? (
                "Memuat daftar permintaan fitur..."
              ) : (
                <div className="space-y-1">
                  <p className="font-semibold text-slate-600">Belum ada request fitur yang diajukan.</p>
                  <p className="text-xs text-slate-400">
                    Kirim chat ke WhatsApp bot atau gunakan tombol di atas untuk mengajukan fitur baru.
                  </p>
                </div>
              )}
            </div>
          ) : (
            featureList.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl border border-slate-200 hover:border-purple-300 hover:bg-purple-50/20 transition-all bg-white shadow-xs"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900">{req.title}</h4>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 uppercase">
                        {req.category || "General"}
                      </span>
                      {req.requestedVia === "whatsapp" ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center space-x-1">
                          <MessageCircle className="w-3 h-3 text-emerald-600" />
                          <span>Via WhatsApp AI</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
                          Via Web
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{req.description}</p>
                    {req.notes && (
                      <p className="text-[11px] text-slate-400 italic">Catatan: {req.notes}</p>
                    )}
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center space-x-2 shrink-0">
                    <select
                      value={req.status}
                      onChange={(e: any) => handleUpdateStatus(req.id, e.target.value)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none ${
                        req.status === "completed"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : req.status === "in_progress"
                          ? "bg-blue-50 text-blue-800 border-blue-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
                      }`}
                    >
                      <option value="pending">⏳ Menunggu (Pending)</option>
                      <option value="in_progress">⚙️ Sedang Dikerjakan</option>
                      <option value="completed">✅ Selesai</option>
                    </select>

                    <button
                      onClick={() => handleCopyAiPrompt(req)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors shadow-xs"
                      title="Salin perintah untuk dimasukkan ke Google AI Studio"
                    >
                      {copiedId === req.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-300" />
                          <span>Salin Prompt AI Studio</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
