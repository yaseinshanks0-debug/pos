import { Category } from '../entities/category.entity';

export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  save(category: Category): Promise<void>;
  update(category: Category): Promise<void>;
}

export const ICategoryRepository = Symbol('ICategoryRepository');
