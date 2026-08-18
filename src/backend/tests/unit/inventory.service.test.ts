import { describe, it, expect, vi } from 'vitest';
import { InventoryService } from '../../application/services/inventory.service';
import { mockUow, mockLogger } from '../mocks';

describe('InventoryService', () => {
  const service = new InventoryService(mockUow as any, mockLogger as any);

  describe('createProduct', () => {
    it('should create a product', async () => {
      const mockProductRepo = {
        findAll: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: 1, sku: 'TEST' }),
        findById: vi.fn().mockResolvedValue({ id: 1, sku: 'TEST' }),
      };
      
      // Update the mockUow's runInTransaction to provide a mock repository
      mockUow.runInTransaction.mockImplementation(async (callback) => {
        const txUow = {
          getRepository: vi.fn().mockReturnValue(mockProductRepo)
        };
        return await callback(txUow, {});
      });

      const dto = {
        companyId: 1,
        sku: 'TEST',
        barcode: '123',
        name: 'Test Product',
        costPrice: 10,
        retailPrice: 20,
      };

      const result = await service.createProduct(dto as any);
      
      expect(result.id).toBe(1);
      expect(mockProductRepo.create).toHaveBeenCalled();
    });
  });
});
