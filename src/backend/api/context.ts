// src/backend/api/context.ts

import { StructuredLogger } from "../infrastructure/logging/logger.ts";
import { DrizzleUnitOfWork } from "../infrastructure/persistence/unit-of-work.ts";

export const logger = new StructuredLogger();
export const uow = new DrizzleUnitOfWork();
