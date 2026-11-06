import { Link } from "wouter";
import { ArrowRight, BookMarked, ClipboardList, LifeBuoy, MessagesSquare, Scale, ShieldCheck, Users } from "lucide-react";
import { useDocTitle } from "@/components/lkt/common";

const FEATURES = [
  { icon: ClipboardList, title: "Daftar persiapan per jenis entitas", body: "UMKM, perusahaan nonpublik, emiten, hingga KJPP mendapat urutan kerja yang berbeda, lengkap dengan status dan catatan tim." },
  { icon: BookMarked, title: "Referensi dengan status tinjauan", body: "Setiap rujukan memuat penerbit, tanggal tinjauan, periode berlaku, dan apakah sumber primernya sudah diperiksa." },
  { icon: LifeBuoy, title: "Solusi masalah yang sering muncul", body: "Saldo tidak cocok, dokumen pendukung tercecer, tenggat mepet: langkah praktis yang terhubung ke rujukan." },
  { icon: MessagesSquare, title: "Konsultasi AI yang tahu batas", body: "Membantu memahami istilah dan menyusun pertanyaan, bukan menggantikan akuntan publik, konsultan pajak, atau penasihat hukum." },
];

const STEPS = [
  ["01", "Daftar dan buat perusahaan", "Anda menjadi pemilik ruang kerja perusahaan."],
  ["02", "Ajak tim lewat ID akun", "Rekan mendaftar, membagikan ID akun user_..., lalu Anda menambahkannya."],
  ["03", "Kerjakan bersama sampai siap", "Progres, catatan, dan penanda referensi terlihat oleh seluruh tim."],
];

export default function LandingPage() {
  useDocTitle("Pendamping persiapan laporan keuangan tahunan");
  return (
    <div className="min-h-[100dvh] bg-background">
      <section className="ink-grid relative overflow-hidden bg-sidebar text-sidebar-foreground">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-10">
          <div className="flex items-center gap-2.5">
            <div className="relative grid h-9 w-9 place-items-center rounded-lg bg-[hsl(var(--sidebar-primary))]">
              <span className="font-display text-lg font-extrabold text-[hsl(var(--ink))]">L</span>
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[hsl(var(--signal))] ring-2 ring-[hsl(var(--ink))]" />
            </div>
            <span className="font-display text-xl font-extrabold text-white">LKTara</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/sign-in" data-testid="link-sign-in" className="rounded-lg px-3 py-2 text-sm font-semibold text-sky-50 hover:bg-sidebar-accent">Masuk</Link>
            <Link href="/sign-up" data-testid="link-sign-up-header" className="rounded-lg bg-[hsl(var(--sidebar-primary))] px-3.5 py-2 text-sm font-semibold text-[hsl(var(--ink))]">Daftar</Link>
          </div>
        </header>
        <div className="mx-auto grid max-w-6xl gap-10 px-5 pb-20 pt-10 md:grid-cols-[1.3fr_1fr] md:px-10 md:pb-28 md:pt-16">
          <div>
            <p className="rise font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[hsl(var(--signal))]">Laporan Keuangan Tahunan · Tahun buku 2025</p>
            <h1 className="rise font-display mt-4 text-[2.6rem] font-extrabold leading-[1.02] text-white md:text-[4.2rem]" style={{ animationDelay: "80ms" }}>
              Tutup buku tanpa<br />menebak-nebak.
            </h1>
            <p className="rise mt-5 max-w-xl text-[16px] leading-relaxed text-sky-100/85" style={{ animationDelay: "160ms" }}>
              LKTara mendampingi tim keuangan menyiapkan laporan tahunan: apa yang dikerjakan lebih dulu, dokumen apa yang dicari, dan rujukan mana yang perlu dibaca, dalam satu ruang kerja perusahaan.
            </p>
            <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
              <Link href="/sign-up" data-testid="link-cta-sign-up" className="group inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--sidebar-primary))] px-5 py-3 font-semibold text-[hsl(var(--ink))] transition-transform hover:-translate-y-0.5">
                Mulai untuk perusahaan Anda <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/sign-in" data-testid="link-cta-sign-in" className="inline-flex items-center rounded-xl border border-sidebar-border px-5 py-3 font-semibold text-white hover:bg-sidebar-accent">Saya sudah punya akun</Link>
            </div>
          </div>
          <div className="rise hidden rounded-2xl border border-sidebar-border bg-sidebar-accent/80 p-5 md:block" style={{ animationDelay: "320ms" }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-sky-200/70">PT Sinar Rasa Nusantara</p>
            <p className="font-display mt-1 text-4xl font-extrabold text-white">63<span className="text-xl text-sky-200/70">%</span></p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[63%] rounded-full bg-[hsl(var(--sidebar-primary))]" /></div>
            <ul className="mt-5 space-y-2.5 text-sm">
              {[["Rekonsiliasi bank Desember", "Siap"], ["Daftar aset tetap dan penyusutan", "Proses"], ["Konfirmasi saldo piutang", "Proses"], ["Draf catatan atas laporan", "Belum"]].map(([t, s]) => (
                <li key={t} className="flex items-center justify-between gap-3 rounded-lg bg-sidebar/70 px-3 py-2">
                  <span className="truncate text-sky-50">{t}</span>
                  <span className={s === "Siap" ? "font-mono text-xs text-emerald-300" : s === "Proses" ? "font-mono text-xs text-[hsl(var(--signal))]" : "font-mono text-xs text-sky-200/60"}>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-10">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Yang Anda dapatkan</p>
        <h2 className="font-display mt-2 max-w-2xl text-3xl font-extrabold md:text-4xl">Peta kerja, bukan tumpukan peraturan.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className={i === 0 ? "rounded-2xl border border-card-border bg-card p-6 md:row-span-2" : "rounded-2xl border border-card-border bg-card p-6"}>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-[hsl(var(--ink))] text-[hsl(var(--sidebar-primary))]"><Icon className="h-5 w-5" /></div>
              <h3 className="font-display mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2 md:px-10">
          <div>
            <Scale className="h-7 w-7 text-[hsl(var(--signal))]" />
            <h2 className="font-display mt-3 text-3xl font-extrabold">Jujur soal batasnya.</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              LKTara adalah alat bantu persiapan. Kami tidak memberi opini audit, nasihat hukum, atau kepastian kepatuhan pajak. Untuk keputusan yang mengikat, rujuk sumber primer dan profesional berizin.
            </p>
          </div>
          <ul className="space-y-3 text-[15px]">
            {["Setiap referensi menunjukkan tanggal tinjauan dan statusnya, termasuk bila perlu ditinjau ulang.", "Jawaban AI menyebut ketidakpastian dan mengarahkan ke rujukan, bukan menebak pasal.", "Jangan kirim nomor rekening, NPWP pribadi, atau data karyawan ke Konsultasi AI."].map((t) => (
              <li key={t} className="flex gap-3 rounded-xl bg-background p-4"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><span>{t}</span></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20 md:px-10">
        <div className="flex items-center gap-2 text-primary"><Users className="h-5 w-5" /><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em]">Untuk tim perusahaan</p></div>
        <h2 className="font-display mt-2 text-3xl font-extrabold md:text-4xl">Satu perusahaan, satu ruang kerja, tim yang Anda pilih.</h2>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map(([n, t, b]) => (
            <li key={n} className="border-t-2 border-[hsl(var(--ink))] pt-4">
              <span className="font-mono text-sm font-semibold text-primary">{n}</span>
              <p className="font-display mt-1 text-lg font-bold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="ink-grid bg-sidebar">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-16 md:flex-row md:items-center md:justify-between md:px-10">
          <h2 className="font-display max-w-xl text-3xl font-extrabold text-white">Tenggat tidak menunggu. Mulai susun hari ini.</h2>
          <Link href="/sign-up" data-testid="link-cta-bottom" className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--signal))] px-5 py-3 font-semibold text-[hsl(var(--ink))] transition-transform hover:-translate-y-0.5">
            Buat akun gratis <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mx-auto max-w-6xl px-5 pb-8 text-xs text-sky-100/60 md:px-10">LKTara bukan pengganti akuntan publik, konsultan pajak, atau penasihat hukum.</p>
      </section>
    </div>
  );
}
