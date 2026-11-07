import type { PrimaryEvidence, ReferenceReviewEvent } from "@workspace/api-zod";

// A later, bounded review. Do not replace the initial DJP evidence with this.
const primarySources: PrimaryEvidence[] = [
  {
    title: "DJP — PER-11/PJ/2025, dasar SPT Tahunan",
    url: "https://www.pajak.go.id/sites/default/files/lampiran/PER-11_PJ_2025_0.pdf",
    locator: "Pasal 80–85 (hlm. 68–73); Pasal 138–140 dan 143 (hlm. 114–116); Pasal 147 (hlm. 119)",
    finding: "Pasal 80 membedakan Tahun Pajak dan Bagian Tahun Pajak serta kriteria dokumen elektronik. Orang pribadi memakai Pasal 81–83 dan Lampiran G, bukan formulir badan Pasal 84–85 dan Lampiran H. Pasal 85 memuat rekonsiliasi laporan keuangan badan rupiah. Pasal 138: formulir untuk Tahun Pajak sampai 2024 atau Bagian Tahun Pajak yang berakhir sampai Desember 2024 mengikuti aturan lama yang disebut (migas tersendiri); Pasal 139 mengatur perpanjangan sampai Tahun Pajak 2024; Pasal 140 mempertahankan tata cara PER-02/PJ/2019 bagi periode lama selain SPT Masa Bea Meterai. Pasal 143 mengakui dokumen periode yang disebut yang dibuat/disampaikan melalui sistem terintegrasi sejak 1 Januari 2025 sebelum aturan dasar berlaku. Pasal 147: berlaku pada tanggal ditetapkan, 22 Mei 2025.",
  },
  {
    title: "DJP — naskah PER-12/PJ/2026, perubahan PER-11/PJ/2025",
    url: "https://www.pajak.go.id/index.php/id/peraturan/perubahan-atas-peraturan-direktur-jenderal-pajak-nomor-11pj2025-tentang-ketentuan",
    locator: "Batang tubuh lengkap Pasal I angka 1–15 dan Pasal II angka 1–2; khusus Pasal I angka 13 (80A), 14 (129A–129B), 15 (Lampiran A, B, E, G, H)",
    finding: "Ditetapkan 28 September 2026, tetapi Pasal II angka 2 menyatakan berlaku 1 Oktober 2026. Pasal II angka 1 huruf a: pelaporan/pembetulan yang disampaikan sebelum berlaku dan belum diproses/diselesaikan ditindaklanjuti menurut PER-11/PJ/2025. Huruf b: pembetulan yang disampaikan setelah berlaku atas SPT yang telah disampaikan sebelum berlaku mengikuti perubahan untuk Masa Pajak sejak Januari 2025, Bagian Tahun Pajak yang berakhir sejak Januari 2025, atau Tahun Pajak sejak 2025. Pasal 80A mensyaratkan belum ada pemeriksaan atau pemeriksaan bukti permulaan secara terbuka; penghitungan pembetulan memperhitungkan seluruh pembayaran PPh Pasal 29 dan/atau pengembalian melalui SKPPKP sebelum pembetulan, dengan ketentuan khusus migas cost recovery. Pasal 129A mengatur pembetulan terakhir dan tindak lanjut permohonan pengembalian dengan syaratnya, bukan pembatalan semua permohonan otomatis. Pasal 129B: persetujuan pengangsuran/penundaan PPh Pasal 29 tidak berlaku sejak SPT Tahunan pembetulan disampaikan. Lampiran G (orang pribadi) dan H (badan) ikut diubah; tidak hanya prosedur badan.",
  },
  {
    title: "DJP — Lampiran PER-12/PJ/2026, bagian SPT orang pribadi dan badan",
    url: "https://www.pajak.go.id/sites/default/files/lampiran/Lampiran_PER12PJ2026.pdf",
    locator: "Bagian G: induk hlm. 350–351 dan petunjuk Bagian F angka 12a–12b hlm. 386; Bagian H: judul hlm. 484, petunjuk badan rupiah Bagian F angka 18a–18b hlm. 656",
    finding: "Bagian G memisahkan penghasilan pekerjaan, usaha/pekerjaan bebas, pembukuan dan pencatatan; label UMKM tidak memilihkan rezim pajak. Pada orang pribadi Bagian F angka 12a–12b dan badan rupiah Bagian F angka 18a–18b, pembetulan memperhitungkan seluruh pembayaran PPh Pasal 29 dikurangi pengembalian pendahuluan melalui SKPPKP untuk Tahun/Bagian Tahun Pajak bersangkutan sebelum pembetulan disampaikan, bukan sekadar menyalin angka SPT sebelumnya. Pembacaan lampiran terbatas pada lokasi ini, bukan audit seluruh formulir, contoh hitung atau prosedur migas/dolar.",
  },
];

export const djpTaxReview: ReferenceReviewEvent = {
  recordedAt: "2026-11-07",
  editorialOwner: "Redaksi perpajakan",
  nextReviewAt: "2026-12-07",
  changeSummary: "Naskah primer perubahan dibaca lengkap pada batang tubuh dan dicocokkan dengan dasar SPT serta bagian lampiran terkait; tanggal berlaku, pembetulan dan transisi dipisahkan. Riwayat awal tetap dipertahankan.",
  verificationStatus: "verified_primary",
  applicability: "SPT Tahunan PPh untuk Tahun Pajak atau Bagian Tahun Pajak, bukan annual report atau standar akuntansi. Bedakan wajib pajak badan (Pasal 84–85, Lampiran H) dari orang pribadi (Pasal 81–83, Lampiran G). UMKM orang pribadi tidak otomatis mengikuti formulir/prosedur badan; skala UMKM bukan penetapan rezim pajak. Periksa jenis wajib pajak, periode, tanggal penyampaian normal/pembetulan, status pemeriksaan, pembayaran dan pengembalian. Migas serta mata uang dolar memerlukan telaah khusus, bukan perluasan panduan badan rupiah.",
  effectivePeriod: "PER-11/PJ/2025 berlaku 22 Mei 2025 (Pasal 147). PER-12/PJ/2026 ditetapkan 28 September 2026, berlaku 1 Oktober 2026 (Pasal II angka 2), bukan tanggal metadata JDIH. Pasal 138–140 dasar tetap membedakan Tahun Pajak sampai 2024 dan Bagian Tahun Pajak yang berakhir sampai Desember 2024; Pasal 143 memuat pengakuan dokumen transisi awal 2025. Pasal II angka 1 huruf a perubahan: pelaporan/pembetulan yang disampaikan sebelum berlaku dan belum diproses/diselesaikan memakai aturan dasar. Huruf b: pembetulan yang disampaikan setelah berlaku atas SPT yang telah disampaikan sebelum berlaku memakai perubahan untuk Masa Pajak sejak Januari 2025, Bagian Tahun Pajak yang berakhir sejak Januari 2025, atau Tahun Pajak sejak 2025. Tanggal berlaku bukan tenggat individual dan bukan penggantian seluruh prosedur periode lama.",
  standards: ["Ketentuan perpajakan, bukan standar akuntansi"],
  verificationNotes: "Terverifikasi terbatas pada temuan yang dicatat, bukan jaminan kelengkapan semua aturan pajak terkini. Batang tubuh lengkap PER-12/PJ/2026 (Pasal I angka 1–15 dan Pasal II) dibaca dari halaman peraturan resmi DJP, bukan materi edukasi. Dasar PER-11/PJ/2025 dan lampiran perubahan dibaca pada pasal/lokasi yang dicantumkan. Metadata JDIH menyebut berlaku 28 September 2026, tetapi teks Pasal II angka 2 secara eksplisit menyebut 1 Oktober 2026; gunakan naskah, bukan metadata untuk tanggal berlaku. Pasal 80A, 129A–129B dan perubahan Lampiran G/H harus dipertimbangkan untuk pembetulan, termasuk syarat pemeriksaan, seluruh pembayaran/pengembalian dan gugurnya persetujuan angsuran/penundaan. Ketentuan Masa PPN seperti Pasal 29E tidak digeneralisasi ke SPT Tahunan. Tidak menetapkan tarif, tenggat individual otomatis atau simpulan kewajiban individual; tidak menggeneralisasi prosedur badan ke UMKM orang pribadi. Seluruh lampiran dan aturan lain di luar lokasi bukti tidak diklaim telah ditelaah.",
  primarySources,
};
