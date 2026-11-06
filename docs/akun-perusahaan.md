# Akun perusahaan dan data browser lama

## Batas akses

Login menggunakan Clerk terkelola. Keanggotaan perusahaan disimpan di database aplikasi, bukan mengandalkan organisasi dari penyedia login. Pembuat perusahaan menjadi pemilik. Pemilik dapat menambahkan akun terdaftar dengan email terverifikasi melalui ID akun yang dibagikan rekan, serta mencabut aksesnya. Anggota dapat menggunakan profil, checklist, bookmark, aktivitas dan konsultasi milik perusahaan, tetapi tidak dapat mengatur anggota atau menghapus perusahaan.

API mengambil identitas dari sesi Clerk yang diverifikasi di server. Header `X-LKT-Organization` hanya memilih perusahaan; setiap permintaan harus cocok dengan keanggotaan terkini. Cookie browser lama, ID perusahaan, dan ID pengguna dalam body tidak memberikan hak akses. Satu akun dapat mengikuti beberapa perusahaan. Pemilihan perusahaan tidak disimpan di cookie lintas tab atau diteruskan ke akun berikutnya.

Login dan database pengguna Development/Production berbeda. Jangan menyalin keanggotaan yang memakai ID pengguna Development untuk mengatur akses Production.

## Migrasi eksplisit

1. Jalankan `pnpm --filter @workspace/db run migrate:lkt-auth` pada database target sebelum menjalankan kode baru. Skrip bersifat aditif, transaksional dan dapat diulang; tidak menghapus isi atau menautkan data lama ke akun. Setelah penggabungan task, skrip setup menjalankan migrasi ini otomatis pada database workspace.
2. Seluruh baris browser lama tetap tanpa organisasi dan tidak dapat dibaca melalui API akun. Cookie bertanda tangan lama tidak lagi membuka profil atau konsultasi.
3. Setelah login, pengguna hanya diberi tahu **ada/tidaknya** data lama pada browser itu, tanpa melihat isi.
4. Untuk memindahkan, pengguna harus membuat **perusahaan baru**, memilih pemindahan, dan mengonfirmasi bahwa data tersebut miliknya. Tidak tersedia pemindahan ke perusahaan yang sudah ada, sehingga data tidak mendadak terlihat oleh tim lain.
5. Dalam satu transaksi, sistem membuat perusahaan dan pemiliknya lalu mengaitkan workspace lama. Seluruh tahun checklist, bookmark, pesan, dan aktivitas tetap utuh. Klaim kedua ditolak. Cookie lama dibersihkan setelah berhasil.
6. Pengguna dapat memilih perusahaan kosong dan membiarkan data lama terpisah, atau menghapus data lama secara eksplisit melalui cookie bertanda tangan.

**Batas penting:** versi lama tidak memiliki identitas pemilik. Cookie hanya membuktikan akses browser, bukan identitas orang yang dahulu memasukkan data. Pada browser bersama, jangan mengklaim data orang lain; pilih perusahaan kosong atau hapus setelah mendapat kewenangan. Tidak ada pemulihan berdasarkan ID workspace yang diketik atau ditebak. Data yang kehilangan cookie tetap terisolasi sampai pemilik dapat diverifikasi melalui proses terpisah. Jangan menghapus baris lama massal tanpa persetujuan dan kebijakan retensi.

Anggota yang ditambahkan kemudian dapat membaca seluruh data perusahaan, termasuk data hasil migrasi dan percakapan. Jangan menambahkan akun yang tidak dikenal.

## Penghapusan

Pemilik dapat menghapus perusahaan lewat **Tim & Akun** setelah mengetik nama perusahaan. Ini menghapus profil, semua tahun checklist, bookmark, aktivitas, konsultasi, keanggotaan dan penghitung AI perusahaan melalui relasi cascade. Tidak ada pemulihan dari aplikasi. Pengguna juga dapat menghapus riwayat konsultasi saja, berlaku untuk seluruh tim.

Penghapusan ditolak selama konsultasi berlangsung agar jawaban yang sedang disimpan tidak muncul kembali setelah penghapusan. Penghapusan lokal tidak menarik kembali data yang sudah dikirim ke penyedia AI. Akun login Clerk tidak otomatis dihapus ketika satu perusahaan dihapus, karena akun dapat mengikuti perusahaan lain.

## Batas AI dan retensi teknis

- Maksimal 12 percobaan per jam per akun, lintas perusahaan.
- Maksimal 36 percobaan per jam per perusahaan, lintas anggota.
- Satu konsultasi aktif per perusahaan, diperiksa melalui lease database yang kedaluwarsa jika proses berhenti. Panggilan AI dibatasi 90 detik, tanpa retry otomatis.
- Penghitung disimpan di PostgreSQL, bukan memori proses atau hanya IP. Mengulang login, berpindah perangkat, mengganti IP, atau restart server tidak menghapus kuota.
- Penghitung akun hanya memuat ID, jumlah, dan waktu reset; tetap berlaku setelah perusahaan dihapus agar kuota tidak bisa dilewati dengan membuat perusahaan baru. Counter kedaluwarsa dibersihkan saat reservasi konsultasi berikutnya.
- Keanggotaan diperiksa kembali sebelum jawaban disimpan; akses yang dicabut selama panggilan AI tidak dapat menerima jawaban tersebut melalui API.

Tetap jangan kirim NPWP, nomor rekening, identitas pribadi atau rincian transaksi rahasia ke konsultasi AI. Autentikasi dan isolasi organisasi bukan sertifikasi kepatuhan atau izin mengirim data sensitif yang tidak diperlukan.

## Pemeriksaan

`pnpm --filter @workspace/api-server run test:auth` memverifikasi penolakan anonim/lintas perusahaan, kolaborasi anggota, batas pemilik, pencabutan, klaim data lama satu kali, penghapusan cascade, kuota lintas perusahaan dan reservasi paralel menggunakan fixture database Development yang dibersihkan setelah selesai. Identitas pada tes server disuntikkan hanya di server tes; kode produksi tidak memiliki jalan pintas login tersebut. Alur browser menggunakan sesi Clerk asli diperiksa secara terpisah.
