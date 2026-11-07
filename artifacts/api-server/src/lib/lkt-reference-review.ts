import type { PrimaryEvidence, Reference, ReferenceReviewEvent } from "@workspace/api-zod";

// Review findings are deliberately narrower than an opinion on legal compliance.
export const REVIEWED_AT = "2026-11-06";

export const evidence = {
  rupst: {
    title: "Permenkum 49 Tahun 2025 — laporan tahunan perseroan",
    url: "https://peraturan.bpk.go.id/Download/414656/Permenkum%20Nomor%2049%20Tahun%202025.pdf",
    locator: "Pasal 1 angka 10; Pasal 16–20, 27–28, 32 dan 34",
    finding: "Pasal 16: direksi perseroan persekutuan modal menyampaikan laporan tahunan kepada RUPS setelah telaah komisaris paling lambat 6 bulan setelah akhir tahun buku. Persetujuan dimuat dalam akta notaris dan disampaikan oleh direksi melalui notaris kepada Menteri melalui SABH paling lama 30 hari kalender sejak akta ditandatangani, dengan akta persetujuan dan laporan tahunan. Pasal 17–18 mengatur teguran tertulis dan pemblokiran akses SABH bila kewajiban belum dipenuhi dalam 30 hari sejak notifikasi teguran. Perseroan perorangan memiliki jalur berbeda pada Pasal 27–28. Pasal 34 menyatakan berlaku sejak diundangkan, bukan menyebut 1 Juni 2026; jadwal operasional/relaksasi perlu pengumuman AHU tersendiri.",
  },
  ojk: {
    title: "POJK 14/POJK.04/2022",
    url: "https://ojk.go.id/id/regulasi/Documents/Pages/Penyampaian-Laporan-Keuangan-Berkala-Emiten-atau-Perusahaan-Publik/POJK%2014%20-%2004%20-%202022.pdf",
    locator: "Pasal 2–3, 15–18, 28–30",
    finding: "Laporan keuangan berkala meliputi laporan tahunan dan tengah tahunan untuk emiten/perusahaan publik dengan pernyataan pendaftaran efektif. Pasal 11–14 memuat pengecualian/kondisi khusus. Komponen diatur Pasal 2 ayat (4); audit laporan keuangan tahunan diatur Pasal 16 ayat (2), bukan kewajiban audit semua usaha.",
  },
  annual: {
    title: "POJK 29/POJK.04/2016",
    url: "https://www.ojk.go.id/id/kanal/pasar-modal/regulasi/peraturan-ojk/Documents/Pages/POJK-Laporan-Tahunan-Emiten-Perusahaan-Publik/POJK-Laporan-Tahunan.pdf",
    locator: "Pasal 1, 4, 6, 23–24",
    finding: "Laporan tahunan adalah pertanggungjawaban pengurusan dan pengawasan. Isinya lebih luas daripada laporan keuangan: profil, analisis manajemen, tata kelola dan laporan keuangan tahunan yang telah diaudit. Ini konteks emiten/perusahaan publik, bukan semua UMKM.",
  },
  kjpp: {
    title: "PMK 228/PMK.01/2019 — perubahan kedua PMK 101/PMK.01/2014",
    url: "https://jdih.kemenkeu.go.id/api/download/fulltext/2019/228~PMK.01~2019Per.pdf",
    locator: "Pasal I angka 15 (Pasal 52), Pasal II",
    finding: "KJPP menyampaikan laporan bulanan dan tahunan kepada Kepala Pusat. Laporan tahunan mencakup laporan keuangan (minimal posisi keuangan, laba rugi dan catatan), serta laporan realisasi alih pengetahuan yang disebut dalam Pasal 52. Bukan aturan bagi semua perusahaan.",
  },
  ep: {
    title: "IAI — Tentang SAK Entitas Privat (EP)",
    url: "https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20Entitas%20Privat%20(EP)",
    locator: "Ruang lingkup dan paragraf tanggal efektif",
    finding: "Ditujukan bagi entitas tanpa akuntabilitas publik yang menerbitkan laporan keuangan tujuan umum bagi pengguna eksternal. Entitas berakuntabilitas publik hanya jika otoritas berwenang mengizinkan. Efektif 1 Januari 2025; penerapan dini diperkenankan.",
  },
  transition: {
    title: "IAI — Pengesahan SAK Entitas Privat",
    url: "https://web.iaiglobal.or.id/Berita-IAI/detail/pengesahan-sak-entitas-privat",
    locator: "Pengumuman 9 Juli 2021, paragraf pengesahan",
    finding: "SAK EP menggantikan SAK ETAP, efektif pada 2025 dengan penerapan lebih awal diperkenankan. Periode sebelum 2025 perlu ditelaah tersendiri, bukan otomatis menggunakan EP.",
  },
  emkm: {
    title: "IAI — Tentang SAK EMKM",
    url: "https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20EMKM",
    locator: "Definisi entitas, konsep entitas bisnis dan tanggal efektif",
    finding: "SAK EMKM efektif 1 Januari 2018 dengan penerapan dini diperkenankan. Kelayakan tidak cukup berdasarkan label UMKM; perhatikan akuntabilitas publik, karakteristik usaha, pemisahan kekayaan pemilik/usaha serta kebutuhan pengguna laporan.",
  },
  revocation: {
    title: "Permendag 26 Tahun 2025",
    url: "https://jdih.kemendag.go.id/peraturan/download/b6be39d2-fc52-423e-96cc-e0bbae80f922/file_peraturan",
    locator: "Pasal 1 huruf c dan Pasal 2; pengundangan 30 Juni 2025",
    finding: "Permendag 25 Tahun 2020 tentang LKTP dicabut sejak 30 Juni 2025. Tidak menyimpulkan seluruh kewajiban berdasarkan peraturan lain ikut hilang.",
  },
  djp: {
    title: "DJP — PER-11/PJ/2025",
    url: "https://www.pajak.go.id/sites/default/files/lampiran/PER-11_PJ_2025_0.pdf",
    locator: "Pasal 84–85, 130–143 dan 147",
    finding: "SPT Tahunan PPh Badan adalah pelaporan pajak, bukan annual report. Pasal 85 memuat induk dan lampiran, termasuk rekonsiliasi laporan keuangan. Naskah awal efektif 22 Mei 2025; ketentuan peralihan perlu dicocokkan dengan tahun pajak. Jangan gunakan naskah awal sendirian untuk prosedur terkini.",
  },
} satisfies Record<string, PrimaryEvidence>;

export const djpUpdateUrl = "https://www.pajak.go.id/sites/default/files/2026-10/Pelaporan%20SPT%20Dalam%20Rangka%20Pelaksanaan%20Sistem%20Inti%20Administrasi%20Perpajakan%20%28PER-12_PJ_%202026%20tentang%20Perubahan%20PER-11_PJ_2025%20%20tentang%20Ketentuan%20Pelaporan%20PPh%2C%20PPN%2C%20PPnBM%2C%20dan%20Bea%20Materai%29_1.pdf";

type Review = Pick<Reference, "verificationStatus" | "sourceType" | "reportType" | "applicability" | "effectivePeriod" | "standards" | "verificationNotes" | "primarySources">;
const generalPeriod = "Artikel edukasi; tidak menetapkan periode berlaku peraturan atau standar.";
const secondary = (reportType: Review["reportType"], verificationNotes: string, primarySources: PrimaryEvidence[] = []): Review => ({
  verificationStatus: "reviewed_secondary", sourceType: "secondary", reportType,
  applicability: "Pengantar umum, bukan penetapan kewajiban untuk publik, nonpublik, UMKM atau KJPP.",
  effectivePeriod: generalPeriod, standards: [], verificationNotes, primarySources,
});

export const referenceReviews: Record<string, Review> = {
  legalmp: {
    ...secondary("annual_report", "Sebagian klaim dikonfirmasi dari naskah Permenkum 49/2025 di portal BPK: kewajiban penyampaian persetujuan laporan tahunan dan sanksi bertahap ada pada Pasal 16–18, khusus perseroan persekutuan modal. Pemblokiran bukan sanksi otomatis tanpa tahapan teguran. Tanggal 1 Juni 2026 tidak disebut sebagai awal berlaku dalam naskah; Pasal 34 merujuk pengundangan. Pengumuman primer AHU tentang mulai layanan, relaksasi dan jadwal sanksi 2026 belum berhasil diperoleh. Berita DDTC 29 Oktober 2026 menyebut jadwal berbeda dari berita Juni; informasi sekunder itu bukan tenggat terverifikasi. Tidak ada kewajiban memakai LegalMP dalam pasal yang diperiksa; kualitas layanan dan afiliasi tidak dinilai.", [evidence.rupst]),
    applicability: "Pasal 16–20: perseroan persekutuan modal, bukan seluruh PT tanpa pembeda. Perseroan perorangan mengikuti Pasal 27–28. Label nonpublik hanya penyaring topik; status publik tidak mengecualikan otomatis kewajiban ini.",
    effectivePeriod: "Ditinjau 6 November 2026. Pasal 34: berlaku sejak diundangkan; tanggal pengundangan tidak terbaca jelas pada hasil ekstraksi PDF dan belum dipastikan. Pasal 32 memberi masa nonelektronik paling lama 6 bulan setelah pengundangan. Mulai layanan 1 Juni 2026 dan jadwal relaksasi/sanksi operasional belum terverifikasi dari pengumuman primer AHU.",
  },
  hepidigital: {
    ...secondary("financial_report", "Halaman penawaran berhasil dibaca pada 6 November 2026. Daftar fitur adalah deskripsi penjual, bukan hasil uji produk. File Excel tidak dibeli, diunduh atau diuji; formula, keamanan file dan kesesuaian standar belum dinilai. Klaim cocok untuk semua bidang usaha tidak diadopsi. Bukan rekomendasi pembelian atau afiliasi dengan LKTara."),
    applicability: "Topik pembukuan dan template laporan untuk UMKM; pemilihan format tetap mengikuti kebutuhan usaha serta standar yang berlaku.",
    effectivePeriod: "Halaman komersial dibaca 6 November 2026; tidak menetapkan periode berlaku standar. Penawaran dapat berubah.",
  },
  "setyorini-2007": {
    ...secondary("annual_report", "Metadata dan ringkasan abstrak PDF yang telah ditambahkan di proyek utama dipertahankan. Artikel belum ditelaah ulang dalam peninjauan 11 sumber regulasi ini; bukan bukti kewajiban atau standar terkini."),
    verificationStatus: "needs_review",
    effectivePeriod: "Artikel akademik April 2007; konteks historis keterbacaan dan pemahaman annual report, bukan periode berlaku aturan.",
  },
  ciputra: secondary("financial_report", "Isi artikel berhasil dibaca. Manfaat LKT dapat dipakai sebagai pengantar; pernyataan kewajiban hukum bersifat umum tanpa penetapan dasar hukum Indonesia."),
  ajaib: secondary("annual_report", "Isi berhasil dibaca. Annual report lebih luas daripada laporan keuangan. Pernyataan audit dalam FAQ tidak boleh diterapkan ke semua perusahaan; gunakan dasar audit sesuai cakupan.", [evidence.annual]),
  wordsmith: secondary("mixed", "Artikel bertanggal 16 Juni 2023 berhasil dibaca. Istilah laporan tahunan dan jenis laporan keuangan bercampur; bukan daftar komponen wajib untuk semua standar.", [evidence.annual, evidence.ojk]),
  bca: secondary("annual_report", "Isi berhasil dibaca, bertanggal 30 Agustus 2026 pada halaman. Kata 'wajib' dan laporan diaudit dalam artikel bisnis bukan dasar kewajiban universal.", [evidence.annual]),
  hukumonline: {
    ...secondary("mixed", "Ulasan diperbarui 13 Agustus 2025 berhasil dibaca. Pencabutan Permendag 25/2020 cocok dengan naskah primer. Angka ambang aset dalam artikel tidak diadopsi; kriteria PP 24/1998 jo. PP 64/1999 dan penerapan terkini harus ditelaah tersendiri.", [evidence.revocation, evidence.annual]),
    applicability: "Orientasi penerima laporan menurut bentuk/status perusahaan; bukan kesimpulan bahwa semua perusahaan wajib melapor kepada Menteri Perdagangan.",
  },
  pppk: {
    verificationStatus: "verified_primary", sourceType: "primary", reportType: "mixed",
    applicability: "Khusus Kantor Jasa Penilai Publik (KJPP), bukan PT nonpublik, UMKM atau emiten pada umumnya.",
    effectivePeriod: "Dasar Pasal 52 pada perubahan PMK efektif 31 Desember 2019. Tanggal pembaruan halaman prosedur tidak tercantum; konfirmasi prosedur operasional untuk periode tujuan.",
    standards: [],
    verificationNotes: "Halaman resmi dan bunyi Pasal 52 pada PMK 228/2019 telah dibaca dan cocok untuk jenis serta komponen laporan KJPP. Verifikasi terbatas pada temuan ini; tidak menyatakan prosedur eLSa-PK pasti tetap sama atau menetapkan standar akuntansi otomatis.",
    primarySources: [evidence.kjpp],
  },
  levner: secondary("annual_report", "Artikel 12 Mei 2026 berhasil dibaca. Menguraikan komunikasi, strategi, tata kelola dan keberlanjutan; bukan ketentuan audit atau format wajib bagi semua perusahaan.", [evidence.annual]),
  zahir: secondary("mixed", "Artikel 13 Juni 2016, metadata pembaruan 13 September 2022, berhasil dibaca. Berguna untuk perbedaan istilah; daftar komponen dan generalisasi publikasi bukan acuan standar terkini.", [evidence.annual, evidence.ojk]),
  ojk: {
    verificationStatus: "verified_primary", sourceType: "primary", reportType: "financial_report",
    applicability: "Emiten/perusahaan publik dengan pernyataan pendaftaran efektif; periksa kondisi Pasal 11–14. Tidak otomatis berlaku bagi nonpublik, UMKM atau KJPP.",
    effectivePeriod: "Berlaku sejak diundangkan 22 Agustus 2022; Pasal 7 berlaku setelah enam bulan. Periode sebelum berlakunya aturan dan relaksasi khusus perlu telaah terpisah.",
    standards: ["Standar sesuai aturan pasar modal; pengecualian emiten skala kecil dan perubahan standar: Pasal 15"],
    verificationNotes: "Halaman resmi dan naskah penuh telah dibaca, terutama cakupan, komponen dan perbedaan laporan. Tidak menghitung tenggat individual atau menjamin tidak ada pengecualian/relaksasi untuk tahun tertentu.",
    primarySources: [evidence.ojk],
  },
  kledo: {
    ...secondary("financial_report", "Isi berhasil dibaca tetapi sebagian panduan tidak aman dijadikan dasar kewajiban terkini. Klaim pelaporan nonpublik ke Menteri tidak berlaku universal; jangan mengadopsi tenggat RUPS sebagai tenggat laporan keuangan semua usaha atau klaim semua aset memakai nilai wajar.", [evidence.revocation, evidence.ojk, evidence.emkm]),
    verificationStatus: "outdated",
    effectivePeriod: "Bagian kewajiban perlu ditinjau ulang terhadap pencabutan Permendag 25/2020 sejak 30 Juni 2025; artikel bukan naskah standar.",
  },
  siplaw: {
    ...secondary("mixed", "Artikel 4 November 2024 berhasil dibaca. Masih memakai Permendag 25/2020 yang telah dicabut. Definisi annual report dan financial report juga tidak boleh dipertukarkan. Ketentuan PP/UU lain tidak otomatis ikut dicabut.", [evidence.revocation, evidence.annual, evidence.ojk]),
    verificationStatus: "outdated",
    effectivePeriod: "Ulasan 2024; rujukan Permendag 25/2020 tidak berlaku sejak 30 Juni 2025.",
  },
};

type InitialReference = Omit<Reference, "editorialOwner" | "nextReviewAt" | "reviewOverdue" | "reviewHistory">;

function primary(id: string, title: string, publisher: string, scope: string, summary: string, review: Review, url: string): InitialReference {
  return { id, title, publisher, scope, summary, url, category: "Sumber resmi", ...review, reviewedAt: REVIEWED_AT, verified: review.verificationStatus === "verified_primary", bookmarked: false };
}

export const additionalReferences: InitialReference[] = [
  primary("kemenkum-rupst", "Laporan Tahunan Perseroan: Persetujuan RUPS dan Penyampaian melalui SABH", "Kementerian Hukum · naskah pada portal BPK", "umum",
    "Permenkum 49/2025 membedakan laporan tahunan perseroan persekutuan modal dari laporan keuangan perseroan perorangan. Pelaporan ke SABH berbeda dari pelaporan OJK dan SPT Tahunan.", {
      verificationStatus: "verified_primary", sourceType: "primary", reportType: "mixed",
      applicability: "Pasal 16–20 untuk perseroan persekutuan modal; Pasal 27–28 untuk perseroan perorangan. Bentuk badan hukum perlu dikonfirmasi; profil umum aplikasi bukan klasifikasi hukum lengkap.",
      effectivePeriod: "Pasal 34 berlaku sejak diundangkan. Tanggal pengundangan belum dapat dipastikan dari ekstraksi PDF. Pasal 32 mengatur masa nonelektronik paling lama 6 bulan setelah pengundangan; bukan bukti tanggal operasional 1 Juni 2026.",
      standards: [], verificationNotes: "Naskah resmi pada portal BPK dibaca, khusus Pasal 16–20, 27–28, 32 dan 34. Terverifikasi terbatas pada isi pasal tersebut, bukan keseluruhan perubahan atau pelaksanaan terkini. Dokumen primer AHU tentang relaksasi dan jadwal sanksi operasional belum berhasil diperoleh; jangan jadikan tanggal dari iklan/berita sebagai tenggat otomatis. Pasal 16 ayat (6) menegaskan laporan tahunan lebih luas daripada laporan keuangan. Tidak menyimpulkan kewajiban audit universal atau kewajiban memakai penyedia komersial tertentu.", primarySources: [evidence.rupst],
    }, evidence.rupst.url),
  primary("ojk-annual", "Laporan Tahunan Emiten atau Perusahaan Publik", "Otoritas Jasa Keuangan", "publik",
    "Annual report adalah pertanggungjawaban yang lebih luas daripada financial report; laporan keuangan tahunan adalah salah satu bagiannya.", {
      verificationStatus: "verified_primary", sourceType: "primary", reportType: "annual_report",
      applicability: "Emiten/perusahaan publik. Tidak menetapkan format annual report wajib untuk semua perusahaan nonpublik atau UMKM.",
      effectivePeriod: "Diundangkan 29 Juli 2016; Pasal 23 mengatur penyampaian mulai 2017 dengan pengecualian pasal tertentu pada 2016.",
      standards: [], verificationNotes: "Naskah dibaca untuk definisi dan cakupan isi. Detail bentuk/isi mengikuti Surat Edaran menurut Pasal 6; pustaka ini bukan pemeriksaan seluruh aturan pelaksana terkini.", primarySources: [evidence.annual],
    }, evidence.annual.url),
  primary("iai-ep", "SAK Entitas Privat dan peralihan dari SAK ETAP", "Ikatan Akuntan Indonesia", "nonpublik",
    "SAK EP efektif 1 Januari 2025, menggantikan SAK ETAP. Status nonpublik saja tidak cukup untuk memilih standar.", {
      verificationStatus: "verified_primary", sourceType: "primary", reportType: "financial_report",
      applicability: "Entitas tanpa akuntabilitas publik yang menerbitkan laporan tujuan umum bagi pengguna eksternal; entitas berakuntabilitas publik hanya jika diizinkan otoritas.",
      effectivePeriod: "Efektif 1 Januari 2025; penerapan dini diperkenankan. Periksa dasar standar yang dipakai untuk periode sebelum 2025.",
      standards: ["SAK Entitas Privat", "SAK ETAP (konteks transisi)"], verificationNotes: "Dua publikasi resmi IAI dibaca untuk ruang lingkup, tanggal efektif dan transisi. Bukan penelaahan naskah standar berlisensi secara lengkap.", primarySources: [evidence.ep, evidence.transition],
    }, evidence.ep.url),
  primary("iai-emkm", "Kelayakan SAK EMKM", "Ikatan Akuntan Indonesia", "umkm",
    "SAK EMKM efektif 1 Januari 2018; label UMKM tidak otomatis membuktikan kelayakan standar.", {
      verificationStatus: "verified_primary", sourceType: "primary", reportType: "financial_report",
      applicability: "Entitas yang memenuhi persyaratan EMKM dan tanpa akuntabilitas publik signifikan. Pertimbangkan kebutuhan pengguna laporan dan pemisahan aset pribadi/usaha.",
      effectivePeriod: "Efektif 1 Januari 2018; penerapan dini diperkenankan. Kriteria ukuran usaha sesuai peraturan yang relevan perlu diperiksa tersendiri.",
      standards: ["SAK EMKM"], verificationNotes: "Halaman resmi IAI dibaca untuk cakupan, konsep entitas dan tanggal efektif; bukan verifikasi kelayakan perusahaan tertentu atau keseluruhan naskah berlisensi.", primarySources: [evidence.emkm],
    }, evidence.emkm.url),
  primary("kemendag-pencabutan", "Pencabutan Permendag 25/2020 tentang LKTP", "JDIH Kementerian Perdagangan", "umum",
    "Permendag 26/2025 mencabut Permendag 25/2020. Jangan memakai prosedur dari aturan yang dicabut untuk menetapkan kewajiban terkini.", {
      verificationStatus: "verified_primary", sourceType: "primary", reportType: "financial_report",
      applicability: "Menilai validitas rujukan Permendag 25/2020. Kewajiban lain pada UU/PP atau regulator sektoral harus diperiksa secara terpisah.",
      effectivePeriod: "Pencabutan berlaku 30 Juni 2025, tanggal pengundangan; bukan penghapusan otomatis semua kewajiban pelaporan.",
      standards: [], verificationNotes: "Naskah lengkap resmi dan abstrak JDIH telah dibaca. Hanya pencabutan yang dipastikan, bukan kesimpulan atas semua kewajiban nonpublik.", primarySources: [evidence.revocation],
    }, evidence.revocation.url),
  primary("djp-spt", "SPT Tahunan PPh Badan dan perubahan aturan Coretax", "Direktorat Jenderal Pajak", "umum",
    "SPT Tahunan adalah pelaporan perpajakan yang berbeda dari laporan tahunan perusahaan. Naskah PER-11/PJ/2025 perlu dibaca bersama perubahannya.", {
      verificationStatus: "needs_review", sourceType: "primary", reportType: "tax_return",
      applicability: "Wajib pajak badan; UMKM orang pribadi tidak otomatis mengikuti formulir badan. Tahun pajak, status wajib pajak dan jenis usaha menentukan prosedur.",
      effectivePeriod: "Naskah awal PER-11/PJ/2025 efektif 22 Mei 2025. Materi resmi DJP 1 Oktober 2026 menyebut perubahan PER-12/PJ/2026; naskah perubahan belum diverifikasi penuh.",
      standards: ["Ketentuan perpajakan, bukan standar akuntansi"],
      verificationNotes: "Pasal 84–85 dan peralihan pada naskah awal dibaca. Materi edukasi resmi DJP tentang PER-12/PJ/2026 juga dibaca, tetapi bukan pengganti naskah hukum. Prosedur terkini masih perlu penelaahan naskah perubahan; tidak ada tarif, tenggat atau simpulan kewajiban individual yang ditetapkan.",
      primarySources: [evidence.djp],
    }, evidence.djp.url),
];

// Baseline findings and the historical code-reviewed snapshots below are
// retained history, not a rolling latest value. New in-app editorial entries
// live in the append-only database journal (lkt-editorial.ts); do not rewrite
// these historical findings or evidence when adding a later review.
const rupstOperationalEvidence = [
  evidence.rupst,
  {
    title: "Metadata resmi BPK — Permenkum 49 Tahun 2025",
    url: "https://peraturan.bpk.go.id/Details/350901/permenkum-no-49-tahun-2025",
    locator: "Metadata peraturan: Tanggal Penetapan, Tanggal Pengundangan, Tanggal Berlaku, Sumber",
    finding: "Ditetapkan 11 Desember 2025; diundangkan dan berlaku 17 Desember 2025; BN 2025 Nomor 1076, 16 halaman. Tanggal pengundangan diverifikasi dari metadata resmi, bukan ditebak dari penetapan atau ekstraksi PDF.",
  },
  {
    title: "Ditjen AHU — pengumuman awal penyampaian laporan tahunan melalui SABH",
    url: "https://www.instagram.com/p/DYzKsm7zVmm/",
    locator: "Akun resmi djahu_kemenkum; caption dibaca melalui /embed/captioned/ pada 6 November 2026",
    finding: "AHU mengumumkan penyampaian laporan tahunan PT melalui SABH mulai 1 Juni 2026; caption awal menyebut sanksi mulai November 2026. Ini pengumuman operasional awal, bukan tanggal berlakunya Permenkum 49/2025. Jadwal sanksi periode 2025 mengikuti pengumuman lanjutan yang lebih spesifik, bukan jadwal awal ini.",
  },
  {
    title: "Ditjen AHU — Pemberlakuan sanksi administratif bagi perseroan terbatas yang belum menyampaikan laporan tahunan",
    url: "https://www.instagram.com/p/De_cAWjk26F/",
    locator: "Akun resmi djahu_kemenkum; caption butir 1–5 dan poster carousel halaman 3–7, dibaca melalui /embed/captioned/ serta gambar aslinya pada 6 November 2026",
    finding: "Butir 1: mulai 1 November 2026 diberlakukan penyampaian akta persetujuan laporan tahunan melalui SABH paling lama 30 hari sejak ditandatangani. Butir 2: PNBP Rp0 sampai 31 Desember 2026, bukan tenggat bebas sanksi. Butir 3: teguran tertulis 1–31 Desember 2026 dan pemblokiran akses SABH mulai 2 Januari 2027 bagi PT yang belum memenuhi penyampaian laporan tahunan periode 2025. Butir 4–5: laporan periode 2026 dapat disampaikan 2 Januari–30 Juni 2027; PT didirikan pada 2026 atau belum habis tahun buku 2026 melapor pada periode berikutnya. Tidak mengekstrapolasi jadwal ini ke semua tahun buku atau bentuk usaha.",
  },
  {
    title: "Portal Ditjen AHU — Kewajiban Penyampaian Laporan Tahunan Perseroan",
    url: "https://portal.ahu.go.id/id/detail/85-ahu-portal/6213-pengumuman-kewajiban-penyampaian-laporan-tahunan-perseroan",
    locator: "Galeri foto: poster TEMPLATEPENGUMUMAN1080x1920px4; visual dibaca 6 November 2026",
    finding: "Poster resmi menjelaskan penyampaian melalui notaris dan SABH dengan akta persetujuan serta laporan tahunan; menyebut sanksi bagi perseroan persekutuan modal. Poster ini tidak memuat jadwal mulai layanan, relaksasi atau tanggal sanksi; bukan bukti mandiri untuk tanggal tersebut.",
  },
] satisfies PrimaryEvidence[];

const rupstReview = {
  recordedAt: REVIEWED_AT,
  editorialOwner: "Redaksi regulasi perseroan",
  nextReviewAt: "2026-12-06",
  applicability: "Pasal 16–20: perseroan persekutuan modal; perseroan perorangan tetap mengikuti Pasal 27–28. Jadwal sanksi operasional yang diperiksa khusus laporan tahunan periode 2025 yang belum disampaikan. Bentuk badan hukum dan tahun buku harus dinilai; profil publik, nonpublik, UMKM atau KJPP bukan klasifikasi hukum lengkap.",
  effectivePeriod: "Permenkum 49/2025 diundangkan dan berlaku 17 Desember 2025 (BN 2025 Nomor 1076), ditetapkan 11 Desember 2025. Pasal 32: jalur nonelektronik paling lama 6 bulan sejak pengundangan. Pengumuman awal: layanan SABH mulai 1 Juni 2026. Pengumuman lanjutan: batas penyampaian 30 hari sejak akta diberlakukan mulai 1 November 2026; teguran 1–31 Desember 2026 dan pemblokiran mulai 2 Januari 2027 untuk laporan periode 2025. PNBP Rp0 sampai 31 Desember 2026 bukan tenggat bebas sanksi. Jadwal periode 2026 (2 Januari–30 Juni 2027) serta kondisi PT baru/tahun buku belum habis tidak diterapkan otomatis.",
  standards: [],
  primarySources: rupstOperationalEvidence,
  verificationNotes: "Terverifikasi terbatas pada metadata BPK, caption asli akun resmi djahu_kemenkum dan visual poster pengumuman lanjutan, bukan kutipan berita. Jadwal November pada pengumuman awal bersifat historis; pengumuman lanjutan butir 3 menetapkan teguran 1–31 Desember 2026 dan blokir mulai 2 Januari 2027 khusus periode 2025. Masa nonelektronik Pasal 32 berbeda dari penyesuaian operasional sanksi dan fasilitas PNBP. Pengumuman yang dibaca tidak menyatakan 31 Desember sebagai masa bebas teguran; jangan menyimpulkannya dari tarif Rp0 atau berita tentang relaksasi. IKPI Juni dan DDTCNews 29 Oktober 2026 tetap sumber sekunder. Tidak menetapkan tenggat otomatis, audit universal, kewajiban semua profil atau kewajiban memakai LegalMP. Pelaksanaan individual tetap mengikuti tahapan Pasal 17–20 dan penilaian bentuk badan hukum. Laporan tahunan lebih luas daripada laporan keuangan.",
};

export const subsequentReferenceReviews: Readonly<Record<string, readonly ReferenceReviewEvent[]>> = {
  "kemenkum-rupst": [{
    ...rupstReview,
    verificationStatus: "verified_primary",
    changeSummary: "Pengumuman primer operasional AHU dan metadata pengundangan diperoleh; jadwal periode 2025 dicatat dengan batas cakupan. Temuan awal dipertahankan.",
  }],
  legalmp: [{
    ...rupstReview,
    verificationStatus: "reviewed_secondary",
    changeSummary: "Klaim jadwal dicocokkan dengan pengumuman asli AHU dan metadata BPK; LegalMP tetap sumber sekunder komersial, bukan dasar hukum atau rekomendasi penyedia.",
    verificationNotes: `${rupstReview.verificationNotes} LegalMP tetap sumber sekunder komersial; bukti resmi dilampirkan hanya sebagai pencocokan klaim. Mutu layanan, afiliasi dan harga tidak dinilai.`,
  }],
};

const editorialSchedule: Record<string, { editorialOwner: string; nextReviewAt: string }> = {
  legalmp: { editorialOwner: "Redaksi regulasi perseroan", nextReviewAt: "2026-12-06" },
  "kemenkum-rupst": { editorialOwner: "Redaksi regulasi perseroan", nextReviewAt: "2026-12-06" },
  "djp-spt": { editorialOwner: "Redaksi perpajakan", nextReviewAt: "2026-12-06" },
  pppk: { editorialOwner: "Redaksi regulasi profesi", nextReviewAt: "2027-02-04" },
  ojk: { editorialOwner: "Redaksi pasar modal", nextReviewAt: "2027-02-04" },
  "ojk-annual": { editorialOwner: "Redaksi pasar modal", nextReviewAt: "2027-02-04" },
  "iai-ep": { editorialOwner: "Redaksi standar akuntansi", nextReviewAt: "2027-02-04" },
  "iai-emkm": { editorialOwner: "Redaksi standar akuntansi", nextReviewAt: "2027-02-04" },
  "kemendag-pencabutan": { editorialOwner: "Redaksi regulasi perseroan", nextReviewAt: "2027-02-04" },
  kledo: { editorialOwner: "Redaksi edukasi akuntansi", nextReviewAt: "2026-12-06" },
  siplaw: { editorialOwner: "Redaksi regulasi perseroan", nextReviewAt: "2026-12-06" },
  "setyorini-2007": { editorialOwner: "Redaksi literatur akademik", nextReviewAt: "2027-02-04" },
  hepidigital: { editorialOwner: "Redaksi referensi komersial", nextReviewAt: "2026-12-06" },
};

export function editorialDay(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function withReviewReminder(reference: Reference, now = new Date()): Reference {
  // Access to a URL and passage of time are not editorial verification.
  return { ...reference, reviewOverdue: reference.nextReviewAt < editorialDay(now) };
}

export function withEditorialReview(
  initial: InitialReference,
  subsequent: readonly ReferenceReviewEvent[] = subsequentReferenceReviews[initial.id] ?? [],
): Reference {
  const schedule = editorialSchedule[initial.id] ?? {
    editorialOwner: "Redaksi edukasi akuntansi", nextReviewAt: "2027-05-05",
  };
  const baseline: ReferenceReviewEvent = {
    recordedAt: initial.reviewedAt,
    ...schedule,
    changeSummary: "Pencatatan awal temuan yang sudah tersedia; penambahan jadwal berkala, bukan verifikasi ulang.",
    verificationStatus: initial.verificationStatus,
    verificationNotes: initial.verificationNotes,
    applicability: initial.applicability,
    effectivePeriod: initial.effectivePeriod,
    standards: initial.standards,
    primarySources: initial.primarySources,
  };
  const reviewHistory = [baseline, ...subsequent];
  const latest = reviewHistory[reviewHistory.length - 1];
  return withReviewReminder({
    ...initial,
    verificationStatus: latest.verificationStatus,
    verificationNotes: latest.verificationNotes,
    applicability: latest.applicability,
    effectivePeriod: latest.effectivePeriod,
    standards: latest.standards,
    primarySources: latest.primarySources,
    reviewedAt: latest.recordedAt,
    verified: latest.verificationStatus === "verified_primary",
    editorialOwner: latest.editorialOwner,
    nextReviewAt: latest.nextReviewAt,
    reviewOverdue: false,
    reviewHistory,
  });
}
