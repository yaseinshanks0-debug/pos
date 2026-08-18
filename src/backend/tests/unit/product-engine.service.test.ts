import { describe, it, expect, vi } from 'vitest';
import { ProductEngineService } from '../../application/services/product-engine.service';
import { mockUow, mockLogger } from '../mocks';

describe('ProductEngineService', () => {
  const service = new ProductEngineService(mockUow as any, mockLogger as any);

  describe('generateMatrix', () => {
    it('should generate variant combinations', async () => {
      const mockVariantRepo = {
        findAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation((v) => Promise.resolve({ id: Math.random(), ...v })),
      };

      mockUow.runInTransaction.mockImplementation(async (callback) => {
        const txUow = {
          getRepository: vi.fn().mockReturnValue(mockVariantRepo)
        };
        return await callback(txUow, {});
      });

      const dto = {
        productId: 1,
        baseSku: 'TEST',
        baseBarcode: '123',
        baseCost: 10,
        baseRetail: 20,
        attributes: [
          { name: 'Color', values: ['Red', 'Blue'] },
          { name: 'Size', values: ['S', 'M'] }
        ]
      };

      const result = await service.generateMatrix(dto as any);
      
      expect(result.length).toBe(4);
      expect(mockVariantRepo.create).toHaveBeenCalledTimes(4);
    });
  });
});
