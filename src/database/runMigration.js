import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  const startTime = Date.now();
  console.log('🚀 [MIGRATION]: Iniciando ejecución del esquema DDL maestro...');

  const client = await pool.connect();
  try {
    const initSqlPath = path.join(__dirname, 'init.sql');
    console.log(`📄 [MIGRATION]: Leyendo archivo DDL desde: ${initSqlPath}`);
    const sqlContent = await fs.readFile(initSqlPath, 'utf-8');

    console.log('⏳ [MIGRATION]: Aplicando sentencias DDL en PostgreSQL...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [MIGRATION]: Esquema maestro aplicado exitosamente en ${duration}s.`);

    // Verificación rápida de tablas creadas
    const checkQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    const { rows: tables } = await client.query(checkQuery);
    console.log(`📊 [MIGRATION]: Tablas presentes en base de datos (${tables.length}):`);
    console.log(tables.map(t => `   - ${t.table_name}`).join('\n'));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [MIGRATION ERROR]: Falló la ejecución del script DDL:', error.message);
    if (error.position) {
      console.error(`   Posición del error en SQL: caracter ${error.position}`);
    }
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    console.log('🔌 [MIGRATION]: Pool de conexiones cerrado.');
  }
}

runMigration();
