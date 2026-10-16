const {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  dialog,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { createStaticServer } = require("./static-server.cjs");
if (process.env.MANJIRA_USER_DATA_DIR)
  app.setPath("userData", process.env.MANJIRA_USER_DATA_DIR);
let mainWindow;
let server;
let serverPort;
function trusted(event) {
  try {
    const url = new URL(event.senderFrame.url);
    return (
      url.hostname === "127.0.0.1" &&
      [String(serverPort), "3000"].includes(url.port)
    );
  } catch {
    return false;
  }
}
function registerSettings() {
  const file = path.join(app.getPath("userData"), "practice-settings.json");
  ipcMain.on("settings:read", (event, name) => {
    let value = null;
    if (trusted(event) && name === "manjira-settings") {
      try {
        value = fs.readFileSync(file, "utf8");
      } catch {}
    }
    event.returnValue = value;
  });
  ipcMain.on("settings:write", (event, name, value) => {
    let saved = false;
    if (trusted(event) && name === "manjira-settings") {
      try {
        if (value === null) {
          fs.rmSync(file, { force: true });
          saved = true;
        } else if (typeof value === "string" && value.length <= 2_000_000) {
          JSON.parse(value);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          fs.writeFileSync(file + ".tmp", value, "utf8");
          fs.renameSync(file + ".tmp", file);
          saved = true;
        }
      } catch {}
    }
    // Synchronous IPC replies must be assigned only once, after the operation.
    event.returnValue = saved;
  });
}
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 380,
    minHeight: 600,
    title: "Manjira Tracker",
    backgroundColor: "#f5f7fa",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  if (
    !app.isPackaged &&
    (process.env.USE_DEV_SERVER === "true" || process.argv.includes("--dev"))
  )
    await mainWindow.loadURL("http://127.0.0.1:3000");
  else {
    const root = path.join(__dirname, "../dist");
    if (!fs.existsSync(path.join(root, "index.html")))
      throw new Error(
        "Build files are missing. Run npm run build before npm run app.",
      );
    if (!server) {
      server = createStaticServer(root);
      await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      serverPort = server.address().port;
    }
    await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (new URL(url).origin !== new URL(mainWindow.webContents.getURL()).origin)
      event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
app
  .whenReady()
  .then(async () => {
    registerSettings();
    session.defaultSession.setPermissionCheckHandler(
      (webContents, permission, origin) => {
        try {
          return (
            new URL(origin).hostname === "127.0.0.1" &&
            ["media", "serial"].includes(permission)
          );
        } catch {
          return false;
        }
      },
    );
    session.defaultSession.setPermissionRequestHandler(
      (webContents, permission, callback) => {
        try {
          callback(
            new URL(webContents.getURL()).hostname === "127.0.0.1" &&
              ["media", "serial"].includes(permission),
          );
        } catch {
          callback(false);
        }
      },
    );
    session.defaultSession.setDevicePermissionHandler((details) => {
      try {
        return (
          details.deviceType === "serial" &&
          new URL(details.origin).hostname === "127.0.0.1"
        );
      } catch {
        return false;
      }
    });
    session.defaultSession.on(
      "select-serial-port",
      async (event, ports, webContents, callback) => {
        event.preventDefault();
        if (!ports.length) {
          callback("");
          return;
        }
        const result = await dialog.showMessageBox(mainWindow, {
          type: "question",
          title: "Choose USB serial input",
          message: "Select your connected instrument controller",
          buttons: [
            ...ports.map((port) => port.displayName || port.portName),
            "Cancel",
          ],
          cancelId: ports.length,
        });
        callback(ports[result.response]?.portId || "");
      },
    );
    await createWindow();
    app.on("activate", () => {
      if (!BrowserWindow.getAllWindows().length)
        void createWindow().catch(reportError);
    });
  })
  .catch(reportError);
function reportError(error) {
  dialog.showErrorBox("Manjira could not start", error.message);
  app.quit();
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    server?.close();
    app.quit();
  }
});
