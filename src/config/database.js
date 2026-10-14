import 'dotenv/config';
import pkg from 'pg';
const { Pool } = pkg;

// Validación de variables de entorno críticas
const requiredEnvVars = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PORT'];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`⚠️ [DATABASE WARNING]: Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
}

const dbConfig = {
  host: (process.env.DB_HOST || 'localhost').trim(),
  user: (process.env.DB_USER || 'postgres').trim(),
  password: (process.env.DB_PASSWORD || '').trim(),
  database: (process.env.DB_NAME || 'inventario_camiones').trim(),
  port: parseInt((process.env.DB_PORT || '5432').trim(), 10),
  max: parseInt((process.env.DB_POOL_MAX || '10').trim(), 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 20000,
};

const pool = new Pool(dbConfig);

// Listeners del ciclo de vida del Pool
pool.on('connect', (client) => {
  // Conexión adquirida
});

pool.on('error', (err) => {
  console.error('❌ [DATABASE ERROR]: Error inesperado en cliente inactivo del pool:', err.message);
});

export default pool;