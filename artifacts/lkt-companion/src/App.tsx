import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { Shell } from '@/components/lkt/shell';
import DashboardPage from '@/pages/dashboard';
import ChecklistPage from '@/pages/checklist';
import ReferensiPage from '@/pages/referensi';
import KonsultasiPage from '@/pages/konsultasi';
import SolusiPage from '@/pages/solusi';
import PerusahaanPage from '@/pages/perusahaan';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function Router() {
  return (
    <Shell>
      <RoutedErrorBoundary>
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/checklist" component={ChecklistPage} />
          <Route path="/referensi" component={ReferensiPage} />
          <Route path="/konsultasi" component={KonsultasiPage} />
          <Route path="/solusi" component={SolusiPage} />
          <Route path="/perusahaan" component={PerusahaanPage} />
          <Route component={NotFound} />
        </Switch>
      </RoutedErrorBoundary>
    </Shell>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
