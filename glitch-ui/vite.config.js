import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.TAURI_DEV_HOST;
const MOCK = process.env.VITE_MOCK === "1";

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString().slice(11, 16)), // HH:MM
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),  // YYYY-MM-DD
  },

  resolve: {
    alias: MOCK
      ? { "@tauri-apps/api/core": path.resolve(__dirname, "src/mock/tauri.js") }
      : {},
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: !MOCK, // allow any port in mock mode (Playwright passes --port 1422)
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
