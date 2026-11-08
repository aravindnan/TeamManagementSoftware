# ---- dependencies (production only) ----
FROM node:25-alpine AS deps
# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json package-lock.json ./
# The schema must be present: `npm ci` runs `prisma generate` (postinstall).
COPY prisma ./prisma
RUN npm ci --omit=dev

# ---- runtime ----
FROM node:25-alpine
RUN apk add --no-cache openssl
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Never run as root inside the container.
USER node
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8000/healthz || exit 1
# Apply pending migrations, then start. `exec` keeps node as PID 1 so it receives SIGTERM.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && exec node server.js"]
