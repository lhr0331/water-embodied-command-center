import { createGateway } from "./realtime-gateway.mjs";

const gateway = await createGateway({ port: 8791, simulation: false });
const base = `http://127.0.0.1:${gateway.port}`;

try {
  const health = await fetch(`${base}/health`).then((response) => response.json());
  if (health.status !== "ok") throw new Error("Health endpoint did not report ok.");

  const telemetry = await fetch(`${base}/api/v1/ingest/telemetry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId: "UAV-D01", battery: 74.5, linkQuality: 95, speed: 13.1 }) }).then((response) => response.json());
  if (!telemetry.accepted || telemetry.device.battery !== 74.5) throw new Error("Telemetry ingest was not accepted.");

  const command = await fetch(`${base}/api/v1/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dispatch-inspection", deviceIds: ["UAV-D01", "QGV-Q01"], operator: "qa-operator", mode: "simulation" }) }).then((response) => response.json());
  if (!command.accepted || command.command.status !== "simulated") throw new Error("Simulation command was not accepted.");

  const liveCommand = await fetch(`${base}/api/v1/commands`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "dispatch-inspection", deviceIds: ["UAV-D01"], operator: "qa-operator", mode: "live" }) });
  if (liveCommand.status !== 503) throw new Error("Live command safety gate did not reject a browser-originated command.");

  console.log("Gateway smoke test passed: health, telemetry ingest, simulation command, and live-command safety gate.");
} finally {
  await gateway.close();
}
