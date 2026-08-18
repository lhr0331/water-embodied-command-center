import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = process.env.BASE_URL || "http://127.0.0.1:5173";
const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const outputDir = fileURLToPath(new URL("../qa/", import.meta.url));
const findings = [];
const consoleErrors = [];
const responseFailures = [];
const expectGateway = process.env.EXPECT_GATEWAY === "true";
let telemetryBefore = null;
let telemetryAfter = null;
let mapInteraction = null;
let geofenceInteraction = null;
let sensorInteraction = null;
let utilityInteraction = null;

if (!existsSync(edgePath)) {
  throw new Error(`Microsoft Edge was not found at ${edgePath}`);
}

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: edgePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });

page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});
page.on("pageerror", (error) => consoleErrors.push(error.message));
page.on("response", (response) => {
  if (response.status() >= 400) responseFailures.push(`${response.status()} ${response.url()}`);
});

try {
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByText("多设备联合巡检", { exact: true }).waitFor();
  if (expectGateway) {
    await page.getByText(/演练网关|集成网关/).waitFor();
    telemetryBefore = await page.locator(".selected-device-card small").textContent();
    await page.waitForTimeout(2400);
    telemetryAfter = await page.locator(".selected-device-card small").textContent();
    if (telemetryBefore === telemetryAfter) findings.push("Realtime telemetry did not visibly change after one gateway interval.");
  }
  const mapCanvas = page.locator("canvas.three-map-canvas");
  await mapCanvas.waitFor();
  const zoomBeforeButton = await page.locator(".map-zoom-readout").textContent();
  await page.getByRole("button", { name: "三维鸟瞰" }).click();
  const obliquePressed = await page.getByRole("button", { name: "三维鸟瞰" }).getAttribute("aria-pressed");
  if (obliquePressed !== "true") findings.push("Oblique map view did not become active.");
  await page.getByRole("button", { name: "放大地图" }).click();
  const zoomAfterButton = await page.locator(".map-zoom-readout").textContent();
  if (!Number.parseInt(zoomAfterButton, 10) || Number.parseInt(zoomAfterButton, 10) <= Number.parseInt(zoomBeforeButton, 10)) findings.push("Map zoom button did not increase the map scale.");
  const panBeforeDrag = (await mapCanvas.screenshot()).toString("base64");
  const mapBox = await page.locator(".map-stage").boundingBox();
  if (!mapBox) throw new Error("Map stage has no visible bounding box.");
  await page.mouse.move(mapBox.x + mapBox.width * .42, mapBox.y + mapBox.height * .62);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(mapBox.x + mapBox.width * .48, mapBox.y + mapBox.height * .66, { steps: 5 });
  await page.mouse.up({ button: "left" });
  await page.waitForTimeout(180);
  const panAfterDrag = (await mapCanvas.screenshot()).toString("base64");
  if (panBeforeDrag === panAfterDrag) findings.push("Map drag did not change the map viewport.");
  await page.mouse.move(mapBox.x + mapBox.width * .68, mapBox.y + mapBox.height * .54);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(mapBox.x + mapBox.width * .6, mapBox.y + mapBox.height * .48, { steps: 5 });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(180);
  const rotatedFrame = (await mapCanvas.screenshot()).toString("base64");
  if (panAfterDrag === rotatedFrame) findings.push("Right-button drag did not rotate the 3D map viewport.");
  mapInteraction = { activeView: "oblique", zoomBeforeButton, zoomAfterButton, panChanged: panBeforeDrag !== panAfterDrag, rotationChanged: panAfterDrag !== rotatedFrame };
  await page.screenshot({ path: join(outputDir, "map-oblique-detail.png"), fullPage: true });
  await page.getByRole("button", { name: "复位地图" }).click();
  await page.getByRole("button", { name: "电子围栏" }).click();
  await page.getByRole("dialog", { name: "电子围栏管理" }).waitFor();
  await page.getByRole("textbox", { name: "区域名称" }).fill("QA 自定义围栏");
  await page.getByRole("button", { name: "开始在地图点选" }).click();
  await page.getByText("围栏绘制中").waitFor();
  await page.mouse.click(mapBox.x + mapBox.width * .38, mapBox.y + mapBox.height * .56);
  await page.mouse.click(mapBox.x + mapBox.width * .46, mapBox.y + mapBox.height * .61);
  await page.mouse.click(mapBox.x + mapBox.width * .42, mapBox.y + mapBox.height * .69);
  await page.getByText(/已选边界点/).waitFor();
  const draftPointText = await page.locator(".fence-draft-status").textContent();
  if (!draftPointText?.includes("3")) findings.push("Custom geofence did not collect three map points.");
  await page.getByRole("button", { name: "保存区域" }).click();
  await page.getByRole("dialog", { name: "电子围栏管理" }).getByText("QA 自定义围栏", { exact: true }).waitFor();
  await page.screenshot({ path: join(outputDir, "geofence-custom.png"), fullPage: true });
  await page.getByRole("button", { name: "删除QA 自定义围栏" }).click();
  geofenceInteraction = { points: draftPointText, savedAndDeleted: true };
  await page.getByRole("button", { name: "关闭电子围栏管理" }).click();
  await page.getByRole("button", { name: "传感监测" }).click();
  await page.getByRole("dialog", { name: "无人设备传感监测" }).waitFor();
  await page.getByRole("button", { name: "USV-B01" }).click();
  await page.getByText("pH", { exact: true }).waitFor();
  await page.screenshot({ path: join(outputDir, "sensor-monitoring.png"), fullPage: true });
  sensorInteraction = { device: "USV-B01", readings: await page.locator(".sensor-card").count() };
  if (sensorInteraction.readings !== 3) findings.push(`Expected three sensor readings for USV-B01, found ${sensorInteraction.readings}.`);
  await page.getByRole("button", { name: "关闭无人设备传感监测" }).click();
  await page.getByRole("button", { name: "实时画面" }).click();
  await page.getByRole("dialog", { name: "实时画面" }).waitFor();
  await page.getByText(/演练实时流/).waitFor();
  await page.screenshot({ path: join(outputDir, "video-panel.png"), fullPage: true });
  await page.getByRole("button", { name: "关闭实时画面" }).click();
  await page.getByRole("button", { name: "系统设置" }).click();
  await page.getByRole("dialog", { name: "系统设置与运行状态" }).waitFor();
  await page.getByRole("button", { name: "检查实时网关健康状态" }).click();
  await page.getByText(/实时网关健康：ok/).waitFor();
  utilityInteraction = { videoPanel: true, gatewayHealthCheck: true };
  await page.getByRole("button", { name: "关闭系统设置与运行状态" }).click();
  await page.screenshot({ path: join(outputDir, "overview-1440x1024.png"), fullPage: true });

  await page.getByRole("button", { name: /溢洪道左侧边坡位移/ }).click();
  await page.getByRole("heading", { name: "溢洪道左侧边坡位移" }).waitFor();
  await page.screenshot({ path: join(outputDir, "incident-1440x1024.png"), fullPage: true });

  await page.getByRole("button", { name: /提交协同任务申请/ }).click();
  await page.getByRole("button", { name: /演练任务已下达/ }).waitFor();

  await page.getByRole("button", { name: "协同编排" }).click();
  await page.getByRole("heading", { name: "青龙水库库区通道协同巡检" }).waitFor();
  await page.screenshot({ path: join(outputDir, "planner-1440x1024.png"), fullPage: true });
  await page.getByRole("button", { name: "无人船", exact: true }).click();
  const boatTimelineRows = await page.locator(".timeline-row").count();
  if (boatTimelineRows !== 1) findings.push(`Expected one unmanned-boat timeline row after filtering, found ${boatTimelineRows}.`);
  await page.getByRole("button", { name: "发布计划" }).click();
  await page.screenshot({ path: join(outputDir, "planner-filtered-published.png"), fullPage: true });
  await page.getByRole("button", { name: "启动任务" }).click();
  await page.getByText(/协同演练已启动/).waitFor();
  await page.getByText("多设备联合巡检", { exact: true }).waitFor();
  await page.screenshot({ path: join(outputDir, "overview-after-start.png"), fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (overflow) findings.push("Desktop viewport has horizontal overflow.");
} finally {
  await browser.close();
}

const summary = {
  baseUrl,
  viewport: "1440x1024 CSS pixels at deviceScaleFactor 1",
  screenshots: ["qa/overview-1440x1024.png", "qa/map-oblique-detail.png", "qa/geofence-custom.png", "qa/sensor-monitoring.png", "qa/video-panel.png", "qa/incident-1440x1024.png", "qa/planner-1440x1024.png", "qa/planner-filtered-published.png", "qa/overview-after-start.png"],
  interactions: ["map-view-switch", "map-zoom", "map-drag", "geofence-draw-save-delete", "sensor-device-switch", "video-panel", "gateway-health-check", "alert-to-incident", "dispatch-task", "fleet-filter", "publish-plan", "start-simulation"],
  mapInteraction,
  geofenceInteraction,
  sensorInteraction,
  utilityInteraction,
  realtime: expectGateway ? { telemetryBefore, telemetryAfter } : { skipped: true },
  consoleErrors,
  responseFailures,
  findings,
  result: consoleErrors.length === 0 && responseFailures.length === 0 && findings.length === 0 ? "passed" : "failed",
};

await writeFile(join(outputDir, "visual-qa-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));

if (summary.result !== "passed") process.exitCode = 1;
