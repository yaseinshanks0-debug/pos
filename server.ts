// server.ts

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { router } from "./src/backend/api/routes.ts";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import pino from "pino-http";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Security headers configured safely for iframe and Vite development environment
  app.use(
    helmet({
      contentSecurityPolicy: false,
      frameguard: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
    })
  );
  app.use(cors());
  
  // Rate limiting with generous limits for development and operational POS
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000, // limit each IP to 2000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV !== "production",
  });
  app.use("/api/", limiter);

  // Structured Logging (disabled during dev/testing to prevent stdout spam)
  if (process.env.NODE_ENV === "production") {
    app.use(pino());
  }

  // JSON and URL-encoded parsers for handling API bodies
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

  // Health and Metrics endpoints
  app.get("/healthz", (req, res) => res.status(200).json({ status: "healthy", timestamp: new Date().toISOString() }));
  app.get("/readyz", (req, res) => res.status(200).json({ status: "ready", timestamp: new Date().toISOString() }));
  app.get("/metrics", (req, res) => {
    const memory = process.memoryUsage();
    res.status(200).json({
      uptime_seconds: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        rss_mb: Math.round(memory.rss / (1024 * 1024)),
        heapTotal_mb: Math.round(memory.heapTotal / (1024 * 1024)),
        heapUsed_mb: Math.round(memory.heapUsed / (1024 * 1024)),
        external_mb: Math.round(memory.external / (1024 * 1024)),
      },
      node_version: process.version,
    });
  });

  // Mount clean architecture API routes before any static file handlers
  app.use("/api", router);

  // Vite development server middleware setup
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite hot-reload middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode serving static client assets...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[OK] Server listening at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Critical Failure: Back-end failed to bootstrap:", error);
  process.exit(1);
});
