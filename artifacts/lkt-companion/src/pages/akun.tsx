import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Check, Copy, Crown, Loader2, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { getGetLktMembersQueryKey, getGetLktAccessAuditQueryKey, useGetLktAccessAudit, useAddLktMember, useDeleteLktOrganization, useGetLktMembers, useRemoveLktMember } from "@workspace/api-client-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ROLE_LABEL, useOrg } from "@/lib/org-context";
import { cn } from "@/lib/utils";
import { ErrorState, PageHeader, Shimmer, errorMessage, useDocTitle } from "@/components/lkt/common";
import { CreateCompanyForm, LegacyDiscard, UserBadge } from "@/components/lkt/account-widgets";
import { AuditEntries, DeletionReceipts } from "@/components/lkt/access-audit";

const USER_ID_RE = /^user_[A-Za-z0-9]+$/;

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rise min-w-0 rounded-2xl border border-card-border bg-card p-5 md:p-6", className)}>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function AkunPage() {
  useDocTitle("Tim & Akun");
  const { userId, account, org, rootClient, refreshAccount, selectOrg } = useOrg();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const isOwner = org.role === "owner";

  const members = useGetLktMembers();
  const audit = useGetLktAccessAudit({ query: { enabled: isOwner, refetchInterval: 60_000, refetchOnMount: "always" } });
  const add = useAddLktMember();
  const remove = useRemoveLktMember();
  const delOrg = useDeleteLktOrganization(undefined, rootClient);

  const [newId, setNewId] = useState("");
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [delOpen, setDelOpen] = useState(false);
  const idValid = USER_ID_RE.test(newId.trim());

  const refreshMembers = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: getGetLktMembersQueryKey() }),
      qc.invalidateQueries({ queryKey: getGetLktAccessAuditQueryKey() }),
      refreshAccount(),
    ]);
  };

  const copyId = async () => {
    try { await navigator.clipboard.writeText(userId); setCopied(true); setTimeout(() => setCopied(false), 1600); }
    catch { toast({ title: "Tidak bisa menyalin", description: "Salin ID secara manual." }); }
  };

  const addMember = async () => {
    if (!idValid) return;
    try {
      await add.mutateAsync({ data: { userId: newId.trim() } });
      toast({ title: "Anggota ditambahkan", description: newId.trim() });
      setNewId("");
      await refreshMembers();
    } catch { /* shown inline */ }
  };

  const removeMember = async (id: string) => {
    setRemoving(id);
    try {
      await remove.mutateAsync({ userId: id });
      toast({ title: "Akses dicabut", description: id });
      await refreshMembers();
    } catch { /* shown inline */ } finally { setRemoving(null); }
  };

  const deleteCompany = async () => {
    try {
      await delOrg.mutateAsync({ id: org.id });
      toast({ title: "Perusahaan dihapus", description: `${org.name} dan seluruh datanya telah dihapus permanen.` });
      setDelOpen(false);
      selectOrg(null);
      await refreshAccount();
    } catch { setDelOpen(false); }
  };

  return (
    <div>
      <PageHeader eyebrow="Tim & akun" title={org.name}>
        Anda masuk sebagai <span className="font-semibold text-foreground">{ROLE_LABEL[org.role]}</span>. Data perusahaan ini hanya terlihat oleh anggota tim di bawah.
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Section title="Anggota tim" hint={isOwner ? "Tambahkan rekan yang sudah mendaftar di LKTara menggunakan ID akun mereka." : "Hanya pemilik yang dapat menambah atau mencabut anggota."}>
            {isOwner && (
              <form onSubmit={(e) => { e.preventDefault(); void addMember(); }} className="mb-5 flex flex-col gap-2 sm:flex-row">
                <input data-testid="input-member-id" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="user_..."
                  className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3.5 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring/40" />
                <button type="submit" data-testid="button-add-member" disabled={!idValid || add.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-50">
                  {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Tambah
                </button>
              </form>
            )}
            {isOwner && newId.trim() && !idValid && <p className="-mt-3 mb-4 text-xs text-destructive">ID akun berawalan user_ diikuti huruf dan angka.</p>}
            {add.isError && <p data-testid="text-add-error" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(add.error)}</p>}
            {remove.isError && <p data-testid="text-remove-error" className="mb-4 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(remove.error)}</p>}

            {members.isLoading ? (
              <div className="space-y-2"><Shimmer className="h-14" /><Shimmer className="h-14" /></div>
            ) : members.isError ? (
              <ErrorState title="Daftar anggota belum bisa dimuat" error={members.error} onRetry={() => members.refetch()} />
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border" data-testid="list-members">
                {(members.data ?? []).map((m) => (
                  <li key={m.userId} data-testid={`row-member-${m.userId}`} className="flex items-center gap-3 px-4 py-3">
                    <div className={cn("grid h-8 w-8 place-items-center rounded-lg", m.role === "owner" ? "bg-[hsl(var(--signal))]/20 text-[hsl(38_90%_30%)]" : "bg-secondary text-primary")}>
                      {m.role === "owner" ? <Crown className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[13px]">{m.userId}{m.userId === userId && <span className="ml-2 font-sans text-xs font-semibold text-primary">(Anda)</span>}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</p>
                    </div>
                    {isOwner && m.role !== "owner" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button data-testid={`button-remove-member-${m.userId}`} disabled={removing === m.userId}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50">
                            {removing === m.userId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserMinus className="h-3.5 w-3.5" />} Cabut
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cabut akses anggota ini?</AlertDialogTitle>
                            <AlertDialogDescription><span className="font-mono">{m.userId}</span> tidak akan bisa lagi membuka data {org.name}. Anda bisa menambahkannya kembali kapan saja.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void removeMember(m.userId)}>Cabut akses</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {account.organizations.length > 1 && (
            <Section title="Ganti perusahaan" hint="Berpindah perusahaan memuat ulang seluruh ruang kerja agar data tidak tercampur.">
              <div className="grid gap-2 sm:grid-cols-2">
                {account.organizations.map((o) => (
                  <button key={o.id} data-testid={`button-switch-org-${o.id}`} disabled={o.id === org.id}
                    onClick={() => { setLocation("/ringkasan"); selectOrg(o.id); }}
                    className={cn("rounded-xl border p-3 text-left transition-colors", o.id === org.id ? "border-primary bg-secondary" : "border-border hover:border-primary/50")}>
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="text-xs text-muted-foreground">{ROLE_LABEL[o.role]}{o.id === org.id ? " · aktif" : ""}</p>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {isOwner && (
            <Section title="Jejak audit akses" hint="Hanya pemilik perusahaan ini. Maksimal 100 catatan terbaru selama 90 hari; tanpa isi konsultasi, email, atau rahasia. Catatan kedaluwarsa disembunyikan dan dibersihkan otomatis setiap jam saat layanan aktif.">
              {audit.isLoading ? <Shimmer className="h-24" /> : audit.isError ? (
                <ErrorState title="Jejak audit belum bisa dimuat" error={audit.error} onRetry={() => audit.refetch()} />
              ) : <AuditEntries entries={audit.data ?? []} />}
            </Section>
          )}

          <DeletionReceipts entries={account.deletionReceipts} />

          <Section title="Buat perusahaan lain" hint="Setiap perusahaan memiliki data dan tim yang terpisah sepenuhnya.">
            <CreateCompanyForm client={rootClient} legacyAvailable={account.legacyAvailable} refreshAccount={refreshAccount}
              onCreated={(o) => { setLocation("/ringkasan"); selectOrg(o.id); }} />
          </Section>
        </div>

        <div className="min-w-0 space-y-6">
          <Section title="Akun Anda">
            <UserBadge tone="light" />
            <p className="mt-4 text-sm font-semibold">ID akun</p>
            <p className="text-xs text-muted-foreground">Bagikan kepada pemilik perusahaan agar Anda dapat ditambahkan ke tim.</p>
            <div className="mt-2 flex items-center gap-2">
              <code data-testid="text-account-id" className="flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{userId}</code>
              <button data-testid="button-copy-account-id" onClick={copyId} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[hsl(var(--ink))] text-white transition-transform active:scale-95" title="Salin">
                {copied ? <Check className="h-4 w-4 text-[hsl(var(--sidebar-primary))]" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </Section>

          {account.legacyAvailable && <LegacyDiscard client={rootClient} refreshAccount={refreshAccount} />}

          {isOwner && (
            <section className="rise rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
              <h2 className="font-display text-lg font-bold text-destructive">Hapus perusahaan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Tindakan permanen untuk seluruh tim.</p>
              {delOrg.isError && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{errorMessage(delOrg.error)}</p>}
              <AlertDialog open={delOpen} onOpenChange={(o) => { setDelOpen(o); if (!o) setConfirmName(""); }}>
                <AlertDialogTrigger asChild>
                  <button data-testid="button-delete-company" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-destructive px-3.5 py-2 text-sm font-semibold text-destructive-foreground">
                    <Trash2 className="h-4 w-4" /> Hapus {org.name}
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus {org.name} secara permanen?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>Seluruh profil perusahaan, daftar persiapan beserta catatan, penanda referensi, riwayat aktivitas, dan riwayat konsultasi AI akan dihapus permanen untuk semua anggota tim. Semua anggota kehilangan akses. Tindakan ini tidak bisa dibatalkan.</p>
                        <p>Penghapusan tidak menarik kembali data yang telah dikirim ke penyedia AI. Penghitung batas penggunaan akun tetap berlaku sampai jendela satu jam berakhir.</p>
                        <p>Audit perubahan anggota ikut dihapus. Tanda terima hanya berisi ID pelaku, waktu dan jenis penghapusan, tanpa nama, ID atau isi data perusahaan; hanya terlihat oleh Anda selama 90 hari.</p>
                        <p>Ketik <span className="font-semibold text-foreground">{org.name}</span> untuk mengonfirmasi.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <input data-testid="input-confirm-company-name" value={confirmName} onChange={(e) => setConfirmName(e.target.value)}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-destructive/40" />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction data-testid="button-confirm-delete-company" disabled={confirmName.trim() !== org.name || delOrg.isPending}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={(e) => { e.preventDefault(); void deleteCompany(); }}>
                      {delOrg.isPending ? "Menghapus..." : "Hapus permanen"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
