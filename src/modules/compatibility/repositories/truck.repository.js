import pool from '../../../config/database.js';

export const truckRepository = {
  /**
   * Obtiene lista paginada de camiones con filtros opcionales.
   */
  async findAll({ search = '', brand = '', engine = '', page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (search && search.trim() !== '') {
      conditions.push(`(
        truck_brand ILIKE $${paramIndex} OR 
        truck_model ILIKE $${paramIndex} OR 
        engine_model ILIKE $${paramIndex}
      )`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    if (brand && brand.trim() !== '') {
      conditions.push(`LOWER(truck_brand) = LOWER($${paramIndex})`);
      params.push(brand.trim());
      paramIndex++;
    }

    if (engine && engine.trim() !== '') {
      conditions.push(`engine_model ILIKE $${paramIndex}`);
      params.push(`%${engine.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Consulta de conteo total
    const countSql = `SELECT COUNT(*) AS total FROM truck ${whereClause};`;
    const countResult = await pool.query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Consulta paginada
    const dataSql = `
      SELECT 
        id_truck,
        truck_brand,
        truck_model,
        engine_model,
        first_year,
        last_year,
        notes
      FROM truck
      ${whereClause}
      ORDER BY truck_brand ASC, truck_model ASC, first_year DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const dataParams = [...params, limitNum, offset];
    const dataResult = await pool.query(dataSql, dataParams);

    return {
      rows: dataResult.rows,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    };
  },

  /**
   * Busca camión por ID.
   */
  async findById(idTruck) {
    const sql = `
      SELECT 
        id_truck,
        truck_brand,
        truck_model,
        engine_model,
        first_year,
        last_year,
        notes
      FROM truck
      WHERE id_truck = $1;
    `;
    const result = await pool.query(sql, [idTruck]);
    return result.rows[0] || null;
  },

  /**
   * Busca si ya existe un modelo con la misma marca, modelo, motorización y años.
   */
  async findExact(truckBrand, truckModel, engineModel, firstYear) {
    const sql = `
      SELECT id_truck 
      FROM truck 
      WHERE LOWER(truck_brand) = LOWER($1)
        AND LOWER(truck_model) = LOWER($2)
        AND LOWER(COALESCE(engine_model, '')) = LOWER(COALESCE($3, ''))
        AND first_year = $4;
    `;
    const result = await pool.query(sql, [truckBrand, truckModel, engineModel, firstYear]);
    return result.rows[0] || null;
  },

  /**
   * Inserta un nuevo registro de camión.
   */
  async create({ truckBrand, truckModel, engineModel, firstYear, lastYear, notes }) {
    const sql = `
      INSERT INTO truck (truck_brand, truck_model, engine_model, first_year, last_year, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await pool.query(sql, [
      truckBrand.trim(),
      truckModel.trim(),
      engineModel ? engineModel.trim() : null,
      firstYear,
      lastYear || null,
      notes ? notes.trim() : null
    ]);
    return result.rows[0];
  },

  /**
   * Actualiza los datos de un camión.
   */
  async update(idTruck, { truckBrand, truckModel, engineModel, firstYear, lastYear, notes }) {
    const sql = `
      UPDATE truck
      SET 
        truck_brand = COALESCE($1, truck_brand),
        truck_model = COALESCE($2, truck_model),
        engine_model = COALESCE($3, engine_model),
        first_year = COALESCE($4, first_year),
        last_year = COALESCE($5, last_year),
        notes = COALESCE($6, notes)
      WHERE id_truck = $7
      RETURNING *;
    `;
    const result = await pool.query(sql, [
      truckBrand !== undefined ? truckBrand.trim() : null,
      truckModel !== undefined ? truckModel.trim() : null,
      engineModel !== undefined ? (engineModel ? engineModel.trim() : null) : null,
      firstYear !== undefined ? firstYear : null,
      lastYear !== undefined ? lastYear : null,
      notes !== undefined ? (notes ? notes.trim() : null) : null,
      idTruck
    ]);
    return result.rows[0] || null;
  },

  /**
   * Elimina un camión (sus compatibilidades asociadas se eliminan en cascada por DDL).
   */
  async delete(idTruck) {
    const sql = `DELETE FROM truck WHERE id_truck = $1 RETURNING *;`;
    const result = await pool.query(sql, [idTruck]);
    return result.rows[0] || null;
  },

  /**
   * Lista marcas de camiones distintas.
   */
  async getDistinctBrands() {
    const sql = `
      SELECT DISTINCT truck_brand 
      FROM truck 
      ORDER BY truck_brand ASC;
    `;
    const result = await pool.query(sql);
    return result.rows.map(r => r.truck_brand);
  }
};
