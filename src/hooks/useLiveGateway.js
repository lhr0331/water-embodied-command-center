import { useCallback, useEffect, useState } from "react";

const DEMO_FENCE_STORAGE = "water-embodied-demo-fences";

const demoFleet = [
  { id: "UAV-D01", type: "drone", label: "无人机 D-01", state: "飞行中", battery: 76, note: "坝面巡查", location: "大坝东侧", x: "70%", y: "44%", linkQuality: 93, speed: 12.4, protocol: "mavlink", sensors: { flightAltitude: 118.4, windSpeed: 5.8, cameraTemp: 36.8 }, lastSeen: "刚刚" },
  { id: "USV-B01", type: "boat", label: "无人船 B-01", state: "航行中", battery: 68, note: "水质监测", location: "库区北侧", x: "49%", y: "22%", linkQuality: 89, speed: 4.2, protocol: "mqtt", sensors: { ph: 7.3, turbidity: 18.6, waterTemp: 24.2 }, lastSeen: "刚刚" },
  { id: "UGV-R01", type: "rover", label: "轮式机器人 R-01", state: "巡检中", battery: 82, note: "机组巡视", location: "泵站道路", x: "24%", y: "72%", linkQuality: 96, speed: 1.2, protocol: "ros2", sensors: { cabinetTemp: 32.6, vibration: 1.2, gas: 2 }, lastSeen: "刚刚" },
  { id: "QGV-Q01", type: "dog", label: "机器狗 Q-01", state: "巡检中", battery: 71, note: "边坡近检", location: "闸站下游", x: "70%", y: "75%", linkQuality: 91, speed: 0.8, protocol: "ros2", sensors: { slopeAngle: 16.2, surfaceTemp: 27.8, gas: 1 }, lastSeen: "刚刚" },
];

const demoAlerts = [
  { id: "A-01", level: "critical", title: "溢洪道左侧边坡位移", place: "溢洪道左侧边坡 K0+320", time: "14:28", confidence: "92%", state: "待处置", source: "vision-anomaly" },
  { id: "A-02", level: "warning", title: "大坝下游水位上涨", place: "大坝下游 1.2 km", time: "14:15", confidence: "88%", state: "监测中", source: "hydrology" },
  { id: "A-03", level: "warning", title: "2# 机组温度偏高", place: "右岸机组 2#", time: "13:42", confidence: "86%", state: "待核验", source: "thermal" },
  { id: "A-04", level: "warning", title: "水质浊度异常", place: "库区中部", time: "13:10", confidence: "81%", state: "监测中", source: "water-quality" },
];

const demoFences = [
  { id: "F-01", name: "主坝下游禁入区", type: "noEntry", points: [{ x: -36, z: 25 }, { x: -14, z: 22 }, { x: -8, z: 40 }, { x: -34, z: 44 }] },
  { id: "F-02", name: "库区水面作业区", type: "water", points: [{ x: -6, z: -22 }, { x: 18, z: -18 }, { x: 20, z: 6 }, { x: -9, z: 10 }] },
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const now = () => new Date().toISOString();

const isPublicDemoHost = () => {
  if (typeof window === "undefined") return false;
  return import.meta.env.VITE_PUBLIC_DEMO === "true"
    || new URLSearchParams(window.location.search).get("demo") === "1"
    || window.location.hostname.endsWith(".chatgpt.site")
    || window.location.hostname.endsWith(".github.io");
};

const readDemoFences = () => {
  if (typeof window === "undefined") return clone(demoFences);
  try {
    const stored = JSON.parse(window.localStorage.getItem(DEMO_FENCE_STORAGE) || "null");
    return Array.isArray(stored) ? stored : clone(demoFences);
  } catch {
    return clone(demoFences);
  }
};

const persistDemoFences = (fences) => {
  try { window.localStorage.setItem(DEMO_FENCE_STORAGE, JSON.stringify(fences)); } catch { /* storage is optional for the public demo */ }
};

const createDemoSnapshot = () => ({
  fleet: clone(demoFleet),
  alerts: clone(demoAlerts),
  fences: readDemoFences(),
  mode: "simulation",
  updatedAt: now(),
});

/**
 * The browser is a gateway client in production. The public Sites deployment
 * deliberately runs a local, browser-only simulation so every showcase control
 * remains usable without exposing a field gateway, real telemetry, or devices.
 */
export function useLiveGateway() {
  const publicDemo = isPublicDemoHost();
  const [snapshot, setSnapshot] = useState(() => publicDemo ? createDemoSnapshot() : ({
    fleet: [],
    alerts: [],
    fences: [],
    mode: "connecting",
    updatedAt: now(),
  }));
  const [connection, setConnection] = useState(publicDemo ? "online" : "connecting");

  useEffect(() => {
    if (publicDemo) {
      let tick = 0;
      setConnection("online");
      const timer = window.setInterval(() => {
        tick += 1;
        setSnapshot((current) => ({
          ...current,
          updatedAt: now(),
          fleet: current.fleet.map((device, index) => ({
            ...device,
            battery: Math.max(25, Number((device.battery - (tick % 13 === index ? 0.2 : 0)).toFixed(1))),
            linkQuality: Math.max(76, Math.min(99, device.linkQuality + ((tick + index) % 3 - 1))),
            speed: Number(Math.max(0.3, device.speed + ((tick + index) % 5 - 2) * 0.08).toFixed(1)),
            sensors: Object.fromEntries(Object.entries(device.sensors || {}).map(([key, value]) => [key, Number((value + ((tick + index) % 5 - 2) * 0.1).toFixed(1))])),
            lastSeen: "刚刚",
          })),
        }));
      }, 2400);
      return () => window.clearInterval(timer);
    }

    let disposed = false;
    const applySnapshot = (payload) => {
      if (!disposed && payload?.fleet && payload?.alerts) setSnapshot(payload);
    };

    fetch("/api/v1/snapshot")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Gateway snapshot unavailable")))
      .then((payload) => { if (!disposed) { setConnection("online"); applySnapshot(payload); } })
      .catch(() => { if (!disposed) setConnection("offline"); });

    const stream = new EventSource("/events");
    stream.onopen = () => { if (!disposed) setConnection("online"); };
    stream.onmessage = (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } };
    ["snapshot", "telemetry", "alert", "command", "geofence"].forEach((type) => stream.addEventListener(type, (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } }));
    stream.onerror = () => { if (!disposed) setConnection("offline"); };

    return () => {
      disposed = true;
      stream.close();
    };
  }, [publicDemo]);

  const sendCommand = useCallback(async (command) => {
    const mode = publicDemo ? "simulation" : (snapshot.mode === "simulation" ? "simulation" : "integration");
    if (publicDemo) {
      const simulatedCommand = { id: `CMD-DEMO-${Date.now()}`, ...command, mode, status: "simulated", createdAt: now() };
      setSnapshot((current) => ({
        ...current,
        updatedAt: now(),
        fleet: command.action === "dispatch-inspection"
          ? current.fleet.map((device) => command.deviceIds?.includes(device.id) ? { ...device, state: "演练执行中", lastSeen: "刚刚" } : device)
          : current.fleet,
        alerts: command.action === "acknowledge-alert"
          ? current.alerts.map((alert) => alert.id === command.alertId ? { ...alert, state: "已确认" } : alert)
          : current.alerts,
      }));
      return { ok: true, accepted: true, command: simulatedCommand, safety: { simulation: true, fieldExecution: false } };
    }

    const payload = { operator: "web-duty-01", mode, ...command };
    try {
      const response = await fetch("/api/v1/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      return { ok: response.ok && result.accepted, ...result };
    } catch {
      return { ok: false, reason: "无法连接实时网关，任务未提交。" };
    }
  }, [publicDemo, snapshot.mode]);

  const saveGeofence = useCallback(async (fence) => {
    if (publicDemo) {
      const saved = { id: `F-DEMO-${Date.now()}`, ...clone(fence) };
      const fences = [...snapshot.fences.filter((item) => item.id !== saved.id), saved];
      persistDemoFences(fences);
      setSnapshot((current) => ({ ...current, fences, updatedAt: now() }));
      return { ok: true, accepted: true, fence: saved, fences };
    }
    try {
      const response = await fetch("/api/v1/geofences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fence }) });
      const result = await response.json();
      return { ok: response.ok && result.accepted, ...result };
    } catch {
      return { ok: false, reason: "无法连接实时网关，电子围栏未保存。" };
    }
  }, [publicDemo, snapshot.fences]);

  const deleteGeofence = useCallback(async (id) => {
    if (publicDemo) {
      const fences = snapshot.fences.filter((fence) => fence.id !== id);
      persistDemoFences(fences);
      setSnapshot((current) => ({ ...current, fences, updatedAt: now() }));
      return { ok: true, accepted: true, fences };
    }
    try {
      const response = await fetch("/api/v1/geofences/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await response.json();
      return { ok: response.ok && result.accepted, ...result };
    } catch {
      return { ok: false, reason: "无法连接实时网关，电子围栏未删除。" };
    }
  }, [publicDemo, snapshot.fences]);

  const checkGateway = useCallback(async () => {
    if (publicDemo) return { ok: true, status: "ok", clients: 1, mode: "simulation" };
    try {
      const response = await fetch("/health");
      const result = await response.json();
      return { ok: response.ok, ...result };
    } catch {
      return { ok: false };
    }
  }, [publicDemo]);

  return { ...snapshot, connection, isPublicDemo: publicDemo, sendCommand, saveGeofence, deleteGeofence, checkGateway };
}
