// src/backend/infrastructure/logging/logger.ts

import { ILogger } from "../../application/ports/logger.interface.ts";

export class StructuredLogger implements ILogger {
  private formatMeta(meta?: Record<string, any>): string {
    if (!meta || Object.keys(meta).length === 0) return "";
    return ` | META: ${JSON.stringify(meta)}`;
  }

  public info(message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] \x1b[32mINFO\x1b[0m: ${message}${this.formatMeta(meta)}`);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] \x1b[33mWARN\x1b[0m: ${message}${this.formatMeta(meta)}`);
  }

  public error(message: string, error?: any, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    const errorDetails = error ? `\nStack: ${error.stack || error.message || error}` : "";
    console.error(`[${timestamp}] \x1b[31mERROR\x1b[0m: ${message}${this.formatMeta(meta)}${errorDetails}`);
  }

  public debug(message: string, meta?: Record<string, any>): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] \x1b[34mDEBUG\x1b[0m: ${message}${this.formatMeta(meta)}`);
  }
}
