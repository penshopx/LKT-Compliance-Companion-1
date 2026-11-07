# Operator izin redaksi

Operator adalah izin global tersendiri. Owner/member perusahaan dan editor tidak
otomatis menjadi operator; akun pertama juga tidak. Operator bisa memakai panel
di `/redaksi` tanpa perusahaan dan tanpa izin editor. Panel tidak dapat memberikan
izin operator. Hak operator tidak otomatis memberi hak menyunting pustaka.

## Bootstrap dan pemulihan

Jalankan migrasi `pnpm --filter @workspace/db run migrate:lkt-operators` setelah
migrasi redaksi. Tidak ada akun atau izin yang dibuat migrasi, saat startup,
ataupun post-merge.

Administrator infrastruktur harus memastikan lingkungan yang dituju dan
identitas manusianya. Gunakan akun yang sudah ada dengan email terverifikasi
dalam Clerk lingkungan tersebut:

```sh
pnpm --filter @workspace/api-server run editorial:operator grant '<verified-email>' '<display-name>' --confirm-identity '<infrastructure-operator-name>' '<reason>'
pnpm --filter @workspace/api-server run editorial:operator revoke '<verified-email>' '<display-name>' --confirm-identity '<infrastructure-operator-name>' '<reason>'
```

Pengelolaan editor darurat lewat CLI tetap tersedia dengan argumen yang sama,
mengganti `editorial:operator` menjadi `editorial:member`. Nama operator CLI
merupakan atribusi yang dinyatakan administrator infrastruktur, bukan identitas
sesi aplikasi yang terverifikasi. Audit membedakannya dengan sumber `cli` dan
aktor `infrastructure-cli`. Jangan menyalin ID pengguna development ke production.
Pemberian ulang tidak mengubah nama atau membuat audit duplikat; izin yang
dicabut tidak dipulihkan otomatis.

## Panel

Pemberian memakai email terverifikasi yang cocok tepat satu akun, nama tampilan
dan alasan. Pencabutan memakai ID editor aktif, alasan dan konfirmasi. Server
mengambil aktor dari sesi, memeriksa ulang hak operator di dalam transaksi,
dan menyimpan perubahan serta audit secara atomik. Penolakan dan permintaan
tanpa perubahan tidak dicatat sebagai pemberian/pencabutan.

Panel menampilkan 100 catatan terbaru (termasuk pengelolaan operator lewat CLI);
database mempertahankan seluruh audit append-only. Riwayat sebelum fitur ini
tidak direkonstruksi atau diklaim telah diaudit. Audit mencakup aktor, sumber,
jenis izin, tindakan, target, nama saat kejadian, alasan dan waktu.

Mencabut editor hanya menghapus izin aktif, bukan snapshot jurnal, nama aktor,
atau penanggung jawab historis. Penugasan lama tetap historis; untuk penugasan
baru pilih editor aktif. Operasi jurnal yang sudah berjalan sebelum pencabutan
dapat selesai terlebih dahulu; setelah pencabutan berhasil, operasi baru ditolak.
Tidak ada audit keanggotaan perusahaan dalam fitur ini.
