// Product navigation, not tenant permissions, live service health or legal verification.
export type WorkRole = "penyusun" | "penelaah" | "pimpinan";
export type ModuleAvailability = "tersedia" | "sebagian";
export type ModuleCapability = {
  title: string; detail: string; available: boolean; href?: string; action?: string;
};
export type WorkModule = {
  id: string; title: string; description: string; keywords: string[];
  availability: ModuleAvailability; capabilities: ModuleCapability[]; boundary: string;
};

export const WORK_MODULES: WorkModule[] = [
  {
    id: "akuntansi", title: "Penyusunan dan rekonsiliasi",
    description: "Atur persiapan penutupan buku, komponen laporan, dan kebutuhan rekonsiliasi.",
    keywords: ["akuntansi", "bank", "jurnal", "saldo", "neraca", "laba rugi", "arus kas", "standar", "SAK"],
    availability: "tersedia",
    capabilities: [
      { title: "Ruang laporan per tahun buku", detail: "Pilih tahun buku untuk melihat diagnosis dan daftar persiapan tahun tersebut.", available: true, href: "/ruang-laporan", action: "Pilih ruang tahun buku" },
      { title: "Daftar persiapan aktif", detail: "Checklist mengikuti tahun aktif pada profil perusahaan; bukan laporan keuangan yang telah disusun.", available: true, href: "/checklist", action: "Buka daftar persiapan" },
      { title: "Pendamping Akuntansi", detail: "Konsultasi edukatif tentang rekonsiliasi, jurnal penyesuaian, dan pemilihan standar.", available: true, href: "/konsultasi?fokus=akuntansi", action: "Konsultasi akuntansi" },
    ],
    boundary: "Kemajuan checklist diisi tim sendiri. Aplikasi tidak memeriksa saldo atau menghasilkan opini audit.",
  },
  {
    id: "perpajakan", title: "Persiapan perpajakan",
    description: "Petakan kebutuhan rekonsiliasi fiskal, bukti potong, serta rujukan persiapan SPT.",
    keywords: ["pajak", "fiskal", "SPT", "bukti potong", "Coretax", "tahun pajak"],
    availability: "tersedia",
    capabilities: [
      { title: "Pendamping Perpajakan", detail: "Isi konteks jenis wajib pajak dan tahun pajak dalam pertanyaan bila diperlukan, tanpa identitas sensitif.", available: true, href: "/konsultasi?fokus=perpajakan", action: "Konsultasi perpajakan" },
      { title: "Rujukan persiapan SPT", detail: "Cari topik pajak pada pustaka; periksa periode, cakupan, dan batas hasil peninjauannya.", available: true, href: "/referensi", action: "Periksa rujukan" },
    ],
    boundary: "Bantuan persiapan, bukan perhitungan otomatis, pengiriman SPT, atau penetapan tarif dan tenggat untuk setiap perusahaan.",
  },
  {
    id: "tahunan-rups", title: "Laporan tahunan dan RUPS",
    description: "Bedakan laporan keuangan, annual report, persetujuan, dan jalur penyampaian.",
    keywords: ["RUPST", "RUPS", "AHU", "SABH", "annual report", "perseroan", "PT", "emiten", "KJPP"],
    availability: "tersedia",
    capabilities: [
      { title: "Pendamping Laporan Tahunan & RUPS", detail: "Bahas bentuk badan usaha serta periode sebelum menilai jalur dan kewajiban yang relevan.", available: true, href: "/konsultasi?fokus=tahunan_rups", action: "Konsultasi laporan tahunan" },
      { title: "Referensi tata kelola", detail: "Baca temuan dan bukti primer yang tercatat beserta pembatasan penerapannya.", available: true, href: "/referensi", action: "Telusuri dasar rujukan" },
    ],
    boundary: "Tidak mengajukan laporan ke SABH atau menggantikan notaris. Jadwal satu periode tidak otomatis berlaku untuk seluruh badan usaha.",
  },
  {
    id: "pengendalian", title: "Pengendalian internal",
    description: "Catat masalah nyata dan tindak lanjut tim, terpisah dari diagnosis otomatis.",
    keywords: ["temuan", "tindakan", "penyebab", "CAPA", "PIC", "target internal", "telaah", "riwayat", "arsip temuan"],
    availability: "tersedia",
    capabilities: [
      { title: "Temuan dan tindak lanjut per tahun", detail: "Pilih ruang tahun buku, lalu buka Temuan dan tindak lanjut. Catat PIC, hasil tindakan, dan hasil telaah internal.", available: true, href: "/ruang-laporan", action: "Pilih ruang untuk tindak lanjut" },
      { title: "Riwayat perubahan dan pengarsipan", detail: "Di dalam temuan, lihat setiap versi, arsipkan, atau pulihkan catatan tanpa menghapus riwayat.", available: true, href: "/ruang-laporan", action: "Buka ruang laporan" },
    ],
    boundary: "Menutup temuan tidak menyelesaikan checklist secara otomatis, memperbarui verifikasi regulasi, atau membuktikan adanya audit independen.",
  },
  {
    id: "dokumen-bukti", title: "Dokumen dan bukti",
    description: "Pisahkan dokumen privat perusahaan dari salinan bukti sumber regulasi untuk pustaka.",
    keywords: ["berkas", "dokumen privat", "unggah", "file", "arsip bukti", "sumber primer", "snapshot"],
    availability: "sebagian",
    capabilities: [
      { title: "Arsip bukti regulasi", detail: "Di Referensi, buka Riwayat temuan untuk melihat salinan bukti yang sudah diarsipkan bila tersedia. Ini bukan dokumen keuangan privat perusahaan.", available: true, href: "/referensi", action: "Lihat referensi dan arsip bukti" },
      { title: "Penyimpanan dokumen privat per tahun buku", detail: "Belum tersedia. Kolom bukti pada temuan hanya mencatat kebutuhan dokumen, bukan mengunggah atau menyimpan berkas.", available: false },
    ],
    boundary: "Jangan memasukkan dokumen perusahaan sensitif ke arsip pustaka bersama atau ke konsultasi AI. Salinan bukti tidak memperbarui status verifikasi secara otomatis.",
  },
  {
    id: "regulasi", title: "Regulasi dan pembelajaran",
    description: "Telusuri rujukan yang ditinjau, batas penerapannya, dan penjelasan masalah umum.",
    keywords: ["pustaka", "referensi", "regulasi", "peraturan", "belajar", "solusi", "masalah", "verifikasi"],
    availability: "tersedia",
    capabilities: [
      { title: "Pustaka referensi", detail: "Periksa tanggal telaah, cakupan, periode, sumber primer, dan riwayat perubahan.", available: true, href: "/referensi", action: "Buka pustaka" },
      { title: "Solusi masalah", detail: "Pelajari penjelasan awal dan rujukan untuk masalah persiapan yang umum.", available: true, href: "/solusi", action: "Telusuri solusi masalah" },
      { title: "Pilih fokus pendamping", detail: "Pilih salah satu dari tiga fokus bantuan pada model AI yang sama, bukan tiga profesional yang ditugaskan.", available: true, href: "/pendamping", action: "Lihat pendamping" },
    ],
    boundary: "Referensi dan AI adalah pendamping edukatif. Tidak tersedia pencarian web langsung dalam konsultasi atau jaminan bahwa setiap aturan telah ditelaah lengkap.",
  },
];

export const ROLE_PATHS: Record<WorkRole, {
  label: string; purpose: string; modules: string[];
  steps: { title: string; detail: string; href: string }[];
}> = {
  penyusun: {
    label: "Penyusun", purpose: "Menyiapkan dasar, dokumen, dan pekerjaan tahun buku.",
    modules: ["akuntansi", "perpajakan", "dokumen-bukti", "regulasi"],
    steps: [
      { title: "Periksa konteks perusahaan", detail: "Tinjau jenis perusahaan, standar, dan tahun aktif. Memilih jalur ini tidak mengubah profil.", href: "/perusahaan" },
      { title: "Pilih ruang tahun buku", detail: "Lihat diagnosis dan kerjakan daftar persiapan tahun yang dipilih.", href: "/ruang-laporan" },
      { title: "Periksa dasar rujukan", detail: "Cocokkan topik dengan cakupan dan periode peninjauannya.", href: "/referensi" },
      { title: "Klarifikasi kendala akuntansi", detail: "Ajukan pertanyaan edukatif; jangan sertakan data keuangan sensitif.", href: "/konsultasi?fokus=akuntansi" },
    ],
  },
  penelaah: {
    label: "Penelaah internal", purpose: "Menelaah kesiapan dan merekam tindak lanjut internal, bukan memberi opini audit.",
    modules: ["pengendalian", "dokumen-bukti", "regulasi", "akuntansi"],
    steps: [
      { title: "Pilih tahun yang ditelaah", detail: "Periksa catatan checklist pada ruang tahun buku yang benar.", href: "/ruang-laporan" },
      { title: "Periksa rujukan dan bukti", detail: "Baca batas temuan sumber. Arsip regulasi berbeda dari bukti transaksi perusahaan.", href: "/referensi" },
      { title: "Catat temuan dan tindak lanjut", detail: "Di ruang tahun buku, catat masalah, PIC, hasil tindakan dan telaah, lalu lihat riwayatnya.", href: "/ruang-laporan" },
    ],
  },
  pimpinan: {
    label: "Pimpinan", purpose: "Memahami kemajuan persiapan dan hal yang perlu ditindaklanjuti tim.",
    modules: ["pengendalian", "tahunan-rups", "akuntansi", "regulasi"],
    steps: [
      { title: "Lihat ringkasan perusahaan", detail: "Ringkasan mengikuti tahun aktif perusahaan dan bukan opini kepatuhan.", href: "/ringkasan" },
      { title: "Tinjau ruang tahun buku", detail: "Baca kemajuan dan temuan internal untuk tahun yang dipilih. Temuan lintas tahun belum digabung otomatis di Ringkasan.", href: "/ruang-laporan" },
      { title: "Klarifikasi tata kelola laporan", detail: "Bahas laporan tahunan dan RUPS sesuai bentuk badan usaha serta periode.", href: "/konsultasi?fokus=tahunan_rups" },
    ],
  },
};

export function parseWorkRole(value: string | null): { role: WorkRole; invalid: boolean } {
  return value !== null && Object.hasOwn(ROLE_PATHS, value)
    ? { role: value as WorkRole, invalid: false }
    : { role: "penyusun", invalid: value !== null };
}

export function selectWorkModules(query: string, availability: "semua" | ModuleAvailability, role: WorkRole): WorkModule[] {
  const terms = query.toLocaleLowerCase("id-ID").trim().split(/\s+/).filter(Boolean);
  const preferred = ROLE_PATHS[role].modules;
  return WORK_MODULES.filter(m => {
    const haystack = [m.title, m.description, ...m.keywords, ...m.capabilities.map(c => `${c.title} ${c.detail}`)].join(" ").toLocaleLowerCase("id-ID");
    return (availability === "semua" || m.availability === availability) && terms.every(t => haystack.includes(t));
  }).sort((a, b) => {
    const rank = (id: string) => preferred.includes(id) ? preferred.indexOf(id) : preferred.length;
    return rank(a.id) - rank(b.id);
  });
}
