import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  FaArrowRight,
  FaBars,
  FaBatteryThreeQuarters,
  FaBell,
  FaCheck,
  FaCheckCircle,
  FaCloud,
  FaCog,
  FaCrosshairs,
  FaDog,
  FaExclamationTriangle,
  FaLayerGroup,
  FaMap,
  FaMapMarkerAlt,
  FaMinus,
  FaPlane,
  FaPlay,
  FaPlus,
  FaRobot,
  FaRoute,
  FaSatellite,
  FaShieldAlt,
  FaShip,
  FaTemperatureHigh,
  FaTimes,
  FaUndo,
  FaVideo,
} from "react-icons/fa";
import reservoirOverview from "./assets/reservoir-overview.png";
import thermalSlopeEvidence from "./assets/thermal-slope-evidence.png";
import planningMapBase from "./assets/planning-map-base.png";
import { useLiveGateway } from "./hooks/useLiveGateway.js";
import { resolveSupportQuestion, supportSuggestedQuestions } from "./supportKnowledge.js";

const ThreeDMap = lazy(() => import("./components/ThreeDMap.jsx"));

const deviceTypeMeta = {
  drone: { label: "无人机", icon: FaPlane, accent: "cyan" },
  boat: { label: "无人船", icon: FaShip, accent: "teal" },
  rover: { label: "轮式机器人", icon: FaRobot, accent: "amber" },
  dog: { label: "机器狗", icon: FaDog, accent: "violet" },
};

const seedFleet = [
  { id: "UAV-D01", type: "drone", label: "无人机 D-01", state: "飞行中", battery: 76, note: "坝面巡查", location: "大坝东侧", x: "70%", y: "44%", linkQuality: 93, speed: 12.4, protocol: "mavlink" },
  { id: "USV-B01", type: "boat", label: "无人船 B-01", state: "航行中", battery: 68, note: "水质监测", location: "库区北侧", x: "49%", y: "22%", linkQuality: 89, speed: 4.2, protocol: "mqtt" },
  { id: "UGV-R01", type: "rover", label: "轮式机器人 R-01", state: "巡检中", battery: 82, note: "机组巡视", location: "泵站道路", x: "24%", y: "72%", linkQuality: 96, speed: 1.2, protocol: "ros2" },
  { id: "QGV-Q01", type: "dog", label: "四足机器人 Q-01", state: "巡检中", battery: 71, note: "边坡近检", location: "闸站下游", x: "70%", y: "75%", linkQuality: 91, speed: 0.8, protocol: "ros2" },
];

const seedAlerts = [
  { id: "A-01", level: "critical", title: "溢洪道左侧边坡位移", place: "溢洪道左侧边坡 K0+320", time: "14:28", confidence: "92%", state: "待处置" },
  { id: "A-02", level: "warning", title: "大坝下游水位上涨", place: "大坝下游 1.2 km", time: "14:15", confidence: "88%", state: "监测中" },
  { id: "A-03", level: "warning", title: "2# 机组温度偏高", place: "右岸机组 2#", time: "13:42", confidence: "86%", state: "待核验" },
  { id: "A-04", level: "warning", title: "水质浊度异常", place: "库区中部", time: "13:10", confidence: "81%", state: "监测中" },
];

const plannerRows = [
  { type: "drone", device: "UAV-01", blocks: [{ name: "坝体表观巡检", start: 8, span: 3 }, { name: "溢洪道结构巡检", start: 12, span: 3 }] },
  { type: "drone", device: "UAV-02", blocks: [{ name: "库区航线覆盖", start: 8, span: 4 }, { name: "岸线地形复测", start: 12.5, span: 3 }] },
  { type: "boat", device: "USV-01", blocks: [{ name: "坝前水域测深", start: 8, span: 3 }, { name: "库区水质监测", start: 12, span: 3 }] },
  { type: "rover", device: "UGV-01", blocks: [{ name: "泵站道路巡检", start: 8, span: 3 }, { name: "机组设备巡检", start: 12, span: 3 }] },
  { type: "dog", device: "QGV-01", blocks: [{ name: "边坡近距巡检", start: 8, span: 2.5 }, { name: "涵洞及栈道巡检", start: 12.5, span: 3 }] },
];

const seedFences = [
  { id: "F-01", name: "主坝下游禁入区", type: "noEntry", points: [{ x: -36, z: 25 }, { x: -14, z: 22 }, { x: -8, z: 40 }, { x: -34, z: 44 }] },
  { id: "F-02", name: "库区水面作业区", type: "water", points: [{ x: -6, z: -22 }, { x: 18, z: -18 }, { x: 20, z: 6 }, { x: -9, z: 10 }] },
];

const fenceTypes = {
  noEntry: { label: "禁入区域", color: "critical" },
  altitude: { label: "限高区域", color: "warning" },
  water: { label: "水面作业区", color: "good" },
};

const sensorDefinitions = {
  drone: [{ key: "flightAltitude", label: "飞行高度", unit: "m" }, { key: "windSpeed", label: "环境风速", unit: "m/s" }, { key: "cameraTemp", label: "云台温度", unit: "°C" }],
  boat: [{ key: "ph", label: "pH", unit: "" }, { key: "turbidity", label: "浊度", unit: "NTU" }, { key: "waterTemp", label: "水温", unit: "°C" }],
  rover: [{ key: "cabinetTemp", label: "柜体温度", unit: "°C" }, { key: "vibration", label: "设备振动", unit: "mm/s" }, { key: "gas", label: "可燃气体", unit: "ppm" }],
  dog: [{ key: "slopeAngle", label: "坡面倾角", unit: "°" }, { key: "surfaceTemp", label: "表面温度", unit: "°C" }, { key: "gas", label: "有害气体", unit: "ppm" }],
};

const fenceAreaHa = (points) => {
  if (points.length < 3) return 0;
  const area = points.reduce((total, point, index) => {
    const next = points[(index + 1) % points.length];
    return total + point.x * next.z - next.x * point.z;
  }, 0) / 2;
  return Math.abs(area) * .0625;
};

const sensorFallbacks = {
  drone: { flightAltitude: 118.4, windSpeed: 5.8, cameraTemp: 36.8 },
  boat: { ph: 7.3, turbidity: 18.6, waterTemp: 24.2 },
  rover: { cabinetTemp: 32.6, vibration: 1.2, gas: 2 },
  dog: { slopeAngle: 16.2, surfaceTemp: 27.8, gas: 1 },
};

const getSensorReadings = (device) => (sensorDefinitions[device.type] || []).map((definition, index) => {
  const value = device.sensors?.[definition.key] ?? sensorFallbacks[device.type]?.[definition.key] ?? 0;
  const warning = (definition.key === "cameraTemp" && value > 48) || (definition.key === "gas" && value > 12) || (definition.key === "turbidity" && value > 35) || (definition.key === "vibration" && value > 3.5);
  return { ...definition, value, warning, level: Math.min(96, Math.max(18, 36 + index * 18 + Number(value) % 22)) };
});

const formatSync = (value) => value ? new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(value)) : "--";

function StatusPill({ children, tone = "neutral" }) {
  return <span className={"status-pill " + tone}>{children}</span>;
}

function DeviceIcon({ type, size = 16 }) {
  const Icon = deviceTypeMeta[type]?.icon || FaRobot;
  return <Icon size={size} aria-hidden="true" />;
}

function LiveStatus({ connection, mode, updatedAt }) {
  const online = connection === "online";
  const label = online ? (mode === "simulation" ? "演练网关" : "集成网关") : "网关离线";
  const time = formatSync(updatedAt);
  return <span className={"realtime-state " + (online ? "online" : "simulation")}><FaCheckCircle />{label} · {time}</span>;
}

function AppHeader({ activeView, setActiveView, pendingAlerts, setDrawerOpen, onOpenAlerts, onOpenSettings, connection, mode, updatedAt }) {
  const navItems = [
    { id: "overview", label: "态势总览", icon: FaMap },
    { id: "incident", label: "事件管理", icon: FaExclamationTriangle },
    { id: "planner", label: "协同编排", icon: FaRoute },
  ];
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <button className="icon-button mobile-menu" onClick={() => setDrawerOpen(true)} aria-label="打开设备列表"><FaBars /></button>
        <span className="brand-mark"><FaSatellite /></span>
        <div><strong>水利具身智能平台</strong><span>空天地水协同感知网络</span></div>
      </div>
      <nav className="primary-nav" aria-label="工作台导航">
        {navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setActiveView(id)} className={activeView === id ? "active" : ""}><Icon />{label}</button>)}
      </nav>
      <div className="header-status">
        <LiveStatus connection={connection} mode={mode} updatedAt={updatedAt} />
        <span><FaCloud /> 多云 28°C</span>
        <span className="date-stamp">2026-08-17</span>
        <button className="icon-button notification" aria-label="查看告警" onClick={onOpenAlerts}><FaBell />{pendingAlerts > 0 && <b>{pendingAlerts}</b>}</button>
        <button className="icon-button" aria-label="系统设置" onClick={onOpenSettings}><FaCog /></button>
      </div>
    </header>
  );
}

function FleetList({ devices, selectedDevice, setSelectedDevice, compact = false }) {
  return (
    <section className={"fleet-list " + (compact ? "compact" : "")} aria-label="在线设备">
      {!compact && <div className="panel-title"><span>任务编组</span><StatusPill tone="good">{devices.length} 在线</StatusPill></div>}
      {!devices.length && <div className="empty-inline-state">暂无现场设备。请由已认证的边缘适配器向网关上传遥测。</div>}
      {devices.map((device) => (
        <button key={device.id} className={"fleet-item " + (selectedDevice === device.id ? "selected" : "")} onClick={() => setSelectedDevice(device.id)}>
          <span className={"device-symbol " + (deviceTypeMeta[device.type]?.accent || "cyan")}><DeviceIcon type={device.type} size={compact ? 17 : 20} /></span>
          <span className="fleet-copy"><strong>{device.label}</strong><small>{device.note} · {device.location}</small></span>
          <span className="fleet-meta"><em>{device.state}</em><small><FaBatteryThreeQuarters />{device.battery}%</small></span>
        </button>
      ))}
    </section>
  );
}

function MapMarker({ device, selected, onClick }) {
  return <button className={"map-marker " + (deviceTypeMeta[device.type]?.accent || "cyan") + (selected ? " selected" : "")} style={{ left: device.x, top: device.y }} onPointerDown={(event) => event.stopPropagation()} onClick={onClick} aria-label={"定位 " + device.label}><span><DeviceIcon type={device.type} size={17} /></span><small>{device.id}</small></button>;
}

const mapViews = [
  { id: "orthographic", label: "正射全域", shortLabel: "正射", hint: "正射影像 · 全域巡检", zoom: 1, panX: 0, panY: 0 },
  { id: "oblique", label: "三维鸟瞰", shortLabel: "鸟瞰", hint: "航测倾斜 · 态势观察", zoom: 1.28, panX: -20, panY: 18 },
  { id: "dam", label: "坝体细节", shortLabel: "坝体", hint: "大坝区域 · 细节复核", zoom: 1.86, panX: -88, panY: 8 },
];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function LegacyImageMap({ devices, selectedDevice, setSelectedDevice }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [activeView, setActiveView] = useState("orthographic");
  const [isDragging, setIsDragging] = useState(false);
  const [transform, setTransform] = useState({ zoom: 1, panX: 0, panY: 0 });
  const selected = devices.find((device) => device.id === selectedDevice) || devices[0];
  const activeMapView = mapViews.find((view) => view.id === activeView) || { hint: "手动浏览 · 已调整视窗" };

  const limitPan = (value, axis, zoom) => {
    const stage = stageRef.current;
    if (!stage) return value;
    const size = axis === "x" ? stage.clientWidth : stage.clientHeight;
    const allowance = Math.max(56, ((zoom - 1) * size) / 2 + 42);
    return clamp(value, -allowance, allowance);
  };

  const updateZoom = (delta) => {
    setTransform((current) => ({ ...current, zoom: clamp(Number((current.zoom + delta).toFixed(2)), 1, 3) }));
  };

  const setMapView = (view) => {
    setActiveView(view.id);
    setTransform({ zoom: view.zoom, panX: view.panX, panY: view.panY });
  };

  const resetMap = () => setMapView(mapViews[0]);

  const moveMap = (x, y) => {
    setTransform((current) => ({
      ...current,
      panX: limitPan(current.panX + x, "x", current.zoom),
      panY: limitPan(current.panY + y, "y", current.zoom),
    }));
  };

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.target.closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, panX: transform.panX, panY: transform.panY };
    setIsDragging(true);
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setTransform((current) => ({
      ...current,
      panX: limitPan(drag.panX + event.clientX - drag.startX, "x", current.zoom),
      panY: limitPan(drag.panY + event.clientY - drag.startY, "y", current.zoom),
    }));
  };

  const endPointerDrag = (event) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
    }
  };

  const onKeyDown = (event) => {
    const moves = { ArrowLeft: [-28, 0], ArrowRight: [28, 0], ArrowUp: [0, -28], ArrowDown: [0, 28] };
    if (moves[event.key]) { event.preventDefault(); moveMap(...moves[event.key]); }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); updateZoom(.2); }
    if (event.key === "-") { event.preventDefault(); updateZoom(-.2); }
    if (event.key === "0") { event.preventDefault(); resetMap(); }
  };

  return (
    <section
      ref={stageRef}
      className={"map-stage " + (isDragging ? "is-dragging" : "")}
      aria-label="水库协同态势地图，可拖动浏览并缩放"
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointerDrag}
      onPointerCancel={endPointerDrag}
      onWheel={(event) => { event.preventDefault(); updateZoom(event.deltaY < 0 ? .16 : -.16); }}
      onKeyDown={onKeyDown}
    >
      <div
        className={"map-world map-view-" + activeView}
        style={{ "--map-translate-x": `${transform.panX}px`, "--map-translate-y": `${transform.panY}px`, "--map-zoom": transform.zoom }}
      >
        <img className="map-image" src={reservoirOverview} alt="水库、大坝和下游闸站的航拍底图" draggable="false" />
        <div className="map-wash" />
        <div className="map-grid" aria-hidden="true" />
        <div className="route route-cyan route-one" /><div className="route route-teal route-two" />
        <div className="zone zone-amber">轮式巡检区</div><div className="zone zone-violet">边坡作业区</div><div className="zone zone-cyan">大坝巡检区</div>
        {devices.map((device) => <MapMarker key={device.id} device={device} selected={selectedDevice === device.id} onClick={() => setSelectedDevice(device.id)} />)}
      </div>

      <div className="map-view-switcher" role="group" aria-label="航测地图视角">
        <div><span>航测地图视角</span><small>{activeMapView.hint}</small></div>
        <div className="map-view-buttons">
          {mapViews.map((view) => <button key={view.id} className={activeView === view.id ? "active" : ""} onPointerDown={(event) => event.stopPropagation()} onClick={() => setMapView(view)} aria-label={view.label} aria-pressed={activeView === view.id}>{view.shortLabel}</button>)}
        </div>
      </div>

      <div className="map-toolbar" aria-label="地图操作">
        <button onPointerDown={(event) => event.stopPropagation()} onClick={() => updateZoom(.2)} aria-label="放大地图"><FaPlus /></button>
        <span className="map-zoom-readout" aria-live="polite">{Math.round(transform.zoom * 100)}%</span>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={() => updateZoom(-.2)} aria-label="缩小地图"><FaMinus /></button>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={resetMap} aria-label="复位地图"><FaUndo /></button>
        <button onPointerDown={(event) => event.stopPropagation()} onClick={() => setMapView(mapViews[2])} aria-label="定位大坝细节"><FaCrosshairs /></button>
      </div>

      <div className="map-interaction-hint"><FaMap />拖动浏览 · 滚轮缩放 · 方向键微调</div>
      <div className="map-coordinate-readout"><span>WGS84</span><b>30.7421°N · 118.0824°E</b><small>比例尺 {Math.round(1200 / transform.zoom)} m</small></div>
      <div className="map-legend"><span className="legend-dot cyan" />无人机航线 <span className="legend-dot teal" />无人船航线 <span className="legend-box amber" />地面作业区 <span className="legend-box violet" />边坡近检区</div>
      {selected && <div className="selected-device-card"><div className={"device-symbol " + deviceTypeMeta[selected.type].accent}><DeviceIcon type={selected.type} /></div><div><strong>{selected.label}</strong><small>{selected.state} · 链路 {selected.linkQuality ?? "--"}% · {selected.speed ?? "--"} m/s</small></div><StatusPill tone="good">{selected.battery}%</StatusPill></div>}
    </section>
  );
}

function OperationalMap({ devices, selectedDevice, setSelectedDevice, fences, draftFence, drawingFence, onFencePoint, onCancelDrawing }) {
  const selected = devices.find((device) => device.id === selectedDevice) || devices[0];
  return <Suspense fallback={<section className="map-stage three-map-stage"><div className="three-map-loading"><i /><span>正在加载三维地形与工程模型…</span></div></section>}><ThreeDMap devices={devices} selectedDevice={selectedDevice} onSelectDevice={setSelectedDevice} fences={fences} draftFence={draftFence} drawingFence={drawingFence} onFencePoint={onFencePoint} onCancelDrawing={onCancelDrawing} renderSelectedCard={() => selected && <div className="selected-device-card"><div className={"device-symbol " + deviceTypeMeta[selected.type].accent}><DeviceIcon type={selected.type} /></div><div><strong>{selected.label}</strong><small>{selected.state} · 链路 {selected.linkQuality ?? "--"}% · {selected.speed ?? "--"} m/s</small></div><StatusPill tone="good">{selected.battery}%</StatusPill></div>} /></Suspense>;
}

function Overview({ devices, alerts, selectedDevice, setSelectedDevice, openIncident, openPlanner, openVideo, openSensors, openGeofence, fences, draftFence, drawingFence, onFencePoint, onCancelDrawing, mode, updatedAt }) {
  const hasDevices = devices.length > 0;
  return (
    <main className="workspace overview-workspace">
      <aside className="left-rail">
        <div className="task-card">
          <div className="eyebrow"><span>当前任务</span><StatusPill tone={hasDevices ? "cyan" : "neutral"}>{hasDevices ? "在线监控" : "待接入"}</StatusPill></div>
          <h2>{hasDevices ? "多设备联合巡检" : "等待现场设备接入"}</h2>
          <dl>
            <div><dt>任务区域</dt><dd>{hasDevices ? "按设备实时位置" : "待配置工程 GIS 数据"}</dd></div>
            <div><dt>执行时段</dt><dd>{hasDevices ? "按已发布计划" : "--"}</dd></div>
            <div><dt>设备数量</dt><dd>{devices.length} 台</dd></div>
            <div><dt>数据模式</dt><dd>{mode === "simulation" ? "演练数据" : "现场集成"}</dd></div>
          </dl>
          <p>{hasDevices ? `最新同步 ${formatSync(updatedAt)}。系统持续接收设备状态、环境遥测与视觉告警。` : "系统不会生成样例设备数据；完成边缘适配器接入后，设备与告警将自动出现。"}</p>
        </div>
        <FleetList devices={devices} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} />
        <div className="rail-actions">
          <button onClick={openPlanner}><FaRoute />任务编排</button>
          <button onClick={openIncident}><FaExclamationTriangle />风险处置</button>
          <button onClick={openVideo}><FaVideo />实时画面</button>
          <button onClick={openGeofence}><FaLayerGroup />电子围栏</button>
          <button onClick={openSensors}><FaTemperatureHigh />传感监测</button>
        </div>
      </aside>

      <OperationalMap devices={devices} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} fences={fences} draftFence={draftFence} drawingFence={drawingFence} onFencePoint={onFencePoint} onCancelDrawing={onCancelDrawing} />

      <aside className="right-rail">
        <div className="panel-title"><span>风险告警</span><button className="text-button" onClick={() => openIncident("A-01")}>全部</button></div>
        <div className="alert-stack">{alerts.length ? alerts.map((alert) => <button className={"alert-card " + alert.level} key={alert.id} onClick={() => openIncident(alert.id)}><FaExclamationTriangle /><span><strong>{alert.title}</strong><small>{alert.place}</small><small>{alert.time} · 置信度 {alert.confidence}</small></span><StatusPill tone={alert.level === "critical" ? "critical" : "warning"}>{alert.state}</StatusPill></button>) : <div className="empty-inline-state">暂无现场告警。</div>}</div>
        <div className="safety-note"><FaShieldAlt /><span>浏览器只能提交任务申请和查看状态；真实设备指令必须经过现场边缘适配器、电子围栏、人工二次授权与设备回执。</span></div>
      </aside>
    </main>
  );
}

function DispatchUnit({ type, title, content, state }) {
  return <article className="dispatch-unit"><span className={"device-symbol " + deviceTypeMeta[type].accent}><DeviceIcon type={type} size={25} /></span><div><strong>{title}</strong><p>{content}</p><small><FaBatteryThreeQuarters /> 可用电量实时同步 · <em>{state}</em></small></div></article>;
}

function Incident({ activeAlert, dispatchState, mode, onDispatch, onAcknowledge, onViewEvidence, openOverview }) {
  if (!activeAlert) return <main className="workspace incident-workspace"><section className="empty-workspace"><FaCheckCircle /><h1>暂无需要处置的现场告警</h1><p>网关收到经认证的告警后，会在这里生成处置流程和审计记录。</p><button className="primary-action" onClick={openOverview}>返回态势总览</button></section></main>;
  const pendingApproval = dispatchState === "pending-approval";
  const completed = dispatchState === "dispatched";
  return (
    <main className="workspace incident-workspace">
      <section className="incident-heading">
        <div className="incident-title"><span className="incident-icon"><FaExclamationTriangle /></span><div><p>一级风险事件</p><h1>{activeAlert.title}</h1><small><FaMapMarkerAlt />{activeAlert.place}</small></div></div>
        <dl className="incident-stats"><div><dt>预警时间</dt><dd>2026-08-17 {activeAlert.time}</dd></div><div><dt>模型置信度</dt><dd>{activeAlert.confidence}</dd></div><div><dt>安全状态</dt><dd><FaShieldAlt /> Ⅲ级（受控）</dd></div></dl>
      </section>
      <section className="incident-grid">
        <div className="evidence-column">
          <article className="evidence-card"><div className="panel-title"><span>现场证据 <small>红外 / 可见光融合</small></span><StatusPill tone="critical">异常区域</StatusPill></div><div className="evidence-media"><img src={thermalSlopeEvidence} alt="坝坡热成像复核画面" /><div className="thermal-key"><span>45°C</span><i /><span>15°C</span></div><span className="evidence-tag">疑似位移区</span></div><div className="evidence-foot"><span><FaTemperatureHigh />温度异常幅度 +8.4°C</span><span><FaVideo />来源 UAV-02 · 实时回传</span><button className="text-button" onClick={onViewEvidence}>查看原始帧 <FaArrowRight /></button></div></article>
          <article className="mini-map-card"><div className="panel-title"><span>工程态势与资源位置</span><small>青龙水库主坝区</small></div><div className="mini-map"><img src={reservoirOverview} alt="资源位置地图" /><span className="danger-pin">预警区</span><span className="mini-device uav"><FaPlane />UAV-02</span><span className="mini-device dog"><FaDog />QGV-01</span><span className="mini-device boat"><FaShip />USV-01</span></div></article>
        </div>
        <aside className="decision-panel">
          <div className="panel-title"><span>风险处置</span><StatusPill tone={completed ? "good" : "warning"}>{completed ? "演练已下达" : pendingApproval ? "待现场审批" : "待提交申请"}</StatusPill></div>
          <div className="recommendation"><FaCheckCircle /><span>AI 协同建议综合边坡传感、红外影像、水位与气象数据生成。</span></div>
          <DispatchUnit type="drone" title="无人机广域复巡" content="经网关提交大坝右岸边坡及库区周边航测申请，获取连续影像证据。" state={completed ? "演练执行中" : pendingApproval ? "待现场审批" : "待命中"} />
          <DispatchUnit type="dog" title="机器狗近距巡检" content="经 ROS 2 边缘适配器执行近距检查，采集裂缝、渗漏与表面变形数据。" state={completed ? "演练执行中" : pendingApproval ? "待现场审批" : "待命中"} />
          <button className={"primary-action " + (completed || pendingApproval ? "success" : "")} onClick={onDispatch}>{completed ? <><FaCheck />演练任务已下达</> : pendingApproval ? <><FaCheck />任务申请已提交</> : <><FaPlay />提交协同任务申请</>}</button>
          <button className="secondary-action" onClick={onAcknowledge}>{activeAlert.state === "已确认" ? "已确认处置" : "人工确认事件"}</button>
          <div className="decision-notice"><FaShieldAlt />{mode === "simulation" ? "当前为安全演练模式。" : "现场集成模式不会直接控制设备。"}真实执行需通过经认证的边缘适配器，并具备审批令牌、电子围栏校验与设备控制器回执。</div>
          <button className="back-link" onClick={openOverview}><FaArrowRight />返回态势总览</button>
        </aside>
      </section>
    </main>
  );
}

function Planner({ devices, planPublished, setPlanPublished, openOverview, onStart }) {
  const [selectedRow, setSelectedRow] = useState("UAV-D01");
  const [filter, setFilter] = useState("all");
  if (!devices.length) return <main className="workspace planner-workspace"><section className="empty-workspace"><FaRoute /><h1>暂无可编排设备</h1><p>请先接入无人机、无人船、轮式机器人或机器狗的实时遥测，再建立运行计划。</p><button className="primary-action" onClick={openOverview}>返回态势总览</button></section></main>;
  const visibleRows = filter === "all" ? plannerRows : plannerRows.filter((row) => row.type === filter);
  return (
    <main className="workspace planner-workspace">
      <aside className="planner-fleet"><div className="panel-title"><span>设备可用性</span><StatusPill tone="good">{devices.length} 可用</StatusPill></div><div className="filter-tabs">{[["all", "全部"], ["drone", "无人机"], ["boat", "无人船"], ["rover", "轮式"], ["dog", "四足"]].map(([id, label]) => <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>)}</div><FleetList devices={devices} selectedDevice={selectedRow} setSelectedDevice={setSelectedRow} compact /><div className="maintenance"><FaCog /><span>UGV-02 预计 08-19 离线维护</span></div></aside>
      <section className="planner-main">
        <div className="planner-header"><div><p className="eyebrow">协同任务编排</p><h1>青龙水库库区通道协同巡检</h1><span>执行窗口 2026-08-17 10:00 — 16:00 · 网关统一调度</span></div><div className="planner-actions"><button className="secondary-action" onClick={() => setPlanPublished(false)}>保存草稿</button><button className="secondary-action" onClick={() => setPlanPublished(true)}>{planPublished ? <><FaCheck />已发布</> : "发布计划"}</button></div></div>
        <div className="planner-content">
          <section className="timeline-card"><div className="timeline-head"><span>设备 / 时间</span><div className="hours">{[8, 9, 10, 11, 12, 13, 14, 15, 16].map((hour) => <b key={hour}>{String(hour).padStart(2, "0")}:00</b>)}</div></div><div className="timeline-body">{visibleRows.map((row) => <button className={"timeline-row " + (selectedRow === row.device ? "selected" : "")} key={row.device} onClick={() => setSelectedRow(row.device)}><span className="row-label"><DeviceIcon type={row.type} />{row.device}</span><span className="row-track">{row.blocks.map((block) => <i key={block.name} className="assigned" style={{ left: (((block.start - 8) / 8) * 100) + "%", width: ((block.span / 8) * 100) + "%" }}>{block.name}</i>)}</span></button>)}</div><div className="timeline-legend"><span><i className="legend-block assigned" />已分配</span><span><i className="legend-block available" />待分配</span><span><i className="legend-block constraint" />安全约束</span></div></section>
          <aside className="plan-side"><div className="plan-map"><img src={planningMapBase} alt="任务区地图底图" /><span className="map-route cyan-route">UAV</span><span className="map-route teal-route">USV</span><span className="map-route amber-route">UGV</span><span className="map-route violet-route">QGV</span></div><article className="plan-summary"><h2>所选任务摘要</h2><dl><div><dt>任务名称</dt><dd>库区通道协同巡检</dd></div><div><dt>任务目标</dt><dd>结构、环境与水质联合巡检</dd></div><div><dt>参与设备</dt><dd>无人机、无人船、轮式机器人、机器狗</dd></div><div><dt>安全约束</dt><dd>电子围栏、设备健康、人工二次授权</dd></div></dl></article></aside>
        </div>
        <div className="planner-footer"><span><FaCheckCircle />编排校验通过 · 未发现资源冲突，可进入演练</span><div><button className="secondary-action" onClick={openOverview}>模拟演练</button><button className="primary-action" onClick={onStart}>{planPublished ? <><FaPlay />启动任务</> : <><FaCheck />发布并启动</>}</button></div></div>
      </section>
    </main>
  );
}

function UtilityPanel({ title, subtitle, onClose, children }) {
  return <aside className="utility-panel" role="dialog" aria-label={title}><div className="utility-panel-head"><div><span>{title}</span>{subtitle && <small>{subtitle}</small>}</div><button className="icon-button" aria-label={`关闭${title}`} onClick={onClose}><FaTimes /></button></div>{children}</aside>;
}

function SensorPanel({ devices, selectedDevice, setSelectedDevice, updatedAt, onClose }) {
  const activeDevice = devices.find((device) => device.id === selectedDevice) || devices[0];
  const readings = activeDevice ? getSensorReadings(activeDevice) : [];
  return <UtilityPanel title="无人设备传感监测" subtitle={`实时同步 ${formatSync(updatedAt)}`} onClose={onClose}>
    <div className="sensor-device-tabs">{devices.map((device) => <button key={device.id} className={device.id === activeDevice?.id ? "active" : ""} onClick={() => setSelectedDevice(device.id)}><DeviceIcon type={device.type} />{device.id}</button>)}</div>
    {!activeDevice && <div className="empty-inline-state">尚未收到设备传感器遥测。</div>}
    {activeDevice && <div className="sensor-device-summary"><span className={`device-symbol ${deviceTypeMeta[activeDevice.type].accent}`}><DeviceIcon type={activeDevice.type} /></span><div><strong>{activeDevice.label}</strong><small>{activeDevice.location} · 链路 {activeDevice.linkQuality}%</small></div><StatusPill tone="good">{activeDevice.state}</StatusPill></div>}
    <div className="sensor-grid">{readings.map((reading) => <article className={"sensor-card " + (reading.warning ? "warning" : "")} key={reading.key}><span>{reading.label}</span><strong>{reading.value}<small>{reading.unit}</small></strong><i><b style={{ width: `${reading.level}%` }} /></i><em>{reading.warning ? "超阈值，已纳入告警" : "数据正常"}</em></article>)}</div>
    <div className="sensor-panel-note"><FaCheckCircle />传感读数由设备遥测报文更新。真实接入时可直接在网关的 `sensors` 字段写入厂商测点。</div>
  </UtilityPanel>;
}

function GeofencePanel({ fences, draftFence, drawingFence, onDraftChange, onStartDrawing, onUndoPoint, onSave, onDelete, onCancelDrawing, onClose }) {
  const area = fenceAreaHa(draftFence.points || []);
  return <UtilityPanel title="电子围栏管理" subtitle={drawingFence ? "地图点选模式已开启" : "三维工程坐标"} onClose={() => { if (drawingFence) onCancelDrawing(); onClose(); }}>
    <p className="panel-intro">自定义区域会写入三维地图，任务下发前可由边缘网关据此校验禁入、限高和水面作业边界。</p>
    <label className="field-label">区域名称<input value={draftFence.name} onChange={(event) => onDraftChange({ ...draftFence, name: event.target.value })} placeholder="例如：右岸边坡禁入区" /></label>
    <label className="field-label">围栏类型<select value={draftFence.type} onChange={(event) => onDraftChange({ ...draftFence, type: event.target.value })}>{Object.entries(fenceTypes).map(([id, type]) => <option key={id} value={id}>{type.label}</option>)}</select></label>
    <div className="fence-draft-status"><span>已选边界点 <b>{draftFence.points.length}</b> / 至少 3 点</span><span>估算面积 <b>{area.toFixed(2)} ha</b></span></div>
    <div className="fence-actions"><button className={drawingFence ? "secondary-action active" : "primary-action"} onClick={drawingFence ? onCancelDrawing : onStartDrawing}>{drawingFence ? "取消绘制" : "开始在地图点选"}</button><button className="secondary-action" onClick={onUndoPoint} disabled={!draftFence.points.length}>撤销上一点</button><button className="primary-action" onClick={onSave} disabled={draftFence.points.length < 3}>保存区域</button></div>
    <div className="fence-list"><div className="panel-title"><span>已启用围栏</span><StatusPill tone="good">{fences.length} 条</StatusPill></div>{fences.map((fence) => <article key={fence.id}><span><strong>{fence.name}</strong><small>{fenceTypes[fence.type]?.label} · {fence.points.length} 点 · {fenceAreaHa(fence.points).toFixed(2)} ha</small></span><button onClick={() => onDelete(fence.id)} aria-label={`删除${fence.name}`}>删除</button></article>)}</div>
  </UtilityPanel>;
}

function VideoPanel({ devices, selectedDevice, setSelectedDevice, mode, onClose }) {
  const activeDevice = devices.find((device) => device.id === selectedDevice) || devices[0];
  const hasVideo = mode === "simulation";
  return <UtilityPanel title="实时画面" subtitle={hasVideo ? "演练视频流 · 网关统一接入" : "现场视频流待边缘视频网关接入"} onClose={onClose}>
    <label className="field-label">视频来源<select value={activeDevice?.id || ""} onChange={(event) => setSelectedDevice(event.target.value)}>{devices.map((device) => <option key={device.id} value={device.id}>{device.label}</option>)}</select></label>
    {hasVideo ? <div className="video-preview"><img src={thermalSlopeEvidence} alt="演练视频流预览" /><span><FaVideo />演练实时流 · {activeDevice?.id}</span></div> : <div className="video-preview video-awaiting-stream"><FaVideo /><strong>未配置现场视频流</strong><span>请由边缘视频网关提供经过鉴权的 WebRTC、HLS 或 RTSP 转码地址。</span></div>}
    <div className="video-meta"><span>编码 H.265 / 1080P</span><span>传输 {activeDevice?.linkQuality ?? "--"}%</span><span>录像：已开启</span></div>
    <div className="sensor-panel-note"><FaShieldAlt />生产环境由边缘视频网关转换 RTSP、WebRTC 或 HLS 流；浏览器不直接连接设备相机。</div>
  </UtilityPanel>;
}

function SettingsPanel({ connection, mode, updatedAt, onCheckGateway, onClose }) {
  return <UtilityPanel title="系统设置与运行状态" subtitle={mode === "simulation" ? "演练环境" : "现场集成环境"} onClose={onClose}>
    <div className="settings-status"><span>实时连接</span><LiveStatus connection={connection} mode={mode} updatedAt={updatedAt} /><span>指令策略</span><b>{mode === "simulation" ? "仅演练任务" : "任务申请进入人工审批与边缘适配器流程"}</b><span>安全状态</span><b>电子围栏、人工审批、边缘适配器</b></div>
    <button className="primary-action utility-full-action" onClick={onCheckGateway}>检查实时网关健康状态</button>
  </UtilityPanel>;
}

function KeywordSupport() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([{ id: "welcome", role: "assistant", title: "专业使用助手", lines: ["您好，我会提取设备、模块、操作和故障关键词，并可一次回答多个使用问题。", "例如：无人机如何接入、电子围栏怎么设置、告警如何处理？"] }]);

  const reply = (rawQuestion) => {
    const text = rawQuestion.trim();
    if (!text) return;
    const answer = resolveSupportQuestion(text);
    const now = Date.now();
    setMessages((current) => [...current, { id: `question-${now}`, role: "user", title: "您的问题", lines: [text] }, { id: `answer-${now}`, role: "assistant", ...answer }]);
    setQuestion("");
  };

  return <>
    {open && <aside className="support-panel" role="dialog" aria-label="智能使用助手">
      <div className="support-head"><div><FaRobot /><span>智能使用助手</span><small>多意图关键词解析 · 不连接真实设备</small></div><button className="icon-button" aria-label="关闭智能使用助手" onClick={() => setOpen(false)}><FaTimes /></button></div>
      <div className="support-messages" aria-live="polite">{messages.map((message) => <article className={`support-message ${message.role}`} key={message.id}><b>{message.title}</b>{message.keywords && <div className="support-analysis"><span>已识别关键词</span><div aria-label="识别出的关键词">{message.keywords.map((keyword) => <i key={keyword}>{keyword}</i>)}</div>{message.intentLabel && <small>{message.intentLabel}{message.confidence ? ` · 匹配度${message.confidence}` : ""}</small>}</div>}{message.lines?.map((line) => <p key={line}>{line}</p>)}{message.topics?.map((topic) => <section className="support-answer" key={topic.id}><strong>{topic.title}</strong>{topic.lines.map((line) => <p key={line}>{line}</p>)}</section>)}{message.related?.length > 0 && <div className="support-related"><span>可继续问</span>{message.related.map((item) => <button key={item} onClick={() => reply(item)}>{item}</button>)}</div>}</article>)}</div>
      <div className="support-suggestions" aria-label="常见问题">{supportSuggestedQuestions.map((item) => <button key={item} onClick={() => reply(item)}>{item}</button>)}</div>
      <form className="support-form" onSubmit={(event) => { event.preventDefault(); reply(question); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="可一次输入多个软件使用问题" aria-label="软件使用问题" /><button type="submit">询问</button></form>
    </aside>}
    <button className="support-launch" onClick={() => setOpen((current) => !current)} aria-label={open ? "关闭智能使用助手" : "打开智能使用助手"} aria-expanded={open}><FaRobot /><span>{open ? "关闭助手" : "智能客服"}</span></button>
  </>;
}

function App() {
  const live = useLiveGateway();
  const [activeView, setActiveView] = useState("overview");
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [selectedAlertId, setSelectedAlertId] = useState(null);
  const [dispatchState, setDispatchState] = useState("idle");
  const [planPublished, setPlanPublished] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [utilityPanel, setUtilityPanel] = useState(null);
  const [fences, setFences] = useState([]);
  const [fenceDraft, setFenceDraft] = useState({ name: "", type: "noEntry", points: [] });
  const [drawingFence, setDrawingFence] = useState(false);
  const [toast, setToast] = useState("");
  const activeAlert = useMemo(() => live.alerts.find((alert) => alert.id === selectedAlertId) || live.alerts[0] || null, [live.alerts, selectedAlertId]);
  const pendingAlerts = live.alerts.filter((alert) => alert.state !== "已确认").length;

  useEffect(() => {
    if (Array.isArray(live.fences)) setFences(live.fences);
  }, [live.fences]);

  const openIncident = (id) => {
    const nextAlert = live.alerts.find((alert) => alert.id === id) || live.alerts[0];
    if (!nextAlert) { setToast("暂无现场告警，无法创建处置任务。"); return; }
    setSelectedAlertId(nextAlert.id);
    setActiveView("incident");
  };
  const openPlanner = () => setActiveView("planner");
  const openUtility = (panel) => { setActiveView("overview"); setUtilityPanel(panel); };
  const startFenceDrawing = () => {
    if (!fenceDraft.name.trim()) { setToast("请先填写电子围栏区域名称。"); return; }
    setDrawingFence(true);
    setToast("围栏绘制已开启：请在三维地形上依次点选边界点。");
  };
  const addFencePoint = (point) => {
    if (!drawingFence) return;
    setFenceDraft((current) => current.points.length >= 8 ? current : { ...current, points: [...current.points, point] });
  };
  const undoFencePoint = () => setFenceDraft((current) => ({ ...current, points: current.points.slice(0, -1) }));
  const cancelFenceDrawing = () => { setDrawingFence(false); setFenceDraft((current) => ({ ...current, points: [] })); };
  const saveFence = async () => {
    if (fenceDraft.points.length < 3) { setToast("电子围栏至少需要 3 个边界点。"); return; }
    const name = fenceDraft.name.trim();
    try {
      const result = await live.saveGeofence({ name, type: fenceDraft.type, points: fenceDraft.points });
      const response = { ok: result.ok };
      if (!response.ok || !result.accepted) { setToast(result.error || result.reason || "电子围栏保存失败。"); return; }
      setFences(result.fences || []);
      setFenceDraft({ name: "", type: "noEntry", points: [] });
      setDrawingFence(false);
      setToast(`电子围栏“${name}”已保存到网关并显示在三维地图。`);
    } catch { setToast("无法连接实时网关，电子围栏未保存。"); }
  };
  const deleteFence = async (id) => {
    try {
      const result = await live.deleteGeofence(id);
      const response = { ok: result.ok };
      if (!response.ok || !result.accepted) { setToast(result.error || result.reason || "电子围栏删除失败。"); return; }
      setFences(result.fences || []);
      setToast("电子围栏已从网关删除，下一次任务校验将不再使用该区域。");
    } catch { setToast("无法连接实时网关，电子围栏未删除。"); }
  };
  const checkGateway = async () => {
    try {
      const status = await live.checkGateway();
      const response = { ok: status.ok };
      setToast(response.ok ? `实时网关健康：${status.status}，当前连接 ${status.clients} 个客户端。` : "实时网关健康检查未通过。");
    } catch { setToast("无法连接实时网关，请检查本地服务。"); }
  };
  const dispatch = async () => {
    const deviceIds = live.fleet.filter((device) => ["drone", "dog"].includes(device.type)).map((device) => device.id);
    if (!deviceIds.length) { setToast("当前没有可用于该处置流程的在线无人机或机器狗。任务未提交。"); return; }
    const result = await live.sendCommand({ action: "dispatch-inspection", deviceIds });
    if (result.ok) {
      const pendingApproval = result.command?.status === "pending-field-approval";
      setDispatchState(pendingApproval ? "pending-approval" : "dispatched");
      setToast(pendingApproval ? "任务申请已记录，正在等待现场审批和认证边缘适配器处理；设备尚未接收执行指令。" : "演练任务已写入网关。");
    } else setToast(result.reason || "任务未提交，请检查网关连接和安全策略。");
  };
  const acknowledge = async () => {
    if (!activeAlert) { setToast("暂无可确认的现场告警。"); return; }
    const result = await live.sendCommand({ action: "acknowledge-alert", alertId: activeAlert.id });
    setToast(result.ok ? "事件已确认，处置审计记录已更新。" : (result.reason || "事件确认失败。"));
  };
  const startPlan = async () => {
    const deviceIds = live.fleet.map((device) => device.id);
    if (!deviceIds.length) { setToast("没有在线设备，计划无法提交。"); return; }
    setPlanPublished(true);
    const result = await live.sendCommand({ action: "dispatch-inspection", deviceIds });
    if (result.ok) { setToast(result.command?.status === "pending-field-approval" ? "计划申请已提交，等待现场审批与边缘适配器确认。" : "协同演练已启动，所有设备状态将通过实时网关刷新。"); setActiveView("overview"); }
    else setToast(result.reason || "计划启动失败。");
  };

  return (
    <div className="app-shell">
      <AppHeader activeView={activeView} setActiveView={setActiveView} pendingAlerts={pendingAlerts} setDrawerOpen={setDrawerOpen} onOpenAlerts={() => openIncident()} onOpenSettings={() => openUtility("settings")} connection={live.connection} mode={live.mode} updatedAt={live.updatedAt} />
      {activeView === "overview" && <Overview devices={live.fleet} alerts={live.alerts} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} openIncident={openIncident} openPlanner={openPlanner} openVideo={() => openUtility("video")} openSensors={() => openUtility("sensors")} openGeofence={() => openUtility("geofence")} fences={fences} draftFence={fenceDraft} drawingFence={drawingFence} onFencePoint={addFencePoint} onCancelDrawing={cancelFenceDrawing} mode={live.mode} updatedAt={live.updatedAt} />}
      {activeView === "incident" && <Incident activeAlert={activeAlert} dispatchState={dispatchState} mode={live.mode} onDispatch={dispatch} onAcknowledge={acknowledge} onViewEvidence={() => setUtilityPanel("video")} openOverview={() => setActiveView("overview")} />}
      {activeView === "planner" && <Planner devices={live.fleet} planPublished={planPublished} setPlanPublished={setPlanPublished} openOverview={() => setActiveView("overview")} onStart={startPlan} />}
      {drawerOpen && <div className="mobile-drawer"><button className="drawer-scrim" aria-label="关闭设备列表" onClick={() => setDrawerOpen(false)} /><aside><div className="panel-title"><span>任务编组</span><button className="icon-button" onClick={() => setDrawerOpen(false)}><FaTimes /></button></div><FleetList devices={live.fleet} selectedDevice={selectedDevice} setSelectedDevice={(id) => { setSelectedDevice(id); setDrawerOpen(false); }} /></aside></div>}
      {utilityPanel === "sensors" && <SensorPanel devices={live.fleet} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} updatedAt={live.updatedAt} onClose={() => setUtilityPanel(null)} />}
      {utilityPanel === "geofence" && <GeofencePanel fences={fences} draftFence={fenceDraft} drawingFence={drawingFence} onDraftChange={setFenceDraft} onStartDrawing={startFenceDrawing} onUndoPoint={undoFencePoint} onSave={saveFence} onDelete={deleteFence} onCancelDrawing={cancelFenceDrawing} onClose={() => setUtilityPanel(null)} />}
      {utilityPanel === "video" && <VideoPanel devices={live.fleet} selectedDevice={selectedDevice} setSelectedDevice={setSelectedDevice} mode={live.mode} onClose={() => setUtilityPanel(null)} />}
      {utilityPanel === "settings" && <SettingsPanel connection={live.connection} mode={live.mode} updatedAt={live.updatedAt} onCheckGateway={checkGateway} onClose={() => setUtilityPanel(null)} />}
      {toast && <button className="toast" onClick={() => setToast("")}><FaCheckCircle />{toast}<FaTimes /></button>}
      <KeywordSupport />
    </div>
  );
}

export { App };
