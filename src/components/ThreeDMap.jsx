import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { FaCrosshairs, FaMap, FaMinus, FaPlus, FaUndo } from "react-icons/fa";

const MAP_VIEWS = [
  { id: "orthographic", shortLabel: "正射", label: "正射全域", hint: "全域三维地形 · 水库主坝区", position: [72, 78, 74], target: [0, 0, 5] },
  { id: "oblique", shortLabel: "鸟瞰", label: "三维鸟瞰", hint: "倾斜航测视角 · 地形与设施", position: [86, 49, 88], target: [0, 2, 9] },
  { id: "dam", shortLabel: "坝体", label: "坝体细节", hint: "主坝与闸站 · 近距复核", position: [44, 23, 68], target: [0, 2, 34] },
];

const markerColors = {
  drone: "#42d9fb",
  boat: "#38e0c4",
  rover: "#ffd064",
  dog: "#c79aff",
};

const fenceColors = {
  noEntry: "#ff6472",
  altitude: "#ffd064",
  water: "#38e0c4",
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function terrainHeight(x, z) {
  const hills = Math.sin(x * .09) * 1.2 + Math.cos(z * .12) * 1.1 + Math.sin((x + z) * .07) * .85;
  const shore = Math.max(0, (Math.abs(x) - 14) / 28) + Math.max(0, (Math.abs(z) - 18) / 34);
  return hills + shore * 3 - 1.2;
}

function createTerrain() {
  const geometry = new THREE.PlaneGeometry(120, 104, 90, 78);
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.attributes.position;
  const colors = [];
  const low = new THREE.Color("#0c2831");
  const high = new THREE.Color("#3e5547");
  const crest = new THREE.Color("#7a7258");

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const z = position.getZ(index);
    const height = terrainHeight(x, z);
    position.setY(index, height);
    const colour = height > 2.8 ? high.clone().lerp(crest, Math.min(.7, (height - 2.8) / 4)) : low.clone().lerp(high, Math.max(0, (height + 1.2) / 4.4));
    colors.push(colour.r, colour.g, colour.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .94, metalness: .02 }));
}

function createReservoir() {
  const shape = new THREE.Shape();
  shape.moveTo(-16, -46);
  shape.bezierCurveTo(-26, -30, -20, -15, -11, -4);
  shape.bezierCurveTo(-5, 5, -13, 17, -6, 35);
  shape.bezierCurveTo(1, 49, 14, 45, 18, 31);
  shape.bezierCurveTo(22, 18, 12, 8, 16, -4);
  shape.bezierCurveTo(20, -18, 28, -34, 18, -46);
  shape.closePath();
  const water = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshPhysicalMaterial({ color: "#0b6378", transparent: true, opacity: .88, roughness: .17, metalness: .12, clearcoat: .7 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = .34;
  return water;
}

function addDam(scene) {
  const dam = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: "#53626a", roughness: .78, metalness: .08 });
  const gateMaterial = new THREE.MeshStandardMaterial({ color: "#1e9cb6", emissive: "#0b2631", roughness: .35, metalness: .65 });
  const wall = new THREE.Mesh(new THREE.BoxGeometry(76, 7, 4), concrete);
  wall.position.set(0, 3.2, 36);
  dam.add(wall);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(86, 1.2, 8), new THREE.MeshStandardMaterial({ color: "#758188", roughness: .72 }));
  deck.position.set(0, 7.1, 36);
  dam.add(deck);
  for (let index = -5; index <= 5; index += 1) {
    const gate = new THREE.Mesh(new THREE.BoxGeometry(4.3, 4.2, .5), gateMaterial);
    gate.position.set(index * 6, 3.2, 33.82);
    dam.add(gate);
    const pier = new THREE.Mesh(new THREE.BoxGeometry(1.2, 8.2, 5), concrete);
    pier.position.set(index * 6 + 3.15, 4, 36);
    dam.add(pier);
  }
  scene.add(dam);
}

function addRoute(scene, points, color) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), true, "catmullrom", .18);
  const geometry = new THREE.TubeGeometry(curve, 96, .19, 8, true);
  const route = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .7, roughness: .28 }));
  scene.add(route);
}

function addZone(scene, points, color) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points.map(([x, z]) => new THREE.Vector3(x, terrainHeight(x, z) + .45, z)));
  const line = new THREE.LineLoop(geometry, new THREE.LineDashedMaterial({ color, dashSize: 2.1, gapSize: 1.1, transparent: true, opacity: .88 }));
  line.computeLineDistances();
  scene.add(line);
}

function deviceCoordinate(device) {
  const x = -45 + (Number.parseFloat(device.x) / 100) * 90;
  const z = -42 + (Number.parseFloat(device.y) / 100) * 82;
  const ground = terrainHeight(x, z);
  const altitude = device.type === "drone" ? 13 : device.type === "boat" ? .85 : 1.1;
  return new THREE.Vector3(x, ground + altitude, z);
}

function createDeviceMarker(device) {
  const colour = new THREE.Color(markerColors[device.type] || "#42d9fb");
  const group = new THREE.Group();
  group.userData.deviceId = device.id;
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.38, 32), new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: .9, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  group.add(ring);
  const coreGeometry = device.type === "drone" ? new THREE.OctahedronGeometry(.72) : device.type === "boat" ? new THREE.ConeGeometry(.72, 1.65, 4) : new THREE.CapsuleGeometry(.45, .72, 4, 10);
  const core = new THREE.Mesh(coreGeometry, new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: .32, metalness: .34, roughness: .35 }));
  if (device.type === "boat") core.rotation.x = Math.PI / 2;
  core.position.y = device.type === "drone" ? .7 : .55;
  group.add(core);
  const beacon = new THREE.PointLight(colour, 2.1, 11, 2);
  beacon.position.y = 2.1;
  group.add(beacon);

  const label = document.createElement("div");
  label.className = "three-device-label";
  const title = document.createElement("strong");
  const state = document.createElement("span");
  title.textContent = device.id;
  state.textContent = device.state;
  label.append(title, state);
  const labelObject = new CSS2DObject(label);
  labelObject.position.set(0, 3.25, 0);
  group.add(labelObject);

  group.userData.marker = { ring, core, beacon, title, state, label };
  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.isCSS2DObject && child.element) child.element.remove();
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function createFenceObject(fence, draft = false) {
  const points = (fence.points || []).map((point) => new THREE.Vector3(point.x, terrainHeight(point.x, point.z) + .72, point.z));
  const group = new THREE.Group();
  const color = new THREE.Color(fenceColors[fence.type] || "#ff6472");
  if (points.length < 1) return group;

  const path = points.length > 2 ? [...points, points[0]] : points;
  const border = new THREE.Line(new THREE.BufferGeometry().setFromPoints(path), new THREE.LineDashedMaterial({ color, dashSize: 1.25, gapSize: .65, transparent: true, opacity: draft ? .74 : .95 }));
  border.computeLineDistances();
  group.add(border);
  points.forEach((point) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.22, .28, draft ? 1.4 : 2.3, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .22, roughness: .4 }));
    post.position.copy(point).add(new THREE.Vector3(0, draft ? .65 : 1.1, 0));
    group.add(post);
  });
  if (points.length >= 3) {
    const center = points.reduce((total, point) => total.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
    const positions = [center.x, center.y, center.z];
    points.forEach((point) => positions.push(point.x, point.y, point.z));
    const indices = [];
    for (let index = 1; index <= points.length; index += 1) indices.push(0, index, index === points.length ? 1 : index + 1);
    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    fillGeometry.setIndex(indices);
    fillGeometry.computeVertexNormals();
    group.add(new THREE.Mesh(fillGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: draft ? .13 : .2, side: THREE.DoubleSide, depthWrite: false })));
  }
  const labelElement = document.createElement("div");
  labelElement.className = "three-fence-label";
  labelElement.textContent = draft ? `绘制中 · ${points.length} 点` : fence.name;
  const label = new CSS2DObject(labelElement);
  const labelAnchor = points.reduce((total, point) => total.add(point), new THREE.Vector3()).multiplyScalar(1 / points.length);
  label.position.copy(labelAnchor).add(new THREE.Vector3(0, 3.1, 0));
  group.add(label);
  return group;
}

export default function ThreeDMap({ devices, selectedDevice, onSelectDevice, renderSelectedCard, fences = [], draftFence, drawingFence = false, onFencePoint, onCancelDrawing }) {
  const containerRef = useRef(null);
  const runtimeRef = useRef(null);
  const onSelectRef = useRef(onSelectDevice);
  const onFencePointRef = useRef(onFencePoint);
  const drawingFenceRef = useRef(drawingFence);
  const [activeView, setActiveView] = useState("orthographic");
  const [zoomReadout, setZoomReadout] = useState("100%");

  onSelectRef.current = onSelectDevice;
  onFencePointRef.current = onFencePoint;
  drawingFenceRef.current = drawingFence;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071523");
    scene.fog = new THREE.Fog("#071523", 74, 162);
    const camera = new THREE.PerspectiveCamera(48, 1, .1, 260);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "three-map-canvas";
    container.appendChild(renderer.domElement);

    const labelRenderer = new CSS2DRenderer();
    labelRenderer.domElement.className = "three-map-label-layer";
    labelRenderer.domElement.style.pointerEvents = "none";
    container.appendChild(labelRenderer.domElement);

    scene.add(new THREE.HemisphereLight("#8bdcff", "#111a1d", 2.15));
    const keyLight = new THREE.DirectionalLight("#dce8d2", 2.5);
    keyLight.position.set(42, 65, 18);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight("#2ac8e8", 1.6);
    rimLight.position.set(-58, 26, -45);
    scene.add(rimLight);
    const terrain = createTerrain();
    scene.add(terrain);
    scene.add(createReservoir());
    const grid = new THREE.GridHelper(120, 24, "#2186a2", "#183542");
    grid.position.y = .12;
    grid.material.transparent = true;
    grid.material.opacity = .32;
    scene.add(grid);
    addDam(scene);
    addRoute(scene, [[18, 12, -5], [30, 13, -20], [8, 12, -27], [-3, 13, -4], [12, 12, 16]], "#31d9f8");
    addRoute(scene, [[17, 1.5, 8], [23, 1.5, 21], [15, 1.5, 34], [3, 1.5, 23], [9, 1.5, 8]], "#3be2bf");
    addZone(scene, [[-39, 16], [-24, 12], [-20, 30], [-35, 37]], "#ffd064");
    addZone(scene, [[20, 23], [40, 16], [39, 39], [17, 45]], "#c79aff");

    const markerRoot = new THREE.Group();
    scene.add(markerRoot);
    const fenceRoot = new THREE.Group();
    scene.add(fenceRoot);
    const markerMap = new Map();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = .08;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 20;
    controls.maxDistance = 132;
    controls.minPolarAngle = .16;
    controls.maxPolarAngle = Math.PI / 2.6;
    controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    controls.touches.ONE = THREE.TOUCH.PAN;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const updateReadout = () => {
      const distance = camera.position.distanceTo(controls.target);
      setZoomReadout(`${Math.round(clamp(92 / distance * 100, 40, 280))}%`);
    };
    const applyView = (view) => {
      camera.position.set(...view.position);
      controls.target.set(...view.target);
      controls.update();
      updateReadout();
    };
    const syncDevices = (nextDevices, nextSelectedId) => {
      const remaining = new Set(nextDevices.map((device) => device.id));
      for (const [id, marker] of markerMap) {
        if (!remaining.has(id)) { markerRoot.remove(marker); markerMap.delete(id); }
      }
      nextDevices.forEach((device) => {
        let marker = markerMap.get(device.id);
        if (!marker) {
          marker = createDeviceMarker(device);
          markerMap.set(device.id, marker);
          markerRoot.add(marker);
        }
        marker.position.copy(deviceCoordinate(device));
        const selected = device.id === nextSelectedId;
        marker.scale.setScalar(selected ? 1.22 : 1);
        marker.userData.marker.ring.material.opacity = selected ? 1 : .66;
        marker.userData.marker.beacon.intensity = selected ? 3.2 : 1.55;
        marker.userData.marker.title.textContent = device.id;
        marker.userData.marker.state.textContent = `${device.state} · ${device.battery}%`;
        marker.userData.marker.label.classList.toggle("selected", selected);
      });
    };
    const syncFences = (nextFences, nextDraft) => {
      [...fenceRoot.children].forEach((child) => {
        fenceRoot.remove(child);
        disposeObject(child);
      });
      nextFences.forEach((fence) => fenceRoot.add(createFenceObject(fence)));
      if (nextDraft?.points?.length) fenceRoot.add(createFenceObject(nextDraft, true));
    };
    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      labelRenderer.setSize(width, height);
    };
    const onMapClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      if (drawingFenceRef.current) {
        const terrainHit = raycaster.intersectObject(terrain, false)[0];
        if (terrainHit) onFencePointRef.current?.({ x: Number(terrainHit.point.x.toFixed(1)), z: Number(terrainHit.point.z.toFixed(1)) });
        return;
      }
      const hit = raycaster.intersectObjects(markerRoot.children, true).find(({ object }) => {
        let current = object;
        while (current) {
          if (current.userData.deviceId) return true;
          current = current.parent;
        }
        return false;
      });
      if (!hit) return;
      let target = hit.object;
      while (target && !target.userData.deviceId) target = target.parent;
      if (target?.userData.deviceId) onSelectRef.current(target.userData.deviceId);
    };
    const preventContextMenu = (event) => event.preventDefault();
    renderer.domElement.addEventListener("click", onMapClick);
    renderer.domElement.addEventListener("contextmenu", preventContextMenu);
    controls.addEventListener("change", updateReadout);
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    let frameId = 0;
    const render = () => {
      frameId = window.requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    };
    runtimeRef.current = { camera, controls, syncDevices, syncFences, applyView, updateReadout };
    syncDevices(devices, selectedDevice);
    syncFences(fences, draftFence);
    applyView(MAP_VIEWS[0]);
    resize();
    render();

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      renderer.domElement.removeEventListener("click", onMapClick);
      renderer.domElement.removeEventListener("contextmenu", preventContextMenu);
      controls.removeEventListener("change", updateReadout);
      controls.dispose();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelRenderer.domElement.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.syncDevices(devices, selectedDevice);
  }, [devices, selectedDevice]);

  useEffect(() => {
    runtimeRef.current?.syncFences(fences, draftFence);
  }, [fences, draftFence]);

  useEffect(() => {
    if (runtimeRef.current) runtimeRef.current.controls.enabled = !drawingFence;
  }, [drawingFence]);

  const changeView = (view) => {
    runtimeRef.current?.applyView(view);
    setActiveView(view.id);
  };
  const changeZoom = (direction) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    const delta = runtime.camera.position.clone().sub(runtime.controls.target);
    const distance = clamp(delta.length() * (direction > 0 ? .82 : 1.2), runtime.controls.minDistance, runtime.controls.maxDistance);
    runtime.camera.position.copy(runtime.controls.target.clone().add(delta.setLength(distance)));
    runtime.controls.update();
    runtime.updateReadout();
  };

  return (
    <section className="map-stage three-map-stage" aria-label="水库三维协同态势地图">
      <div ref={containerRef} className="three-map-viewport" />
      <div className="map-view-switcher" role="group" aria-label="三维地图视角">
        <div><span>三维工程地图</span><small>{MAP_VIEWS.find((view) => view.id === activeView)?.hint}</small></div>
        <div className="map-view-buttons">
          {MAP_VIEWS.map((view) => <button key={view.id} className={activeView === view.id ? "active" : ""} onClick={() => changeView(view)} aria-label={view.label} aria-pressed={activeView === view.id}>{view.shortLabel}</button>)}
        </div>
      </div>
      <div className="map-toolbar" aria-label="三维地图操作">
        <button onClick={() => changeZoom(1)} aria-label="放大地图"><FaPlus /></button>
        <span className="map-zoom-readout" aria-live="polite">{zoomReadout}</span>
        <button onClick={() => changeZoom(-1)} aria-label="缩小地图"><FaMinus /></button>
        <button onClick={() => changeView(MAP_VIEWS[0])} aria-label="复位地图"><FaUndo /></button>
        <button onClick={() => changeView(MAP_VIEWS[2])} aria-label="定位大坝细节"><FaCrosshairs /></button>
      </div>
      <div className="map-interaction-hint"><FaMap />左键平移 · 右键旋转 · 滚轮缩放</div>
      {drawingFence && <div className="map-drawing-state"><strong>围栏绘制中</strong><span>点击地形依次添加边界点（至少 3 点）</span><button onClick={onCancelDrawing}>取消绘制</button></div>}
      <div className="map-coordinate-readout"><span>WGS84 · 3D</span><b>30.7421°N · 118.0824°E</b><small>实时地形场景 · WebGL</small></div>
      <div className="map-legend"><span className="legend-dot cyan" />无人机航线 <span className="legend-dot teal" />无人船航线 <span className="legend-box amber" />地面作业区 <span className="legend-box violet" />边坡近检区</div>
      {renderSelectedCard()}
    </section>
  );
}
