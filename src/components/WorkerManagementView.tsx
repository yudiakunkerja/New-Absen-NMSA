import React, { useState } from "react";
import {
  Users,
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Edit2,
  Save,
  X,
  Phone,
  Briefcase,
  DollarSign,
  UserPlus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import QRCode from "qrcode";
import { Worker } from "../types";

interface WorkerManagementViewProps {
  workers: Worker[];
  onUpdateWorker: (updated: Worker) => void;
  onAddWorker?: (newWorker: Worker) => Promise<void> | void;
  onDeleteWorker?: (workerId: string) => Promise<void> | void;
  onOpenWorkerAttendance: (worker: Worker) => void;
}

export const WorkerManagementView: React.FC<WorkerManagementViewProps> = ({
  workers,
  onUpdateWorker,
  onAddWorker,
  onDeleteWorker,
  onOpenWorkerAttendance,
}) => {
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Worker>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<{ worker: Worker; qrUrl: string } | null>(null);

  // Add Worker Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newWorkerForm, setNewWorkerForm] = useState<{
    id: string;
    name: string;
    role: string;
    phoneNumber: string;
    dailyAllowance: number;
  }>({
    id: "",
    name: "",
    role: "Karyawan",
    phoneNumber: "",
    dailyAllowance: 25000,
  });
  const [isAdding, setIsAdding] = useState(false);

  // Helper to generate next employee ID
  const getNextWorkerId = (): string => {
    const existingIds = workers
      .map((w) => {
        const match = w.id.match(/^W(\d+)$/i);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((n): n is number => n !== null);
    const maxNum = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const nextNum = maxNum + 1;
    return `W${String(nextNum).padStart(2, "0")}`;
  };

  const handleOpenAddModal = () => {
    setNewWorkerForm({
      id: getNextWorkerId(),
      name: "",
      role: "Karyawan",
      phoneNumber: "",
      dailyAllowance: 25000,
    });
    setShowAddModal(true);
  };

  const handleSaveNewWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkerForm.name.trim()) {
      alert("Nama lengkap karyawan wajib diisi.");
      return;
    }
    const finalId = newWorkerForm.id.trim() || getNextWorkerId();
    if (workers.some((w) => w.id.toLowerCase() === finalId.toLowerCase())) {
      alert(`ID Karyawan "${finalId}" sudah digunakan. Silakan gunakan ID lain.`);
      return;
    }

    setIsAdding(true);
    try {
      const newWorker: Worker = {
        id: finalId,
        name: newWorkerForm.name.trim(),
        role: newWorkerForm.role.trim() || "Karyawan",
        phoneNumber: newWorkerForm.phoneNumber.trim(),
        dailyAllowance: Number(newWorkerForm.dailyAllowance) || 25000,
        isActive: true,
        updatedAt: Date.now(),
      };

      if (onAddWorker) {
        await onAddWorker(newWorker);
      }
      setShowAddModal(false);
    } catch (err: any) {
      alert(err.message || "Gagal menambahkan karyawan");
    } finally {
      setIsAdding(false);
    }
  };

  const handleDelete = async (worker: Worker) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus karyawan "${worker.name}" (${worker.id})?\n\nKaryawan tidak akan muncul lagi di daftar aktif, namun rekap absensi historis yang sudah dicatat sebelumnya tetap aman tersimpan.`
    );
    if (!confirmed) return;

    try {
      if (onDeleteWorker) {
        await onDeleteWorker(worker.id);
      }
    } catch (err: any) {
      alert(err.message || "Gagal menghapus karyawan");
    }
  };

  const handleStartEdit = (w: Worker) => {
    setEditingWorkerId(w.id);
    setEditForm({ ...w, dailyAllowance: w.dailyAllowance || 25000 });
  };

  const handleSaveEdit = () => {
    if (!editingWorkerId) return;
    const existing = workers.find((w) => w.id === editingWorkerId);
    if (!existing) return;
    onUpdateWorker({
      ...existing,
      ...editForm,
      dailyAllowance: Number(editForm.dailyAllowance) || 25000,
      updatedAt: Date.now(),
    } as Worker);
    setEditingWorkerId(null);
  };

  const handleCopyLink = (workerId: string) => {
    const origin = window.location.origin;
    const link = `${origin}/?worker=${workerId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(workerId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShowQr = async (worker: Worker) => {
    const origin = window.location.origin;
    const link = `${origin}/?worker=${worker.id}`;
    const qrUrl = await QRCode.toDataURL(link, { width: 300, margin: 2 });
    setActiveQrModal({ worker, qrUrl });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">
              Manajemen Data Karyawan ({workers.length} Orang)
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Uang Makan Rp 25.000 / Hari
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Setiap karyawan memiliki tautan presensi mandiri tanpa PIN yang mendeteksi lokasi koordinat kantor NMSA secara otomatis. Anda dapat menambah atau menghapus karyawan sesuai kebutuhan operasional.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center justify-center space-x-2 transition-all shrink-0 hover:shadow-md"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Karyawan Baru</span>
        </button>
      </div>

      {/* Workers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workers.map((worker) => {
          const isEditing = editingWorkerId === worker.id;

          return (
            <div
              key={worker.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 font-bold flex items-center justify-center border border-emerald-500/20 text-sm">
                      {worker.name.charAt(0)}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 font-mono">{worker.id}</span>
                      <h3 className="text-sm font-bold text-slate-900 leading-tight">
                        {worker.name}
                      </h3>
                    </div>
                  </div>

                  {!isEditing && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleStartEdit(worker)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Edit Data Karyawan"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(worker)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Hapus Karyawan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Nama Lengkap</label>
                      <input
                        type="text"
                        value={editForm.name || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Jabatan</label>
                      <input
                        type="text"
                        value={editForm.role || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Nomor WhatsApp</label>
                      <input
                        type="text"
                        value={editForm.phoneNumber || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="Contoh: 08123456789"
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Uang Makan / Hari (Rp)</label>
                      <input
                        type="number"
                        value={editForm.dailyAllowance || 25000}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, dailyAllowance: Number(e.target.value) }))
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:outline-emerald-500"
                      />
                    </div>

                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={handleSaveEdit}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center space-x-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Simpan</span>
                      </button>
                      <button
                        onClick={() => setEditingWorkerId(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs text-slate-600 my-3">
                    <div className="flex items-center space-x-2">
                      <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{worker.role}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{worker.phoneNumber || "Belum ada nomor WA"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium text-emerald-700">
                        Rp {(worker.dailyAllowance || 25000).toLocaleString("id-ID")} / hari
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {!isEditing && (
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onOpenWorkerAttendance(worker)}
                    className="flex-1 py-2 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Buka Absen</span>
                  </button>

                  <button
                    onClick={() => handleShowQr(worker)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                    title="Tampilkan QR Code Absensi Karyawan"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleCopyLink(worker.id)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
                    title="Salin Link Presensi Tanpa PIN"
                  >
                    {copiedId === worker.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Worker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-2.5 mb-4">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Tambah Karyawan Baru</h3>
                <p className="text-xs text-slate-500">PT. Nusantara Mineral Sukses Abadi</p>
              </div>
            </div>

            <form onSubmit={handleSaveNewWorker} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ID Karyawan <span className="text-slate-400 font-normal">(Otomatis/Dapat Diedit)</span>
                </label>
                <input
                  type="text"
                  required
                  value={newWorkerForm.id}
                  onChange={(e) => setNewWorkerForm((prev) => ({ ...prev, id: e.target.value.toUpperCase() }))}
                  placeholder="Contoh: W10"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 font-mono font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Lengkap Karyawan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newWorkerForm.name}
                  onChange={(e) => setNewWorkerForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Contoh: Bpk Ahmad Fauzi"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Jabatan / Posisi
                </label>
                <input
                  type="text"
                  value={newWorkerForm.role}
                  onChange={(e) => setNewWorkerForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="Contoh: Karyawan / Staff Operasional"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nomor WhatsApp <span className="text-slate-400 font-normal">(Untuk integrasi bot & broadcast)</span>
                </label>
                <input
                  type="text"
                  value={newWorkerForm.phoneNumber}
                  onChange={(e) => setNewWorkerForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                  placeholder="Contoh: 08123456789 atau +628123456789"
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Uang Makan Harian (Rp)
                </label>
                <input
                  type="number"
                  value={newWorkerForm.dailyAllowance}
                  onChange={(e) => setNewWorkerForm((prev) => ({ ...prev, dailyAllowance: Number(e.target.value) }))}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-emerald-500 focus:outline-none font-semibold text-emerald-700"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Standar perusahaan: <strong>Rp 25.000 / hari kerja hadir</strong>.
                </p>
              </div>

              <div className="flex items-center space-x-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center space-x-1.5 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isAdding ? "Menyimpan..." : "Simpan Karyawan"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {activeQrModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center relative">
            <button
              onClick={() => setActiveQrModal(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-slate-900 mb-1">QR Code Presensi Mandiri</h3>
            <p className="text-xs text-slate-500 mb-4">{activeQrModal.worker.name}</p>

            <div className="p-3 bg-white border-2 border-dashed border-emerald-500 rounded-2xl inline-block shadow-xs mb-4">
              <img src={activeQrModal.qrUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Scan dengan kamera HP untuk langsung membuka presensi mandiri (tanpa PIN) untuk{" "}
              <strong>{activeQrModal.worker.name}</strong>.
            </p>

            <button
              onClick={() => {
                const link = `${window.location.origin}/?worker=${activeQrModal.worker.id}`;
                navigator.clipboard.writeText(link);
                alert("Link presensi disalin ke clipboard!");
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Salin Tautan Presensi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
