// Scanner logic, API calls, and UI updates

let isScanning = false;
let lastScannedCode = null;
let lastScanTime = 0;
const DEBOUNCE_TIME = 2000; // Prevent scanning same code within 2 seconds

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusIndicator = document.getElementById('status');
const lastScannedDisplay = document.getElementById('last-scanned');
const productInfoDiv = document.getElementById('product-info');
const historyListDiv = document.getElementById('history-list');
const beepSound = document.getElementById('beep');

startBtn.addEventListener('click', startScanning);
stopBtn.addEventListener('click', stopScanning);

async function startScanning() {
    if (!selectedDeviceId) return;

    isScanning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusIndicator.innerText = "Scanner Active";
    statusIndicator.style.backgroundColor = "#e8f8f5";
    statusIndicator.style.color = "#16a085";

    try {
        await codeReader.decodeFromVideoDevice(selectedDeviceId, 'video', (result, err) => {
            if (result) {
                handleScanResult(result.text);
            }
            if (err && !(err instanceof ZXing.NotFoundException)) {
                console.error("Scanner Error:", err);
            }
        });
    } catch (err) {
        console.error("Failed to start scanner:", err);
        statusIndicator.innerText = "Camera Access Denied/Failed";
        statusIndicator.style.backgroundColor = "#fadbd8";
        statusIndicator.style.color = "#c0392b";
        stopScanning();
    }
}

function stopScanning() {
    isScanning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    statusIndicator.innerText = "Scanner Stopped";
    statusIndicator.style.backgroundColor = "#f2f3f4";
    statusIndicator.style.color = "#7f8c8d";

    if (codeReader) {
        codeReader.reset();
    }
}

async function handleScanResult(barcode) {
    const now = Date.now();
    // Debounce duplicate scans
    if (barcode === lastScannedCode && (now - lastScanTime) < DEBOUNCE_TIME) {
        return;
    }

    lastScannedCode = barcode;
    lastScanTime = now;

    // Play beep
    try {
        if(beepSound) beepSound.play().catch(e => console.log('Audio play prevented by browser', e));
    } catch(e) {}

    // Update UI
    lastScannedDisplay.innerText = barcode;
    addToHistory(barcode);

    // Flash UI green
    statusIndicator.style.backgroundColor = "#d5f5e3";
    setTimeout(() => {
        if (isScanning) statusIndicator.style.backgroundColor = "#e8f8f5";
    }, 500);

    // Fetch product details
    fetchProductDetails(barcode);

    // Record scan to API
    recordScan(barcode);
}

async function fetchProductDetails(barcode) {
    productInfoDiv.innerHTML = '<p class="placeholder-text">Searching product...</p>';
    try {
        const response = await fetch(`http://localhost:3000/api/products/barcode/${barcode}`);
        if (response.ok) {
            const product = await response.json();
            displayProduct(product);
        } else {

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

        }
    } catch (err) {
        console.error('Error fetching product:', err);
        productInfoDiv.innerHTML = '<p class="placeholder-text" style="color:red">Error connecting to server</p>';
    }
}

function displayProduct(product) {
    const stockColor = product.stock_quantity > 10 ? '#27ae60' : (product.stock_quantity > 0 ? '#f39c12' : '#c0392b');

    const table = document.createElement('table');
    table.innerHTML = `
        <tr><th>Name:</th><td><strong id="p-name"></strong></td></tr>
        <tr><th>Category:</th><td id="p-category"></td></tr>
        <tr><th>Price:</th><td id="p-price" style="font-size: 1.2rem; font-weight: bold;"></td></tr>
        <tr><th>Stock:</th><td id="p-stock" style="font-weight: bold;"></td></tr>
    `;
    productInfoDiv.innerHTML = '';
    productInfoDiv.appendChild(table);

    document.getElementById('p-name').textContent = product.name;
    document.getElementById('p-category').textContent = product.category || 'N/A';
    document.getElementById('p-price').textContent = '
}

function addToHistory(barcode) {
    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'history-item';

    const barcodeSpan = document.createElement('span');
    barcodeSpan.className = 'history-barcode';
    barcodeSpan.textContent = barcode;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = time;

    item.appendChild(barcodeSpan);
    item.appendChild(timeSpan);

    historyListDiv.prepend(item);

    // Keep only last 20
    if (historyListDiv.children.length > 20) {
        historyListDiv.removeChild(historyListDiv.lastChild);
    }
}

async function recordScan(barcode) {
    try {
        await fetch('http://localhost:3000/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode })
        });
    } catch (err) {
        console.error('Error recording scan:', err);
    }
}
 + product.price.toFixed(2);
    const pStock = document.getElementById('p-stock');
    pStock.textContent = product.stock_quantity + ' units';
    pStock.style.color = stockColor;

}

function addToHistory(barcode) {
    const time = new Date().toLocaleTimeString();
    const item = document.createElement('div');
    item.className = 'history-item';

    const barcodeSpan = document.createElement('span');
    barcodeSpan.className = 'history-barcode';
    barcodeSpan.textContent = barcode;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = time;

    item.appendChild(barcodeSpan);
    item.appendChild(timeSpan);

    historyListDiv.prepend(item);

    // Keep only last 20
    if (historyListDiv.children.length > 20) {
        historyListDiv.removeChild(historyListDiv.lastChild);
    }
}

async function recordScan(barcode) {
    try {
        await fetch('http://localhost:3000/api/scans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ barcode })
        });
    } catch (err) {
        console.error('Error recording scan:', err);
    }
}
