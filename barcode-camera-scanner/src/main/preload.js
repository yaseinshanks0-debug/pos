const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendBarcodeWedge: (barcodeData) => ipcRenderer.send('wedge-barcode', barcodeData)
});
