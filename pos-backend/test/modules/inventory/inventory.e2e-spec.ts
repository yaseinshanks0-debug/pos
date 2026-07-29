import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
const request = require('supertest');
import { InventoryModule } from '../../../src/modules/inventory/inventory.module';
import { IWarehouseRepository, ICostLayerRepository, IInventoryLedgerRepository } from '../../../src/modules/inventory/domain/repositories/inventory.repository.interface';
import { randomUUID } from 'crypto';
import { CostLayer } from '../../../src/modules/inventory/domain/entities/cost-layer.entity';
import { Quantity } from '../../../src/modules/inventory/domain/value-objects/quantity.vo';
import { Money } from '../../../src/modules/products/domain/value-objects/money.vo';

describe('InventoryController (e2e)', () => {
  let app: INestApplication;

  let mockCostLayerRepo = {
    save: jest.fn(),
    findOpenLayersForProduct: jest.fn().mockResolvedValue([
      new CostLayer(randomUUID(), 'prod1', 'wh1', new Quantity(10), new Quantity(10), new Money(10), new Date(), 'OPEN')
    ]),
    update: jest.fn(),
  };

  let mockLedgerRepo = {
    save: jest.fn(),
    calculateStockOnHand: jest.fn().mockResolvedValue(100),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [InventoryModule],
    })
      .overrideProvider(ICostLayerRepository)
      .useValue(mockCostLayerRepo)
      .overrideProvider(IInventoryLedgerRepository)
      .useValue(mockLedgerRepo)
      .overrideProvider(IWarehouseRepository)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/inventory/receive (POST) should receive stock', () => {
    return request(app.getHttpServer())
      .post('/inventory/receive')
      .send({
        productId: randomUUID(),
        warehouseId: randomUUID(),
        quantity: 50,
        unitCost: 10.5
      })
      .expect(201)
      .expect((res: any) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('/inventory/consume (POST) should consume stock', () => {
    return request(app.getHttpServer())
      .post('/inventory/consume')
      .send({
        productId: randomUUID(),
        warehouseId: randomUUID(),
        quantity: 5,
        movementType: 'SALE'
      })
      .expect(201)
      .expect((res: any) => {
        expect(res.body.success).toBe(true);
      });
  });

  it('/inventory/availability/:whId/:prodId (GET) should return stock', () => {
    return request(app.getHttpServer())
      .get(`/inventory/availability/wh1/prod1`)
      .expect(200)
      .expect((res: any) => {
        expect(res.body.onHand).toBe(100);
      });
  });
});
