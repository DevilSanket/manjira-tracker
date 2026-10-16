const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
};
function createStaticServer(root) {
  const base = path.resolve(root);
  return http.createServer((req, res) => {
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405);
      res.end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(req.url.split("?")[0]);
    } catch {
      res.writeHead(400);
      res.end("Bad request");
      return;
    }
    const file = path.resolve(base, "." + pathname);
    const relative = path.relative(base, file);
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    const target = pathname === "/" ? path.join(base, "index.html") : file;
    fs.stat(target, (err, stat) => {
      if (err || !stat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      res.writeHead(200, {
        "Content-Type":
          types[path.extname(target)] || "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const stream = fs.createReadStream(target);
      stream.on("error", () => res.destroy());
      stream.pipe(res);
    });
  });
}
module.exports = { createStaticServer };
