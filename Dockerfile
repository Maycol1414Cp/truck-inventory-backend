FROM node:22-bookworm-slim

# Instalar certificados SSL del sistema para conexiones TLS hacia Supabase Pooler
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Habilitar pnpm mediante Corepack (incluido en Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar manifiestos e instalar únicamente dependencias de producción
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Copiar el código fuente del servidor
COPY src ./src

# Crear estructura de directorios para Multer + Sharp (punto de montaje de Cloud Storage FUSE)
RUN mkdir -p /app/uploads/items /app/uploads/thumbs

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/app.js"]
