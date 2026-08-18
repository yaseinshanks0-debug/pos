// src/backend/infrastructure/queue/queue.service.ts

import { Queue, Worker, Job } from "bullmq";
import { ILogger } from "../../application/ports/logger.interface.ts";

export interface IQueueJobPayload {
  type: "SYNC_BATCH" | "REORDER_CALCULATION" | "LEDGER_RECONCILE" | "NOTIFICATION";
  data: Record<string, any>;
}

export class JobQueueService {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private isRedisAvailable = false;

  constructor(private readonly logger?: ILogger) {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        const urlObj = new URL(redisUrl);
        const connection = {
          host: urlObj.hostname || "127.0.0.1",
          port: parseInt(urlObj.port || "6379", 10),
          password: urlObj.password || undefined,
        };

        this.queue = new Queue("enterprise-background-jobs", {
          connection,
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: "exponential",
              delay: 1000,
            },
            removeOnComplete: 100,
            removeOnFail: 500,
          },
        });

        this.isRedisAvailable = true;
        if (this.logger) this.logger.info("BullMQ job queue initialized successfully.");
      } catch (err: any) {
        if (this.logger) this.logger.warn(`BullMQ queue initialization skipped: ${err.message}. Direct execution enabled.`);
      }
    }
  }

  public async addJob(jobName: string, payload: IQueueJobPayload): Promise<void> {
    if (this.queue && this.isRedisAvailable) {
      try {
        await this.queue.add(jobName, payload);
        if (this.logger) this.logger.info(`Queued job '${jobName}' [${payload.type}]`);
        return;
      } catch (err: any) {
        if (this.logger) this.logger.warn(`Failed to enqueue job '${jobName}': ${err.message}. Running synchronously.`);
      }
    }

    // Synchronous execution fallback when no Redis broker is configured
    await this.processJobDirectly(payload);
  }

  private async processJobDirectly(payload: IQueueJobPayload): Promise<void> {
    if (this.logger) this.logger.info(`[Direct Worker] Processing job payload: ${payload.type}`);
    switch (payload.type) {
      case "SYNC_BATCH":
        // Sync batch execution logic
        break;
      case "REORDER_CALCULATION":
        // Periodic stock reorder calculation logic
        break;
      case "LEDGER_RECONCILE":
        // Automated ledger balancing validation
        break;
      case "NOTIFICATION":
        // System alerts or emails
        break;
    }
  }

  public async close(): Promise<void> {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
