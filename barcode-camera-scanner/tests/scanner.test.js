/**
 * @jest-environment jsdom
 */

window.HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());

document.body.innerHTML = `
  <div id="video"></div>
  <select id="camera-select"></select>
  <button id="start-btn"></button>
  <button id="stop-btn"></button>
  <div id="status"></div>
  <div class="scanner-overlay"></div>
  <div id="last-scanned"></div>
  <div id="history-list"></div>
  <audio id="beep"></audio>
  <input type="checkbox" id="wedge-mode-checkbox">
  <div id="wedge-settings" class="disabled"></div>
  <input type="number" id="delay-typing" value="0">
  <input type="number" id="delay-enter" value="0">
`;

const { handleScanResult, DEBOUNCE_TIME } = require('../src/renderer/camera.js');

describe('Scanner Logic', () => {
    let mockTime;

    beforeEach(() => {
        document.getElementById('last-scanned').innerText = '---';
        document.getElementById('history-list').innerHTML = '';

        // Use a unique time for each test so the debounce logic resets properly
        mockTime = new Date().getTime();
        jest.spyOn(global.Date, 'now').mockImplementation(() => mockTime);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('should update DOM when a new barcode is scanned', () => {
        handleScanResult('123456789');
        expect(document.getElementById('last-scanned').innerText).toBe('123456789');
        expect(document.getElementById('history-list').children.length).toBe(1);
    });

    it('should prevent duplicate scans within the debounce time', () => {
        // Need distinct barcode from prev test to pass debounce
        handleScanResult('99999');
        expect(document.getElementById('history-list').children.length).toBe(1);

        // Immediate second scan
        handleScanResult('99999');
        expect(document.getElementById('history-list').children.length).toBe(1);
    });

    it('should allow same barcode scan after debounce time passes', () => {
        handleScanResult('88888');
        expect(document.getElementById('history-list').children.length).toBe(1);

        // Advance mock time
        mockTime += (DEBOUNCE_TIME + 100);

        handleScanResult('88888');
        expect(document.getElementById('history-list').children.length).toBe(2);
    });

    it('should allow different barcodes to be scanned immediately', () => {
        handleScanResult('11111');
        handleScanResult('22222');

        expect(document.getElementById('history-list').children.length).toBe(2);
    });
});
