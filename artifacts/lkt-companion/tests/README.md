# Regresi riwayat konsultasi

Jalankan dari root:

```sh
pnpm install --frozen-lockfile
pnpm --filter @workspace/lkt-companion run test:message-history
```

Tidak memerlukan server, browser terpasang, login, database, kunci API, atau AI.
Vitest + jsdom merender `KonsultasiPage` asli dengan `QueryClient` baru per
skenario dan hook/API client hasil generasi yang asli. Hanya `fetch` dan scroll
yang diganti. Seluruh request dicegat; rute tak dikenal ditolak, tidak diteruskan
ke jaringan. Fixture berisi 205 pesan buatan, paging 80 pesan, cursor eksklusif,
POST/DELETE dalam memori, kegagalan sekali, dan respons yang dapat ditahan.

Yang diperiksa:

- Gagal mengambil halaman ketiga tidak menyembunyikan dua halaman yang terbaca;
  tombol muat lama mencoba ulang cursor yang sama.
- Muat ulang eksplisit dan mount dengan cache kosong memulai dari pesan terbaru,
  lalu seluruh pesan lama dapat diambil kembali; kegagalan awal dapat dicoba lagi.
- POST memicu invalidasi nyata, menghitung ulang batas halaman, menjaga urutan,
  tidak menggandakan pesan, dan tetap dapat mencapai awal riwayat.
- Refetch pasca-POST yang gagal tetap menampilkan cache lama dan dapat dipulihkan.
- POST saat halaman lama masih dimuat membatalkan request tersebut; respons lama
  yang terlambat tidak menimpa cache baru.
- Record batas yang berulang hanya ditampilkan sekali, memakai salinan terbaru.
- DELETE melalui dialog konfirmasi membatalkan request berjalan dan mereset
  semua halaman/cursor, termasuk cache pencarian tidak aktif.

Retry otomatis dimatikan hanya pada client pengujian agar skenario gagal
deterministik tanpa menunggu backoff produksi. Tes memeriksa DOM, isi cache,
urutan cursor request, batas halaman, dan pembatalan signal, bukan screenshot.
`typecheck` frontend juga memeriksa kode pengujian.
