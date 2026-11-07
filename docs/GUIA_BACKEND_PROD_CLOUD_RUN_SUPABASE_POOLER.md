# Guía de Configuración a Producción del Backend (`backend-inventario-truck-parts`)
## Google Cloud Run + Supabase PostgreSQL Connection Pooler (Supavisor)

Esta guía documenta paso a paso cómo preparar, contenedorizar y desplegar a **Producción** el backend **Node.js 22 + Express 5 (`backend-inventario-truck-parts`)** en **Google Cloud Run**, conectándolo de forma segura y de alta concurrencia al **Connection Pooler (Supavisor)** de **Supabase PostgreSQL**, y persistiendo las imágenes subidas (`/uploads`) en **Google Cloud Storage**.

---

## 1. Arquitectura de Conexión en Producción

```text
[ App Flutter POS / Móvil ]
            │
            ▼ (HTTPS TLS 1.3)
[ Google Cloud Run (Express 5 + Sharp + Multer) ]
     ├──► Volumen FUSE (/app/uploads) ──► [ Google Cloud Storage Bucket ]
     │
     └──► Pool TCP/TLS (pg) ──► [ Supabase Supavisor Pooler (*.pooler.supabase.com) ]
                                         ├── Puerto 6543 (Transaction Mode — Operación API / POS)
                                         └── Puerto 5432 (Session Mode — Migraciones DDL / Seeds)
```

### ¿Por qué usar el Pooler de Supabase (`*.pooler.supabase.com`) desde Cloud Run?
1. **Compatibilidad IPv4 nativa**: La conexión directa de Supabase (`db.<PROJECT_REF>.supabase.co`) es solo **IPv6** en el plan gratuito, mientras que el egress por defecto de Google Cloud Run sin VPC Connector opera sobre **IPv4**. El host del Pooler (`aws-0-<region>.pooler.supabase.com`) resuelve **IPv4 + IPv6** de forma nativa.
2. **Protección contra picos de contenedores Serverless**: Cloud Run puede escalar de 1 a $N$ instancias bajo carga. El Pooler **Supavisor** multiplexa cientos de conexiones entrantes hacia las conexiones físicas reales de PostgreSQL sin agotar `max_connections`.
3. **Soporte completo para transacciones ACID y `SELECT ... FOR UPDATE`**: El módulo POS (`pos.service.js`) e Inventario (`inventory.service.js`) utilizan transacciones explícitas (`BEGIN` -> `SELECT ... FOR UPDATE` -> `COMMIT`) sobre un único `client = await pool.connect()` con consultas parametrizadas sin nombre (`$1, $2`), lo cual es **100% compatible** tanto con el modo **Transaction (`6543`)** como con el modo **Session (`5432`)** de Supavisor.

---

## 2. Ajuste Requerido en `src/config/database.js` para Supabase Pooler

El archivo actual [`src/config/database.js`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/src/config/database.js) instancia `new Pool(dbConfig)` sin bloque `ssl`. Supabase exige **TLS/SSL** en conexiones remotas de producción.

Actualiza `src/config/database.js` para soportar `DB_SSL=true`, `keepAlive` y `maxUses` óptimos para entornos Serverless (Cloud Run):

```javascript
// src/config/database.js
import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Validación de variables de entorno críticas
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️ [DATABASE WARNING]: Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
}

const isSslEnabled =
  (process.env.DB_SSL || '').trim().toLowerCase() === 'true' ||
  (process.env.DB_HOST || '').includes('supabase.com');

const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').trim(),
  user: (process.env.DB_USER || 'postgres').trim(),
  password: (process.env.DB_PASSWORD || '').trim(),
  database: (process.env.DB_NAME || 'postgres').trim(),
  port: parseInt((process.env.DB_PORT || '5432').trim(), 10),
  max: parseInt((process.env.DB_POOL_MAX || '10').trim(), 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
  keepAlive: true,
  ...(isSslEnabled
    ? {
        ssl: {
          rejectUnauthorized: false, // Requerido por el certificado intermedio de Supavisor Pooler
        },
      }
    : {}),
};

const pool = new Pool(dbConfig);

pool.on('connect', () => {
  // Conexión adquirida del pool
});

pool.on('error', (err) => {
  console.error('❌ [DATABASE ERROR]: Error inesperado en cliente inactivo del pool:', err.message);
});

export default pool;
```

---

## 3. Obtener las Credenciales del Pooler en Supabase

1. Ingresa a [Supabase Dashboard](https://supabase.com/dashboard) y crea tu proyecto (Región recomendada para Bolivia/Sudamérica: **`South America (São Paulo) - sa-east-1`** o **`US East (N. Virginia) - us-east-1`** si tu Cloud Run está en `us-east1`).
2. Haz clic en el botón **Connect** (arriba al centro) o ve a **Project Settings -> Database -> Connection pooling**.
3. Copia los parámetros de **Supavisor Connection Pooler**:

| Parámetro en Supabase Pooler | Variable en Backend (`.env`) | Valor en Producción |
| :--- | :--- | :--- |
| **Host** | `DB_HOST` | `aws-0-sa-east-1.pooler.supabase.com` *(o la región de tu proyecto)* |
| **User** | `DB_USER` | `postgres.<TU_PROJECT_REF>` *(¡Importante!: incluye el `.project_ref`)* |
| **Password** | `DB_PASSWORD` | `<TU_PASSWORD_DE_SUPABASE>` |
| **Database** | `DB_NAME` | `postgres` |
| **Port (Transaction Mode)** | `DB_PORT` | `6543` *(Recomendado en Cloud Run para tráfico HTTP de la API)* |
| **Port (Session Mode)** | `DB_PORT` | `5432` *(Recomendado al ejecutar `pnpm migrate` / `init.sql`)* |
| **Pool Size por instancia** | `DB_POOL_MAX` | `5` *(Con `max-instances=3` en Cloud Run = máx. 15 conexiones totales)* |
| **TLS / SSL** | `DB_SSL` | `true` |

> **Nota crítica sobre `DB_USER` en el Pooler de Supabase**:
> Cuando te conectas a través de `*.pooler.supabase.com`, el usuario **NO** es solo `postgres`, sino **`postgres.<PROJECT_REF>`** (por ejemplo: `postgres.abcdefghijklmnop`). Supavisor utiliza el sufijo `<PROJECT_REF>` para enrutar la conexión al clúster PostgreSQL de tu proyecto.

---

## 4. Migrar el Esquema Maestro (`init.sql`) y Datos hacia Supabase

### Opción A: Ejecutar la migración oficial del Backend (`pnpm migrate`)
Desde tu máquina local dentro de `backend-inventario-truck-parts`, apunta temporalmente al **Puerto `5432` (Session Mode)** del Pooler de Supabase para ejecutar el DDL transaccional:

```bash
cd ../backend-inventario-truck-parts

DB_HOST="aws-0-sa-east-1.pooler.supabase.com" \
DB_PORT="5432" \
DB_USER="postgres.<TU_PROJECT_REF>" \
DB_PASSWORD="<TU_PASSWORD_SUPABASE>" \
DB_NAME="postgres" \
DB_SSL="true" \
pnpm migrate
```

Si deseas poblar los datos semilla iniciales (marcas Volvo, Scania, Freightliner, motores D13/ISX15, transmisión I-Shift, sucursales y repuestos de prueba):

```bash
DB_HOST="aws-0-sa-east-1.pooler.supabase.com" \
DB_PORT="5432" \
DB_USER="postgres.<TU_PROJECT_REF>" \
DB_PASSWORD="<TU_PASSWORD_SUPABASE>" \
DB_NAME="postgres" \
DB_SSL="true" \
pnpm seed
```

### Opción B: Clonar la Base de Datos Actual (con tus repuestos y ventas reales)
Si prefieres llevar exactamente los datos actuales de tu servidor (`35.212.146.205`) hacia Supabase:

```bash
# 1. Exportar backup completo desde la BD actual
PGPASSWORD="<PASS_ACTUAL>" pg_dump \
  -h 35.212.146.205 \
  -p 5432 \
  -U postgres \
  -d inventario_camiones \
  --no-owner --no-acl --clean --if-exists \
  -f backup_truck_parts.sql

# 2. Restaurar en Supabase usando el Pooler en Session Mode (puerto 5432)
PGPASSWORD="<TU_PASSWORD_SUPABASE>" psql \
  "sslmode=require host=aws-0-sa-east-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.<TU_PROJECT_REF>" \
  -f backup_truck_parts.sql
```

---

## 5. Crear `Dockerfile` y `.dockerignore` en el Backend

El backend utiliza **`sharp`** (procesamiento nativo de imágenes a WebP y miniaturas) y **`pnpm`**. La imagen **`node:22-bookworm-slim`** es ideal porque incluye `glibc` compatible con los binarios precompilados de `libvips`/`sharp` sin necesidad de compilar C++ en producción.

### 5.1. Crear `backend-inventario-truck-parts/Dockerfile`
```dockerfile
FROM node:22-bookworm-slim

# Instalar dependencias mínimas del sistema para certificados SSL y sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Habilitar pnpm mediante Corepack (incluido en Node 22)
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copiar manifiestos e instalar solo dependencias de producción
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
```

### 5.2. Crear `backend-inventario-truck-parts/.dockerignore`
```dockerignore
node_modules
.git
.env
uploads/*
test
docs
*.md
```

---

## 6. Configurar Google Cloud Storage para Persistir `/uploads`

Dado que el sistema de archivos local de un contenedor en Cloud Run es efímero (en memoria RAM), montaremos un **Bucket de Google Cloud Storage** sobre `/app/uploads` usando el volumen nativo **Cloud Storage FUSE de Cloud Run Gen2**. Así, `multer` y `sharp` siguen escribiendo en `/app/uploads/items` y `/app/uploads/thumbs` sin tocar ni una sola línea del middleware [`src/common/middlewares/upload.middleware.js`](file:///home/mich/Documents/portafolio/inventario-truck-parts/backend-inventario-truck-parts/src/common/middlewares/upload.middleware.js).

```bash
# 1. Definir variables de tu proyecto GCP
export PROJECT_ID="tu-proyecto-gcp"
export REGION="us-east1" # O southamerica-east1 (São Paulo) para mínima latencia con Supabase sa-east-1
export BUCKET_NAME="truck-parts-uploads-${PROJECT_ID}"

gcloud config set project $PROJECT_ID

# 2. Habilitar las APIs necesarias en GCP
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com

# 3. Crear el bucket de Cloud Storage para las fotos de repuestos
gcloud storage buckets create gs://$BUCKET_NAME \
  --location=$REGION \
  --uniform-bucket-level-access
```

---

## 7. Guardar la Contraseña de Supabase en Google Secret Manager (Recomendado)

Para no exponer `DB_PASSWORD` en texto plano dentro de la configuración del servicio:

```bash
echo -n "<TU_PASSWORD_SUPABASE>" | gcloud secrets create supabase-db-password \
  --replication-policy="automatic" \
  --data-file=-

# Otorgar permiso de lectura del secreto a la cuenta de servicio de Cloud Run
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
gcloud secrets add-iam-policy-binding supabase-db-password \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 8. Desplegar el Backend en Google Cloud Run Conectado al Pooler (`6543`)

Ejecuta este comando dentro del directorio `backend-inventario-truck-parts/`:

```bash
cd ../backend-inventario-truck-parts

gcloud run deploy truck-parts-api \
  --source . \
  --region $REGION \
  --platform managed \
  --execution-environment gen2 \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 \
  --memory 512Mi \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 60s \
  --add-volume=name=uploads-vol,type=cloud-storage,bucket=$BUCKET_NAME \
  --add-volume-mount=volume=uploads-vol,mount-path=/app/uploads \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="DB_HOST=aws-0-sa-east-1.pooler.supabase.com" \
  --set-env-vars="DB_PORT=6543" \
  --set-env-vars="DB_USER=postgres.<TU_PROJECT_REF>" \
  --set-env-vars="DB_NAME=postgres" \
  --set-env-vars="DB_POOL_MAX=5" \
  --set-env-vars="DB_SSL=true" \
  --set-secrets="DB_PASSWORD=supabase-db-password:latest"
```

> **Alternativa rápida sin Secret Manager**:
> Si prefieres pasar la contraseña directamente como variable de entorno en la primera prueba, reemplaza `--set-secrets="DB_PASSWORD=..."` por:
> `--set-env-vars="DB_PASSWORD=<TU_PASSWORD_SUPABASE>"`

### Inicializar las subcarpetas `items/` y `thumbs/` en el Bucket
Cuando Cloud Storage FUSE monta un bucket vacío en `/app/uploads`, asegúrate de que existan los prefijos `items/` y `thumbs/` para que `sharp` pueda guardar las imágenes procesadas:

```bash
# Crear objetos marcador vacíos para garantizar los directorios en GCS FUSE
touch /tmp/.keep
gcloud storage cp /tmp/.keep gs://$BUCKET_NAME/items/.keep
gcloud storage cp /tmp/.keep gs://$BUCKET_NAME/thumbs/.keep
```

---

## 9. Verificación Post-Despliegue (Health Check, Docs y Catálogo)

Una vez finalizado `gcloud run deploy`, la consola te devolverá la URL HTTPS de producción, por ejemplo:
`https://truck-parts-api-123456789.us-east1.run.app`

Verifica que el backend y el Pooler de Supabase respondan correctamente:

```bash
export SERVICE_URL="https://truck-parts-api-123456789.us-east1.run.app"

# 1. Verificar estado de salud del contenedor Express 5
curl -s "$SERVICE_URL/health" | jq .

# 2. Probar consulta real a Supabase Pooler (Listado de Sucursales)
curl -s "$SERVICE_URL/api/v1/inventory/branches" | jq .

# 3. Probar consulta de Catálogo con trigramas (pg_trgm)
curl -s "$SERVICE_URL/api/v1/catalog/items?page=1&limit=5" | jq .

# 4. Abrir la documentación interactiva Scalar OpenAPI 3.1 en el navegador
xdg-open "$SERVICE_URL/docs"
```

---

## 10. Resumen de Parámetros Recomendados (Cheat Sheet)

| Escenario | Host (`DB_HOST`) | Puerto (`DB_PORT`) | Usuario (`DB_USER`) | `DB_POOL_MAX` | `DB_SSL` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cloud Run (Producción API / POS)** | `aws-0-<region>.pooler.supabase.com` | `6543` *(Transaction Mode)* | `postgres.<PROJECT_REF>` | `5` | `true` |
| **Migraciones / Seeds (`pnpm migrate`)** | `aws-0-<region>.pooler.supabase.com` | `5432` *(Session Mode)* | `postgres.<PROJECT_REF>` | `2` | `true` |
| **Desarrollo Local (`localhost`)** | `localhost` | `5432` | `postgres` | `10` | `false` |
