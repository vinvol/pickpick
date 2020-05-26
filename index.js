const path = require("path");
const { app, BrowserWindow, ipcMain, Menu, Tray } = require("electron");
const robot = require("robotjs");
const clipboardy = require("clipboardy");
const nearestColor = require("nearest-color");
const namedColors = require("color-name-list");

// nearestColor need objects {name => hex} as input
const colors = namedColors.reduce(
    (o, { name, hex }) => Object.assign(o, { [name]: hex }),
    {}
);
const nearest = nearestColor.from(colors);

let appIsAlive = true;
const DIMENSION = 200;
try {
    let mouse = robot.getMousePos();
    robot.screen.capture(0, 0, 1, 1);
    robot.moveMouse(mouse.x, mouse.y);
} catch (e) {}

const clamp = (min, max, n) => (n > min ? (n > max ? max : n) : min);

const createWindow = () => {
    
    appIsAlive = true;
    const screenSizes = robot.getAllScreensSize();
    
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
        // const finalX = clamp(0, screenSize.width - 200, x - DIMENSION / 2);
        const finalX = x;
        mainWindow?.setPosition(finalX, y - DIMENSION / 2 + 150);
        /// XXX redo the border logic
        // if (y > screenSize.height / 2) {
        //     mainWindow?.setPosition(finalX, y - DIMENSION / 2 - 150);
        // } else {
        //     mainWindow?.setPosition(finalX, y - DIMENSION / 2 + 150);
        // }
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
        if (keyPress === "Escape") {
            mainWindow.close();
        }

        let mouse = robot.getMousePos();
        robot.moveMouse(mouse.x + dx, mouse.y + dy);
        mouse = robot.getMousePos();
        moveAndAdjust(mouse.x, mouse.y);
    });

    const sendColor = () => {
        var mouse = robot.getMousePos();
        var hex = robot.getPixelColor(mouse.x, mouse.y);

        var size = 10;

        // XXX: fix the corners of the screen
        // const xPos = clamp(0, screenSize.width, mouse.x - size / 2);
        // const yPos = clamp(0, screenSize.height, mouse.y - size / 2);

        const xPos = mouse.x - size / 2;
        const yPos = mouse.y - size / 2;

        var buff = robot.screen.capture(xPos, yPos, size, size);

        const img = buff.image;

        const arg = {
            img,
            dimension: { width: buff.width, height: buff.height },
            colorName: nearest(hex),
            color: hex,
            backgroundColor: "yellow"
        };

        mainWindow?.webContents?.send("action-update-label", arg);
        moveAndAdjust(mouse.x, mouse.y);
    };
    mainWindow.setPosition(0, -500);
    const loop = () => {
        sendColor();
        if (appIsAlive) {
            setTimeout(loop, 15);
        }
    };
    loop();

    // Open the DevTools.
    // mainWindow.webContents.openDevTools();

    mainWindow.on("blur", function () {
        // appIsAlive = false;
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

const createTray = () => { 
    

        let tray = new Tray("./assets/iconTemplate.png");
        // tray.setContextMenu(contextMenu);
        // const contextMenu = Menu.buildFromTemplate([
        //     { label: "Item1", type: "radio" },
        //     { label: "Item2", type: "radio" },
        //     { label: "Item3", type: "radio", checked: true },
        //     { label: "Item4", type: "radio" }
        // ]);
        tray.setToolTip("piccpick");
        tray.on('click', createWindow);
        
    
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(
   createTray
    
)//.then(createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});
