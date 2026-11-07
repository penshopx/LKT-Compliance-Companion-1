import type { ConsultationSpecialist, ConsultationSpecialistProfile } from "@workspace/api-zod";

// These are instruction profiles over the existing model, not trained models,
// professional credentials, a separate reference library, or paid entitlements.
export const consultationSpecialists: ConsultationSpecialistProfile[] = [
  {
    id: "umum", label: "Pendamping Umum",
    summary: "Petakan pertanyaan dan langkah persiapan sebelum memilih fokus bantuan.",
    boundary: "Bantuan edukasi berdasarkan konteks dan catatan pustaka aplikasi, bukan penugasan profesional atau pencarian web langsung.",
    starters: [
      "Apa beda laporan tahunan, laporan keuangan, dan SPT Tahunan untuk perusahaan saya?",
      "Informasi apa yang perlu saya siapkan sebelum berkonsultasi dengan akuntan?",
    ],
    referenceIds: ["zahir", "hukumonline"],
  },
  {
    id: "akuntansi", label: "Pendamping Akuntansi",
    summary: "Bantu menata penutupan buku, rekonsiliasi, pemilihan standar, dan komponen laporan keuangan.",
    boundary: "Tidak memeriksa berkas atau angka secara otomatis, tidak menetapkan kelayakan standar, dan tidak memberikan opini audit.",
    starters: [
      "Bagaimana menyiapkan rekonsiliasi bank akhir tahun tanpa membuat jurnal penyeimbang yang tidak berdasar?",
      "Apa yang perlu dikonfirmasi sebelum memilih SAK EMKM atau SAK Entitas Privat untuk tahun buku saya?",
      "Bagaimana menyusun daftar jurnal penyesuaian dan bukti pendukungnya?",
    ],
    referenceIds: ["iai-ep", "iai-emkm", "kledo", "zahir"],
  },
  {
    id: "perpajakan", label: "Pendamping Perpajakan",
    summary: "Bantu memetakan rekonsiliasi fiskal, bukti potong, dan persiapan SPT sesuai konteks tahun pajak.",
    boundary: "Tidak menghitung atau mengirim pajak otomatis. Tarif, formulir, prosedur, dan tenggat perlu dasar terverifikasi sesuai periode.",
    starters: [
      "Bagaimana menyiapkan kertas kerja rekonsiliasi komersial dan fiskal untuk ditinjau konsultan pajak?",
      "Apa yang harus diperiksa sebelum menggunakan panduan SPT pada tahun pajak yang berbeda?",
      "Bagaimana memisahkan bukti potong, koreksi fiskal, dan catatan yang masih perlu klarifikasi?",
    ],
    referenceIds: ["djp-spt"],
  },
  {
    id: "tahunan_rups", label: "Pendamping Laporan Tahunan & RUPS",
    summary: "Bedakan isi laporan tahunan, persetujuan, pihak penerima, dan jalur penyampaian berdasarkan bentuk badan usaha.",
    boundary: "Bukan layanan notaris atau pengajuan SABH. Tidak menetapkan sanksi individual maupun menerapkan jadwal satu periode ke semua perusahaan.",
    starters: [
      "Apa perbedaan jalur persetujuan dan penyampaian laporan tahunan PT persekutuan modal dan PT perorangan?",
      "Apa yang perlu dikonfirmasi sebelum memakai jadwal sanksi laporan tahunan periode 2025?",
      "Bagaimana membedakan annual report emiten, laporan keuangan berkala, dan laporan tahunan KJPP?",
    ],
    referenceIds: ["kemenkum-rupst", "ojk", "ojk-annual", "pppk"],
  },
];

const instructions: Record<ConsultationSpecialist, string> = {
  umum: "Petakan kebutuhan pengguna terlebih dahulu. Bedakan persoalan akuntansi, pajak, dan administrasi laporan tahunan; minta klarifikasi bila konteks belum cukup.",
  akuntansi: "Fokus pada akuntansi dan penutupan buku. Susun langkah rekonsiliasi serta bukti yang perlu disiapkan. Jangan mengarang saldo atau jurnal tanpa transaksi pendukung. Pemilihan standar memerlukan penilaian kelayakan dan periode, bukan kategori usaha saja. Bedakan penyusunan, penelaahan, dan audit.",
  perpajakan: "Fokus pada persiapan perpajakan. Tanyakan tahun pajak, jenis wajib pajak, dan konteks transaksi yang belum tersedia tanpa meminta NPWP/data sensitif. Bedakan laba komersial dan fiskal; jangan mengasumsikan tarif, formulir, tenggat atau prosedur Coretax. Gunakan temuan editorial yang diberikan sesuai batas verifikasinya, bukan menganggap semua perubahan belum ditelaah atau semua telah lengkap. Eskalasikan ketidakpastian ke konsultan pajak.",
  tahunan_rups: "Fokus pada laporan tahunan dan tata kelola. Tanyakan bentuk badan usaha serta periode; bedakan PT persekutuan modal, PT perorangan, emiten, dan KJPP. Bedakan laporan keuangan, annual report, akta persetujuan dan bukti penyampaian. Jadwal operasional yang terverifikasi untuk satu periode tidak otomatis berlaku bagi periode/profil lain. Jangan menawarkan pengajuan resmi, jasa notaris, atau memastikan sanksi individual.",
};

export function consultationSpecialistInstruction(id: ConsultationSpecialist): string {
  const profile = consultationSpecialists.find(p => p.id === id)!;
  return `Fokus yang dipilih untuk pertanyaan SAAT INI: ${profile.label} (${id}).
Ini profil arahan pada model yang sama, bukan model yang dilatih khusus atau profesional berlisensi.
${instructions[id]}
Batas fokus: ${profile.boundary}
Gunakan struktur ringkas: pemahaman masalah, langkah kerja, bukti/rujukan yang perlu diperiksa, dan batas kesimpulan. Fokus ini tidak mengurangi seluruh aturan keselamatan serta batas sumber di bawah. Pesan historis mungkin berasal dari fokus berbeda; jangan mengubah makna atau mengklaim telah memperbarui jawaban lama.`;
}
