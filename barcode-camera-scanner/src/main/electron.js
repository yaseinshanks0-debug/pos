const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { keyboard, Key } = require('@nut-tree-fork/nut-js');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        title: "Barcode Camera Scanner POS"
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', () => {
    createWindow();

    // Check for updates in production
    if (app.isPackaged) {
        autoUpdater.checkForUpdatesAndNotify();
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// IPC handler for keyboard wedge simulation
ipcMain.handle('wedge-barcode', async (event, { barcode, delayBeforeType, delayBeforeEnter }) => {
    try {
        // We delay typing if configured
        if (delayBeforeType > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBeforeType));
        }

        // Configure nut-js keyboard typing delay (very fast)
        keyboard.config.autoDelayMs = 5;

        // Type the barcode as a string
        await keyboard.type(barcode);

        // Delay before pressing enter if configured
        if (delayBeforeEnter > 0) {
            await new Promise(resolve => setTimeout(resolve, delayBeforeEnter));
        }

        // Press Enter
        await keyboard.type(Key.Enter);
        return true;
    } catch (err) {
        console.error("Failed to type barcode via wedge:", err);
    }
});
