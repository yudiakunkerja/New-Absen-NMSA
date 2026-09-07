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
  Share2,
} from "lucide-react";
import QRCode from "qrcode";
import { Worker } from "../types";

interface WorkerManagementViewProps {
  workers: Worker[];
  onUpdateWorker: (updated: Worker) => void;
  onOpenWorkerAttendance: (worker: Worker) => void;
}

export const WorkerManagementView: React.FC<WorkerManagementViewProps> = ({
  workers,
  onUpdateWorker,
  onOpenWorkerAttendance,
}) => {
  const [editingWorkerId, setEditingWorkerId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Worker>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<{ worker: Worker; qrUrl: string } | null>(null);

  const handleStartEdit = (w: Worker) => {
    setEditingWorkerId(w.id);
    setEditForm({ ...w });
  };

  const handleSaveEdit = () => {
    if (!editingWorkerId) return;
    const existing = workers.find((w) => w.id === editingWorkerId);
    if (!existing) return;
    onUpdateWorker({ ...existing, ...editForm } as Worker);
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
            <h2 className="text-lg font-bold text-slate-900">Manajemen Data Karyawan (9 Orang)</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Setiap karyawan memiliki tautan presensi mandiri tanpa PIN yang mendeteksi lokasi koordinat kantor NMSA secara otomatis.
          </p>
        </div>
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
                    <button
                      onClick={() => handleStartEdit(worker)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit Data Karyawan"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
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
                        className="w-full text-xs p-2 rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Jabatan</label>
                      <input
                        type="text"
                        value={editForm.role || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Nomor WhatsApp</label>
                      <input
                        type="text"
                        value={editForm.phoneNumber || ""}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, phoneNumber: e.target.value }))}
                        className="w-full text-xs p-2 rounded-lg border border-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-slate-500 uppercase">Uang Makan / Hari</label>
                      <input
                        type="number"
                        value={editForm.dailyAllowance || 50000}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, dailyAllowance: Number(e.target.value) }))
                        }
                        className="w-full text-xs p-2 rounded-lg border border-slate-200"
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
                      <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                      <span>{worker.role}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{worker.phoneNumber || "Belum ada nomor WA"}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                      <span>Rp {(worker.dailyAllowance || 50000).toLocaleString("id-ID")} / hari</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Open Link, Copy Link, Show QR */}
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
