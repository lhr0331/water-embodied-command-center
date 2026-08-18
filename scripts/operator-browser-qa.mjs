import { existsSync } from "node:fs";
import { chromium } from "playwright";

const baseUrl = process.env.OPERATOR_URL || "http://127.0.0.1:8080";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const findings = [];
const consoleErrors = [];

if (!existsSync(edgePath)) throw new Error(`Microsoft Edge was not found at ${edgePath}`);

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
page.on("pageerror", (error) => consoleErrors.push(error.message));

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("等待现场设备接入", { exact: true }).waitFor();
  await page.getByText("集成网关", { exact: false }).waitFor();
  if (await page.locator(".fleet-item").count() !== 0) findings.push("Integration console displayed a device before telemetry was received.");
  if (await page.locator(".alert-card").count() !== 0) findings.push("Integration console displayed an alert before field data was received.");
  if (await page.getByText("溢洪道左侧边坡位移", { exact: false }).count() !== 0) findings.push("A demonstration incident was visible in integration mode.");

  await page.getByRole("button", { name: "实时画面" }).click();
  await page.getByRole("dialog", { name: "实时画面" }).getByText("未配置现场视频流", { exact: true }).waitFor();
  await page.getByRole("button", { name: "关闭实时画面" }).click();

  await page.getByRole("button", { name: "系统设置" }).click();
  await page.getByRole("dialog", { name: "系统设置与运行状态" }).getByText("现场集成环境", { exact: true }).waitFor();
  await page.getByRole("button", { name: "检查实时网关健康状态" }).click();
  await page.getByText(/实时网关健康：ok/).waitFor();
  await page.getByRole("button", { name: "关闭系统设置与运行状态" }).click();
} finally {
  await browser.close();
}

const result = { baseUrl, findings, consoleErrors, result: findings.length === 0 && consoleErrors.length === 0 ? "passed" : "failed" };
console.log(JSON.stringify(result, null, 2));
if (result.result !== "passed") process.exitCode = 1;
