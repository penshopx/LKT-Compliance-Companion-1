# Baseline Peta Modul LKTara

## Tujuan dan status

Dokumen ini mencatat baseline fitur **Peta Modul** yang telah diterapkan dan diverifikasi. Ini adalah acuan cakupan produk dan regresi, bukan persetujuan pengembangan fitur tambahan, sertifikat kepatuhan, atau laporan audit keamanan menyeluruh.

Peta Modul mengadaptasi pengelompokan alur kerja yang relevan dari GUSTAFTA ke kebutuhan persiapan laporan keuangan tahunan. Taksonomi konstruksi, katalog pembayaran, dan model hak akses GUSTAFTA tidak diimpor.

## Akses dan konteks

- Halaman: `/peta-modul`, di dalam area aplikasi yang memerlukan autentikasi.
- Titik masuk: menu **Peta Modul** dan tautan pada halaman **Pendamping**.
- Judul halaman: `Peta Modul | LKTara`; deskripsi dan metadata Open Graph menjelaskan fungsi navigasi.
- Membuka halaman atau memilih perspektif tidak mengubah perusahaan maupun tahun buku aktif.
- Tautan ke Ruang Laporan membuka pemilihan ruang tahun buku. Daftar Persiapan pada `/checklist` tetap mengikuti tahun aktif profil perusahaan.
- Peta ini menautkan fitur yang sudah ada; tidak menambah endpoint, tabel, migrasi, unggahan, atau pengiriman pesan otomatis.

## Cakupan enam modul

| Modul | Status baseline | Tujuan dan jalur yang tersedia | Batas utama |
|---|---|---|---|
| Penyusunan dan rekonsiliasi | Tersedia | Ruang Laporan, Daftar Persiapan, konsultasi akuntansi | Tidak memeriksa saldo atau menghasilkan opini audit; checklist merupakan isian tim. |
| Persiapan perpajakan | Tersedia | Konsultasi perpajakan dan Referensi untuk persiapan SPT | Tidak menghitung atau menyampaikan SPT, serta tidak menetapkan tarif/tenggat universal. |
| Laporan tahunan dan RUPS | Tersedia | Konsultasi laporan tahunan/RUPS dan Referensi | Tidak mengajukan laporan ke SABH atau menggantikan notaris; penerapan perlu konteks badan usaha dan periode. |
| Pengendalian internal | Tersedia | Temuan, tindak lanjut, riwayat, dan pengarsipan melalui Ruang Laporan per tahun | Penutupan temuan bukan penyelesaian checklist otomatis, verifikasi regulasi, atau audit independen. |
| Dokumen dan bukti | Sebagian | Arsip bukti regulasi melalui Referensi dan Riwayat temuan | Penyimpanan dokumen privat perusahaan per tahun buku belum tersedia. |
| Regulasi dan pembelajaran | Tersedia | Referensi, Solusi Masalah, dan Pendamping | Bantuan edukatif; bukan pencarian web langsung atau jaminan seluruh aturan telah ditelaah. |

**Arti status:** “Tersedia” dan “Sebagian” adalah metadata cakupan fungsi yang telah dibangun, bukan indikator kesehatan layanan, kemutakhiran hukum, ataupun kepatuhan perusahaan.

## Perspektif navigasi, bukan kewenangan

| Pilihan UI | Nilai URL | Alur yang disarankan |
|---|---|---|
| Penyusun | `penyusun` | Konteks perusahaan → ruang tahun buku → dasar rujukan → konsultasi akuntansi. |
| Penelaah internal | `penelaah` | Tahun yang ditelaah → rujukan dan bukti → temuan dan tindak lanjut. |
| Pimpinan | `pimpinan` | Ringkasan perusahaan → ruang tahun buku → konsultasi tata kelola laporan. |

- Perspektif mengubah rekomendasi dan urutan modul, bukan izin akses.
- Tanpa filter, keenam modul tetap muncul pada setiap perspektif.
- Pilihan ini tidak memberikan keanggotaan perusahaan, hak pemilik, atau izin editorial. Autentikasi dan otorisasi tetap mengikuti mekanisme aplikasi yang terpisah; lihat [batas akses akun perusahaan](akun-perusahaan.md).
- Tanpa parameter `peran`, halaman menggunakan Penyusun. Nilai tak dikenal, termasuk `owner`, menampilkan peringatan dan menggunakan Penyusun tanpa menaikkan hak akses.
- Ringkasan mengikuti tahun aktif perusahaan. Pada baseline ini, temuan lintas tahun belum digabung otomatis di Ringkasan.

## Pencarian, filter, dan URL

- `peran`: `penyusun`, `penelaah`, atau `pimpinan`.
- `q`: teks pencarian; mencakup judul, deskripsi, kata kunci, dan uraian kemampuan. Pencarian mengabaikan kapitalisasi; semua kata pencarian harus ditemukan dalam teks modul.
- `status`: `tersedia` atau `sebagian`; tanpa filter menggunakan semua modul.
- Contoh: `/peta-modul?peran=penelaah&q=SPT`.
- Pergantian perspektif menambah entri riwayat browser. Perubahan pencarian/filter mengganti entri saat ini, sehingga tidak memenuhi riwayat dengan setiap ketikan.
- Reload mempertahankan perspektif, pencarian, dan filter yang tercantum dalam URL.
- Hasil kosong menampilkan keadaan tanpa hasil. Reset menghapus pencarian dan filter status, tetapi mempertahankan perspektif.
- Tautan konsultasi membuka `/konsultasi?fokus=akuntansi`, `perpajakan`, atau `tahunan_rups`. Membuka tautan tidak mengirim pertanyaan; pengguna tetap harus menulis dan mengirimkannya sendiri.

## Pemisahan bukti regulasi dan dokumen privat

1. **Arsip bukti regulasi:** salinan sumber publik untuk pustaka bersama. Tautan menuju `/referensi`; pengguna membuka Riwayat temuan untuk melihat arsip bila tersedia.
2. **Dokumen privat perusahaan:** berkas keuangan per tahun buku. Penyimpanannya belum tersedia pada baseline ini, ditandai **Belum tersedia**, tanpa tombol unggah atau tautan aksi.
3. Kolom bukti pada temuan mencatat kebutuhan dokumen, bukan mengunggah atau menyimpan berkas.
4. Jangan memasukkan dokumen perusahaan sensitif ke pustaka bersama atau konsultasi AI.
5. Salinan arsip tidak memperbarui status verifikasi secara otomatis. Detail kebijakan sumber dan arsip tetap mengikuti [dokumentasi referensi](referensi-lkt.md).

## Bukti verifikasi baseline

Hasil berikut berasal dari pemeriksaan pada penyelesaian implementasi Peta Modul, sebelum dokumentasi ini dibuat. Hasil tersebut bukan klaim bahwa semua fitur aplikasi atau perubahan lain yang digabung sesudahnya telah diuji ulang.

| Pemeriksaan | Hasil yang telah dicatat |
|---|---|
| Empat pengujian otomatis khusus peta | Lulus: enam modul unik dan perspektif terbatas; pencarian/filter tanpa mutasi metadata; tidak ada aksi palsu dokumen privat; seluruh tautan aksi dan langkah cocok dengan rute aplikasi. |
| Pemeriksaan tipe frontend | Lulus. |
| Browser dengan sesi terautentikasi | Enam modul, pergantian perspektif, Back, pencarian SPT, reload, hasil kosong/reset, dan filter Sebagian berfungsi. |
| Parameter perspektif tidak sah | `peran=owner` menampilkan peringatan dan kembali ke Penyusun tanpa menyiratkan penambahan izin. |
| Konsultasi dari peta | Fokus perpajakan terbuka tanpa pesan baru atau permintaan pengiriman pesan. |
| Metadata halaman | Judul, deskripsi, dan `og:title` ditemukan. |
| Desktop dan ponsel 390 px | Konten terbaca; navigasi shell ponsel menggunakan gulir horizontal. |

Pada pemeriksaan browser awal, pemuatan akun sempat terhalang HTTP 502 selama pemulihan server. Setelah layanan tersedia dan halaman dimuat ulang, pemeriksaan berhasil. Ini dicatat sebagai kendala lingkungan, bukan disembunyikan sebagai pengujian yang langsung lulus.

Perintah pemeriksaan terarah yang dapat dijalankan ulang:

```sh
pnpm --filter @workspace/scripts run test:lkt-module-map
pnpm --filter @workspace/lkt-companion run typecheck
```

## Sumber implementasi dan pemeliharaan baseline

- `artifacts/lkt-companion/src/lib/module-map.ts`: definisi modul, status kemampuan, perspektif, pencarian, dan pengurutan.
- `artifacts/lkt-companion/src/pages/peta-modul.tsx`: tampilan, parameter URL, metadata, dan batas aksi.
- `artifacts/lkt-companion/src/lib/module-map.test.ts`: empat pengujian terarah.
- `artifacts/lkt-companion/src/App.tsx`, `components/lkt/shell.tsx`, dan `pages/pendamping.tsx`: rute dan titik masuk; dua path terakhir relatif terhadap `artifacts/lkt-companion/src/`.

Saat kemampuan produk berubah, perbarui definisi modul, pengujian terkait, dan dokumen ini secara selaras. Jangan mengubah status “belum tersedia” hanya karena fitur telah direncanakan atau masuk antrean tugas. Tandai hasil pengujian baru berdasarkan pemeriksaan yang benar-benar dilakukan.

Dokumentasi baseline ini tidak memberi izin menerapkan penyimpanan privat, migrasi status `expired`, mekanisme kill switch, atau perubahan lain di luar cakupan Peta Modul.
