import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import { Layout } from "@/components/layout";
import { PinGuard } from "@/components/pin-guard";
import { I18nProvider } from "@/lib/i18n";
import Dashboard from "@/pages/dashboard";
import TwitterPage from "@/pages/twitter";
import InstagramPage from "@/pages/instagram";
import ArchivePage from "@/pages/archive";
import AdGenPage from "@/pages/adgen";
import ContentGenPage from "@/pages/content-gen";
import UsagePage from "@/pages/usage";
import EnginePage from "@/pages/engine";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/twitter" component={TwitterPage} />
        <Route path="/instagram" component={InstagramPage} />
        <Route path="/adgen" component={AdGenPage} />
        <Route path="/content-gen" component={ContentGenPage} />
        <Route path="/archivo" component={ArchivePage} />
        <Route path="/usage" component={UsagePage} />
        <Route path="/engine/cct" component={EnginePage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <PinGuard>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
          </PinGuard>
          <Toaster theme="dark" position="top-right" />
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}

export default App;