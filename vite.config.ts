/**
 * Musanad Contracts — Frontend Vite config.
 *
 * Explicit TanStack Start setup (no Lovable plugin). The original Lovable
 * vite.config.ts used `@lovable.dev/vite-tanstack-config` which bundled all
 * plugins. We re-declare them here so the build is self-contained and
 * portable off the Lovable platform.
 */
import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    strictPort: false,
    host: "127.0.0.1",
  },
  preview: {
    port: 5173,
  },
});
