import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = Number(process.env.OPERATOR_PORT || 8080);
const url = `http://127.0.0.1:${port}`;

if (!existsSync(join(projectRoot, "dist", "client", "index.html"))) {
  console.error("首次运行需要先构建正式前端包。请双击“首次部署正式系统.cmd”。");
  process.exit(1);
}

async function ready() {
  try {
    const response = await fetch(`${url}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

if (!(await ready())) {
  const child = spawn(process.execPath, ["scripts/operator-server.mjs"], {
    cwd: projectRoot,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, GATEWAY_SIMULATION: "false" },
  });
  child.unref();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
    if (await ready()) break;
  }
}

if (!(await ready())) {
  console.error("正式系统未能启动。请确认 Node.js 已安装，且 8080 与 8878 端口未被占用。");
  process.exit(1);
}

if (process.platform === "win32") {
  const browser = spawn("cmd.exe", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true });
  browser.unref();
} else {
  console.log(`请在浏览器中打开 ${url}`);
}

console.log(`正式系统已启动：${url}`);
