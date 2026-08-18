import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const gatewayOrigin = process.env.GATEWAY_URL || "http://127.0.0.1:8787";
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  build: {
    outDir: "dist/client",
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: ["terminal.local"],
    proxy: {
      "/api": gatewayOrigin,
      "/events": gatewayOrigin,
      "/health": gatewayOrigin,
    },
    warmup: {
      clientFiles: ["./src/main.jsx"],
    },
  },
  plugins: [react()],
});
