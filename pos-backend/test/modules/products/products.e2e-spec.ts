import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
const request = require('supertest');
import { ProductsModule } from '../../../src/modules/products/products.module';
import { IProductRepository } from '../../../src/modules/products/domain/repositories/product.repository.interface';
import { randomUUID } from 'crypto';

describe('ProductsController (e2e)', () => {
  let app: INestApplication;
  let mockProductRepository = {
    save: jest.fn(),
    findBySku: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue({ id: randomUUID(), name: 'Test', sku: 'SKU' }),
    findByBarcode: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ProductsModule],
    })
      .overrideProvider(IProductRepository)
      .useValue(mockProductRepository)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/products (POST) should create a product', () => {
    return request(app.getHttpServer())
      .post('/products')
      .send({
        name: 'E2E Product',
        sku: 'E2E-SKU-1',
        unitOfMeasure: 'EA',
        isTracked: true,
      })
      .expect(201)
      .expect((res) => {
        expect(res.body.id).toBeDefined();
      });
  });

  it('/products (GET) should return list of products', () => {
    return request(app.getHttpServer())
      .get('/products')
      .expect(200)
      .expect([]);
  });

  it('/products/:id (GET) should return a product', () => {
    return request(app.getHttpServer())
      .get(`/products/${randomUUID()}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.name).toEqual('Test');
      });
  });
});
