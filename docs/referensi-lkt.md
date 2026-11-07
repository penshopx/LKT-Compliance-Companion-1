# Peninjauan berkala editorial

## Arsip bukti publik

Bukti primer yang dicatat dalam snapshot temuan kini mempunyai lampiran arsip di App Storage. Buka **Referensi → Riwayat temuan → Buka arsip bukti** atau **Redaksi → Riwayat dan bukti**. Tautan sumber asli tetap dipertahankan; arsip tidak mengubah tanggal pemeriksaan, status verifikasi, jadwal, temuan atau jawaban konsultasi lama.

Arsip awal meliputi ekstrak pasal publik Permenkum 49/2025, metadata resmi BPK, caption publik dua pengumuman AHU, poster galeri portal AHU, serta bagian relevan dari sumber primer OJK, Kemenkeu, Kemendag, pengantar publik IAI dan naskah awal DJP yang sudah dikutip. Caption hanya salinan teks publik, **bukan seluruh carousel**. Ekstrak teks bukan PDF utuh, dapat memiliki keterbatasan ekstraksi, dan bagian yang tidak disertakan ditandai. Pengantar IAI bukan salinan naskah standar berlisensi. Pengarsipan naskah awal DJP tidak menyelesaikan peninjauan naskah perubahannya.

Contoh tautan arsip pada aplikasi (salinan diambil 7 November 2026, ditautkan ke snapshot pemeriksaan 6 November 2026):

- [Caption pengumuman awal AHU](/api/lkt/evidence-archives/c5be7046251583a5ea3dd6383f7918edfbc1aa9c020ea5ddfd134479b0b80f3b) — sumber asli tetap https://www.instagram.com/p/DYzKsm7zVmm/.
- [Caption pengumuman lanjutan AHU, butir 1–5](/api/lkt/evidence-archives/e758e54c28ffbd99b322b92762be72ebb922af5d9cc8ca840b2adc5dcc5eecf4) — sumber asli tetap https://www.instagram.com/p/De_cAWjk26F/.
- [Poster galeri portal AHU](/api/lkt/evidence-archives/f1c41e07201b0ded64d908a2d1c503884eb1da09aecbe9825004f973d702e870) — sumber asli halaman portal tetap tercantum dalam riwayat.

Tanggal pemeriksaan berasal dari snapshot editorial yang ditautkan; waktu pengambilan arsip dicatat terpisah. Salinan yang diambil kemudian tidak membuktikan isi sumber sama persis pada tanggal pemeriksaan terdahulu. Arsip hanya membuktikan byte yang dipertahankan sejak pengambilan. Setiap lampiran menyertakan URL asal, lokasi bagian, deskripsi bagian yang disalin, MIME, ukuran, SHA-256 berkas, SHA-256 bukti, dan SHA-256 snapshot lengkap. Arsip dapat ditautkan ke beberapa riwayat hanya jika bukti persis sama; temuan awal tidak ditimpa.

Byte ada di namespace khusus dalam App Storage, bukan Git atau kolom JSON database. Metadata lampiran PostgreSQL bersifat append-only, terpisah dari jurnal. Rute publik `/api/lkt/evidence-archives/{id}` hanya melayani ID yang tercatat, masih cocok dengan referensi/snapshot/bukti/tanggal/lokasi yang dipertahankan, dan checksum serta ukuran byte yang sesuai. Tidak ada rute unggah publik, penjelajahan bucket, proxy URL bebas atau pengalihan ke URL bertanda tangan. Bila berkas hilang/berubah atau kaitan riwayat tidak cocok, unduhan gagal dengan pesan eksplisit (503); gunakan sumber asli, bukan menaikkan/menurunkan verifikasi otomatis.

### Prosedur operator

1. Jalankan migrasi aditif `pnpm --filter @workspace/db run migrate:lkt-evidence-archives` (juga dijalankan setelah merge).
2. Lihat target dengan `pnpm --filter @workspace/api-server run evidence:archive list`. Revisi dimulai dari 1, indeks sumber dari 0. Hanya snapshot temuan, bukan perubahan jadwal.
3. Ambil dan periksa **hanya bagian publik yang relevan** secara manual. Gunakan teks UTF-8, PDF atau PNG/JPEG hingga 20 MB. Jangan menyimpan HTML halaman akun, komentar pengguna, cookie, token, URL CDN bertanda tangan, EXIF/data pribadi atau naskah standar berlisensi. Pemisahan materi dan pemeriksaan visual tetap tanggung jawab operator; pemeriksaan format bukan pemindai semua data sensitif.
4. Simpan: `pnpm --filter @workspace/api-server run evidence:archive save <referenceId> <revision> <sourceIndex> <file> <mime> '<deskripsi batas salinan>' --confirm-public-material`. Jalur file relatif ke paket API. Gunakan `save-related` sebagai pengganti `save` hanya untuk menautkan byte yang sama ke **semua snapshot temuan dengan bukti identik**. URL harus berasal dari sumber resmi dalam daftar izin, tanpa query, kredensial atau fragmen. Sumber baru memerlukan pemeriksaan daftar izin oleh pengembang.
5. Penulisan objek bersifat create-only, checksum dibaca ulang sebelum metadata dicatat, dan pengulangan identik idempoten. Koreksi ditambahkan sebagai lampiran baru, bukan menimpa berkas/metadata lama. Tidak ada penghapusan otomatis arsip historis.
6. Jalankan `pnpm --filter @workspace/api-server run evidence:archive audit` untuk mendeteksi lampiran tanpa kaitan dan bukti yang belum diarsipkan. Ini memeriksa kaitan metadata, bukan mengambil ulang sumber atau mengubah status hukum. `pnpm --filter @workspace/api-server run test:evidence-archives` menguji kaitan/hash, tidak berubahnya temuan/konteks AI, format aman, metadata append-only dan unduhan gagal-tertutup.

### Pemulihan database baru dan pemindahan lingkungan

Daftar metadata awal yang telah diarsipkan disertakan dalam `artifacts/api-server/src/data/evidence-archives.initial.json`: 35 lampiran untuk 13 URL sumber, termasuk ID, waktu pengambilan asli, checksum dan kaitan snapshot. Ini **bukan byte dokumen**, bukan daftar URL unduhan hidup, serta tidak memuat nama bucket, token, cookie atau URL bertanda tangan. Byte asli sudah tersimpan di App Storage.

Pada lingkungan target yang diizinkan operator:

1. Siapkan akses App Storage dan database target. Jalankan migrasi editorial yang sudah ada, lalu `pnpm --filter @workspace/db run migrate:lkt-evidence-archives`.
2. Jika target memakai bucket/prefix arsip yang sama, jalankan `pnpm --filter @workspace/api-server run evidence:provision`. Perintah membaca byte arsip asli, memeriksa checksum/ukuran/format dan kaitan riwayat, lalu memulihkan metadata yang belum ada secara transaksional. Metadata yang sudah ada harus identik; konflik tidak ditimpa.
3. Jika target memakai bucket/prefix berbeda, operator harus mendapat izin baca sumber dan tulis target melalui App Storage terlebih dahulu, lalu menjalankan `pnpm --filter @workspace/api-server run evidence:provision --from-app-storage-root /bucket-sumber/prefix-privat`. Ini menyalin **objek arsip yang sudah ada**, create-only, memeriksa ulang checksum target, dan baru menautkan metadata. Jangan memasukkan URL/token/kredensial; argumen hanya lokasi bucket/prefix nonrahasia. Tanpa akses sumber, proses gagal; operator perlu memulihkan akses atau memindahkan salinan arsip terverifikasi sebelum melanjutkan.
4. Jalankan `evidence:archive audit` pada target dan buka tiga tautan contoh di atas; cocokkan header `X-Evidence-SHA256` dengan daftar metadata. `test:evidence-archives` juga benar-benar memulihkan 35 lampiran ke schema database terisolasi dari byte App Storage yang ada dan mengunduh ketiga ID dokumentasi melalui rute API. Pengujian hanya membaca objek arsip, tidak menulis bukti uji ke bucket.

Setup setelah merge menjalankan pemulihan ini setelah migrasi. Startup API juga memeriksa byte awal dan memulihkan metadata yang hilang **sebelum menerima permintaan**. Jika tabel, byte, izin, checksum atau kaitannya tidak tersedia/cocok, startup gagal dengan instruksi operator yang eksplisit, bukan menyajikan pustaka kosong atau mengiklankan tautan 404. Prosedur ini tidak menerbitkan aplikasi dan tidak mengakses/mengubah database produksi dari lingkungan pengembangan. Saat kelak menyiapkan lingkungan produksi, operator menjalankan prosedur yang sama di target dengan akses yang sesuai.

## Kebijakan peninjauan

Tanggal tinjau ulang adalah jadwal kerja redaksi, bukan masa berlaku hukum atau tenggat pelaporan perusahaan. Status verifikasi tidak berubah karena waktu berlalu, tautan merespons, atau referensi disimpan sebagai penanda.

- Setiap sumber memiliki penanggung jawab berbasis **peran editorial**, bukan nama orang yang diklaim telah melakukan pemeriksaan. Ini bukan penugasan anggota perusahaan atau notifikasi email.
- Jadwal awal: 30 hari untuk sumber komersial, materi usang, serta perubahan regulasi yang masih terbuka; 90 hari untuk sumber resmi dan literatur akademik yang belum ditelaah ulang; 180 hari untuk pengantar edukasi lain. Semua dihitung dari pencatatan awal 6 November 2026.
- Pengingat tampil di pustaka setelah tanggal berikutnya **lewat** menurut kalender Asia/Jakarta (WIB). Pada tanggal yang dijadwalkan belum dianggap terlambat. Pustaka menyediakan jumlah dan filter sumber lewat jadwal, serta menyegarkan metadata setiap menit saat terbuka.
- Riwayat disimpan bersama kode dalam jurnal editorial dan disertakan dalam respons daftar serta simpan penanda. Catatan awal mempertahankan temuan yang tersedia; penambahan jadwal bukan pemeriksaan ulang terhadap sumber.

## Mencatat peninjauan berikutnya

1. Jangan mengubah temuan awal `referenceReviews`, `additionalReferences`, atau catatan yang telah tersimpan di `subsequentReferenceReviews` dalam `artifacts/api-server/src/lib/lkt-reference-review.ts`. Keduanya merupakan arsip temuan, bukan nilai yang ditimpa setiap peninjauan.
2. Setelah peninjauan manusia, tambahkan snapshot lengkap ke akhir array `subsequentReferenceReviews[id]`: tanggal pencatatan, peran penanggung jawab, jadwal berikutnya, ringkasan perubahan (termasuk bila tidak ada perubahan), status, catatan temuan, cakupan, periode, standar, dan seluruh bukti primer beserta lokasi/temuannya. Pertahankan urutan kronologis dan alasan/batas verifikasi.
3. Snapshot terakhir menjadi metadata aktif; seluruh snapshot sebelumnya tetap tersedia pada **Riwayat temuan**. Gunakan tanggal kalender `YYYY-MM-DD`, bukan timestamp. Jangan menjadwalkan tanggal berikutnya sebelum atau sama dengan tanggal peninjauan.
4. Jangan menaikkan status hanya berdasarkan respons HTTP. Untuk jadwal RUPST, bukti primer AHU tetap wajib sebelum menyatakan tanggal operasional/sanksi terverifikasi. Status primer terverifikasi tetap terbatas pada temuan yang disebutkan.
5. Jalankan codegen bila kontrak berubah, lalu `pnpm --filter @workspace/api-server run test:references` dan pemeriksaan tipe. Pembaruan jurnal mengikuti proses perubahan kode biasa agar tersedia konsisten bagi semua tim setelah rilis.

# Referensi aplikasi pendamping LKT

Daftar tautan yang diberikan pengguna sebagai referensi pengembangan aplikasi pendamping Laporan Keuangan Tahunan (LKT).

Tanggal peninjauan: **6 November 2026**. Seluruh 11 tautan di bawah berhasil diakses dan isi utamanya dibaca. Peninjauan ini **bukan opini hukum atau jaminan kelengkapan aturan terkini**. Verifikasi dibatasi pada temuan, periode dan cakupan yang dicatat; halaman yang dapat diakses tidak otomatis membuktikan semua klaimnya benar.

## Hasil peninjauan 11 sumber awal

Nomor mengacu pada daftar tautan asli di bawah. `verified=true` hanya untuk sumber primer dengan temuan terbatas yang diperiksa; artikel yang telah dibaca tetap `verified=false` karena bukan dasar hukum primer.

| No. | Sumber | Hasil | Temuan dan batas pemakaian |
| --- | --- | --- | --- |
| 1 | OJK | Primer terverifikasi | Halaman resmi dan PDF **POJK 14/POJK.04/2022** dibaca. Pasal 2: laporan keuangan tahunan/tengah tahunan, komponen dan pelaporan elektronik; khusus emiten/perusahaan publik dengan pernyataan pendaftaran efektif. Pasal 11–14 memuat kondisi khusus. Pasal 15 mengatur penyajian/standar dan kondisi emiten skala kecil; Pasal 16 mengatur audit laporan tahunan dalam cakupan ini. Tidak berlaku otomatis bagi semua usaha. |
| 2 | PPPK Kemenkeu | Primer terverifikasi | Halaman prosedur dibaca dan dicocokkan dengan **Pasal 52 pada PMK 228/PMK.01/2019**, perubahan kedua PMK 101/PMK.01/2014 (sebelumnya diubah PMK 56/PMK.01/2017). Khusus **KJPP**: laporan bulanan dan tahunan; laporan tahunan mencakup laporan keuangan dan realisasi alih pengetahuan yang disebut dalam pasal. Tanggal pembaruan halaman tidak ditampilkan; prosedur aplikasi operasional perlu dikonfirmasi lagi untuk periode tujuan. |
| 3 | Universitas Ciputra | Pendukung ditinjau | Isi pengantar manfaat LKT dibaca. Klaim kewajiban hukum bersifat umum; tidak digunakan menetapkan kewajiban hukum Indonesia. Tanggal penerbitan tidak dipastikan dari isi utama hasil ekstraksi. |
| 4 | Ajaib | Pendukung ditinjau | Definisi annual report dan komponen naratif/keuangan dibaca. Pernyataan audit dalam FAQ tidak diadopsi sebagai kewajiban universal; cocokkan POJK 29/2016 untuk konteks publik. |
| 5 | Wordsmith Group | Pendukung ditinjau | Artikel 16 Juni 2023 memadukan laporan tahunan dan jenis laporan keuangan. Dipakai untuk orientasi, bukan daftar komponen wajib lintas standar. |
| 6 | BCA Ocean | Pendukung ditinjau | Halaman menampilkan 30 Agustus 2026. Annual report dibedakan dari laporan keuangan, tetapi bahasa “wajib” dan audit tidak dipakai sebagai dasar hukum semua perusahaan. |
| 7 | Hukumonline | Pendukung ditinjau | Ulasan diperbarui 13 Agustus 2025; pencabutan Permendag 25/2020 dikonfirmasi melalui naskah resmi Permendag 26/2025. Angka ambang aset pada artikel **tidak disalin**; pembacaan PP 24/1998 jo. PP 64/1999 dan penerapannya memerlukan penelaahan tersendiri. |
| 8 | Levner Consulting | Pendukung ditinjau | Artikel 12 Mei 2026 dibaca: cakupan annual report meliputi strategi, tata kelola dan keberlanjutan. Bukan penetapan audit, tenggat atau format wajib semua perusahaan. |
| 9 | Zahir Accounting | Pendukung ditinjau | Artikel 13 Juni 2016 dengan metadata pembaruan 13 September 2022 dibaca. Berguna membedakan istilah; daftar komponen dan generalisasi publikasi bukan rujukan standar terkini. |
| 10 | Kledo | Sebagian tidak mutakhir / perlu koreksi | Isi berhasil dibaca. Generalisasi pelaporan perusahaan tertutup kepada Menteri dan waktu RUPS tidak boleh diterapkan ke semua usaha; kerangka prosedur perlu ditelaah terhadap pencabutan Permendag 25/2020. Klaim semua aset memakai nilai wajar tidak diadopsi: SAK EMKM memakai dasar biaya historis. Tidak digunakan sebagai dasar kewajiban. |
| 11 | SIP Law Firm | Sebagian tidak mutakhir | Artikel 4 November 2024 masih menggunakan Permendag 25/2020; aturan itu dicabut sejak 30 Juni 2025. Istilah annual report dan laporan keuangan tidak boleh disamakan. Pencabutan Permendag tidak membatalkan otomatis UU/PP lainnya. |

## Sumber primer pelengkap dan bukti yang diperiksa

1. [Naskah POJK 14/POJK.04/2022](https://ojk.go.id/id/regulasi/Documents/Pages/Penyampaian-Laporan-Keuangan-Berkala-Emiten-atau-Perusahaan-Publik/POJK%2014%20-%2004%20-%202022.pdf).
   - Pasal 2–3, 11–18, 28–30. Efektif **22 Agustus 2022** (pengundangan); Pasal 7 berlaku setelah enam bulan.
   - Financial report berkala, bukan annual report. Audit laporan keuangan tahunan dalam cakupan ini memiliki dasar Pasal 16 ayat (2); tidak digeneralisasi ke nonpublik/UMKM/KJPP. Tidak ada penghitungan tenggat individual dalam aplikasi.
2. [Naskah POJK 29/POJK.04/2016](https://www.ojk.go.id/id/kanal/pasar-modal/regulasi/peraturan-ojk/Documents/Pages/POJK-Laporan-Tahunan-Emiten-Perusahaan-Publik/POJK-Laporan-Tahunan.pdf).
   - Pasal 1, 4, 6, 23–24. Diundangkan **29 Juli 2016**; Pasal 23 mengatur penyampaian mulai **2017**, dengan pengecualian pasal tertentu pada 2016.
   - Annual report emiten/perusahaan publik adalah pertanggungjawaban Direksi/Komisaris; Pasal 4 mencakup profil, analisis manajemen, tata kelola dan laporan keuangan tahunan yang diaudit. Bentuk/isi lebih lanjut diatur Surat Edaran menurut Pasal 6. Peninjauan ini tidak memeriksa keseluruhan aturan pelaksana atau pengecualian terbaru.
3. [Naskah PMK 228/PMK.01/2019](https://jdih.kemenkeu.go.id/api/download/fulltext/2019/228~PMK.01~2019Per.pdf).
   - Pasal I angka 15 mengganti Pasal 52; Pasal II: efektif saat diundangkan **31 Desember 2019**.
   - KJPP melapor kepada Kepala Pusat. Laporan keuangan minimal posisi keuangan, laba rugi dan catatan adalah bagian laporan tahunan KJPP, selain laporan realisasi terkait tenaga ahli asing/KJPPA. Tidak menetapkan standar akuntansi otomatis atau kewajiban audit umum.
4. [IAI — Tentang SAK Entitas Privat](https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20Entitas%20Privat%20(EP)) dan [Pengesahan SAK EP, 9 Juli 2021](https://web.iaiglobal.or.id/Berita-IAI/detail/pengesahan-sak-entitas-privat).
   - Ruang lingkup: entitas tanpa akuntabilitas publik yang menerbitkan laporan tujuan umum bagi pengguna eksternal; entitas berakuntabilitas publik hanya jika otoritas mengizinkan.
   - Efektif **1 Januari 2025**, menggantikan ETAP, penerapan dini diperkenankan. Periode sebelum 2025 tidak otomatis memakai EP.
5. [IAI — Tentang SAK EMKM](https://web.iaiglobal.or.id/SAK-IAI/Tentang%20SAK%20EMKM).
   - Efektif **1 Januari 2018**, penerapan dini diperkenankan. Kelayakan perlu mempertimbangkan karakteristik usaha, akuntabilitas publik, pemisahan kekayaan pemilik/usaha dan kebutuhan pengguna laporan.
   - Verifikasi IAI terbatas pada publikasi resmi terbuka tersebut, **bukan seluruh teks standar berlisensi**, bukan verifikasi ambang UMKM terkini atau penetapan kelayakan perusahaan. Untuk SAK Indonesia/aturan sektoral, periksa edisi dan naskah sesuai periode secara terpisah.
6. [Naskah Permendag 26 Tahun 2025](https://jdih.kemendag.go.id/peraturan/download/b6be39d2-fc52-423e-96cc-e0bbae80f922/file_peraturan) dan [abstrak JDIH](https://jdih.kemendag.go.id/peraturan/download/b6be39d2-fc52-423e-96cc-e0bbae80f922/file_abstract).
   - Naskah lengkap diunduh dan teks dibaca; Pasal 1 huruf c mencabut Permendag 25/2020, efektif **30 Juni 2025** (Pasal 2 dan pengundangan). Portal peraturan.go.id tidak dapat diakses saat peninjauan; digunakan naskah langsung dari JDIH Kemendag.
   - Temuan hanya pencabutan; jangan menyimpulkan semua kewajiban pelaporan hilang. Prosedur LKTP nonpublik terkini dan relasinya dengan UU/PP lain belum ditetapkan dalam aplikasi.
7. [Naskah DJP PER-11/PJ/2025](https://www.pajak.go.id/sites/default/files/lampiran/PER-11_PJ_2025_0.pdf).
   - PDF diunduh dan teks Pasal 84–85, ketentuan peralihan 130–143 dan Pasal 147 dibaca. SPT Tahunan PPh Badan berbeda dari annual report; Pasal 85 mencakup induk/lampiran termasuk rekonsiliasi laporan keuangan. Naskah awal efektif **22 Mei 2025**.
   - [Materi resmi DJP mengenai perubahan PER-12/PJ/2026, diperbarui 1 Oktober 2026](https://www.pajak.go.id/sites/default/files/2026-10/Pelaporan%20SPT%20Dalam%20Rangka%20Pelaksanaan%20Sistem%20Inti%20Administrasi%20Perpajakan%20%28PER-12_PJ_%202026%20tentang%20Perubahan%20PER-11_PJ_2025%20%20tentang%20Ketentuan%20Pelaporan%20PPh%2C%20PPN%2C%20PPnBM%2C%20dan%20Bea%20Materai%29_1.pdf) dibaca untuk mengidentifikasi adanya perubahan, **bukan sebagai pengganti naskah hukum**.
   - **Status awal 6 November 2026: perlu telaah lanjutan.** Naskah perubahan belum terverifikasi penuh saat itu. Temuan awal ini tetap disimpan; hasil peninjauan primer berikutnya ada di bagian **Peninjauan lanjutan SPT — 7 November 2026**. Aplikasi tidak menetapkan tarif, tenggat atau kewajiban individual.

## Peninjauan lanjutan SPT — 7 November 2026

Snapshot lengkap baru untuk `djp-spt` ditambahkan sesudah pencatatan awal, bukan menggantinya. Status aktif `verified_primary` berarti **temuan terbatas berikut diperiksa pada sumber primer**, bukan jaminan seluruh aturan perpajakan sudah lengkap atau selalu mutakhir. Peran penanggung jawab tetap Redaksi perpajakan; tinjau ulang dijadwalkan 7 Desember 2026, bukan tenggat pelaporan pengguna.

### Naskah primer dan lokasi yang benar-benar dibaca

| Sumber | Lokasi pembacaan | Temuan dan batas |
| --- | --- | --- |
| [PER-11/PJ/2025, PDF DJP](https://www.pajak.go.id/sites/default/files/lampiran/PER-11_PJ_2025_0.pdf) | Pasal **80–85**, hlm. tercetak 68–73; Pasal **138–140, 143**, hlm. 114–116; Pasal **147**, hlm. 119 | Fungsi SPT Tahunan dan Tahun/Bagian Tahun Pajak; pembeda orang pribadi/badan; formulir, prosedur periode lama dan pengakuan dokumen transisi awal 2025. Berlaku sejak ditetapkan **22 Mei 2025**. Naskah diunduh dan teks pasal tersebut dibaca, bukan klaim audit seluruh ketentuan/lampiran dasar. |
| [PER-12/PJ/2026, naskah pada halaman peraturan DJP](https://www.pajak.go.id/index.php/id/peraturan/perubahan-atas-peraturan-direktur-jenderal-pajak-nomor-11pj2025-tentang-ketentuan) | **Seluruh batang tubuh**, dari konsiderans sampai penetapan, termasuk Pasal I angka **1–15**, Pasal II angka **1–2** | Dibaca hingga akhir, bukan cuplikan pencarian atau materi edukasi. Untuk SPT Tahunan: angka 13 menyisipkan **80A**, angka 14 menyisipkan **129A–129B**, angka 15 mengganti Lampiran **A, B, E, G, H**. Pasal II menentukan transisi dan tanggal berlaku. Ketentuan SPT Masa, termasuk PPN Pasal 29E, tidak diterapkan sebagai prosedur SPT Tahunan. |
| [Lampiran PER-12/PJ/2026, PDF DJP](https://www.pajak.go.id/sites/default/files/lampiran/Lampiran_PER12PJ2026.pdf) | **G**: induk orang pribadi hlm. 350–351 dan petunjuk Bagian F angka **12a–12b** hlm. 386; **H**: judul hlm. 484 dan petunjuk badan rupiah Bagian F angka **18a–18b** hlm. 656 | Lampiran diunduh; teks lokasi tersebut dibaca. Keduanya memperhitungkan seluruh pembayaran PPh Pasal 29 dikurangi pengembalian pendahuluan melalui SKPPKP untuk Tahun/Bagian Tahun Pajak terkait sebelum pembetulan, bukan hanya angka pada SPT terakhir. Pembacaan ini tidak meliputi seluruh formulir, contoh hitung atau petunjuk migas/dolar. |

**Tanggal ditetapkan berbeda dari mulai berlaku.** Naskah perubahan ditetapkan **28 September 2026**, tetapi **Pasal II angka 2** tegas menyatakan mulai berlaku **1 Oktober 2026**. [Metadata JDIH Kemenkeu](https://www.jdih.kemenkeu.go.id/dok/per-12pj2026) yang turut dibaca mencantumkan 28 September sebagai tanggal berlaku; ketidaksesuaian ini dicatat, bukan disalin sebagai kesimpulan. Dasar tanggal dalam snapshot adalah pasal pada naskah resmi DJP. Materi edukasi resmi yang dibaca sebelumnya tetap bukti historis pengenalan perubahan, bukan dasar hukum snapshot baru.

### Periode dan ketentuan transisi

- **Periode lama:** Pasal 138 huruf a dasar mempertahankan formulir menurut PER-34/PJ/2010 beserta perubahannya (terakhir yang disebut PER-30/PJ/2017) untuk Tahun Pajak sampai **2024** atau Bagian Tahun Pajak yang berakhir sampai **Desember 2024**, baik penyampaian maupun pembetulan. Huruf b memisahkan formulir usaha hulu migas menurut PER-05/PJ/2014. Pasal 139 merujuk PER-21/PJ/2009 untuk pemberitahuan perpanjangan sampai Tahun Pajak 2024. Pasal 140 merujuk PER-02/PJ/2019 untuk penyampaian/penerimaan/pengolahan periode lama yang disebut, **selain SPT Masa Bea Meterai**. Rujukan aturan lama tersebut adalah hasil pembacaan pasal transisi, bukan klaim bahwa seluruh aturan lama dibaca kembali.
- **Transisi awal 2025:** Pasal 143 dasar mengakui bentuk dokumen untuk Masa Januari 2025 sampai masa mulai berlakunya aturan dasar, Bagian Tahun Pajak yang berakhir setelah Desember 2024, atau Tahun Pajak 2025, yang dibuat/disampaikan melalui Portal Wajib Pajak atau sistem terintegrasi sejak 1 Januari 2025 sebelum aturan dasar berlaku. Bukan pengampunan semua kesalahan atau perpanjangan tenggat.
- **Sudah masuk sebelum perubahan berlaku:** Pasal II angka 1 huruf **a** perubahan menyebut pelaporan dan/atau pembetulan yang disampaikan sebelum aturan perubahan berlaku dan belum diproses/diselesaikan tindak lanjutnya tetap ditindaklanjuti menurut **PER-11/PJ/2025**.
- **Pembetulan masuk sesudah perubahan berlaku:** huruf **b** menyebut pembetulan atas SPT yang telah disampaikan sebelum perubahan berlaku mengikuti **PER-12/PJ/2026**, untuk Masa Pajak sejak Januari 2025, Bagian Tahun Pajak yang berakhir sejak Januari 2025, atau Tahun Pajak sejak 2025. Karena itu tahun pajak saja tidak cukup; periksa juga tanggal pelaporan awal/pembetulan dan status pemrosesan. Jangan mengganti seluruh prosedur periode 2024 dan sebelumnya berdasarkan tanggal kalender pengajuan saja.

### Orang pribadi, badan dan syarat pembetulan

- **Orang pribadi:** Pasal 81–83 dasar dan Lampiran **G**; termasuk pemisahan pembukuan/pencatatan serta penghasilan usaha/pekerjaan bebas pada induk yang dibaca. Status UMKM **bukan** penetapan otomatis rezim pajak, hak memakai norma, tarif final, atau pemilihan formulir badan.
- **Badan:** Pasal 84–85 dasar dan Lampiran **H**; Pasal 85 memuat rekonsiliasi laporan keuangan untuk badan rupiah. Pasal 84 membedakan mata uang dan usaha hulu migas; prosedur khusus tersebut tidak diturunkan dari contoh badan rupiah. **UMKM orang pribadi tidak otomatis mengikuti prosedur badan.**
- **Pasal 80A:** pembetulan SPT Tahunan mensyaratkan DJP belum melakukan pemeriksaan atau pemeriksaan bukti permulaan secara terbuka terhadap SPT bersangkutan. Penghitungan memperhitungkan seluruh pembayaran PPh Pasal 29 dan/atau pengembalian yang telah diterbitkan SKPPKP sebelum pembetulan untuk Tahun/Bagian Tahun Pajak terkait; keputusan pembetulan/pembatalan SKPPKP juga diperhatikan menurut ayat (4). Ayat (3) memberi ketentuan tersendiri untuk migas *cost recovery*. Kurang/lebih bayar ditindaklanjuti sesuai ayat (5), bukan kalkulasi otomatis aplikasi.
- **Pasal 129A:** hak/kewajiban mengikuti pembetulan terakhir. Permohonan pengembalian lebih bayar yang SPT-nya dibetulkan tidak ditindaklanjuti dengan syarat masing-masing: penelitian belum menghasilkan keputusan atau pemeriksaan belum dimulai. Jangan menyimpulkan semua permohonan pengembalian otomatis batal tanpa memeriksa tahapnya.
- **Pasal 129B:** keputusan persetujuan pengangsuran/penundaan pembayaran PPh Pasal 29 menjadi tidak berlaku sejak SPT Tahunan pembetulan disampaikan; jangan memakai persetujuan lama seolah tetap berlaku setelah pembetulan.

**Batas aplikasi:** SPT Tahunan tetap berbeda dari annual report dan laporan keuangan. Tidak ada penetapan tarif, tenggat individual otomatis, kewajiban individual, atau jaminan kepatuhan dari snapshot ini. Konfirmasi jenis wajib pajak, periode, tanggal penyampaian/pembetulan, status pemeriksaan, pembayaran/pengembalian dan aturan lain yang relevan dengan profesional. Riwayat awal serta snapshot konsultasi lama tidak diubah.

## Matriks penerapan

| Profil | Pembeda yang aman | Batas peninjauan |
| --- | --- | --- |
| Publik | Pisahkan financial report POJK 14/2022 dari annual report POJK 29/2016; baca kondisi khusus masing-masing. | Tidak menetapkan tenggat otomatis/relaksasi atau menganggap semua emiten memakai standar identik. Pasal 15 POJK 14/2022 memerlukan perhatian untuk emiten skala kecil dan perubahan standar. |
| Nonpublik | Status nonpublik bukan pembebasan kewajiban; bentuk badan, sektor, penerima dan tahun buku tetap perlu dinilai. SAK EP mungkin relevan sesuai kelayakan. | Tidak menyatakan semua nonpublik wajib melapor ke OJK/Menteri atau wajib audit. UU PT/PP dan kewajiban sektoral lain belum ditelaah lengkap. |
| UMKM | Skala UMKM tidak otomatis membuktikan kelayakan SAK EMKM atau menentukan formulir pajak badan. | Periksa akuntabilitas publik, karakteristik usaha, bentuk wajib pajak dan tahun buku/pajak. Standar berlaku sejak tanggal efektifnya, kecuali penerapan dini yang diperkenankan. |
| KJPP | Laporan bulanan/tahunan profesi kepada Kepala Pusat menurut Pasal 52 berbeda dari annual report emiten; laporan keuangan adalah salah satu komponennya. | Tidak digeneralisasi ke semua perusahaan jasa dan tidak otomatis menentukan standar/audit. Prosedur operasional perlu konfirmasi sesuai periode. |

Kategori dapat beririsan. Pilihan profil pada aplikasi adalah penyaring langkah persiapan, bukan klasifikasi hukum lengkap.

## Kontrak aplikasi

OpenAPI dan hasil codegen meneruskan `verificationStatus`, `reviewedAt`, `sourceType`, `reportType`, `applicability`, `effectivePeriod`, `standards`, `verificationNotes`, serta `primarySources` (judul, URL, pasal/bagian, temuan). `verified` dipertahankan untuk kompatibilitas dan bernilai benar **hanya** untuk `verified_primary`.

Status: `verified_primary` (primer, temuan terbatas diperiksa), `reviewed_secondary` (dibaca, bukan dasar hukum), `outdated` (sebagian tidak mutakhir/perlu koreksi), `needs_review` (belum cukup untuk simpulan terkini), `unavailable` (tidak dapat diakses, bila terjadi pada peninjauan berikutnya). Semua tanggal peninjauan adalah tanggal kerja editorial, bukan tanggal pembaruan penerbit atau jaminan hukum berlaku selamanya.

## Sumber resmi

1. OJK — Penyampaian Laporan Keuangan Berkala Emiten atau Perusahaan Publik  
   https://ojk.go.id/id/regulasi/Pages/Penyampaian-Laporan-Keuangan-Berkala-Emiten-atau-Perusahaan-Publik.aspx  
   Cakupan terkonfirmasi terbatas: emiten/perusahaan publik dengan kondisi yang disebut di atas; bukan semua perusahaan.

2. PPPK Kementerian Keuangan — Tata Cara Penyampaian Laporan Bulanan dan Tahunan KJPP  
   https://pppk.kemenkeu.go.id/in/post/tata-cara-penyampaian-laporan-bulanan-dan-tahunan-kjpp  
   Cakupan terkonfirmasi terbatas: Kantor Jasa Penilai Publik (KJPP), bukan kewajiban umum semua perusahaan.

## Artikel pendukung

3. Universitas Ciputra — Pentingnya Laporan Keuangan Tahunan  
   https://www.ciputra.ac.id/acc/pentingnya-laporan-keuangan-tahunan/

4. Ajaib — Annual Report  
   https://ajaib.co.id/kamus/a/annual-report

5. Wordsmith Group — Jenis Laporan Keuangan Tahunan  
   https://wordsmithgroup.com/id/jenis-laporan-keuangan-tahunan/

6. BCA Ocean — Annual Report Perusahaan  
   https://ocean.bca.co.id/id/artikel/annual-report-perusahaan

7. Hukumonline — Kepada Siapa Laporan Keuangan Wajib Disampaikan  
   https://www.hukumonline.com/klinik/a/kepada-siapa-laporan-keuangan-wajib-disampaikan-lt5f609138d70ab/

8. Levner Consulting — Annual Report Adalah  
   https://levnerconsulting.com/blog/annual-report-adalah/

9. Zahir Accounting — Apa Perbedaan Annual Report dan Financial Report  
   https://zahiraccounting.com/id/blog/apa-perbedaan-annual-report-dan-financial-report/

10. Kledo — Laporan Keuangan Tahunan  
    https://kledo.com/blog/laporan-keuangan-tahunan/

11. SIP Law Firm — Laporan Keuangan Tahunan  
    https://siplawfirm.id/id/publikasi/laporan-keuangan-tahunan

## Artikel akademik unggahan pengguna

12. Dhyah Setyorini — **Laporan Tahunan vs Ringkasan Laporan Tahunan: Antara Kemampuan Dibaca dan Kemampuan Dipahami**  
    Jurnal Ekonomi & Pendidikan, Volume 4 Nomor 1, April 2007.  
    PDF asli: `attached_assets/asesorarjuna,+03+Diah+Setyorini_(1)_1793972435901.pdf`  
    Tautan aplikasi: `/api/lkt/reference-documents/setyorini-2007.pdf`  
    Salinan layanan disimpan di App Storage, dalam jalur publik `references/setyorini-2007-laporan-tahunan.pdf`.

    Berdasarkan abstrak yang dibaca: artikel membahas keterbacaan, pemahaman pembaca, serta ringkasan laporan tahunan sebagai alternatif komunikasi dengan pemangku kepentingan. Artikel juga mengangkat kehati-hatian terkait pengungkapan dan tanggung jawab hukum.

    **Batas penggunaan:** sumber akademik historis tahun 2007, bukan naskah regulasi atau standar akuntansi terkini. Isi belum ditelaah menyeluruh; jangan menganggap ringkasan laporan tahunan otomatis dapat menggantikan laporan lengkap yang diwajibkan. Kesesuaian dengan ketentuan saat ini belum diverifikasi.

## Referensi komersial tambahan dari pengguna

13. **LegalMP — Layanan RUPS Tahunan dan Laporan Keuangan**  
    https://legalmp.id/jasa-laporan-keuangan1/  
    Halaman dibaca dan klaim hukumnya diperiksa pada 6 November 2026. Menawarkan pendampingan administrasi RUPST, dokumen dan template laporan keuangan. Status aplikasi tetap `reviewed_secondary`, bukan sumber primer. Dasar kewajiban dan tahapan sanksi dicocokkan dengan Permenkum 49/2025; peninjauan lanjutan pada hari yang sama memperoleh pengumuman asli AHU tentang layanan dan jadwal sanksi periode 2025 serta metadata pengundangan resmi BPK. Rincian dan batas cakupan ada di bawah. Kualitas layanan belum dinilai.

14. **Hepi Digital — Template Keuangan UMKM Siap Pakai**  
    https://hepidigital.myscalev.com/  
    Halaman dibaca pada 6 November 2026. Menawarkan template Excel untuk jurnal, neraca, laba rugi, buku besar dan dashboard disertai video panduan. Status aplikasi: `reviewed_secondary`, bukan standar akuntansi. Daftar fitur berasal dari penjual; file tidak dibeli, diunduh atau diuji. Formula, keamanan file, kelengkapan laporan dan kesesuaian standar belum dinilai; klaim cocok bagi semua bidang usaha tidak diadopsi.

Keduanya ditambahkan atas permintaan pengguna sebagai referensi, bukan analisis pembanding, afiliasi atau rekomendasi pembelian. Parameter pelacakan iklan dihapus dari tautan. Tidak ada harga promosi yang dijadikan informasi permanen aplikasi.

## Pemeriksaan klaim hukum LegalMP — 6 November 2026

**Sumber primer yang dibaca:** [Permenkum 49 Tahun 2025 pada portal BPK](https://peraturan.bpk.go.id/Download/414656/Permenkum%20Nomor%2049%20Tahun%202025.pdf), khusus Pasal 1 angka 10, 16–20, 27–28, 32 dan 34. Sumber ini ditambahkan sebagai entri tersendiri `kemenkum-rupst` dengan status `verified_primary` yang terbatas pada temuan tersebut; LegalMP tetap sumber sekunder komersial.

**Peninjauan lanjutan, 6 November 2026:** metadata resmi BPK, caption asli akun resmi AHU dan poster pengumuman lanjutan telah dibaca (URL dan lokasi bukti di bagian berikut). Pada pencatatan awal, pengumuman operasional belum diperoleh. Temuan awal itu tetap disimpan dalam riwayat aplikasi; snapshot berikutnya memuat bukti baru, bukan menimpa sejarah. Tabel di bawah menunjukkan hasil aktif setelah peninjauan lanjutan.

| Klaim/topik | Hasil pencocokan | Batas kesimpulan |
| --- | --- | --- |
| Kewajiban menyampaikan persetujuan laporan tahunan melalui SABH | **Didukung**, untuk perseroan persekutuan modal. Pasal 16 ayat (1): direksi menyampaikan laporan tahunan kepada RUPS setelah ditelaah komisaris paling lambat 6 bulan setelah akhir tahun buku. Ayat (2)–(5): persetujuan dimuat dalam akta notaris; direksi melalui notaris menyampaikannya kepada Menteri paling lama 30 hari sejak akta ditandatangani, secara elektronik melalui SABH, dengan akta persetujuan dan laporan tahunan. Pasal 1 angka 10 mendefinisikan hari kalender. | Bukan semua perusahaan tanpa pembeda. Perseroan perorangan memakai mekanisme laporan keuangan tersendiri pada Pasal 27–28. Status publik/nonpublik bukan pengganti pemeriksaan bentuk badan hukum. |
| Laporan keuangan cukup sebagai seluruh laporan tahunan | **Tidak tepat jika disamakan.** Pasal 16 ayat (6) mencakup laporan keuangan dan materi kegiatan, tanggung jawab sosial/lingkungan, masalah usaha, pengawasan komisaris serta data/penghasilan pengurus yang disebut dalam pasal. | Template laporan keuangan saja tidak otomatis memenuhi seluruh isi laporan tahunan atau ketentuan lain. Tidak menarik kesimpulan audit universal dari pasal ini. |
| Mulai wajib sejak 1 Juni 2026 | **Dikonfirmasi sebagai pengumuman operasional SABH**, melalui caption asli AHU. Bukan tanggal mulai berlaku norma: Pasal 34 dan metadata BPK menunjukkan **17 Desember 2025** sebagai pengundangan/berlaku; tanggal penetapan **11 Desember 2025** berbeda. Pasal 32 mengizinkan jalur nonelektronik paling lama 6 bulan setelah pengundangan. | Jangan menyamakan tanggal layanan, masa nonelektronik dan awal kewajiban hukum. Tidak menghitung tanggal akhir transisi sendiri atau menerapkannya ke seluruh profil. |
| Risiko sanksi hingga pemblokiran SABH | **Didukung dengan tahapan.** Pasal 17 mengatur teguran tertulis dan pemblokiran. Pasal 18: teguran melalui notifikasi SABH dan/atau surel; jika kewajiban tidak dipenuhi dalam 30 hari sejak notifikasi terkait teguran, akses SABH ditutup. Pasal 19–20 mengatur permohonan pembukaan kembali dengan dokumen pendukung. Pengumuman lanjutan AHU butir 3 menetapkan teguran **1–31 Desember 2026** dan blokir mulai **2 Januari 2027**, khusus laporan periode **2025** yang belum disampaikan. | Bukan pemblokiran langsung tanpa tahapan atau pada tanggal iklan. Tidak menetapkan status sanksi individual; notifikasi, pemenuhan kewajiban, bentuk badan hukum dan tahun buku tetap perlu diperiksa. |
| Harus memakai penyedia LegalMP | **Tidak ditemukan dalam pasal yang diperiksa.** Pasal 16 menyebut direksi melalui notaris, bukan merek penyedia tertentu. | Pemeriksaan ini bukan penilaian mutu layanan, harga, atau rekomendasi pembelian. |

### Bukti primer operasional dan pengundangan — peninjauan lanjutan

| Bukti asli dan lokasi yang dibaca | Temuan terbatas | Periode/cakupan dan batas |
| --- | --- | --- |
| [Metadata resmi BPK, Permenkum 49/2025](https://peraturan.bpk.go.id/Details/350901/permenkum-no-49-tahun-2025), bagian **Metadata Peraturan** | Penetapan 11 Desember 2025; pengundangan dan berlaku **17 Desember 2025**; **BN 2025 Nomor 1076**, 16 halaman. | Metadata resmi menyelesaikan ketidakjelasan ekstraksi halaman terakhir PDF. Tidak menebak pengundangan dari tanggal penetapan. Pasal 32 tentang jalur nonelektronik tetap dibedakan dari jadwal operasional berikut. |
| [Pengumuman awal akun resmi `djahu_kemenkum`](https://www.instagram.com/p/DYzKsm7zVmm/), caption | Penyampaian laporan tahunan PT melalui SABH mulai **1 Juni 2026**; caption awal menyebut sanksi mulai November 2026. | Bukti primer komunikasi awal, bukan tanggal berlaku peraturan. Jadwal sanksi awal tidak lagi dipakai untuk periode 2025 ketika pengumuman lanjutan memberikan rincian berbeda. |
| [Pengumuman lanjutan AHU tentang sanksi](https://www.instagram.com/p/De_cAWjk26F/), caption butir **1** dan poster carousel halaman **3** | Mulai **1 November 2026** diberlakukan penyampaian akta persetujuan laporan tahunan melalui SABH paling lama **30 hari** sejak akta ditandatangani. | Pemberlakuan operasional jangka waktu akta, bukan awal berlakunya Permenkum atau tanggal pemblokiran. Mekanisme Pasal 16 untuk perseroan persekutuan modal tidak diterapkan ke perseroan perorangan. |
| Pengumuman lanjutan yang sama, butir **2**, poster halaman **4** | Fasilitas **PNBP Rp0 sampai 31 Desember 2026**. | Bukan bukti seluruh jasa/notaris gratis, bukan tenggat pelaporan, dan **bukan masa bebas teguran sampai 31 Desember**. Ketentuan tarif lengkap tidak ditelaah dalam peninjauan ini. |
| Pengumuman lanjutan yang sama, butir **3**, poster halaman **5** | Teguran tertulis **1–31 Desember 2026**; pemblokiran akses SABH mulai **2 Januari 2027**. | Secara eksplisit khusus PT yang belum memenuhi penyampaian **laporan tahunan periode 2025**. Tidak mengekstrapolasi ke semua periode atau menyimpulkan blokir individual tanpa tahapan Pasal 17–20. |
| Pengumuman lanjutan yang sama, butir **4–5**, poster halaman **6–7** | Laporan periode **2026** dapat disampaikan **2 Januari–30 Juni 2027**. PT yang didirikan pada 2026 atau belum habis tahun buku 2026 menyampaikan pada periode pelaporan berikutnya. | Dicatat untuk mencegah pencampuran periode 2025 dan 2026; tidak dijadikan kalender otomatis bagi semua tahun buku. |
| [Pengumuman pada portal AHU](https://portal.ahu.go.id/id/detail/85-ahu-portal/6213-pengumuman-kewajiban-penyampaian-laporan-tahunan-perseroan), [poster galeri asli](https://portal.ahu.go.id/uploads/e8e0b159bddc/1024_768_TEMPLATEPENGUMUMAN1080x1920px4.png) | Pelaporan melalui notaris dan SABH dengan akta persetujuan serta laporan tahunan; sanksi untuk perseroan persekutuan modal. | Poster tidak mencantumkan tanggal awal layanan, relaksasi atau jadwal sanksi. Metadata halaman `updated : 10/01/2026` tidak digunakan untuk menebak tanggal pengumuman operasional lain. |

**Cara akses bukti:** halaman Instagram biasa/tangkapan web tidak dapat dibuka saat peninjauan, tetapi tampilan publik [caption awal](https://www.instagram.com/p/DYzKsm7zVmm/embed/captioned/) dan [caption lanjutan](https://www.instagram.com/p/De_cAWjk26F/embed/captioned/) berhasil dibaca langsung tanpa login. Gambar carousel asli dari tampilan publik pengumuman lanjutan juga dibuka dan dibaca secara visual; bukan hanya cuplikan hasil pencarian atau salinan media. URL unggahan permanen digunakan dalam aplikasi, bukan URL CDN sementara. Tanggal unggah tidak ditebak dari berita; tanggal **6 November 2026** adalah tanggal pemeriksaan.

**Transisi/relaksasi:** pisahkan masa nonelektronik paling lama 6 bulan pada Pasal 32, penyesuaian operasional pemberlakuan batas 30 hari mulai 1 November 2026, jadwal teguran/pemblokiran periode 2025, dan fasilitas tarif sampai 31 Desember 2026. Pengumuman lanjutan yang dibaca tidak menyatakan bahwa seluruh Desember bebas sanksi; justru teguran sudah berlangsung pada Desember. Karena itu, istilah berita “perpanjangan masa transisi/relaksasi sampai 31 Desember” tidak diubah menjadi tenggat hukum atau jaminan bebas teguran.

**Rekonsiliasi sumber sekunder:**
- [IKPI, 29 Juni 2026](https://ikpi.or.id/ditjen-ahu-tetapkan-sanksi-administratif-pt-berlaku-mulai-november-2026) menyebut layanan sejak 1 Juni dan sanksi November. Jadwal November sejalan dengan caption primer **awal**, tetapi bukan rincian operasional terbaru periode 2025.
- [DDTCNews, 29 Oktober 2026](https://news.ddtc.co.id/berita/nasional/1823661/ditjen-ahu-siapkan-sanksi-bagi-pt-yang-belum-lapor-tahunan) dibaca ulang; jadwal teguran Desember dan blokir 2 Januari 2027 cocok dengan **butir 3 pengumuman lanjutan asli**. Berita tetap sekunder, bukan bukti primer hanya karena mengutip AHU.
- LegalMP tetap sumber sekunder komersial (`reviewed_secondary`, `verified=false`), tanpa rekomendasi memakai penyedianya. Bukti operasional dan metadata resmi tercatat pada snapshot terbaru `legalmp` serta `kemenkum-rupst`; snapshot awal tetap tersedia.

Tidak ada tanggal di atas yang menjadi tenggat otomatis atau perubahan kewajiban seluruh profil aplikasi. Bentuk badan hukum, tahun buku, status pengajuan dan notifikasi individual harus dinilai. Verifikasi terbatas pada temuan yang dicatat, bukan jaminan seluruh perubahan aturan atau pelaksanaan telah diperiksa.

## Pedoman penggunaan

- Bedakan laporan tahunan (annual report) dari laporan keuangan (financial report); jangan menyamakan cakupan keduanya tanpa penjelasan.
- Artikel edukasi dan ulasan hukum adalah sumber pendukung, bukan pengganti naskah peraturan resmi.
- Sebelum menyajikan kewajiban, batas waktu, sanksi, atau rekomendasi perpajakan, verifikasi naskah resmi beserta perubahan dan cakupan penerapannya.
- Setiap panduan perlu mencantumkan sumber, cakupan perusahaan, periode berlaku, dan tanggal verifikasi.
- Jangan menyatakan daftar ini sudah lengkap untuk regulasi akuntansi atau perpajakan.
