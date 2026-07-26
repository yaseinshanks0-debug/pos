const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const { app } = require('electron');
const dbPath = path.join(app ? app.getPath('userData') : __dirname, 'scanner.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to the database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // Create Products table
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                category TEXT,
                price REAL NOT NULL,
                stock_quantity INTEGER NOT NULL DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Scans table
        db.run(`
            CREATE TABLE IF NOT EXISTS scans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                barcode TEXT NOT NULL,
                scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                synced BOOLEAN DEFAULT 0
            )
        `);

        // Seed some initial products for testing
        db.run(`
            INSERT OR IGNORE INTO products (barcode, name, category, price, stock_quantity)
            VALUES
            ('1234567890123', 'Test Product A', 'Electronics', 19.99, 100),
            ('9876543210987', 'Test Product B', 'Groceries', 5.49, 50),
            ('036000291452', 'Kleenex Tissues', 'Household', 2.99, 200)
        `);
    });
}

module.exports = db;
