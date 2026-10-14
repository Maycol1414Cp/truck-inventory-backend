import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSeed() {
  const startTime = Date.now();
  console.log('🌱 [SEED]: Iniciando población de datos demo...');

  const client = await pool.connect();
  try {
    const seedSqlPath = path.join(__dirname, 'seed.sql');
    console.log(`📄 [SEED]: Leyendo archivo de semillas desde: ${seedSqlPath}`);
    const sqlContent = await fs.readFile(seedSqlPath, 'utf-8');

    console.log('⏳ [SEED]: Ejecutando inserciones...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [SEED]: Datos demo insertados exitosamente en ${duration}s.`);

    // Verificación de registros
    const countsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM sucursal) AS sucursales,
        (SELECT COUNT(*) FROM brand) AS marcas,
        (SELECT COUNT(*) FROM truck) AS camiones,
        (SELECT COUNT(*) FROM item) AS repuestos,
        (SELECT COUNT(*) FROM item_oem) AS oems,
        (SELECT COUNT(*) FROM inventario_stock) AS registros_stock,
        (SELECT COUNT(*) FROM inventario_movimiento) AS kardex_asientos,
        (SELECT COUNT(*) FROM v_alertas_reposicion_interna) AS alertas_reposicion_activas;
    `;
    const { rows: [counts] } = await client.query(countsQuery);
    console.log('📊 [SEED]: Resumen de datos cargados:');
    console.log(`   - Sucursales: ${counts.sucursales}`);
    console.log(`   - Marcas: ${counts.marcas}`);
    console.log(`   - Camiones: ${counts.camiones}`);
    console.log(`   - Repuestos: ${counts.repuestos}`);
    console.log(`   - Códigos OEM: ${counts.oems}`);
    console.log(`   - Ubicaciones de Stock: ${counts.registros_stock}`);
    console.log(`   - Asientos de Kardex: ${counts.kardex_asientos}`);
    console.log(`   🚨 Alertas activas Tienda vs Depósito detectadas: ${counts.alertas_reposicion_activas}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [SEED ERROR]: Falló la carga de datos demo:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
    console.log('🔌 [SEED]: Pool de conexiones cerrado.');
  }
}

runSeed();
