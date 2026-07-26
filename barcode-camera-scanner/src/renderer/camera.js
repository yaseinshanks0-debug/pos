// Camera and Scanner Logic (Phase 2)

let codeReader;
let selectedDeviceId;
let isScanning = false;
let lastScannedCode = null;
let lastScanTime = 0;
const DEBOUNCE_TIME = 2000;

const videoElement = document.getElementById('video');
const cameraSelect = document.getElementById('camera-select');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusIndicator = document.getElementById('status');
const overlay = document.querySelector('.scanner-overlay');
const lastScannedDisplay = document.getElementById('last-scanned');
const historyListDiv = document.getElementById('history-list');
const beepSound = document.getElementById('beep');

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof ZXing !== 'undefined') {
        // Initialize multi format reader for EAN, UPC, Code128, QR, etc.
        codeReader = new ZXing.BrowserMultiFormatReader();
        await initializeCameras();
    } else {
        updateStatus("Error: ZXing not loaded.", "#fadbd8", "#c0392b");
    }
});

async function initializeCameras() {
    try {
        const videoInputDevices = await codeReader.listVideoInputDevices();

        cameraSelect.innerHTML = '';

        if (videoInputDevices.length === 0) {
            const option = document.createElement('option');
            option.text = "No camera found";
            cameraSelect.appendChild(option);
            return;
        }

        videoInputDevices.forEach((element, index) => {
            const option = document.createElement('option');
            option.text = element.label || "Camera " + (index + 1);
            option.value = element.deviceId;
            cameraSelect.appendChild(option);
        });

        selectedDeviceId = videoInputDevices[0].deviceId;

        cameraSelect.addEventListener('change', (e) => {
            selectedDeviceId = e.target.value;
            if (isScanning) {
                stopScanner();
                setTimeout(() => startScanner(), 500);
            }
        });

    } catch (err) {
        console.error("Error listing devices", err);
        cameraSelect.innerHTML = '<option>Error loading cameras</option>';
        updateStatus("Camera access denied", "#fadbd8", "#c0392b");
    }
}

async function startScanner() {
    if (!selectedDeviceId || !codeReader) return;

    isScanning = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    overlay.classList.add('active');
    updateStatus("Scanner Active", "#e8f8f5", "#16a085");

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
        updateStatus("Failed to start scanner", "#fadbd8", "#c0392b");
        stopScanner();
    }
}

function stopScanner() {
    isScanning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    overlay.classList.remove('active');
    updateStatus("Scanner Stopped", "#f2f3f4", "#7f8c8d");

    if (codeReader) {
        codeReader.reset();
    }
}

function handleScanResult(barcode) {
    const now = Date.now();

    if (barcode === lastScannedCode && (now - lastScanTime) < DEBOUNCE_TIME) {
        return; // debounce
    }

    lastScannedCode = barcode;
    lastScanTime = now;

    // Play sound
    try {
        if(beepSound) {
            beepSound.currentTime = 0;
            beepSound.play().catch(e => console.log('Audio blocked', e));
        }
    } catch(e) {}

    // Flash UI
    updateStatus("Barcode Detected!", "#d5f5e3", "#27ae60");
    setTimeout(() => {
        if (isScanning) updateStatus("Scanner Active", "#e8f8f5", "#16a085");
    }, 500);

    // Update UI
    lastScannedDisplay.innerText = barcode;

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

    if (historyListDiv.children.length > 20) {
        historyListDiv.removeChild(historyListDiv.lastChild);
    }
}

function updateStatus(text, bgColor, textColor) {
    statusIndicator.innerText = text;
    statusIndicator.style.backgroundColor = bgColor;
    statusIndicator.style.color = textColor;
}

startBtn.addEventListener('click', startScanner);
stopBtn.addEventListener('click', stopScanner);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleScanResult, DEBOUNCE_TIME };
}
