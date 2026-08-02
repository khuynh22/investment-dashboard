import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"] },
    // Next compiles JSX itself; vitest needs telling to use the modern runtime too.
    esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": resolve(__dirname, "src") } },
});
