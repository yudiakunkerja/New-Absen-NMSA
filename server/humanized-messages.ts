import { GoogleGenAI } from "@google/genai";

export interface HumanizedMessageOptions {
  workerName: string;
  role?: string;
  attendUrl: string;
  style?: "human_dynamic" | "ai_generative" | "formal" | "friendly";
  dayOfWeek?: string; // "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat" | "Sabtu" | "Minggu"
  dateFormatted?: string;
  variationIndex?: number;
}

// Helper to determine day of week in Jakarta timezone
export function getJakartaDayOfWeek(): { dayName: string; dateFormatted: string; isWorkDay: boolean } {
  const now = new Date();
  const dayName = now.toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", weekday: "long" });
  const dateFormatted = now.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const isWorkDay = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].includes(dayName);
  return { dayName, dateFormatted, isWorkDay };
}

// Clean worker name for natural conversational address
export function formatWorkerDisplayName(fullName: string): { title: string; cleanName: string; informalName: string } {
  let title = "Bapak/Ibu";
  let cleanName = fullName.trim();
  let informalName = cleanName;

  if (cleanName.toLowerCase().startsWith("bpk ") || cleanName.toLowerCase().startsWith("bapak ")) {
    title = "Pak";
    cleanName = cleanName.replace(/^(bpk|bapak)\s+/i, "");
    informalName = cleanName.split(" ")[0];
  } else if (cleanName.toLowerCase().startsWith("ibu ") || cleanName.toLowerCase().startsWith("bu ")) {
    title = "Bu";
    cleanName = cleanName.replace(/^(ibu|bu)\s+/i, "");
    informalName = cleanName.split(" ")[0];
  } else {
    // Determine friendly title or first name
    const firstName = cleanName.split(" ")[0];
    informalName = firstName;
    // Default honorific
    title = "Kak";
  }

  return { title, cleanName, informalName };
}

// Daily varied human message templates
const DAILY_TEMPLATES: Record<string, ((nameInfo: ReturnType<typeof formatWorkerDisplayName>, url: string, dateStr: string) => string)[]> = {
  Senin: [
    // Senin Variasi 1 - Semangat awal pekan hangat
    ({ title, cleanName, informalName }, url, dateStr) =>
      `Selamat pagi ${title} ${informalName}! ☀️\n\n` +
      `Semoga mengawali hari Senin ini dengan semangat baru dan penuh energi positif. Sebelum memulai agenda dan rutinitas kerja hari ini di PT. NMSA, yuk sempatkan 5 detik untuk melakukan presensi kehadiran:\n\n` +
      `🔗 *Link Presensi Mandiri (Tanpa PIN):*\n${url}\n\n` +
      `_Tautan di atas otomatis memverifikasi lokasi kantor secara instan._\n` +
      `Selamat beraktivitas dan semoga hari Seninnya berjalan lancar! 💪💼`,

    // Senin Variasi 2 - Santai & bersahabat
    ({ title, cleanName, informalName }, url) =>
      `Semangat pagi ${title} ${informalName} 👋\n\n` +
      `Hari Senin sudah tiba lagi nih! Semoga sepekan ke depan membawa keberkahan dan kelancaran untuk kita semua. Jangan lupa klik tautan di bawah ini untuk mengisi absensi harian ya:\n\n` +
      `🔗 ${url}\n\n` +
      `Cukup buka link saat sudah berada di area kantor. Selamat bekerja dan tetap jaga kesehatan! ✨`,

    // Senin Variasi 3 - Ringkas & profesional
    ({ title, cleanName }, url, dateStr) =>
      `Selamat pagi ${title} ${cleanName} ✨\n\n` +
      `Mengingatkan rekan-rekan untuk melakukan pencatatan presensi kehadiran hari Senin (${dateStr}):\n\n` +
      `🔗 *Presensi NMSA:* ${url}\n\n` +
      `Sistem tanpa PIN, presensi langsung tercatat otomatis. Have a wonderful and productive Monday! 🌟`,
  ],

  Selasa: [
    // Selasa Variasi 1 - Fokus dan produktif
    ({ title, informalName }, url) =>
      `Selamat pagi ${title} ${informalName}! ☕\n\n` +
      `Semoga hari Selasanya cerah dan seluruh pekerjaan hari ini diberikan kelancaran. Luangkan waktu sejenak untuk mengisi presensi kehadiran hari ini ya:\n\n` +
      `🔗 *Tautan Presensi:* ${url}\n\n` +
      `Terima kasih dan selamat menjalankan aktivitas hari ini dengan produktif! 🚀`,

    // Selasa Variasi 2 - Hangat & ramah
    ({ title, cleanName }, url, dateStr) =>
      `Halo ${title} ${cleanName}, selamat pagi 👋\n\n` +
      `Memasuki hari Selasa (${dateStr}), semoga selalu bersemangat. Jangan lupa untuk melakukan tap absensi sebelum memulai kesibukan ya:\n\n` +
      `🔗 ${url}\n\n` +
      `_Tanpa perlu PIN, verifikasi GPS langsung otomatis._ Semoga harimu menyenangkan! 😊`,

    // Selasa Variasi 3 - Sapaan cepat
    ({ title, informalName }, url) =>
      `Pagi ${title} ${informalName} 🙌\n\n` +
      `Sudah sampai di kantor? Yuk langsung tap link presensi harian berikut:\n\n` +
      `🔗 ${url}\n\n` +
      `Selamat bekerja dan sukses selalu untuk agenda hari ini! 💼`,
  ],

  Rabu: [
    // Rabu Variasi 1 - Pertengahan pekan
    ({ title, informalName }, url) =>
      `Selamat pagi ${title} ${informalName}! 🌿\n\n` +
      `Wah tidak terasa sudah masuk hari Rabu, pertengahan pekan. Tetap jaga stamina, fokus, dan semangat ya. Berikut link presensi kehadiranmu hari ini:\n\n` +
      `🔗 *Link Presensi:* ${url}\n\n` +
      `Cukup sekali klik langsung terdata. Terima kasih atas dedikasi terbaiknya untuk NMSA! 🌟`,

    // Rabu Variasi 2 - Santai & natural
    ({ title, cleanName }, url, dateStr) =>
      `Halo ${title} ${cleanName} 👋\n\n` +
      `Semoga hari Rabu ini membawa kabar baik dan progres kerja yang memuaskan. Silakan lakukan absensi hari ini melalui tautan berikut:\n\n` +
      `🔗 ${url}\n\n` +
      `Semangat terus melewati pertengahan minggu kerja! 💪`,

    // Rabu Variasi 3 - Ringkas
    ({ title, informalName }, url) =>
      `Pagi ${title} ${informalName} ✨\n\n` +
      `Jangan lupa absen pagi ini ya sebelum lanjut ke agenda utama:\n\n` +
      `🔗 ${url}\n\n` +
      `Have a great Wednesday ahead! 👍`,
  ],

  Kamis: [
    // Kamis Variasi 1 - Menjelang akhir pekan
    ({ title, informalName }, url) =>
      `Selamat pagi ${title} ${informalName}! 🌟\n\n` +
      `Satu langkah lagi menuju penutup pekan, semoga seluruh target kerja minggu ini dapat tuntas dengan baik. Yuk sempatkan presensi dulu ya:\n\n` +
      `🔗 *Link Presensi:* ${url}\n\n` +
      `Semoga hari Kamis ini berjalan lancar dan penuh keberkahan! ☕✨`,

    // Kamis Variasi 2 - Ramah & profesional
    ({ title, cleanName }, url, dateStr) =>
      `Halo ${title} ${cleanName}, selamat pagi 👋\n\n` +
      `Mengingatkan untuk pengisian daftar hadir hari Kamis tanggal ${dateStr} di PT. NMSA:\n\n` +
      `🔗 ${url}\n\n` +
      `Tautan langsung tanpa PIN. Terima kasih dan selamat beraktivitas! 💼`,

    // Kamis Variasi 3 - Ceria
    ({ title, informalName }, url) =>
      `Semangat pagi ${title} ${informalName}! 🔥\n\n` +
      `Tetap optimis dan semangat di hari Kamis ini. Tautan presensi harian sudah siap di bawah:\n\n` +
      `🔗 ${url}\n\n` +
      `Yuk segera tap untuk mencatat kehadiranmu hari ini! 👏`,
  ],

  Jumat: [
    // Jumat Variasi 1 - Jumat Berkah & Penutup Pekan
    ({ title, cleanName, informalName }, url, dateStr) =>
      `Selamat pagi dan salam Jumat berkah, ${title} ${informalName}! 🤲✨\n\n` +
      `Semoga di hari terakhir pekan kerja ini, segala urusan kita dimudahkan dan penuh berkah. Silakan lakukan presensi kehadiran pagi ini:\n\n` +
      `🔗 *Link Presensi Mandiri:*\n${url}\n\n` +
      `📌 *Pengingat:* Sore nanti jam 17:00 WIB seluruh rekap kehadiran mingguan akan otomatis diarsipkan ke Google Drive.\n` +
      `Selamat bekerja dan semoga akhir pekannya menyenangkan nanti! 🎉`,

    // Jumat Variasi 2 - Happy Friday
    ({ title, informalName }, url) =>
      `Pagi ${title} ${informalName} 🎉 Happy Friday!\n\n` +
      `Semoga hari penutup pekan kerja ini menyenangkan dan semua rencana hari ini tuntas dengan lancar. Jangan lupa isi presensi pagi ini ya:\n\n` +
      `🔗 ${url}\n\n` +
      `Terima kasih banyak atas kerja keras dan kontribusinya sepanjang minggu ini! 🙏💼`,

    // Jumat Variasi 3 - Hangat & santai
    ({ title, cleanName }, url, dateStr) =>
      `Selamat pagi ${title} ${cleanName} 🌟\n\n` +
      `Hari Jumat (${dateStr}) telah tiba. Mari tuntaskan tugas-tugas pekan ini dengan sebaik-baiknya. Link absensi harian:\n\n` +
      `🔗 ${url}\n\n` +
      `Buka link dari HP saat berada di kantor, presensi langsung tercatat tanpa PIN. Selamat beraktivitas! ✨`,
  ],

  Sabtu: [
    ({ title, cleanName }, url) =>
      `Selamat pagi ${title} ${cleanName} 👋\n\n` +
      `Bagi yang menjalankan piket atau aktivitas kerja hari Sabtu ini di PT. NMSA, silakan mencatat presensi kehadiran di link berikut:\n\n` +
      `🔗 ${url}\n\n` +
      `Terima kasih dan selamat bertugas!`,
  ],

  Minggu: [
    ({ title, cleanName }, url) =>
      `Selamat pagi ${title} ${cleanName} 👋\n\n` +
      `Tautan presensi untuk aktivitas khusus hari Minggu:\n\n` +
      `🔗 ${url}\n\n` +
      `Selamat bertugas!`,
  ],
};

// Generate human-like varied message
export function generateHumanDailyMessage(options: HumanizedMessageOptions): string {
  const { dayName, dateFormatted } = getJakartaDayOfWeek();
  const targetDay = options.dayOfWeek || dayName;
  const nameInfo = formatWorkerDisplayName(options.workerName);

  const templates = DAILY_TEMPLATES[targetDay] || DAILY_TEMPLATES["Senin"];

  // Pick variation based on index or pseudo-random hash of name + date so it's consistent for today yet varied across workers
  let idx = 0;
  if (options.variationIndex !== undefined) {
    idx = options.variationIndex % templates.length;
  } else {
    // Generate a hash based on workerName + current date
    const hash = (options.workerName + targetDay)
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    idx = hash % templates.length;
  }

  const selectedGenerator = templates[idx];
  return selectedGenerator(nameInfo, options.attendUrl, options.dateFormatted || dateFormatted);
}

// Optional: Use Gemini AI to compose ultra-natural, one-of-a-kind message
export async function generateAiPersonalizedMessage(
  workerName: string,
  role: string,
  attendUrl: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback to human daily template
    return generateHumanDailyMessage({ workerName, role, attendUrl, style: "human_dynamic" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const { dayName, dateFormatted } = getJakartaDayOfWeek();
    const nameInfo = formatWorkerDisplayName(workerName);

    const prompt = `Anda adalah asisten admin ramah dan bersahabat di PT. Nusantara Mineral Sukses Abadi (NMSA).
Tulis 1 pesan WhatsApp sapaan pagi untuk mengingatkan karyawan mengisi presensi kehadiran hari ini.

Data Karyawan:
- Nama: ${workerName} (Sapaan yang cocok: ${nameInfo.title} ${nameInfo.informalName})
- Divisi/Jabatan: ${role || "Karyawan"}
- Hari: ${dayName}, ${dateFormatted}
- Link Presensi: ${attendUrl}

Syarat pesan:
1. Nada bicara: Hangat, sopan, bernuansa manusiawi asli (bukan bahasa robot/mesin), khas sapaan WhatsApp kantor Indonesia yang ramah.
2. Cantumkan nuansa hari ${dayName} (misal: jika Senin beri semangat awal pekan, jika Jumat beri salam Jumat berkah atau happy Friday).
3. Selipkan link presensi dengan jelas. Ingatkan bahwa sistem presensi tanpa PIN dan otomatis memverifikasi lokasi kantor.
4. Gunakan emoji secukupnya agar tampak ramah dan hidup.
5. Panjang pesan cukup 3-5 kalimat ringkas.
6. HANYA kembalikan teks pesan WhatsApp yang siap dikirim, tanpa tanda petik pembuka/penutup atau penjelasan tambahan.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const reply = response.text?.trim();
    if (reply && reply.includes(attendUrl)) {
      return reply;
    } else if (reply) {
      return `${reply}\n\n🔗 *Link Presensi:* ${attendUrl}`;
    }
  } catch (err) {
    console.error("Failed to generate AI personalized message, falling back to human template:", err);
  }

  return generateHumanDailyMessage({ workerName, role, attendUrl, style: "human_dynamic" });
}
