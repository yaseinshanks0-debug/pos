// src/backend/application/services/base.service.ts

import { IRepository } from "../../domain/repository.interface.ts";
import { ILogger } from "../ports/logger.interface.ts";
import { NotFoundException } from "../../domain/exceptions.ts";

export class BaseService<T> {
  constructor(
    protected readonly repository: IRepository<T>,
    protected readonly logger: ILogger,
    protected readonly entityName: string
  ) {}

  public async getById(id: number): Promise<T> {
    this.logger.debug(`Fetching ${this.entityName} with id: ${id}`);
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException(this.entityName, id);
    }
    return entity;
  }

  public async getAll(filters?: Record<string, any>): Promise<T[]> {
    this.logger.debug(`Fetching all ${this.entityName} entries with filters`, filters);
    return this.repository.findAll(filters);
  }

  public async create(data: Partial<T>): Promise<T> {
    this.logger.info(`Creating a new ${this.entityName} record`);
    return this.repository.create(data);
  }

  public async update(id: number, data: Partial<T>): Promise<T> {
    this.logger.info(`Updating ${this.entityName} with id: ${id}`);
    // Check if exists
    await this.getById(id);
    return this.repository.update(id, data);
  }

  public async delete(id: number): Promise<boolean> {
    this.logger.warn(`Deleting ${this.entityName} with id: ${id}`);
    // Check if exists
    await this.getById(id);
    return this.repository.delete(id);
  }
}
