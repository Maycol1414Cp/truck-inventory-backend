import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Conexión y Pool de Base de Datos
import pool from './config/database.js';

// Rutas de Módulos (v1)
import catalogRoutes from './modules/catalog/routes/catalog.routes.js';
import inventoryRoutes from './modules/inventory/routes/inventory.routes.js';
import posRoutes from './modules/pos/routes/pos.routes.js';
import vehicleRoutes from './modules/compatibility/routes/vehicle.routes.js';
import analyticsRoutes from './modules/analytics/routes/analytics.routes.js';

// Documentación de API con Scalar (OpenAPI 3.1)
import { apiReference } from '@scalar/express-api-reference';
import { openApiSpec } from './docs/openapi.js';

// Middleware Central de Errores
import { errorHandler } from './common/errors/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// =========================================================================
// MIDDLEWARES GLOBALES
// =========================================================================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos subidos (imágenes procesadas WebP y thumbnails)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =========================================================================
// HEALTH-CHECK
// =========================================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'HEALTHY',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    }
  });
});

// =========================================================================
// DOCUMENTACIÓN INTERACTIVA CON SCALAR (/docs y /reference)
// =========================================================================
app.get('/openapi.json', (req, res) => {
  res.status(200).json(openApiSpec);
});

const scalarMiddleware = apiReference({
  spec: {
    content: openApiSpec
  },
  theme: 'purple',
  pageTitle: 'Truck Parts ERP & POS - Scalar API Reference'
});

app.use('/docs', scalarMiddleware);
app.use('/reference', scalarMiddleware);

// =========================================================================
// MONTAJE DE RUTAS REST API (/api/v1)
// =========================================================================
app.use('/api/v1/catalog', catalogRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/pos', posRoutes);
app.use('/api/v1/vehicles', vehicleRoutes);
app.use('/api/v1/analytics', analyticsRoutes);

// Manejo de rutas no encontradas (404)
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `La ruta ${req.method} ${req.originalUrl} no existe en el servidor.`,
      details: []
    }
  });
});

// =========================================================================
// MIDDLEWARE GLOBAL DE MANEJO DE ERRORES (Express 5)
// =========================================================================
app.use(errorHandler);

// Iniciar servidor solo si no es importado por pruebas
const PORT = parseInt((process.env.PORT || '3000').toString().trim(), 10);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor Express 5 escuchando en el puerto ${PORT}`);
    console.log(`📡 Base de datos conectada en ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
  });
}

export default app;