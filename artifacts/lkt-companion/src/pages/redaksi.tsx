import { Link } from "wouter";
import { PageHeader, useDocTitle } from "@/components/lkt/common";
import { UserBadge } from "@/components/lkt/account-widgets";
import { EditorialWorkspace } from "@/components/lkt/editorial-workspace";

export default function RedaksiPage() {
  useDocTitle("Ruang Redaksi");
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-5 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/referensi" className="text-sm font-semibold text-primary hover:underline">Kembali ke pustaka perusahaan</Link>
        <UserBadge tone="light" />
      </div>
      <PageHeader eyebrow="Pustaka bersama" title="Ruang Redaksi">
        Izin redaksi berlaku untuk pustaka lintas perusahaan, terpisah dari keanggotaan perusahaan.
        Semua perubahan menambah riwayat; catatan lama tidak dapat ditimpa atau dihapus.
        Jadwal menggunakan hari kalender WIB, bukan tenggat hukum. Tautan yang dapat dibuka bukan bukti verifikasi.
      </PageHeader>
      <EditorialWorkspace />
    </main>
  );
}
