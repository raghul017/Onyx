import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import ProtectedRoute from "./components/ProtectedRoute";
import Seo from "./components/Seo";
import { PUBLIC_ROUTES } from "./lib/seo";
import { useServerStatus } from "./store/useServerStatus";

// ---------------------------------------------------------------------------
// Route-level code splitting — each page loads only when navigated to
// ---------------------------------------------------------------------------
const Landing = lazy(() => import("./pages/Landing"));
const Docs = lazy(() => import("./pages/Docs"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Security = lazy(() => import("./pages/Security"));
const Changelog = lazy(() => import("./pages/Changelog"));
const SharedReport = lazy(() => import("./pages/SharedReport"));
const Privacy = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import("./pages/Legal").then((m) => ({ default: m.Terms })));
const ResponsibleDisclosure = lazy(() =>
    import("./pages/Legal").then((m) => ({ default: m.ResponsibleDisclosure })),
);
const Dashboard = lazy(() => import("./pages/Dashboard"));
const History = lazy(() => import("./pages/History"));
const Report = lazy(() => import("./pages/Report"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback"));
const Billing = lazy(() => import("./pages/Billing"));
const Settings = lazy(() => import("./pages/Settings"));
const Profile = lazy(() => import("./pages/Profile"));
const InviteAccept = lazy(() => import("./pages/InviteAccept"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Minimal loading fallback that matches the app's dark theme
const PageLoader = () => (
    <div className="h-screen w-screen bg-[#fafafa] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#e6e6e6] border-t-[#3b82f6] rounded-full animate-spin" />
            <span className="text-[#666] text-xs font-['JetBrains_Mono'] tracking-wider uppercase">
                Loading
            </span>
        </div>
    </div>
);

// Per-route SEO lookup, keyed by path (from the single PUBLIC_ROUTES source).
const seoFor = (path: string) => PUBLIC_ROUTES.find((r) => r.path === path);

// Pair a public route's page with its <Seo> so every public route emits unique
// title/description/canonical/og — in the browser AND during the SSR prerender.
const withSeo = (path: string, element: ReactNode): ReactNode => {
    const s = seoFor(path);
    if (!s) return element;
    return (
        <>
            <Seo title={s.title} description={s.description} path={s.path} />
            {element}
        </>
    );
};

// The route table, router-agnostic so it can render under BrowserRouter (client)
// or StaticRouter (SSR prerender). Exported for the prerender entry.
export const AppRoutes = () => (
    <Suspense fallback={<PageLoader />}>
        <Routes>
            <Route path="/" element={withSeo("/", <Landing />)} />
            <Route path="/docs" element={withSeo("/docs", <Docs />)} />
            <Route path="/pricing" element={withSeo("/pricing", <Pricing />)} />
            <Route path="/security" element={withSeo("/security", <Security />)} />
            <Route path="/changelog" element={withSeo("/changelog", <Changelog />)} />
            <Route path="/privacy" element={withSeo("/privacy", <Privacy />)} />
            <Route path="/terms" element={withSeo("/terms", <Terms />)} />
            <Route
                path="/responsible-disclosure"
                element={withSeo("/responsible-disclosure", <ResponsibleDisclosure />)}
            />
            {/* T16b — PUBLIC read-only shared report. Deliberately OUTSIDE
                ProtectedRoute: a logged-out visitor with a link must see it. */}
            <Route path="/shared/:token" element={<SharedReport />} />
            <Route path="/signin" element={withSeo("/signin", <SignIn />)} />
            <Route path="/signup" element={withSeo("/signup", <SignUp />)} />
            <Route path="/auth/callback" element={<OAuthCallback />} />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/history" element={<History />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/report/:id" element={<Report />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/profile" element={<Profile />} />
            </Route>

            {/* Invite accept — public but handles auth redirect internally */}
            <Route path="/invite/accept" element={<InviteAccept />} />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
        </Routes>
    </Suspense>
);

// Shared providers wrapper — used by both the client App and the SSR prerender so
// hooks like useQuery/useHelmet/Tooltip work identically in both environments.
// `router` is injected (BrowserRouter in the browser, StaticRouter during SSR),
// and `helmetContext` lets the prerender collect the emitted <head> tags.
export const AppProviders = ({
    router,
    helmetContext = {},
    children,
}: {
    router: ReactNode;
    helmetContext?: object;
    children?: ReactNode;
}) => (
    <HelmetProvider context={helmetContext}>
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                {router}
                {children}
            </TooltipProvider>
        </QueryClientProvider>
    </HelmetProvider>
);

const App = () => {
    const { warmUpServer } = useServerStatus();

    // Pre-warm the Render backend as soon as the app mounts (browser only).
    useEffect(() => {
        warmUpServer();
    }, []);

    return (
        <AppProviders
            router={
                <BrowserRouter>
                    <AppRoutes />
                </BrowserRouter>
            }
        >
            <Analytics />
            <SpeedInsights />
        </AppProviders>
    );
};

export default App;
