const { remote, ipcRenderer } = require("electron");

let currWindow = remote.BrowserWindow.getFocusedWindow();
window.ipcRenderer = ipcRenderer;
window.closeCurrentWindow = function () {
    currWindow.close();
};
