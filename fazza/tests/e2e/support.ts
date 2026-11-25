import { createServer, type Server } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";

const require = createRequire(import.meta.url);
// Uses the pre-installed Playwright + Chromium of the test machine.
export const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "/opt/node22/lib/node_modules/playwright") as typeof import("playwright");

const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".json": "application/json", ".ico": "image/x-icon" };

/** Minimal static server with SPA fallback. */
export function serve(dir: string, port: number): Promise<Server> {
  const root = resolve(dir);
  const server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
    let file = join(root, url);
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) file = join(root, "index.html");
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((r) => server.listen(port, "127.0.0.1", () => r(server)));
}

export const ROOT = resolve(__dirname, "../..");
