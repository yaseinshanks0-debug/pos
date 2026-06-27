// src/backend/application/ports/logger.interface.ts

export interface ILogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, error?: any, meta?: Record<string, any>): void;
  debug(message: string, meta?: Record<string, any>): void;
}
