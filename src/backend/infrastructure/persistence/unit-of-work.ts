// src/backend/infrastructure/persistence/unit-of-work.ts

import { db } from "../../../db/index.ts";
import { IUnitOfWork } from "../../application/ports/unit-of-work.interface.ts";
import { IRepository } from "../../domain/repository.interface.ts";
import { 
  DrizzleRepository, 
  DrizzleTransferOrderRepository, 
  DrizzleInventoryRepository, 
  DrizzleGiftCardRepository,
  DrizzleUserRepository
} from "../repositories/drizzle.repository.ts";

export class DrizzleUnitOfWork implements IUnitOfWork {
  constructor(private readonly txContext: any = null) {}

  public getRepository<T>(entityName: string, tx?: any): IRepository<T> {
    const currentTx = tx || this.txContext;
    
    // Return specialized repositories if they exist
    if (entityName === "transferOrders") {
      return new DrizzleTransferOrderRepository(currentTx) as unknown as IRepository<T>;
    }
    if (entityName === "inventory") {
      return new DrizzleInventoryRepository(currentTx) as unknown as IRepository<T>;
    }
    if (entityName === "giftCards") {
      return new DrizzleGiftCardRepository(currentTx) as unknown as IRepository<T>;
    }
    if (entityName === "users") {
      return new DrizzleUserRepository(currentTx) as unknown as IRepository<T>;
    }
    
    // Default to generic repository
    return new DrizzleRepository<T>(entityName, currentTx);
  }

  public async runInTransaction<TResult>(
    callback: (uow: IUnitOfWork, tx: any) => Promise<TResult>
  ): Promise<TResult> {
    // If we are already running inside an active transaction, reuse it
    if (this.txContext) {
      return callback(this, this.txContext);
    }

    // Otherwise, boot a new transaction on the Drizzle pool
    return db.transaction(async (tx) => {
      const transactionalUow = new DrizzleUnitOfWork(tx);
      return callback(transactionalUow, tx);
    });
  }
}
