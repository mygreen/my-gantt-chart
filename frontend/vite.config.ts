import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// const apiProxyTarget = process.env.VITE_API_BASE_URL ?? "http://localhost:8080";
const apiProxyTarget = "http://192.168.133.1:8080";
// const apiProxyTarget = "http://host.docker.internal:8080";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../backend/src/main/resources/public"),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
});
