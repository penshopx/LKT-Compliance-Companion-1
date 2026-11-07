# Baseline ringkasan terjadwal dan arsip bukti

## Tujuan dan cakupan

Dokumen ini mencatat kontrak perilaku ringkasan referensi melalui Slack/Resend dan arsip bukti regulasi berdasarkan kode serta dokumentasi yang tersedia saat baseline disusun. Ini bukan sertifikasi keamanan, verifikasi konfigurasi layanan yang sedang aktif, atau izin mengirim pesan.

Penyusunan baseline hanya membaca kode dan menulis dokumentasi. Tidak menjalankan pengujian, mengubah konfigurasi pengiriman, membaca atau mengubah database, mengakses akun penyedia, ataupun mengirim email/pesan Slack.

**Koreksi terhadap ringkasan status sebelumnya:** penghentian email tanpa akun sudah tersedia melalui formulir POST. Namun, implementasi yang diperiksa belum menyertakan header email `List-Unsubscribe` dan `List-Unsubscribe-Post`, maupun penanganan POST one-click RFC 8058. Jangan menyatakan dukungan RFC 8058 sudah selesai. Keberadaan integrasi Resend juga tidak membuktikan bahwa domain tertentu telah diverifikasi pada lingkungan aktif.

## 1. Ringkasan terjadwal

### Akses, pilihan kanal, dan isi

- Titik masuk: **Referensi → Ringkasan terjadwal**.
- Pemilik perusahaan dapat mengatur atau menghentikan langganan; anggota dapat membaca status dan riwayatnya.
- Satu perusahaan mempunyai satu konfigurasi kanal/tujuan pada satu waktu: Slack atau email Resend, bukan pengiriman serentak ke keduanya.
- Integrasi yang disetujui bukan persetujuan penerima. Membuka halaman, memasang integrasi, atau menjalankan migrasi tidak mengaktifkan jadwal.
- Topik tunggal: seluruh pustaka, perpajakan, pasar modal, atau standar akuntansi. Topik memilih pengingat editorial, bukan menentukan kewajiban hukum perusahaan.
- Ringkasan hanya membawa metadata pustaka bersama untuk sumber jatuh tempo/lewat jadwal, perlu ditinjau, atau usang; maksimal 20 entri. Ringkasan kosong tidak dikirim.
- Profil, catatan privat, dan percakapan perusahaan tidak disertakan.
- Perubahan topik membatalkan retry konfigurasi lama, tetapi tidak menghapus batas satu ringkasan per hari WIB.

### Slack

- Pemilik memberikan ID kanal atau ID pengguna manusia untuk DM dan menyetujui tujuan. Anggota kanal dapat menerima isi ringkasan.
- Penyimpanan memvalidasi akses dan dapat membuka DM, tetapi tidak mengirim pesan uji.
- Identitas koneksi/tujuan dipertahankan; koneksi berubah atau tidak tersedia menghentikan proses dengan kesalahan eksplisit sampai dikonfigurasi ulang.
- Keberhasilan membutuhkan pengakuan penyedia berupa `ok: true` dan identitas pesan/kanal, bukan HTTP 200 saja. Ini bukan bukti pesan telah dibaca.

### Resend dan persetujuan penerima

1. Konfigurasi memerlukan satu alamat pengirim dan satu alamat penerima biasa, serta satu koneksi Resend yang disetujui.
2. Kode memvalidasi domain pengirim secara tepat, status `verified`, dan kemampuan sending yang aktif. Identitas koneksi/domain disimpan dan diperiksa kembali sebelum mengirim. Izin baca domain diperlukan.
3. Menyimpan konfigurasi email selalu meninggalkan jadwal nonaktif, termasuk saat mengganti langganan sebelumnya.
4. Pemilik menyatakan izin penerima dan mendapat tautan konfirmasi privat untuk dibagikan secara manual. Sistem tidak otomatis mengirim email konfirmasi atau email uji.
5. Penerima menyetujui secara eksplisit melalui formulir publik tanpa akun LKTara. Tindakan ini merupakan pengakuan pemegang tautan, **bukan pembuktian independen kepemilikan kotak surat**. Izin kotak surat bersama harus mencakup penerima yang bersangkutan.
6. GET hanya menampilkan halaman; konfirmasi dan penghentian memerlukan POST sehingga pratinjau tautan tidak mengubah status.
7. Perubahan konfigurasi memerlukan persetujuan baru dan membatalkan tautan lama. Tautan konfirmasi tidak dapat mengaktifkan kembali jadwal yang telah dijeda/dihentikan.
8. Tautan ditandatangani, terikat nonce langganan, dan tidak disertakan dalam pembacaan umum konfigurasi/riwayat. URL konfirmasi yang baru dibuat tidak dipulihkan setelah reload. Jangan menyimpan atau menyalin token ke dokumentasi/log.
9. Penerima dapat berhenti tanpa akun melalui tautan yang sama atau tautan dalam ringkasan. Penghentian membatalkan pengiriman mendatang/retry, bukan menarik email yang telah terkirim.

**Batas unsubscribe:** formulir POST tersebut bukan implementasi one-click RFC 8058. Dukungan itu memerlukan pekerjaan tersendiri; baseline ini tidak menambah header atau endpoint.

### Jadwal dan pencegahan pengiriman ganda

- Pilihan harian/mingguan memakai kalender Asia/Jakarta (WIB), dengan slot setelah aktivasi.
- Worker memeriksa jadwal setiap menit selama proses API berjalan. Server yang berhenti atau tidur tidak mengirim; hari kalender terdahulu tidak diputar ulang setelah restart.
- Ledger unik perusahaan/hari WIB dan advisory lock lintas proses melindungi pengiriman dari duplikasi akibat perubahan konfigurasi, konkurensi, atau restart.
- Klaim pengiriman disimpan sebelum permintaan eksternal; jaringan dan commit database bukan transaksi atomik.
- Penghentian, konfigurasi, dan pengiriman menggunakan penguncian bersama. Jika pengiriman memegang lock, penghentian dapat ditolak dengan pesan sibuk dan perlu diulang setelah selesai.
- Pencabutan kewenangan pemilik yang mengotorisasi menghentikan pengiriman mendatang. Penghentian oleh penerima tetap dimungkinkan.
- Riwayat menampilkan 20 catatan pengiriman terakhir. Penghapusan perusahaan menghapus konfigurasi dan riwayat terkait melalui relasi database, bukan pesan yang sudah diterima penyedia.

### Retry dan arti keberhasilan

| Keadaan | Perilaku baseline |
|---|---|
| Penolakan rate limit yang eksplisit | Retry terbatas, maksimal tiga percobaan pada hari WIB asal, dengan payload/identitas pengiriman yang sama. |
| Timeout, klaim terputus, atau pengakuan ambigu | Tidak diulang otomatis; jadwal dijeda untuk pemeriksaan pemilik. |
| Resend 5xx, respons tidak sah, atau 409 | Tidak dianggap aman untuk dikirim ulang otomatis. |
| Resend menerima email dengan UUID penyedia | Dicatat sebagai diterima Resend, **bukan bukti masuk kotak surat atau dibaca**. |
| Domain/koneksi tidak dapat divalidasi | Gagal tertutup; tidak meneruskan pengiriman dengan koneksi/domain pengganti diam-diam. |

Resend menggunakan `Idempotency-Key` berbasis ID pengiriman yang stabil. Keberadaan kunci tersebut tidak digunakan untuk membenarkan pengiriman ulang hasil ambigu. Tidak ada asumsi webhook bounce/delivery telah tersedia.

### Independensi editorial

Konfigurasi, pengiriman, kegagalan, dan penghentian ringkasan tidak menulis status verifikasi, temuan, tanggal pemeriksaan, jadwal telaah berikutnya, atau jurnal editorial. Pengingat bukan pemeriksaan ulang hukum.

## 2. Arsip bukti primer publik

### Cakupan dan provenance

- Titik masuk: **Referensi → Riwayat temuan → Buka arsip bukti** serta **Redaksi → Riwayat dan bukti**, mengikuti batas akses masing-masing halaman.
- Arsip menyimpan salinan bahan publik yang ditautkan ke bukti pada snapshot temuan tertentu, bukan dokumen keuangan privat perusahaan.
- URL sumber asli tetap dipertahankan. Caption bukan seluruh carousel; ekstrak bukan PDF lengkap; pengantar publik IAI bukan naskah standar berlisensi.
- Tanggal pemeriksaan dan waktu pengambilan salinan berbeda. Salinan yang diambil kemudian tidak membuktikan isi sumber identik pada tanggal pemeriksaan terdahulu.
- Lampiran mencatat asal, lokasi bagian, batas salinan, MIME, ukuran, checksum byte, hash bukti, dan hash snapshot.
- Penambahan lampiran tidak menimpa temuan/jurnal, menaikkan status verifikasi, atau mengubah konteks jawaban konsultasi lama.

### Penyimpanan dan unduhan

- Byte disimpan di namespace khusus App Storage; metadata PostgreSQL bersifat append-only. Byte tidak dimasukkan ke Git atau kolom JSON database.
- Pengarsipan melalui alat operator dengan konfirmasi bahan publik, bukan unggahan publik. Tidak ada proxy URL bebas, penjelajahan bucket, atau pengalihan unduhan ke signed URL.
- Rute `/api/lkt/evidence-archives/{id}` hanya melayani arsip tercatat dengan kaitan riwayat dan checksum/ukuran yang masih cocok.
- Berkas hilang, berubah, atau tidak cocok dengan riwayat menyebabkan unduhan gagal secara eksplisit (503), bukan perubahan status hukum otomatis.
- Penulisan objek bersifat create-only dan metadata diverifikasi setelah checksum dibaca ulang. Pengulangan identik idempoten; koreksi menambah lampiran, tidak menimpa arsip lama.
- Jangan mengarsipkan cookie, token, halaman akun, data pribadi, URL CDN bertanda tangan, atau materi standar berlisensi. Pemeriksaan format tidak menggantikan penelaahan materi oleh operator.

### Pemulihan lingkungan

Manifest awal menyertakan metadata pengaitan, bukan byte atau kredensial. Pemulihan harus membaca salinan yang sudah dipertahankan, memeriksa checksum/ukuran serta kaitan riwayat, dan gagal eksplisit bila tidak cocok. Jangan merekonstruksi salinan historis dengan mengambil ulang halaman hidup.

Prosedur migrasi, `evidence:archive list/save/audit`, dan `evidence:provision` tetap mengacu ke [panduan arsip dan pemulihan](referensi-lkt.md). Menyusun baseline tidak menjalankan perintah tersebut dan tidak menyatakan lingkungan produksi telah diprovisikan.

## 3. Bukti pemeriksaan dan batas klaim

| Aspek | Yang dapat dinyatakan pada baseline ini |
|---|---|
| Ringkasan terjadwal | Kode provider, scheduler, route persetujuan, definisi pengujian, dan dokumentasi operasional telah dibaca secara terarah. |
| “15 pengujian lulus” dan pemeriksaan tipe | Hasil yang dilaporkan sebelumnya oleh pengguna; **tidak dijalankan ulang atau dikonfirmasi melalui keluaran runner pada pekerjaan dokumentasi ini**. |
| Definisi suite ringkasan | Terdapat lima pengujian tingkat atas, termasuk satu kelompok dengan sepuluh subpengujian, mencakup jadwal, topik, provider, persetujuan, otorisasi, deduplikasi, konkurensi, retry, dan penghentian. Keberadaannya bukan bukti lulus. |
| Definisi suite arsip | Mencakup kaitan snapshot/hash, format/sumber publik, metadata append-only, dan unduhan gagal-tertutup. Tidak dieksekusi pada pekerjaan ini. |
| Tidak ada kiriman nyata pada proses sebelumnya | Pernyataan hasil sebelumnya, bukan audit ulang riwayat penyedia. Pada pekerjaan dokumentasi ini tidak ada pemanggilan layanan pengiriman. |
| Domain, koneksi, dan tujuan aktif | Tidak diperiksa melalui layanan eksternal atau database; validasi dalam kode bukan bukti konfigurasi aktif. |
| RFC 8058 | Belum diimplementasikan pada kode yang diperiksa; tersedia penghentian manual melalui formulir POST tanpa akun. |

Perintah pemeriksaan terarah berikut hanya dicatat, **tidak dijalankan**:

```sh
pnpm --filter @workspace/api-server run test:reference-digest
pnpm --filter @workspace/api-server run test:evidence-archives
pnpm run typecheck
```

Suite ringkasan menggunakan fixture terisolasi dan stub Slack/Resend; suite arsip juga membutuhkan akses baca ke byte arsip yang tersedia. Jangan menyamakan prosedur pengujian tersebut dengan izin mengaktifkan pengiriman nyata.

## 4. Acuan pemeliharaan

- `artifacts/api-server/src/lib/lkt-reference-digest.ts`: konfigurasi, persetujuan, jadwal, penguncian, dan ledger.
- `artifacts/api-server/src/lib/lkt-digest-slack.ts` dan `lkt-digest-email.ts` pada direktori yang sama: adapter penyedia dan pengakuan pengiriman.
- `artifacts/api-server/src/routes/lkt-digest-email-consent.ts`: halaman publik serta tindakan POST penerima.
- `artifacts/api-server/src/lib/lkt-reference-digest.test.ts` dan `lkt-evidence-archive.test.ts` pada direktori yang sama: definisi pemeriksaan terarah.
- [Panduan referensi dan arsip](referensi-lkt.md) dan bagian **Scheduled reference digests** pada `replit.md`: prosedur operasional yang lebih rinci.

Perbarui baseline bila kontrak persetujuan, retry, topik, penyimpanan, atau unduhan berubah. Pisahkan hasil uji aktual dari skenario yang baru tersedia. Baseline ini tidak memberi izin menambah fitur, memprovisikan layanan, mengubah domain, mengirim pesan, atau menerbitkan aplikasi.
