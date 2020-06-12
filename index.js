const camelCase = require('camelcase');
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

let lastX = 0;
let lastY = 0;

let colorHexs = [];

let shiftIsDown = false;


let mainWindow;

let appIsAlive = true;
const DIMENSION = 250;
try {
    let mouse = robot.getMousePos();
    robot.screen.capture(0, 0, 1, 1);
    robot.moveMouse(mouse.x, mouse.y);
} catch (e) {}

const screenSizes = robot.getAllScreensSize();

console.log(screenSizes);

const clamp = (min, max, n) => (n > min ? (n > max ? max : n) : min);

const createWindow = () => {
    appIsAlive = true;

    let backdropWindows = screenSizes.map((dim) => new BrowserWindow({
        width: dim.width,
        height: dim.height,
        transparent: true,
        frame: false,
        modal: true,
        show: true
    }));


    mainWindow = new BrowserWindow({
        webPreferences: {
            preload: path.resolve(__dirname, "preload.js")
        },
        width: DIMENSION,
        height: DIMENSION,
        transparent: true,
        frame: false,
        modal: true,
        show: false
    });
    mainWindow.loadFile(`./trans.html`);

    mainWindow.setPosition(200, 500);
    mainWindow.on("ready-to-show", () => {
        mainWindow.show();
        const loop = () => {
            sendColor();
            if (appIsAlive) {
                setTimeout(loop, 15);
            }
        };
        loop();
    })

    // Open the DevTools.["6a9955","dcdcaa"]
    // mainWindow.webContents.openDevTools();

    mainWindow.on("blur", function () {
        // appIsAlive = false;
        console.log('blur')
        
        const mouse = robot.getMousePos();
        const colorHex = robot.getPixelColor(mouse.x, mouse.y);
        
        if (shiftIsDown) {
            if (colorHexs.indexOf(colorHex) === -1) {
                colorHexs.push(colorHex);
            }
            mainWindow.focus();
        } else {
            if (colorHexs.length > 1) {
                if (colorHex != "") {
                    colorHexs.push(colorHex);
                }
                const colorsArr = JSON.stringify(colorHexs.map(hex => `#${hex}`));
                const colorsObj = colorHexs.map(hex => `    ${camelCase(nearest(hex).name)}: #${hex}`).join(`,
`);
                const output = `
let colorsArr = ${colorsArr};
let namedColors = {
${colorsObj}
}`;
                clipboardy.writeSync(output);
                colorHexs = [];
            } else if (colorHex != "") {
                clipboardy.writeSync(`#${colorHex}`);
            }
            if (mainWindow) {
                mainWindow.close();
            }
        }
    });

    // Emitted when the window is closed.
    mainWindow.on("closed", function () {

        appIsAlive = false;
        backdropWindows.map(w => w.close());
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
};

const sendColor = () => {
    var mouse = robot.getMousePos();
    if (mouse.x === lastX && mouse.y === lastY) {
        return;
    }
    
    lastX = mouse.x;
    lastY = mouse.y;
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
        colorHexs,
        backgroundColor: "yellow"
    };
    console.log(shiftIsDown, colorHexs);

    mainWindow?.webContents?.send("action-update-label", arg);
    moveAndAdjust(mouse.x, mouse.y);
};

const isWithin = (x, min, max) =>  x >= min && x < max;


const moveAndAdjust = (x, y) => {
    // const finalX = clamp(0, screenSize.width - 200, x - DIMENSION / 2);
    let finalX = x;
    let finalY = Math.round(y - DIMENSION * 1.15);
    // console.log(x,y)
    // mainWindow?.setPosition(finalX, y - DIMENSION / 2 + 150);
    
    const mainDisplay = screenSizes.filter(d => d.isMainDisplay)[0];

    // if (
    //     isWithin(x, 0, mainDisplay.width) &&
    //     isWithin(y, 0, mainDisplay.height)) {
    //     console.log('main');
    // }
    screenSizes.forEach(size => {
        const [minx, maxx, miny, maxy] = [size.x, size.width + size.x, size.y, size.height + size.y];
        // console.log(x, minx, maxx, isWithin(x, minx, maxx));
        // console.log(y, miny, maxy, isWithin(y, miny, maxy));
        if (isWithin(x, minx, maxx) && isWithin(y,miny, maxy) ) {   
            // console.log(size.displayID);

            if (isWithin(x, maxx - DIMENSION * 1.2, maxx)) { 
                finalX = x - DIMENSION;
            }
            if (isWithin(y, miny, miny + DIMENSION * 1.2)) { 
                finalY = y + DIMENSION * 0.2;
            }

        }
    });

    /// XXX redo the border logic
    // if (y > screenSize.height / 2) {
        mainWindow?.setPosition(finalX, finalY);
    // } else {
        // mainWindow?.setPosition(finalX, y - DIMENSION / 2 + 150);
    // }
};

ipcMain.on("up", function (event, keyPress) {
    
    if (keyPress === 'Shift') { 
        shiftIsDown = false
    }
})

ipcMain.on("down", function (event, keyPress) {
    
    if (keyPress === 'Shift') { 
        shiftIsDown = true
    }

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
        appIsAlive = false;
        if (mainWindow) {
            mainWindow.close();
        }
    }

    let mouse = robot.getMousePos();
    robot.moveMouse(mouse.x + dx, mouse.y + dy);
    mouse = robot.getMousePos();
    // console.log('ipc move: adjust')
    moveAndAdjust(mouse.x, mouse.y);
});

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
    tray.on("click", createWindow);
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createTray); //.then(createWindow);

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
