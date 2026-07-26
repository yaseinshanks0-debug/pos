const fs = require('fs');
const path = require('path');

// 1. Fix Database path for Electron production (userData)
const dbPath = path.join(__dirname, 'barcode-camera-scanner/src/backend/database/index.js');
let dbContent = fs.readFileSync(dbPath, 'utf8');

// Replace __dirname with the correct app user data path logic for Electron
dbContent = dbContent.replace(
    /const dbPath = path\.join\(__dirname, 'scanner\.db'\);/,
    `const { app } = require('electron');\nconst dbPath = path.join(app ? app.getPath('userData') : __dirname, 'scanner.db');`
);
fs.writeFileSync(dbPath, dbContent);


// 2. Fix XSS in scanner.js
const scannerPath = path.join(__dirname, 'barcode-camera-scanner/src/renderer/scanner.js');
let scannerContent = fs.readFileSync(scannerPath, 'utf8');

// Use textContent/innerText or safe DOM methods for dynamic content
scannerContent = scannerContent.replace(
    /item\.innerHTML = `[\s\S]*?<span class="history-barcode">\$\{barcode\}<\/span>[\s\S]*?<span class="history-time">\$\{time\}<\/span>[\s\S]*?`;/,
    `
    const barcodeSpan = document.createElement('span');
    barcodeSpan.className = 'history-barcode';
    barcodeSpan.textContent = barcode;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = time;

    item.appendChild(barcodeSpan);
    item.appendChild(timeSpan);
    `
);

scannerContent = scannerContent.replace(
    /productInfoDiv\.innerHTML = `[\s\S]*?<strong>Product Not Found<\/strong><br>[\s\S]*?Barcode: \$\{barcode\}[\s\S]*?`;/,
    `
    const errorDiv = document.createElement('div');
    errorDiv.style = "color: #e74c3c; padding: 10px; background: #fadbd8; border-radius: 4px;";

    const strongText = document.createElement('strong');
    strongText.textContent = "Product Not Found";

    const br = document.createElement('br');

    const textNode = document.createTextNode("Barcode: " + barcode);

    errorDiv.appendChild(strongText);
    errorDiv.appendChild(br);
    errorDiv.appendChild(textNode);

    productInfoDiv.innerHTML = '';
    productInfoDiv.appendChild(errorDiv);
    `
);

// product display fix
scannerContent = scannerContent.replace(
    /productInfoDiv\.innerHTML = `[\s\S]*?<table>[\s\S]*?<tr><th>Name:<\/th><td><strong>\$\{product\.name\}<\/strong><\/td><\/tr>[\s\S]*?<tr><th>Category:<\/th><td>\$\{product\.category \|\| 'N\/A'\}<\/td><\/tr>[\s\S]*?<tr><th>Price:<\/th><td style="font-size: 1\.2rem; font-weight: bold;">\$\$\{product\.price\.toFixed\(2\)\}<\/td><\/tr>[\s\S]*?<tr><th>Stock:<\/th><td style="color: \$\{stockColor\}; font-weight: bold;">\$\{product\.stock_quantity\} units<\/td><\/tr>[\s\S]*?<\/table>[\s\S]*?`;/,
    `
    const table = document.createElement('table');
    table.innerHTML = \`
        <tr><th>Name:</th><td><strong id="p-name"></strong></td></tr>
        <tr><th>Category:</th><td id="p-category"></td></tr>
        <tr><th>Price:</th><td id="p-price" style="font-size: 1.2rem; font-weight: bold;"></td></tr>
        <tr><th>Stock:</th><td id="p-stock" style="font-weight: bold;"></td></tr>
    \`;
    productInfoDiv.innerHTML = '';
    productInfoDiv.appendChild(table);

    document.getElementById('p-name').textContent = product.name;
    document.getElementById('p-category').textContent = product.category || 'N/A';
    document.getElementById('p-price').textContent = '$' + product.price.toFixed(2);
    const pStock = document.getElementById('p-stock');
    pStock.textContent = product.stock_quantity + ' units';
    pStock.style.color = stockColor;
    `
);

fs.writeFileSync(scannerPath, scannerContent);


// 3. Fix Electron main process configuration for better security
const electronPath = path.join(__dirname, 'barcode-camera-scanner/src/main/electron.js');
let electronContent = fs.readFileSync(electronPath, 'utf8');

electronContent = electronContent.replace(
    /nodeIntegration: true,[\s\S]*?contextIsolation: false,[\s\S]*?enableRemoteModule: true/,
    `nodeIntegration: true,
            contextIsolation: false // Keeping this false for this demo's simplicity, but note that contextBridge is needed for full production security`
);

fs.writeFileSync(electronPath, electronContent);

console.log("Patched successfully!");
