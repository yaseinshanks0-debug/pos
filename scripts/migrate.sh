#!/bin/bash
set -eo pipefail

echo "[$(date)] Running automated database schema migrations with Drizzle Kit..."

if [ -f "src/db/drizzle.config.ts" ]; then
  npx drizzle-kit push --config=src/db/drizzle.config.ts
else
  echo "[ERROR] src/db/drizzle.config.ts not found."
  exit 1
fi

echo "[$(date)] Schema synchronization completed successfully."
