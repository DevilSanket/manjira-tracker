import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const { createStaticServer } = createRequire(import.meta.url)(
  "../electron/static-server.cjs",
);
test("offline server serves correct assets and rejects missing files and traversal", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "manjira-server-"));
  await writeFile(path.join(root, "index.html"), "<h1>Manjira</h1>");
  await writeFile(
    path.join(root, "processor.js"),
    'registerProcessor("onset", class {});',
  );
  const server = createStaticServer(root);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const index = await fetch(origin);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /Manjira/);
    const script = await fetch(origin + "/processor.js");
    assert.match(script.headers.get("content-type")!, /javascript/);
    assert.equal((await fetch(origin + "/missing.js")).status, 404);
    assert.equal((await fetch(origin + "/missing.mp3")).status, 404);
    assert.equal((await fetch(origin + "/%2e%2e%2foutside")).status, 403);
    assert.equal((await fetch(origin, { method: "POST" })).status, 405);
    assert.equal((await fetch(origin + "/%E0%A4%A")).status, 400);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(root, { recursive: true });
  }
});
