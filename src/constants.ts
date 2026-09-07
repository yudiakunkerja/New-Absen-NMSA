import { Worker, OfficeLocation } from "./types";

export const INITIAL_WORKERS: Worker[] = [
  { id: "W01", name: "Bpk Faisal Zainuddin", phoneNumber: "081342993880", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W02", name: "Ibu Sri Ekowati", phoneNumber: "085121315059", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W03", name: "Deasy Annisa Syahdane", phoneNumber: "08997419199", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W04", name: "Andi Dhiya Salsabila", phoneNumber: "085121311713", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W05", name: "Addrian Firmansyah Zain", phoneNumber: "085711655612", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W06", name: "Nur Wahyudi", phoneNumber: "+62 881-0240-40191", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W07", name: "Faranabila Zeolita Athalia", phoneNumber: "+447459719586", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W08", name: "Andi Respati Syarif", phoneNumber: "+62 857-5125-0015", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
  { id: "W09", name: "Junaedi", phoneNumber: "+62 895-3914-41239", role: "Karyawan", isActive: true, dailyAllowance: 50000 },
];

export const DEFAULT_OFFICE_LOCATION: OfficeLocation = {
  name: "Kantor PT. Nusantara Mineral Sukses Abadi (NMSA)",
  latitude: -6.244342,
  longitude: 106.843073,
  radiusMeters: 150,
};

export const INDONESIAN_DAYS = {
  Monday: "Senin",
  Tuesday: "Selasa",
  Wednesday: "Rabu",
  Thursday: "Kamis",
  Friday: "Jumat",
};

export const INDONESIAN_MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];
