import pool from '../../config/database.js';

/**
 * Ejecuta una operación atómica dentro de una transacción PostgreSQL.
 * Gestiona automáticamente el ciclo de vida: BEGIN, COMMIT, ROLLBACK y release.
 * 
 * @param {Function} callback - Función asíncrona que recibe la instancia del cliente transaccional.
 * @returns {Promise<any>} - Retorna el resultado devuelto por el callback si el commit es exitoso.
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
