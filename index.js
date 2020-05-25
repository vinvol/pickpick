const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");
const robot = require("robotjs");
const clipboardy = require("clipboardy");

let appIsAlive = true;
const DIMENSION = 200;
try {
    let mouse = robot.getMousePos();
    robot.screen.capture(0, 0, 1, 1);
    robot.moveMouse(mouse.x, mouse.y);
} catch (e) {}

const createWindow = () => {
    const screenSize = robot.getScreenSize();
    let mainWindow = new BrowserWindow({
        webPreferences: {
            preload: path.resolve(__dirname, "preload.js")
        },
        width: DIMENSION,
        height: DIMENSION,
        transparent: true,
        frame: false
    });
    mainWindow.loadFile(`./trans.html`);

    const moveAndAdjust = (x, y) => {
        if (y > screenSize.height / 2) {
            mainWindow?.setPosition(x - DIMENSION / 2, y - DIMENSION / 2 - 150);
        } else {
            mainWindow?.setPosition(x - DIMENSION / 2, y - DIMENSION / 2 + 150);
        }
    };

    ipcMain.on("move", function (event, keyPress) {
        let dx = 0;
        let dy = 0;
        if (keyPress === "ArrowLeft") {
            dx = -1;
        }
        if (keyPress === "ArrowRight") {
            dx = 1;
        }
        if (keyPress === "ArrowUp") {
            dy = -1;
        }
        if (keyPress === "ArrowDown") {
            dy = 1;
        }

        let mouse = robot.getMousePos();
        robot.moveMouse(mouse.x + dx, mouse.y + dy);
        mouse = robot.getMousePos();
        moveAndAdjust(mouse.x, mouse.y);
    });

    const sendColor = () => {
        var mouse = robot.getMousePos();
        var hex = robot.getPixelColor(mouse.x, mouse.y);
        if (mouse.x > 0 && mouse.y > 0) {
            var hex = robot.getPixelColor(mouse.x, mouse.y);

            var size = 10;
            var buff = robot.screen.capture(
                mouse.x - size / 2,
                mouse.y - size / 2,
                size,
                size
            );

            const img = buff.image;

            const arg = {
                img,
                dimension: { width: buff.width, height: buff.height },
                message: hex,
                color: hex,
                backgroundColor: "yellow"
            };

            mainWindow?.webContents?.send("action-update-label", arg);
            moveAndAdjust(mouse.x, mouse.y);
        }
    };
    mainWindow.setPosition(0, 0);
    const loop = () => {
        sendColor();
        if (appIsAlive) {
            setTimeout(loop, 50);
        }
    };
    loop();

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    mainWindow.on("blur", function () {
        appIsAlive = false;
        const mouse = robot.getMousePos();
        const colorHex = robot.getPixelColor(mouse.x, mouse.y);

        if (colorHex != "") {
            clipboardy.writeSync(`#${colorHex}`);
        }
        mainWindow.close();
    });

    // Emitted when the window is closed.
    mainWindow.on("closed", function () {
        appIsAlive = false;

        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    // if (process.platform !== "darwin") {
    app.quit();
    // }
});

app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
