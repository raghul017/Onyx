import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 8080,
        hmr: {
            overlay: false,
        },
        proxy: {
            // Proxy API calls to the Express backend
            "/api": {
                target: "http://localhost:3001",
                changeOrigin: true,
            },
            // Proxy WebSocket connections
            "/ws": {
                target: "ws://localhost:3001",
                ws: true,
            },
        },
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(
        Boolean,
    ),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: {
                    // Core React runtime — cached across all routes
                    "vendor-react": ["react", "react-dom", "react-router-dom"],
                    // Animation library — only loaded by pages that use motion
                    "vendor-motion": ["framer-motion"],
                    // Radix UI primitives — cached together
                    "vendor-radix": [
                        "@radix-ui/react-dialog",
                        "@radix-ui/react-dropdown-menu",
                        "@radix-ui/react-tooltip",
                        "@radix-ui/react-toast",
                        "@radix-ui/react-select",
                        "@radix-ui/react-tabs",
                        "@radix-ui/react-popover",
                        "@radix-ui/react-slot",
                        "@radix-ui/react-label",
                        "@radix-ui/react-separator",
                        "@radix-ui/react-scroll-area",
                        "@radix-ui/react-toggle",
                        "@radix-ui/react-toggle-group",
                        "@radix-ui/react-switch",
                        "@radix-ui/react-checkbox",
                        "@radix-ui/react-progress",
                        "@radix-ui/react-slider",
                        "@radix-ui/react-radio-group",
                        "@radix-ui/react-accordion",
                        "@radix-ui/react-alert-dialog",
                        "@radix-ui/react-aspect-ratio",
                        "@radix-ui/react-avatar",
                        "@radix-ui/react-collapsible",
                        "@radix-ui/react-context-menu",
                        "@radix-ui/react-hover-card",
                        "@radix-ui/react-menubar",
                        "@radix-ui/react-navigation-menu",
                    ],
                    // Lottie animations — heavy, only needed on Landing
                    "vendor-lottie": [
                        "@lottiefiles/react-lottie-player",
                        "lottie-react",
                    ],
                    // Charts — only loaded on pages that use recharts
                    "vendor-charts": ["recharts"],
                },
            },
        },
    },
}));
