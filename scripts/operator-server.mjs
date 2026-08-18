import { createServer, request as httpRequest } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createGateway } from "./realtime-gateway.mjs";

const projectRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const clientRoot = resolve(projectRoot, "dist", "client");
const host = process.env.OPERATOR_HOST || "127.0.0.1";
const port = Number(process.env.OPERATOR_PORT || 8080);
const gatewayPort = Number(process.env.OPERATOR_GATEWAY_PORT || 8878);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

if (!existsSync(join(clientRoot, "index.html"))) {
  throw new Error("未找到正式前端包。请先双击“首次部署正式系统.cmd”，或执行 npm run build。");
}

const gateway = await createGateway({ port: gatewayPort, simulation: false });

function sendError(response, status, message) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  response.end(JSON.stringify({ error: message }));
}

function proxyToGateway(request, response) {
  const headers = { ...request.headers, host: `127.0.0.1:${gateway.port}` };
  const upstream = httpRequest({
    host: "127.0.0.1",
    port: gateway.port,
    path: request.url,
    method: request.method,
    headers,
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => {
    if (!response.headersSent) sendError(response, 502, "实时网关不可用。");
    else response.end();
  });
  request.pipe(upstream);
}

async function serveClient(request, response, pathname) {
  let relativePath;
  try {
    relativePath = decodeURIComponent(pathname === "/" ? "/index.html" : pathname);
  } catch {
    sendError(response, 400, "请求路径无效。");
    return;
  }
  const candidate = normalize(join(clientRoot, relativePath));
  const safePath = candidate === clientRoot || candidate.startsWith(`${clientRoot}${sep}`) ? candidate : null;
  let filePath = safePath;
  try {
    if (!filePath || (await stat(filePath)).isDirectory()) filePath = join(clientRoot, "index.html");
    const body = await readFile(filePath);
    const extension = extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    response.end(body);
  } catch {
    // SPA routes are resolved by the browser application.
    try {
      const body = await readFile(join(clientRoot, "index.html"));
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(body);
    } catch {
      sendError(response, 404, "未找到资源。");
    }
  }
}

const operatorServer = createServer((request, response) => {
  const pathname = new URL(request.url || "/", `http://${request.headers.host || host}`).pathname;
  if (pathname === "/health" || pathname === "/events" || pathname.startsWith("/api/")) {
    proxyToGateway(request, response);
    return;
  }
  serveClient(request, response, pathname);
});

await new Promise((resolveServer) => operatorServer.listen(port, host, resolveServer));
console.log(`Operator console ready at http://${host}:${port}`);
console.log("Integration mode: waiting for certified edge-adapter telemetry. Browser-originated live commands are blocked.");

const shutdown = async () => {
  await new Promise((resolveServer) => operatorServer.close(resolveServer));
  await gateway.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
