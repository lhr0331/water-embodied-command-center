import { spawn } from "node:child_process";

const gateway = spawn(process.execPath, ["scripts/realtime-gateway.mjs"], { stdio: "inherit" });
const port = process.env.VITE_PORT || "5173";
const vite = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", port, "--strictPort"], { stdio: "inherit" });

const stop = () => {
  gateway.kill();
  vite.kill();
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => { gateway.kill(); process.exit(code ?? 0); });
gateway.on("exit", (code) => { if (code && code !== 0) { vite.kill(); process.exit(code); } });
