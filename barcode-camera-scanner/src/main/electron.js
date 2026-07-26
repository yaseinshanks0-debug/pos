const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('../backend/api/index.js');

let mainWindow;
let apiServer;

async function createWindow() {
    // Start backend API first
    try {
        apiServer = await startServer(3000);
    } catch (err) {
        console.error('Failed to start API server:', err);
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false // Keeping this false for this demo's simplicity, but note that contextBridge is needed for full production security
        },
        title: "Barcode Camera Scanner POS"
    });

    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Open DevTools in development
    // mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

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

app.on('quit', () => {
    if (apiServer) {
        apiServer.close();
    }
});
