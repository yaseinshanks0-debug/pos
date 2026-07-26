const express = require('express');
const cors = require('cors');
const productService = require('../services/productService');

const app = express();

app.use(cors());
app.use(express.json());

// API: Get Product by Barcode
app.get('/api/products/barcode/:barcode', async (req, res) => {
    try {
        const product = await productService.getProductByBarcode(req.params.barcode);
        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ error: 'Product not found' });
        }
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Record a Scan
app.post('/api/scans', async (req, res) => {
    try {
        const { barcode } = req.body;
        if (!barcode) {
            return res.status(400).json({ error: 'Barcode is required' });
        }

        const scan = await productService.recordScan(barcode);
        res.status(201).json(scan);
    } catch (err) {
        console.error('Error recording scan:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API: Get Scan History
app.get('/api/scans', async (req, res) => {
    try {
        const history = await productService.getScanHistory();
        res.json(history);
    } catch (err) {
        console.error('Error fetching scan history:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

function startServer(port = 3000) {
    return new Promise((resolve, reject) => {
        const server = app.listen(port, () => {
            console.log(`Backend API server running on port ${port}`);
            resolve(server);
        }).on('error', (err) => {
            reject(err);
        });
    });
}

module.exports = { app, startServer };
