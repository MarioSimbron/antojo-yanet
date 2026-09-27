FROM node:20-slim

# node:20-slim is Debian Bookworm — has glibc (required by onnxruntime-node) and
# OpenSSL 3.x (required by Prisma). Alpine (musl) cannot run the pre-built
# onnxruntime-node binary.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# Persistent volume mount point for uploaded images
RUN mkdir -p uploads

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
