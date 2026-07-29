import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { PricingModule } from '../../../src/modules/pricing/pricing.module';
import { IStorePriceRepository, IPromotionRepository } from '../../../src/modules/pricing/domain/repositories/pricing.repository.interface';
import { IProductRepository } from '../../../src/modules/products/domain/repositories/product.repository.interface';
import { randomUUID } from 'crypto';
import { Product, ProductPrice } from '../../../src/modules/products/domain/entities/product.entity';
import { Money } from '../../../src/modules/products/domain/value-objects/money.vo';
import { StorePrice } from '../../../src/modules/pricing/domain/entities/price.entity';

describe('PricingController (e2e)', () => {
  let app: INestApplication;

  const mockProduct = Product.create('prod1', 'Test', 'SKU', null, null, 'EA', true);
  mockProduct.addPrice(new ProductPrice('price1', new Money(100), 'RETAIL'));

  let mockProductRepo = {
    findById: jest.fn().mockResolvedValue(mockProduct),
    save: jest.fn(),
  };

  let mockStorePriceRepo = {
    findActiveByProductAndStore: jest.fn().mockResolvedValue(new StorePrice('1', 'prod1', 'store1', 'lvl1', new Money(90), new Date(), null)),
    save: jest.fn(),
  };

  let mockPromoRepo = {
    findActivePromotionsForProduct: jest.fn().mockResolvedValue([]),
    save: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PricingModule],
    })
      .overrideProvider(IProductRepository)
      .useValue(mockProductRepo)
      .overrideProvider(IStorePriceRepository)
      .useValue(mockStorePriceRepo)
      .overrideProvider(IPromotionRepository)
      .useValue(mockPromoRepo)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/pricing/store-price (POST) should set store price', () => {
    return request(app.getHttpServer())
      .post('/pricing/store-price')
      .send({
        productId: randomUUID(),
        storeId: randomUUID(),
        priceLevelId: randomUUID(),
        priceAmount: 85.99
      })
      .expect(201)
      .expect((res: any) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('/pricing/promotion (POST) should create promotion', () => {
    return request(app.getHttpServer())
      .post('/pricing/promotion')
      .send({
        name: 'Promo',
        type: 'PERCENTAGE',
        value: 15,
        startDate: '2021-01-01T00:00:00Z',
        endDate: '2021-12-31T00:00:00Z',
        productIds: [randomUUID()],
      })
      .expect(201)
      .expect((res: any) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('/pricing/calculate (GET) should calculate final price', () => {
    return request(app.getHttpServer())
      .get('/pricing/calculate?productId=prod1&storeId=store1&priceLevelId=lvl1')
      .expect(200)
      .expect((res: any) => {
        expect(res.body.finalAmount).toBe(90); // The overridden price we mocked
      });
  });
});
