import { Brand } from '../entities/brand.entity';

export interface IBrandRepository {
  findById(id: string): Promise<Brand | null>;
  findAll(): Promise<Brand[]>;
  save(brand: Brand): Promise<void>;
  update(brand: Brand): Promise<void>;
}

export const IBrandRepository = Symbol('IBrandRepository');
