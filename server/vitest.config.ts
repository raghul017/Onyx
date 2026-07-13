// =============================================================================
// Vitest config — pure-function unit tests only (no DB, no network).
// Node environment; TypeScript is handled by Vitest/esbuild out of the box.
// Source files import each other with explicit ".js" extensions (NodeNext);
// Vite's resolver maps those back to the ".ts" source during tests.
// =============================================================================

import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/__tests__/**/*.test.ts", "src/**/*.test.ts"],
        // No setup files, no globals — every test imports from "vitest" explicitly.
    },
});
