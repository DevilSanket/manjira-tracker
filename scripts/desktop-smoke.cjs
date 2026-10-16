const { _electron } = require(process.cwd() + "/node_modules/playwright");
const { mkdtemp, rm, writeFile } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
(async () => {
  const config = await mkdtemp(path.join(tmpdir(), "manjira-electron-"));
  let application;
  try {
    const launch = () =>
      _electron.launch({
        executablePath:
          process.env.MANJIRA_ELECTRON_EXECUTABLE || require("electron"),
        args: [".", "--no-sandbox"],
        env: { ...process.env, MANJIRA_USER_DATA_DIR: config },
        timeout: 30000,
      });
    application = await launch();
    const userData = await application.evaluate(({ app }) =>
      app.getPath("userData"),
    );
    assert.ok(
      userData.startsWith(config),
      "Use isolated settings for the smoke test",
    );
    let page = await application.firstWindow();
    await page
      .getByRole("heading", { name: "Make time for your rhythm." })
      .waitFor();
    const firstOrigin = new URL(page.url()).origin;
    const preferences = JSON.stringify({
      version: 1,
      state: {
        calibration: {
          noiseFloor: 0.01,
          openZcr: 0.28,
          closedZcr: 0.15,
          minStrikePeak: 0.015,
          maxStrikePeak: 0.95,
          openSamples: [],
          closedSamples: [],
          inputLatency: 35,
        },
        completedLessonIds: ["lesson_1"],
        sessions: [],
      },
    });
    const ipcResult = await page.evaluate((value) => {
      window.electron.writeSettings("manjira-settings", value);
      return window.electron.readSettings("manjira-settings");
    }, preferences);
    assert.equal(ipcResult, preferences);
    await application.close();
    await writeFile(path.join(userData, "practice-settings.json"), preferences);
    application = await launch();
    page = await application.firstWindow();
    await page
      .getByText("Input idle · Delay compensation 35 ms", { exact: true })
      .waitFor();
    const secondOrigin = new URL(page.url()).origin;

    await application.close();
    application = await launch();
    page = await application.firstWindow();
    await page
      .getByText("Input idle · Delay compensation 35 ms", { exact: true })
      .waitFor();
    console.log(
      JSON.stringify({
        startup: "passed",
        persistentSettings: "passed",
        firstOrigin,
        secondOrigin,
      }),
    );
  } finally {
    if (application) await application.close();
    await rm(config, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
