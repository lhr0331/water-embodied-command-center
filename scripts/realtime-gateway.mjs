import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const initialFleet = [
  { id: "UAV-D01", type: "drone", label: "无人机 D-01", state: "飞行中", battery: 76, note: "坝面巡查", location: "大坝东侧", x: "70%", y: "44%", linkQuality: 93, speed: 12.4, protocol: "mavlink", sensors: { flightAltitude: 118.4, windSpeed: 5.8, cameraTemp: 36.8 }, lastSeen: "just now" },
  { id: "USV-B01", type: "boat", label: "无人船 B-01", state: "航行中", battery: 68, note: "水质监测", location: "库区北侧", x: "49%", y: "22%", linkQuality: 89, speed: 4.2, protocol: "mqtt", sensors: { ph: 7.3, turbidity: 18.6, waterTemp: 24.2 }, lastSeen: "just now" },
  { id: "UGV-R01", type: "rover", label: "轮式机器人 R-01", state: "巡检中", battery: 82, note: "机组巡视", location: "泵站道路", x: "24%", y: "72%", linkQuality: 96, speed: 1.2, protocol: "ros2", sensors: { cabinetTemp: 32.6, vibration: 1.2, gas: 2 }, lastSeen: "just now" },
  { id: "QGV-Q01", type: "dog", label: "四足机器人 Q-01", state: "巡检中", battery: 71, note: "边坡近检", location: "闸站下游", x: "70%", y: "75%", linkQuality: 91, speed: 0.8, protocol: "ros2", sensors: { slopeAngle: 16.2, surfaceTemp: 27.8, gas: 1 }, lastSeen: "just now" },
];

const simulatedSpeedBands = {
  drone: [10.5, 14.5],
  boat: [3.2, 5.2],
  rover: [.6, 1.8],
  dog: [.45, 1.25],
};

function simulatedSpeed(type, index, tick) {
  const [minimum, maximum] = simulatedSpeedBands[type] || [.2, 2];
  const midpoint = (minimum + maximum) / 2;
  const amplitude = (maximum - minimum) * .38;
  return Number((midpoint + Math.sin(tick * .42 + index * 1.3) * amplitude).toFixed(1));
}

function simulatedSensors(type, sensors = {}, index, tick) {
  const wave = (base, amplitude, phase = 0) => Number((base + Math.sin(tick * .34 + index + phase) * amplitude).toFixed(1));
  if (type === "drone") return { ...sensors, flightAltitude: wave(118, 4.5), windSpeed: wave(5.8, 1.1, .7), cameraTemp: wave(36.8, 1.8, 1.4) };
  if (type === "boat") return { ...sensors, ph: Number((7.3 + Math.sin(tick * .18 + index) * .08).toFixed(2)), turbidity: wave(18.6, 2.6, .5), waterTemp: wave(24.2, .8, 1.1) };
  if (type === "rover") return { ...sensors, cabinetTemp: wave(32.6, 1.2), vibration: Number((1.2 + Math.abs(Math.sin(tick * .45 + index)) * .45).toFixed(2)), gas: Math.round(Math.max(0, wave(2, 1.2, .4))) };
  if (type === "dog") return { ...sensors, slopeAngle: wave(16.2, 2.8), surfaceTemp: wave(27.8, 1.4, .7), gas: Math.round(Math.max(0, wave(1, .9, 1.1))) };
  return sensors;
}

const initialAlerts = [
  { id: "A-01", level: "critical", title: "溢洪道左侧边坡位移", place: "溢洪道左侧边坡 K0+320", time: "14:28", confidence: "92%", state: "待处置", source: "vision-anomaly" },
  { id: "A-02", level: "warning", title: "大坝下游水位上涨", place: "大坝下游 1.2 km", time: "14:15", confidence: "88%", state: "监测中", source: "hydrology" },
  { id: "A-03", level: "warning", title: "2# 机组温度偏高", place: "右岸机组 2#", time: "13:42", confidence: "86%", state: "待核验", source: "thermal" },
  { id: "A-04", level: "warning", title: "水质浊度异常", place: "库区中部", time: "13:10", confidence: "81%", state: "监测中", source: "water-quality" },
];

const adapterCatalog = [
  { deviceType: "drone", upstream: "MAVLink 2", bridge: "mavlink-edge-adapter", telemetry: ["position", "battery", "mission", "heartbeat"], commandPolicy: "edge-gateway-only" },
  { deviceType: "boat", upstream: "MQTT 5", bridge: "mqtt-watercraft-adapter", telemetry: ["position", "battery", "waterQuality", "sonar"], commandPolicy: "edge-gateway-only" },
  { deviceType: "rover", upstream: "ROS 2", bridge: "ros2-inspection-adapter", telemetry: ["pose", "battery", "camera", "diagnostics"], commandPolicy: "edge-gateway-only" },
  { deviceType: "dog", upstream: "ROS 2", bridge: "ros2-quadruped-adapter", telemetry: ["pose", "battery", "camera", "terrain"], commandPolicy: "edge-gateway-only" },
];

const clone = (value) => structuredClone(value);
const now = () => new Date().toISOString();

async function loadPersistentFences(stateFile) {
  try {
    const document = JSON.parse(await readFile(stateFile, "utf8"));
    return Array.isArray(document.fences) ? document.fences : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw new Error(`无法读取运行状态文件：${error.message}`);
  }
}

async function savePersistentFences(stateFile, fences) {
  await mkdir(dirname(stateFile), { recursive: true });
  await writeFile(stateFile, JSON.stringify({ fences, updatedAt: now() }, null, 2), "utf8");
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); } catch { reject(new Error("Request body must be valid JSON.")); }
    });
    request.on("error", reject);
  });
}

function writeJson(response, status, payload) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify(payload));
}

function setCors(response) {
  response.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:5173");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Operator-Id");
}

export async function createGateway({ port = Number(process.env.GATEWAY_PORT || 8787), simulation = process.env.GATEWAY_SIMULATION !== "false" } = {}) {
  // Integration mode starts empty on purpose. It must only show telemetry and
  // alerts supplied by a certified field adapter, never sample equipment.
  let fleet = simulation ? clone(initialFleet) : [];
  let alerts = simulation ? clone(initialAlerts) : [];
  const stateFile = process.env.OPERATOR_STATE_FILE || resolve(process.cwd(), "data", "operator-state.json");
  let fences = simulation ? [] : await loadPersistentFences(stateFile);
  const commandLog = [];
  const clients = new Set();
  let tick = 0;

  const snapshot = () => ({
    mode: simulation ? "simulation" : "integration",
    updatedAt: now(),
    fleet: clone(fleet),
    alerts: clone(alerts),
    fences: clone(fences),
    adapters: adapterCatalog,
    commandCount: commandLog.length,
  });

  const emit = (event, payload = snapshot()) => {
    const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const response of clients) response.write(message);
  };

  const updateFleet = (telemetry) => {
    if (!telemetry?.deviceId) throw new Error("telemetry.deviceId is required.");
    const index = fleet.findIndex((device) => device.id === telemetry.deviceId);
    const existing = index >= 0 ? fleet[index] : { id: telemetry.deviceId, type: telemetry.type || "rover", label: telemetry.label || telemetry.deviceId, state: "在线", battery: 100, note: "新接入设备", location: "未定位", x: "50%", y: "50%", linkQuality: 0, speed: 0, protocol: telemetry.protocol || "custom", lastSeen: "just now" };
    const allowed = ["type", "label", "state", "battery", "note", "location", "x", "y", "linkQuality", "speed", "protocol", "sensors"];
    const normalized = { ...existing, lastSeen: now() };
    for (const key of allowed) if (telemetry[key] !== undefined) normalized[key] = telemetry[key];
    if (index >= 0) fleet[index] = normalized; else fleet = [...fleet, normalized];
    return normalized;
  };

  const server = createServer(async (request, response) => {
    setCors(response);
    if (request.method === "OPTIONS") { response.writeHead(204); response.end(); return; }
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "GET" && url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        mode: simulation ? "simulation" : "integration",
        clients: clients.size,
        deviceCount: fleet.length,
        alertCount: alerts.length,
        liveCommandAvailable: false,
        updatedAt: now(),
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/snapshot") { writeJson(response, 200, snapshot()); return; }
    if (request.method === "GET" && url.pathname === "/api/v1/integration") {
      writeJson(response, 200, { adapters: adapterCatalog, safety: { browserDirectControl: false, allowLiveCommands: process.env.ALLOW_LIVE_COMMANDS === "true", operatorApprovalRequired: true } });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/v1/geofences") {
      writeJson(response, 200, { fences: clone(fences), persisted: !simulation, updatedAt: now() });
      return;
    }
    if (request.method === "GET" && url.pathname === "/events") {
      response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      response.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
      clients.add(response);
      request.on("close", () => clients.delete(response));
      return;
    }

    try {
      const body = await readJson(request);
      if (request.method === "POST" && url.pathname === "/api/v1/ingest/telemetry") {
        const device = updateFleet(body);
        emit("telemetry");
        writeJson(response, 202, { accepted: true, device, updatedAt: now() });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/ingest/alerts") {
        if (!body.title || !body.level) throw new Error("alert.title and alert.level are required.");
        const alert = { id: body.id || `A-${randomUUID().slice(0, 8)}`, level: body.level, title: body.title, place: body.place || "未定位", time: body.time || new Date().toTimeString().slice(0, 5), confidence: body.confidence || "--", state: body.state || "待处置", source: body.source || "external" };
        alerts = [alert, ...alerts.filter((item) => item.id !== alert.id)].slice(0, 20);
        emit("alert");
        writeJson(response, 202, { accepted: true, alert });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/geofences") {
        const fence = body.fence;
        if (!fence?.name || !Array.isArray(fence.points) || fence.points.length < 3) throw new Error("fence.name and at least three fence.points are required.");
        const normalized = {
          id: fence.id || `F-${randomUUID().slice(0, 8)}`,
          name: String(fence.name).slice(0, 80),
          type: ["noEntry", "altitude", "water"].includes(fence.type) ? fence.type : "noEntry",
          points: fence.points.slice(0, 80).map((point) => ({ x: Number(point.x), z: Number(point.z) })),
          updatedAt: now(),
        };
        if (normalized.points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.z))) throw new Error("fence points must contain finite x/z coordinates.");
        fences = [...fences.filter((item) => item.id !== normalized.id), normalized];
        if (!simulation) await savePersistentFences(stateFile, fences);
        emit("geofence");
        writeJson(response, 202, { accepted: true, fence: normalized, fences: clone(fences), persisted: !simulation });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/geofences/delete") {
        if (!body.id) throw new Error("geofence id is required.");
        const before = fences.length;
        fences = fences.filter((fence) => fence.id !== body.id);
        if (before === fences.length) { writeJson(response, 404, { accepted: false, reason: "geofence not found" }); return; }
        if (!simulation) await savePersistentFences(stateFile, fences);
        emit("geofence");
        writeJson(response, 202, { accepted: true, fences: clone(fences), persisted: !simulation });
        return;
      }
      if (request.method === "POST" && url.pathname === "/api/v1/commands") {
        if (!body.action || !body.operator) throw new Error("command.action and command.operator are required.");
        const mode = body.mode || "simulation";
        if (mode === "live") {
          writeJson(response, 503, { accepted: false, reason: "此版本未安装经认证的现场边缘执行适配器；真实设备指令已被拒绝。" });
          return;
        }
        if (mode !== "simulation" && mode !== "integration") {
          writeJson(response, 400, { accepted: false, reason: "Unsupported command mode." });
          return;
        }
        const command = {
          id: `CMD-${randomUUID().slice(0, 8)}`,
          action: body.action,
          deviceIds: body.deviceIds || [],
          operator: body.operator,
          mode,
          status: mode === "simulation" ? "simulated" : "pending-field-approval",
          createdAt: now(),
        };
        commandLog.unshift(command);
        if (body.action === "dispatch-inspection" && mode === "simulation") fleet = fleet.map((device) => command.deviceIds.includes(device.id) ? { ...device, state: "执行中", lastSeen: now() } : device);
        if (body.action === "acknowledge-alert" && body.alertId) alerts = alerts.map((alert) => alert.id === body.alertId ? { ...alert, state: "已确认" } : alert);
        emit("command");
        writeJson(response, 202, {
          accepted: true,
          command,
          safety: {
            browserDirectControl: false,
            simulation: mode === "simulation",
            fieldExecution: false,
            nextStep: mode === "simulation" ? "simulation-updated" : "await-certified-edge-adapter-and-human-approval",
          },
        });
        return;
      }
      writeJson(response, 404, { error: "Route not found." });
    } catch (error) {
      writeJson(response, 400, { error: error.message });
    }
  });

  const timer = simulation ? setInterval(() => {
    tick += 1;
    fleet = fleet.map((device, index) => ({
      ...device,
      battery: Math.max(18, Number((device.battery - (index % 2 === 0 ? 0.1 : 0.05)).toFixed(1))),
      linkQuality: Math.max(72, Math.min(99, device.linkQuality + (tick % 2 === 0 ? 1 : -1))),
      speed: simulatedSpeed(device.type, index, tick),
      sensors: simulatedSensors(device.type, device.sensors, index, tick),
      lastSeen: now(),
    }));
    emit("snapshot");
  }, 2000) : null;

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    close: async () => { if (timer) clearInterval(timer); for (const response of clients) response.end(); await new Promise((resolve) => server.close(resolve)); },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const gateway = await createGateway();
  console.log(`Realtime gateway listening on http://127.0.0.1:${gateway.port}`);
  const shutdown = async () => { await gateway.close(); process.exit(0); };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
