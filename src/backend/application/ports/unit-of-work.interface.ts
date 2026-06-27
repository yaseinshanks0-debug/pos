// src/backend/application/ports/unit-of-work.interface.ts

import { IRepository } from "../../domain/repository.interface.ts";

export interface IUnitOfWork {
  getRepository<T>(entityName: string, tx?: any): IRepository<T>;
  runInTransaction<TResult>(
    callback: (uow: IUnitOfWork, tx: any) => Promise<TResult>
  ): Promise<TResult>;
}
