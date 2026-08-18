# Multi-Stage Production Dockerfile

# ==========================================
# Stage 1: Build Dependencies & Compile
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Install npm dependencies
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source files
COPY tsconfig.json vite.config.ts index.html server.ts ./
COPY src/ ./src/
COPY metadata.json ./

# Build frontend and compile backend bundle
ENV NODE_ENV=production
RUN npm run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

# Install security updates and curl for healthchecks
RUN apk add --no-cache curl dumb-init

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy runtime files and compiled assets
COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/metadata.json ./

# Set ownership
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose server port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/healthz || exit 1

# Launch production server via dumb-init for proper signal handling
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "dist/server.cjs"]
