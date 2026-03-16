import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import ProtectedRoute from "./components/ProtectedRoute";
import { useServerStatus } from "./store/useServerStatus";

// ---------------------------------------------------------------------------
// Route-level code splitting — each page loads only when navigated to
// ---------------------------------------------------------------------------
const Landing = lazy(() => import("./pages/Landing"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const History = lazy(() => import("./pages/History"));
const Report = lazy(() => import("./pages/Report"));
const SignIn = lazy(() => import("./pages/SignIn"));
const SignUp = lazy(() => import("./pages/SignUp"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

// Minimal loading fallback that matches the app's dark theme
const PageLoader = () => (
    <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-neutral-800 border-t-cyan-500 rounded-full animate-spin" />
            <span className="text-neutral-600 text-xs font-['JetBrains_Mono'] tracking-wider uppercase">
                Loading
            </span>
        </div>
    </div>
);

const App = () => {
    const { warmUpServer } = useServerStatus();

    // Pre-warm the Render backend as soon as the app mounts
    useEffect(() => {
        warmUpServer();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                    <Suspense fallback={<PageLoader />}>
                        <Routes>
                            <Route path="/" element={<Landing />} />
                            <Route path="/signin" element={<SignIn />} />
                            <Route path="/signup" element={<SignUp />} />

                            {/* Protected Routes */}
                            <Route element={<ProtectedRoute />}>
                                <Route
                                    path="/dashboard"
                                    element={<Dashboard />}
                                />
                                <Route path="/history" element={<History />} />
                                <Route
                                    path="/report/:id"
                                    element={<Report />}
                                />
                            </Route>

                            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                            <Route path="*" element={<NotFound />} />
                        </Routes>
                    </Suspense>
                </BrowserRouter>
                <Analytics />
                <SpeedInsights />
            </TooltipProvider>
        </QueryClientProvider>
    );
};

export default App;
