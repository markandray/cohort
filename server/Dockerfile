# syntax=docker/dockerfile:1

# ---------- deps: install all dependencies (needed for tsc + prisma generate) ----------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------- build: generate Prisma client, compile TypeScript ----------
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
ENV DATABASE_URL="postgresql://user:password@localhost:5432/placeholder"
RUN npx prisma generate
RUN npm run build
RUN cp src/graphql/schema.graphql dist/graphql/schema.graphql

# ---------- runtime: production-only deps + compiled output ----------
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/index.js"]