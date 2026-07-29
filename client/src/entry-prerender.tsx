// =============================================================================
// SSR prerender entry (T21h). Renders a public route to static HTML + collected
// <head> meta, so the postbuild script can bake real content + per-route SEO into
// dist/<route>/index.html.
//
// IMPORTANT: the public pages are imported STATICALLY here (not React.lazy),
// because renderToString does not resolve Suspense/lazy — a lazy tree would
// prerender the loading fallback instead of the page. Static imports give the
// crawler the real page markup. Browser-only code (WebGL in useEffect,
// warmUpServer) still never runs, since effects don't fire during renderToString.
// =============================================================================
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Routes, Route } from "react-router-dom";
import type { HelmetServerState } from "react-helmet-async";
import { AppProviders } from "./App";
import Seo from "./components/Seo";
import { PUBLIC_ROUTES } from "./lib/seo";

// Static (non-lazy) imports of the public pages → full markup at render time.
import Landing from "./pages/Landing";
import Docs from "./pages/Docs";
import Pricing from "./pages/Pricing";
import Security from "./pages/Security";
import Changelog from "./pages/Changelog";
import { Privacy, Terms, ResponsibleDisclosure } from "./pages/Legal";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

const seoFor = (path: string) => PUBLIC_ROUTES.find((r) => r.path === path)!;

const withSeo = (path: string, element: React.ReactNode) => {
    const s = seoFor(path);
    return (
        <>
            <Seo title={s.title} description={s.description} path={s.path} />
            {element}
        </>
    );
};

// Only the PUBLIC routes are prerendered; authed routes are intentionally absent.
const PrerenderRoutes = () => (
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
        <Route path="/signin" element={withSeo("/signin", <SignIn />)} />
        <Route path="/signup" element={withSeo("/signup", <SignUp />)} />
    </Routes>
);

export interface PrerenderResult {
    html: string;
    helmet: HelmetServerState;
}

/** Render one route path to HTML + the helmet head state for that route. */
export function render(url: string): PrerenderResult {
    const helmetContext: { helmet?: HelmetServerState } = {};
    const html = renderToString(
        <AppProviders
            helmetContext={helmetContext}
            router={
                <StaticRouter location={url}>
                    <PrerenderRoutes />
                </StaticRouter>
            }
        />,
    );
    return { html, helmet: helmetContext.helmet as HelmetServerState };
}
