import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;
  const production =
    process.env.NODE_ENV === "production" ||
    process.argv.includes("--production");
  if (production) {
    const distPath = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (path.extname(req.path)) {
        res.status(404).send("Not found");
        return;
      }
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
  app.listen(port, process.env.HOST || "127.0.0.1", () =>
    console.log(`Manjira running at http://127.0.0.1:${port}`),
  );
}
startServer().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
