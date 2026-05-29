const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("makershelfDesktop", {
  platform: process.platform,
});
