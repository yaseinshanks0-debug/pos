const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    sendBarcodeWedge: (barcodeData) => ipcRenderer.invoke('wedge-barcode', barcodeData)
});
