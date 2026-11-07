import { type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, Show, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/lkt/shell';
import { AccountScope, EditorialScope } from '@/components/lkt/org-gate';
import { Shimmer } from '@/components/lkt/common';
import DashboardPage from '@/pages/dashboard';
import ChecklistPage from '@/pages/checklist';
import ReferensiPage from '@/pages/referensi';
import RedaksiPage from '@/pages/redaksi';
import KonsultasiPage from '@/pages/konsultasi';
import PendampingPage from '@/pages/pendamping';
import SolusiPage from '@/pages/solusi';
import PerusahaanPage from '@/pages/perusahaan';
import AkunPage from '@/pages/akun';
import LandingPage from '@/pages/landing';
import RuangLaporanPage from '@/pages/ruang-laporan';
import RuangLaporanDetailPage from '@/pages/ruang-laporan-detail';
import PetaModulPage from '@/pages/peta-modul';

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: 'hsl(218 92% 44%)',
    colorForeground: 'hsl(224 52% 8%)',
    colorMutedForeground: 'hsl(222 22% 32%)',
    colorDanger: 'hsl(354 74% 44%)',
    colorBackground: 'hsl(210 80% 99%)',
    colorInput: 'hsl(214 60% 97%)',
    colorInputForeground: 'hsl(224 52% 8%)',
    colorNeutral: 'hsl(224 52% 8%)',
    fontFamily: "'Figtree', system-ui, sans-serif",
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[hsl(210_80%_99%)] rounded-2xl w-[440px] max-w-full overflow-hidden border border-[hsl(216_36%_86%)] shadow-[0_20px_50px_-20px_rgba(14,40,90,.35)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: "text-[hsl(224_52%_8%)] font-extrabold [font-family:'Bricolage_Grotesque',serif] tracking-tight",
    headerSubtitle: 'text-[hsl(222_22%_32%)]',
    socialButtonsBlockButtonText: 'text-[hsl(224_52%_8%)] font-semibold',
    formFieldLabel: 'text-[hsl(224_52%_8%)] font-semibold',
    footerActionLink: 'text-[hsl(218_92%_44%)] font-semibold',
    footerActionText: 'text-[hsl(222_22%_32%)]',
    dividerText: 'text-[hsl(222_22%_32%)]',
    identityPreviewEditButton: 'text-[hsl(218_92%_44%)]',
    formFieldSuccessText: 'text-[hsl(158_70%_32%)]',
    alertText: 'text-[hsl(224_52%_8%)]',
    logoBox: 'justify-center',
    logoImage: 'h-10',
    socialButtonsBlockButton: 'border border-[hsl(216_36%_84%)] bg-[hsl(210_80%_99%)]',
    formButtonPrimary: 'bg-[hsl(218_92%_44%)] text-[hsl(210_100%_98%)] font-semibold',
    formFieldInput: 'border border-[hsl(216_30%_74%)] bg-[hsl(214_60%_97%)] text-[hsl(224_52%_8%)]',
    footerAction: 'justify-center',
    dividerLine: 'bg-[hsl(216_36%_84%)]',
    alert: 'border border-[hsl(354_74%_44%)]/30 bg-[hsl(354_74%_44%)]/5',
    otpCodeFieldInput: 'border border-[hsl(216_30%_74%)] text-[hsl(224_52%_8%)]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

const clerkLocalization = {
  signIn: {
    start: { title: 'Masuk ke LKTara', subtitle: 'Lanjutkan persiapan laporan tahunan tim Anda', actionText: 'Belum punya akun?', actionLink: 'Daftar' },
    password: { title: 'Masukkan kata sandi', subtitle: 'Untuk melanjutkan ke LKTara' },
  },
  signUp: {
    start: { title: 'Buat akun LKTara', subtitle: 'Lalu buat atau bergabung dengan ruang kerja perusahaan', actionText: 'Sudah punya akun?', actionLink: 'Masuk' },
  },
  formFieldLabel__emailAddress: 'Alamat email',
  formFieldLabel__password: 'Kata sandi',
  formFieldLabel__firstName: 'Nama depan',
  formFieldLabel__lastName: 'Nama belakang',
  formButtonPrimary: 'Lanjutkan',
  dividerText: 'atau',
  socialButtonsBlockButton: 'Lanjutkan dengan {{provider|titleize}}',
};

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="ink-grid flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-sidebar px-4 py-10">
      {children}
      <p className="max-w-sm text-center text-xs text-sky-100/70">LKTara membantu persiapan, bukan pengganti akuntan publik, konsultan pajak, atau penasihat hukum.</p>
    </div>
  );
}

function SignInPage() {
  return <AuthFrame><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></AuthFrame>;
}

function SignUpPage() {
  return <AuthFrame><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></AuthFrame>;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/ringkasan" /></Show>
      <Show when="signed-out"><LandingPage /></Show>
    </>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function WorkspaceRoutes() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/ringkasan" component={DashboardPage} />
          <Route path="/peta-modul" component={PetaModulPage} />
          <Route path="/checklist" component={ChecklistPage} />
          <Route path="/ruang-laporan" component={RuangLaporanPage} />
          <Route path="/ruang-laporan/:id" component={RuangLaporanDetailPage} />
          <Route path="/referensi" component={ReferensiPage} />
          <Route path="/pendamping" component={PendampingPage} />
          <Route path="/konsultasi" component={KonsultasiPage} />
          <Route path="/solusi" component={SolusiPage} />
          <Route path="/perusahaan" component={PerusahaanPage} />
          <Route path="/akun" component={AkunPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function SignedInWorkspace() {
  const { user, isLoaded } = useUser();
  const [location] = useLocation();
  if (!isLoaded || !user) {
    return <div className="mx-auto max-w-3xl space-y-4 px-4 py-12"><Shimmer className="h-12 w-2/3" /><Shimmer className="h-40" /></div>;
  }
  if (location === "/redaksi") {
    return <EditorialScope key={`editorial:${user.id}`}><RoutedErrorBoundary><RedaksiPage /></RoutedErrorBoundary></EditorialScope>;
  }
  return <AccountScope key={user.id} userId={user.id}><WorkspaceRoutes /></AccountScope>;
}

function Protected() {
  return (
    <>
      <Show when="signed-in"><SignedInWorkspace /></Show>
      <Show when="signed-out"><Redirect to="/" /></Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <TooltipProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={Protected} />
        </Switch>
        <Toaster />
      </TooltipProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
