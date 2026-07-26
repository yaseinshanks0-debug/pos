const db = require('../database/index.js');

class ProductService {
    getProductByBarcode(barcode) {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM products WHERE barcode = ?';
            db.get(query, [barcode], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    recordScan(barcode) {
        return new Promise((resolve, reject) => {
            const query = 'INSERT INTO scans (barcode) VALUES (?)';
            db.run(query, [barcode], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, barcode, scanned_at: new Date() });
                }
            });
        });
    }

    getScanHistory() {
        return new Promise((resolve, reject) => {
            const query = 'SELECT * FROM scans ORDER BY scanned_at DESC LIMIT 50';
            db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
}

module.exports = new ProductService();
