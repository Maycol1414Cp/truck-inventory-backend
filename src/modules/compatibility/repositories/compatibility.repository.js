import pool from '../../../config/database.js';

export const compatibilityRepository = {
  /**
   * Vincula un repuesto a un modelo de camión.
   * Si ya existe la relación, actualiza la nota de posición (idempotente).
   */
  async linkItemToTruck(idItem, idTruck, positionNote = null) {
    const sql = `
      INSERT INTO item_truck_compatibility (id_item, id_truck, position_note)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_item, id_truck) 
      DO UPDATE SET position_note = EXCLUDED.position_note
      RETURNING *;
    `;
    const result = await pool.query(sql, [idItem, idTruck, positionNote ? positionNote.trim() : null]);
    return result.rows[0];
  },

  /**
   * Desvincula un repuesto de un modelo de camión.
   */
  async unlinkItemFromTruck(idItem, idTruck) {
    const sql = `
      DELETE FROM item_truck_compatibility
      WHERE id_item = $1 AND id_truck = $2
      RETURNING *;
    `;
    const result = await pool.query(sql, [idItem, idTruck]);
    return result.rows[0] || null;
  },

  /**
   * BÚSQUEDA INVERSA: Lista repuestos compatibles con un camión específico.
   */
  async findItemsByTruck(idTruck, { search = '', page = 1, limit = 20 } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const conditions = ['c.id_truck = $1'];
    const params = [idTruck];
    let paramIndex = 2;

    if (search && search.trim() !== '') {
      conditions.push(`(
        i.item_name ILIKE $${paramIndex} OR 
        i.sku ILIKE $${paramIndex} OR 
        c.position_note ILIKE $${paramIndex}
      )`);
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Conteo total
    const countSql = `
      SELECT COUNT(*) AS total
      FROM item_truck_compatibility c
      JOIN item i ON c.id_item = i.id_item
      ${whereClause};
    `;
    const countResult = await pool.query(countSql, params);
    const total = parseInt(countResult.rows[0].total, 10);

    // Consulta de repuestos con datos de marca y existencias resumidas
    const dataSql = `
      SELECT 
        i.id_item,
        i.item_name,
        i.sku,
        b.brand_name,
        i.price,
        i.cost,
        c.position_note,
        (
          SELECT io.oem_code 
          FROM item_oem io 
          WHERE io.id_item = i.id_item AND io.is_main = TRUE 
          LIMIT 1
        ) AS main_oem_code,
        COALESCE(
          (SELECT SUM(st.cantidad) FROM inventario_stock st WHERE st.id_item = i.id_item AND st.tipo_almacen = 'TIENDA'), 0
        ) AS total_stock_tienda,
        COALESCE(
          (SELECT SUM(sd.cantidad) FROM inventario_stock sd WHERE sd.id_item = i.id_item AND sd.tipo_almacen = 'DEPOSITO'), 0
        ) AS total_stock_deposito
      FROM item_truck_compatibility c
      JOIN item i ON c.id_item = i.id_item
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${whereClause}
      ORDER BY i.item_name ASC
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
   * Consulta camiones compatibles con un repuesto específico.
   */
  async findTrucksByItem(idItem) {
    const sql = `
      SELECT 
        t.id_truck,
        t.truck_brand,
        t.truck_model,
        t.engine_model,
        t.first_year,
        t.last_year,
        c.position_note,
        t.notes
      FROM item_truck_compatibility c
      JOIN truck t ON c.id_truck = t.id_truck
      WHERE c.id_item = $1
      ORDER BY t.truck_brand ASC, t.truck_model ASC;
    `;
    const result = await pool.query(sql, [idItem]);
    return result.rows;
  },

  /**
   * Verifica si existe una relación de compatibilidad.
   */
  async exists(idItem, idTruck) {
    const sql = `SELECT 1 FROM item_truck_compatibility WHERE id_item = $1 AND id_truck = $2;`;
    const result = await pool.query(sql, [idItem, idTruck]);
    return result.rowCount > 0;
  }
};
