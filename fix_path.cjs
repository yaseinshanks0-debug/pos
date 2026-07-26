const fs = require('fs');
const path = require('path');

const indexHtmlPath = path.join(__dirname, 'barcode-camera-scanner/src/renderer/index.html');
let content = fs.readFileSync(indexHtmlPath, 'utf8');

// Also need the base library for BrowserMultiFormatReader to work properly in the browser namespace
content = content.replace(
    '<script src="../../node_modules/@zxing/browser/umd/zxing-browser.min.js"></script>',
    '<script src="../../node_modules/@zxing/library/umd/index.min.js"></script>\n    <script src="../../node_modules/@zxing/browser/umd/zxing-browser.min.js"></script>'
);
fs.writeFileSync(indexHtmlPath, content);
