// server.ts

import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { router } from "./src/backend/api/routes.ts";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON and URL-encoded parsers for handling API bodies
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));
  app.use(cookieParser());

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
