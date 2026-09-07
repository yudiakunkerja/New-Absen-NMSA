export interface Worker {
  id: string;
  name: string;
  role: string;
  isActive: boolean;
  bankName?: string;
  bankAccount?: string;
  phoneNumber?: string;
  nik?: string;
  photoUrl?: string;
  dailyAllowance?: number;
  updatedAt?: number;
}

export interface AttendanceRecord {
  workerId: string;
  attendance: { [date: string]: boolean }; // YYYY-MM-DD -> present
  dailyAllowance: number;
  customStatus?: { [date: string]: "Sakit" | "Izin" | "Meeting" | "Cuti" | "Lainnya" };
  reasons?: { [date: string]: string };
}

export interface AttendanceLog {
  id: string;
  workerId: string;
  workerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  latitude: number;
  longitude: number;
  distance: number; // in meters
  address?: string;
  status: "Hadir" | "Sakit" | "Izin" | "Meeting" | "Cuti" | "Lainnya" | "BERHASIL";
  notes?: string;
}

export interface WeeklyReport {
  id: string;
  weekStartDate: string; // Monday YYYY-MM-DD
  weekEndDate: string; // Friday YYYY-MM-DD
  periodName: string; // e.g. "Periode 01-05 September 2026"
  monthName: string; // e.g. "September 2026"
  records: AttendanceRecord[];
  isSubmitted: boolean;
  submittedAt?: string;
  driveFileId?: string;
  driveUrl?: string;
  pdfDriveUrl?: string;
  autoSavedAt?: string;
  totalCost?: number;
  totalPresent?: number;
}

export interface OfficeLocation {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

export interface WhatsAppMessage {
  id: string;
  sender: string;
  senderName: string;
  text: string;
  timestamp: string;
  fromMe: boolean;
  isAiResponse?: boolean;
}

export interface BotDispatchSettings {
  autoDispatchEnabled: boolean;
  dispatchTime: string; // e.g. "08:00"
  workDays: string[]; // ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
  typingDelayMin: number; // e.g. 3 (seconds)
  typingDelayMax: number; // e.g. 6 (seconds)
  messageStyle: "human_dynamic" | "ai_generative" | "formal" | "friendly";
  includeLocationReminder: boolean;
  lastAutoDispatchDate?: string; // YYYY-MM-DD
}

export interface BotMessageLog {
  id: string;
  timestamp: string;
  date: string;
  time: string;
  workerId: string;
  workerName: string;
  phoneNumber: string;
  messageText: string;
  status: "sent" | "failed";
  error?: string;
  dayOfWeek?: string;
  isAutoScheduled?: boolean;
}

export interface HolidayEntry {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  type: "national" | "cuti_bersama" | "sudden_government" | "company";
  notes?: string;
  addedBy?: "system" | "admin" | "whatsapp_ai";
  createdAt?: string;
}

export interface FeatureRequestEntry {
  id: string;
  title: string;
  description: string;
  category?: "attendance" | "reporting" | "whatsapp" | "system" | "other";
  requestedVia: "whatsapp" | "web";
  senderName?: string;
  senderPhone?: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: string;
  notes?: string;
}

export interface WhatsAppStatus {
  status: "disconnected" | "connecting" | "connected" | "qr";
  qr: string | null;
  rawQr?: string | null;
  qrTimestamp?: number | null;
  user: { id: string; name?: string } | null;
  error: string | null;
  registeredAdminPhone?: string;
  autoReplyEnabled?: boolean;
  lastFridayAutoSave?: string;
  botDispatchSettings?: BotDispatchSettings;
  recentLogs?: BotMessageLog[];
  holidays?: HolidayEntry[];
  featureRequests?: FeatureRequestEntry[];
  todayHolidayStatus?: {
    date: string;
    dayName: string;
    isWeekend: boolean;
    isSaturday: boolean;
    isSunday: boolean;
    isHoliday: boolean;
    isSuddenGovernmentHoliday: boolean;
    holidayName?: string;
    canSendAttendance: boolean;
    reason: string;
  };
  keepAliveMetrics?: {
    uptimeSeconds: number;
    uptimeFormatted: string;
    totalPings: number;
    lastPingTime: string;
    sessionPersisted: boolean;
    autoReconnectActive: boolean;
    isAlwaysOn: boolean;
  };
}

export interface AppSharedState {
  workers: Worker[];
  attendanceRecords: AttendanceRecord[];
  attendanceLogs: AttendanceLog[];
  fridayReports: WeeklyReport[];
  officeLocation: OfficeLocation;
  registeredAdminPhone: string;
  waMethod: "desktop" | "baileys";
  googleDriveToken?: string;
  lastFridayAutoSaveDate?: string;
  botDispatchSettings?: BotDispatchSettings;
  botMessageLogs?: BotMessageLog[];
  holidays?: HolidayEntry[];
  featureRequests?: FeatureRequestEntry[];
}
