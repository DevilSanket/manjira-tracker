const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electron", {
  isDesktop: true,
  platform: process.platform,
  version: process.versions.electron,
  readSettings: (name) => ipcRenderer.sendSync("settings:read", name),
  writeSettings: (name, value) =>
    ipcRenderer.sendSync("settings:write", name, value),
});
