import { useCallback, useEffect, useState } from "react";

/**
 * The browser is deliberately a gateway client, not a device controller.
 * When the gateway is unavailable, keep the last known state visible but do
 * not fabricate telemetry, alerts, or command results in the operator build.
 */
export function useLiveGateway() {
  const [snapshot, setSnapshot] = useState(() => ({
    fleet: [],
    alerts: [],
    mode: "connecting",
    updatedAt: new Date().toISOString(),
  }));
  const [connection, setConnection] = useState("connecting");

  useEffect(() => {
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
    stream.addEventListener("snapshot", (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } });
    stream.addEventListener("telemetry", (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } });
    stream.addEventListener("alert", (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } });
    stream.addEventListener("command", (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } });
    stream.addEventListener("geofence", (event) => { try { applySnapshot(JSON.parse(event.data)); } catch { /* ignore malformed events */ } });
    stream.onerror = () => { if (!disposed) setConnection("offline"); };

    return () => {
      disposed = true;
      stream.close();
    };
  }, []);

  const sendCommand = useCallback(async (command) => {
    const payload = { operator: "web-duty-01", mode: snapshot.mode === "simulation" ? "simulation" : "integration", ...command };
    try {
      const response = await fetch("/api/v1/commands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      return { ok: response.ok && result.accepted, ...result };
    } catch {
      return { ok: false, reason: "无法连接实时网关，任务未提交。" };
    }
  }, [snapshot.mode]);

  return { ...snapshot, connection, sendCommand };
}
