// Basic Camera Preview Logic (Phase 1)

let stream = null;
let currentDeviceId = null;

const videoElement = document.getElementById('video');
const cameraSelect = document.getElementById('camera-select');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusIndicator = document.getElementById('status');
const overlay = document.querySelector('.scanner-overlay');

document.addEventListener('DOMContentLoaded', async () => {
    await initializeCameras();
});

async function initializeCameras() {
    try {
        // Request initial permission to enumerate devices properly
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        cameraSelect.innerHTML = '';

        if (videoDevices.length === 0) {
            const option = document.createElement('option');
            option.text = "No camera found";
            cameraSelect.appendChild(option);
            return;
        }

        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.text = device.label || `Camera ${index + 1}`;
            option.value = device.deviceId;
            cameraSelect.appendChild(option);
        });

        currentDeviceId = videoDevices[0].deviceId;

        cameraSelect.addEventListener('change', (e) => {
            currentDeviceId = e.target.value;
            if (stream) {
                stopCamera();
                setTimeout(() => startCamera(), 500);
            }
        });

    } catch (err) {
        console.error("Error listing devices", err);
        cameraSelect.innerHTML = '<option>Error loading cameras</option>';
        updateStatus("Camera access denied", "#fadbd8", "#c0392b");
    }
}

async function startCamera() {
    if (!currentDeviceId) return;

    try {
        const constraints = {
            video: {
                deviceId: { exact: currentDeviceId },
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        videoElement.srcObject = stream;

        startBtn.disabled = true;
        stopBtn.disabled = false;
        overlay.classList.add('active');
        updateStatus("Camera Active", "#e8f8f5", "#16a085");

    } catch (err) {
        console.error("Error starting camera:", err);
        updateStatus("Failed to start camera", "#fadbd8", "#c0392b");
    }
}

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoElement.srcObject = null;
        stream = null;
    }

    startBtn.disabled = false;
    stopBtn.disabled = true;
    overlay.classList.remove('active');
    updateStatus("Camera Stopped", "#f2f3f4", "#7f8c8d");
}

function updateStatus(text, bgColor, textColor) {
    statusIndicator.innerText = text;
    statusIndicator.style.backgroundColor = bgColor;
    statusIndicator.style.color = textColor;
}

startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click', stopCamera);
