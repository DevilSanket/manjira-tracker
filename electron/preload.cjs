const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isDesktop: true,
    platform: process.platform,
    version: process.versions.electron
});
