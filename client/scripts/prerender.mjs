// =============================================================================
// Postbuild prerender (T21h). Renders each PUBLIC route to static HTML and bakes
// it — plus per-route <title>/description/canonical/OG — into the built
// dist/<route>/index.html, so crawlers and social scrapers see real content and
// correct meta WITHOUT running JS. The SPA still hydrates normally on top.
//
// Approach: Vite's own SSR pipeline (createServer + ssrLoadModule) loads the TSX
// entry with all aliases/plugins intact — no separate bundler, no browser/
// Chromium, no router rewrite. Authed routes are never rendered here.
//
// Run automatically as the `build` script's postbuild step (see package.json).
// =============================================================================
import { createServer } from "vite";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");
const template = readFileSync(path.join(distDir, "index.html"), "utf-8");

async function main() {
    if (!existsSync(distDir)) {
        console.error("[prerender] dist/ not found — run `vite build` first.");
        process.exit(1);
    }

    // Middleware-mode Vite server just to use ssrLoadModule with project config.
    const vite = await createServer({
        root,
        logLevel: "warn",
        server: { middlewareMode: true },
        appType: "custom",
    });

    let SITE_URL, PUBLIC_ROUTES, render;
    try {
        ({ SITE_URL, PUBLIC_ROUTES } = await vite.ssrLoadModule("/src/lib/seo.ts"));
        ({ render } = await vite.ssrLoadModule("/src/entry-prerender.tsx"));
    } catch (e) {
        await vite.close();
        throw e;
    }

    let ok = 0;
    for (const route of PUBLIC_ROUTES) {
        let result;
        try {
            result = render(route.path);
        } catch (e) {
            // Never let one route crash the whole prerender — fall back to the SPA
            // template for that route and keep going.
            console.warn(`[prerender] ${route.path} failed to render: ${e.message}`);
            continue;
        }
        const { html: appHtml, helmet } = result;

        // helmet.*.toString() emits the per-route <title>/meta/link tags.
        const headTags = [
            helmet?.title?.toString() ?? "",
            helmet?.meta?.toString() ?? "",
            helmet?.link?.toString() ?? "",
        ]
            .filter(Boolean)
            .join("\n    ");

        let outHtml = template;

        // 1) Remove the global static <title> — helmet emits the route title.
        outHtml = outHtml.replace(/<title>[\s\S]*?<\/title>/, "");
        // 2) Drop the template's global description, default canonical, and
        //    default og:url so the route-specific helmet tags are the only ones
        //    (no duplicate canonical/og:url/description).
        outHtml = outHtml.replace(/<meta\s+name="description"[\s\S]*?\/>/, "");
        outHtml = outHtml.replace(/<link\s+rel="canonical"[^>]*\/?>/, "");
        // Drop the template's global og:/twitter: title+description+url tags so
        // the route-specific helmet ones don't duplicate them. (Keep og:image,
        // og:type, site_name, image:* from the template — helmet re-adds og:image
        // too, harmless, and the rest stay global.)
        outHtml = outHtml.replace(
            /\s*<meta\s+property="og:(title|description|url|image)"[^>]*\/?>/g,
            "",
        );
        outHtml = outHtml.replace(
            /\s*<meta\s+name="twitter:(title|description|image)"[^>]*\/?>/g,
            "",
        );
        // 3) Inject the route head tags just before </head>.
        outHtml = outHtml.replace("</head>", `    ${headTags}\n  </head>`);
        // 4) Inject the prerendered app markup into #root.
        outHtml = outHtml.replace(
            '<div id="root"></div>',
            `<div id="root">${appHtml}</div>`,
        );

        // Write dist/index.html for "/", else dist/<route>/index.html.
        const outPath =
            route.path === "/"
                ? path.join(distDir, "index.html")
                : path.join(distDir, route.path, "index.html");
        mkdirSync(path.dirname(outPath), { recursive: true });
        writeFileSync(outPath, outHtml, "utf-8");
        ok++;
        console.log(`[prerender] ${route.path.padEnd(26)} → ${path.relative(root, outPath)}`);
    }

    // ---- sitemap.xml -------------------------------------------------------
    const urls = PUBLIC_ROUTES.map((r) => {
        const loc = r.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${r.path}`;
        return `  <url><loc>${loc}</loc><changefreq>weekly</changefreq></url>`;
    }).join("\n");
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
    writeFileSync(path.join(distDir, "sitemap.xml"), sitemap, "utf-8");
    console.log(`[prerender] sitemap.xml → ${PUBLIC_ROUTES.length} urls`);

    await vite.close();
    console.log(`[prerender] done — ${ok}/${PUBLIC_ROUTES.length} routes prerendered.`);
}

main().catch((e) => {
    console.error("[prerender] fatal:", e);
    process.exit(1);
});
