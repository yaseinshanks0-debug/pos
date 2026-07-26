// Camera and device management logic

let selectedDeviceId;
let codeReader;

document.addEventListener('DOMContentLoaded', async () => {
    // We expect ZXing to be loaded globally from the script tag
    if (typeof ZXing !== 'undefined') {
        // Create reader supporting all 1D and 2D formats (EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, QR Code)
        codeReader = new ZXing.BrowserMultiFormatReader();
        await initializeCameras();
    } else {
        console.error("ZXing library not found.");
        document.getElementById('status').innerText = "Error: ZXing not loaded.";
        document.getElementById('status').style.color = "red";
    }
});

async function initializeCameras() {
    const select = document.getElementById('camera-select');
    try {
        const videoInputDevices = await codeReader.listVideoInputDevices();

        select.innerHTML = '';

        if (videoInputDevices.length === 0) {
            const option = document.createElement('option');
            option.text = "No camera found";
            select.appendChild(option);
            return;
        }

        videoInputDevices.forEach((element) => {
            const option = document.createElement('option');
            option.text = element.label || `Camera ${select.length + 1}`;
            option.value = element.deviceId;
            select.appendChild(option);
        });

        selectedDeviceId = videoInputDevices[0].deviceId;

        select.addEventListener('change', (e) => {
            selectedDeviceId = e.target.value;
            // If scanner is running, restart it with new camera
            if (isScanning) {
                stopScanning();
                setTimeout(() => startScanning(), 500);
            }
        });

    } catch (err) {
        console.error("Error listing devices", err);
        select.innerHTML = '<option>Error loading cameras</option>';
    }
}
