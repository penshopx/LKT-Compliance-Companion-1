import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, ShieldAlert } from "lucide-react";
import { useGetCompany, useSaveCompany, type CompanyInput, type CompanyInputKind, type CompanyInputStandard } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ErrorState, KIND_LABEL, PageHeader, Shimmer, errorMessage, useDocTitle } from "@/components/lkt/common";

const KINDS: { v: CompanyInputKind; d: string }[] = [
  { v: "nonpublik", d: "Perseroan atau badan usaha yang sahamnya tidak diperdagangkan di bursa." },
  { v: "umkm", d: "Usaha mikro, kecil, dan menengah dengan pembukuan sederhana." },
  { v: "publik", d: "Emiten atau perusahaan publik. Ketentuan OJK berlaku untuk jenis ini." },
  { v: "kjpp", d: "Kantor Jasa Penilai Publik. Ketentuan pelaporan PPPK Kemenkeu berlaku untuk jenis ini." },
];
const STANDARDS: CompanyInputStandard[] = ["Belum ditentukan", "SAK EMKM", "SAK Entitas Privat", "SAK Indonesia"];

export default function PerusahaanPage() {
  useDocTitle("Profil perusahaan");
  const qc = useQueryClient();
  const { toast } = useToast();
  const company = useGetCompany();
  const [form, setForm] = useState<CompanyInput | null>(null);
  useEffect(() => { if (company.data && !form) setForm(company.data); }, [company.data, form]);

  const save = useSaveCompany({
    mutation: {
      onSuccess: (c) => {
        setForm(c);
        qc.invalidateQueries();
        toast({ title: "Profil tersimpan", description: `Daftar persiapan disesuaikan untuk tahun buku ${c.year}.` });
      },
      onError: (e) => toast({ variant: "destructive", title: "Profil gagal disimpan", description: errorMessage(e) }),
    },
  });

  if (company.isError) return <><PageHeader eyebrow="Pengaturan" title="Profil perusahaan" /><ErrorState error={company.error} onRetry={() => company.refetch()} /></>;
  if (!form) return <><PageHeader eyebrow="Pengaturan" title="Profil perusahaan" /><div className="space-y-3"><Shimmer className="h-14" /><Shimmer className="h-48" /><Shimmer className="h-14" /></div></>;

  const nameErr = !form.name.trim() ? "Nama wajib diisi." : form.name.length > 150 ? "Maksimal 150 karakter." : "";
  const yearErr = !Number.isInteger(form.year) || form.year < 2020 || form.year > 2100 ? "Tahun antara 2020 dan 2100." : "";
  const dirty = JSON.stringify(form) !== JSON.stringify(company.data);
  const set = (p: Partial<CompanyInput>) => setForm({ ...form, ...p });

  return (
    <>
      <PageHeader eyebrow="Pengaturan" title="Profil perusahaan">Profil menentukan langkah mana yang masuk daftar persiapan. Mengubah tahun buku memuat ulang daftar, ringkasan, dan aktivitas untuk tahun tersebut.</PageHeader>
      <form className="rise grid gap-6 lg:grid-cols-[1fr_300px]" onSubmit={(e) => { e.preventDefault(); if (!nameErr && !yearErr) save.mutate({ data: { ...form, name: form.name.trim() } }); }}>
        <div className="space-y-6 rounded-2xl border border-card-border bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <Field label="Nama perusahaan" err={nameErr}>
              <input data-testid="input-company-name" value={form.name} maxLength={150} onChange={(e) => set({ name: e.target.value })} className="h-11 w-full rounded-lg border border-input bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
            </Field>
            <Field label="Tahun buku" err={yearErr}>
              <input data-testid="input-company-year" type="number" min={2020} max={2100} value={Number.isNaN(form.year) ? "" : form.year} onChange={(e) => set({ year: Number(e.target.value) })} className="h-11 w-full rounded-lg border border-input bg-background px-3 font-mono outline-none focus:ring-2 focus:ring-ring" />
            </Field>
          </div>
          <Field label="Jenis perusahaan">
            <div className="grid gap-2 sm:grid-cols-2">
              {KINDS.map(({ v, d }) => (
                <button type="button" key={v} data-testid={`option-kind-${v}`} onClick={() => set({ kind: v })} className={cn("relative rounded-xl border p-4 text-left transition-all", form.kind === v ? "border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white" : "border-input hover:border-primary")}>
                  {form.kind === v && <Check className="absolute right-3 top-3 h-4 w-4 text-[hsl(var(--sidebar-primary))]" />}
                  <p className="font-semibold">{KIND_LABEL[v]}</p>
                  <p className={cn("mt-1 text-xs", form.kind === v ? "text-sky-100/85" : "text-muted-foreground")}>{d}</p>
                </button>))}
            </div>
          </Field>
          <Field label="Standar akuntansi">
            <div className="flex flex-wrap gap-2">
              {STANDARDS.map((s) => <button type="button" key={s} data-testid={`option-standard-${s}`} onClick={() => set({ standard: s })} className={cn("rounded-full border px-4 py-2 text-sm font-semibold transition-colors", form.standard === s ? "border-primary bg-primary text-primary-foreground" : "border-input hover:border-primary")}>{s}</button>)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Tidak yakin? Biarkan "Belum ditentukan" dan tanyakan ke akuntan Anda.</p>
          </Field>
        </div>
        <aside className="space-y-4">
          <div className="rounded-2xl bg-[hsl(var(--ink))] p-5 text-white">
            <p className="text-xs uppercase tracking-widest text-sky-200">Pratinjau</p>
            <p className="font-display mt-2 text-xl font-bold">{form.name || "Tanpa nama"}</p>
            <p className="text-sm text-sky-100/85">{KIND_LABEL[form.kind]}</p>
            <p className="mt-3 font-mono text-3xl text-[hsl(var(--sidebar-primary))]">{form.year || "----"}</p>
            <p className="text-xs text-sky-100/85">{form.standard}</p>
            <button data-testid="button-save-company" type="submit" disabled={!dirty || !!nameErr || !!yearErr || save.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[hsl(var(--sidebar-primary))] py-2.5 font-semibold text-[hsl(var(--ink))] transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40">
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}{save.isPending ? "Menyimpan..." : dirty ? "Simpan profil" : "Tersimpan"}
            </button>
            {dirty && <button type="button" onClick={() => company.data && setForm(company.data)} className="mt-2 w-full text-sm text-sky-200 hover:text-white">Batalkan perubahan</button>}
          </div>
          <div className="rounded-2xl border border-card-border bg-card p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-foreground"><ShieldAlert className="h-3.5 w-3.5 text-[hsl(var(--signal))]" /> Privasi</p>
            Profil dibagikan hanya kepada anggota perusahaan ini. Cukup isi nama; jangan masukkan NPWP, nomor rekening, atau angka keuangan yang tidak diperlukan.
          </div>
        </aside>
      </form>
    </>
  );
}

function Field({ label, err, children }: { label: string; err?: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>{children}{err && <p className="mt-1 text-xs font-medium text-destructive">{err}</p>}</div>;
}
