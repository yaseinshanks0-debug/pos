const { app } = require('../src/backend/api/index.js');
const request = require('supertest');

describe('Backend API', () => {
    it('should return a product for a valid barcode', async () => {
        const response = await request(app).get('/api/products/barcode/1234567890123');
        expect(response.status).toBe(200);
        expect(response.body.name).toBe('Test Product A');
    });

    it('should return 404 for an invalid barcode', async () => {
        const response = await request(app).get('/api/products/barcode/unknown_barcode');
        expect(response.status).toBe(404);
    });

    it('should record a new scan', async () => {
        const response = await request(app).post('/api/scans').send({ barcode: '999999999' });
        expect(response.status).toBe(201);
        expect(response.body.barcode).toBe('999999999');
    });

    it('should return scan history', async () => {
        const response = await request(app).get('/api/scans');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
    });
});
