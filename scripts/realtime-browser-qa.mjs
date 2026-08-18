import { spawn } from "node:child_process";

const port = "5174";
const gatewayPort = "8792";
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
const dev = spawn(process.execPath, ["scripts/dev-realtime.mjs"], {
  stdio: "inherit",
  env: { ...process.env, VITE_PORT: port, GATEWAY_PORT: gatewayPort, GATEWAY_URL: gatewayUrl },
});

async function waitForGateway() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch { /* keep waiting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the Vite proxy and realtime gateway.");
}

async function stopTree(processId) {
  if (process.platform === "win32") {
    await new Promise((resolve) => spawn("taskkill", ["/pid", String(processId), "/T", "/F"], { stdio: "ignore" }).on("exit", resolve));
  } else {
    dev.kill("SIGTERM");
  }
}

let exitCode = 1;
try {
  await waitForGateway();
  exitCode = await new Promise((resolve) => {
    const qa = spawn(process.execPath, ["scripts/visual-qa.mjs"], { stdio: "inherit", env: { ...process.env, EXPECT_GATEWAY: "true", BASE_URL: `http://127.0.0.1:${port}` } });
    qa.on("exit", (code) => resolve(code ?? 1));
  });
} finally {
  await stopTree(dev.pid);
}

process.exit(exitCode);
