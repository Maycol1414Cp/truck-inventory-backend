import pool from '../../../config/database.js';
import { inventoryMapper } from '../mappers/inventory.mapper.js';

export const inventoryRepository = {
  async findByBranch(idSucursal, { tipoAlmacen = null, search = null, page = 1, limit = 50 } = {}, client = pool) {
    const offset = (page - 1) * limit;
    const conditions = ['i.is_active = TRUE'];
    const values = [idSucursal];
    let paramIndex = 2;

    if (tipoAlmacen) {
      const upper = tipoAlmacen.toUpperCase();
      if (upper === 'DEPOSITO') {
        conditions.push(`(st.tipo_almacen = $${paramIndex++} OR st.id_inventario IS NULL)`);
        values.push(upper);
      } else {
        conditions.push(`st.tipo_almacen = $${paramIndex++}`);
        values.push(upper);
      }
    }

    if (search && search.trim()) {
      conditions.push(`(
        i.item_name ILIKE $${paramIndex} 
        OR i.sku ILIKE $${paramIndex}
        OR b.brand_name ILIKE $${paramIndex}
        OR COALESCE(st.pasillo, '') ILIKE $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM item_oem io
          WHERE io.id_item = i.id_item AND io.oem_code ILIKE $${paramIndex}
        )
        OR EXISTS (
          SELECT 1 FROM item_truck_compatibility c
          JOIN truck t ON c.id_truck = t.id_truck
          WHERE c.id_item = i.id_item
            AND (t.truck_brand ILIKE $${paramIndex} OR t.truck_model ILIKE $${paramIndex})
        )
      )`);
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM item i
      LEFT JOIN inventario_stock st ON st.id_item = i.id_item AND st.id_sucursal = $1
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${whereClause};
    `;
    const { rows: [{ total }] = [{ total: 0 }] } = await client.query(countQuery, values);

    const dataQuery = `
      SELECT 
        COALESCE(st.id_inventario, 0) AS id_inventario,
        i.id_item,
        i.item_name,
        i.sku,
        i.price,
        i.cost,
        b.id_brand,
        b.brand_name,
        $1::int AS id_sucursal,
        s.name AS sucursal_nombre,
        COALESCE(st.tipo_almacen, 'DEPOSITO') AS tipo_almacen,
        COALESCE(st.pasillo, 'P-01') AS pasillo,
        COALESCE(st.estante, 'E-02') AS estante,
        COALESCE(st.seccion, 'S-01') AS seccion,
        COALESCE(st.cantidad, 0) AS cantidad,
        COALESCE(st.stock_minimo, 3) AS stock_minimo,
        st.stock_maximo,
        COALESCE(st.updated_at, i.created_at) AS updated_at,
        COALESCE(
          (
            SELECT json_agg(DISTINCT io.oem_code)
            FROM item_oem io
            JOIN item i_sib ON io.id_item = i_sib.id_item
            WHERE io.id_item = i.id_item
               OR LOWER(TRIM(i_sib.item_name)) = LOWER(TRIM(i.item_name))
          ), '[]'::json
        ) AS oem_codes,
        COALESCE(
          (
            SELECT json_agg(DISTINCT TRIM(t.truck_brand || ' ' || t.truck_model))
            FROM item_truck_compatibility c
            JOIN truck t ON c.id_truck = t.id_truck
            JOIN item i_sib ON c.id_item = i_sib.id_item
            WHERE c.id_item = i.id_item
               OR LOWER(TRIM(i_sib.item_name)) = LOWER(TRIM(i.item_name))
          ), '[]'::json
        ) AS compatible_trucks
      FROM item i
      LEFT JOIN inventario_stock st ON st.id_item = i.id_item AND st.id_sucursal = $1
      LEFT JOIN sucursal s ON s.id_sucursal = $1
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${whereClause}
      ORDER BY i.id_item DESC, st.id_inventario DESC NULLS LAST
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const { rows } = await client.query(dataQuery, [...values, limit, offset]);

    return {
      stock: inventoryMapper.toDomainList(rows),
      total: parseInt(total, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total, 10) / limit)
    };
  },

  async findById(idInventario, client = pool) {
    const query = `
      SELECT 
        st.*,
        i.item_name,
        i.sku,
        i.price,
        i.cost,
        s.name AS sucursal_nombre
      FROM inventario_stock st
      JOIN item i ON st.id_item = i.id_item
      JOIN sucursal s ON st.id_sucursal = s.id_sucursal
      WHERE st.id_inventario = $1;
    `;
    const { rows } = await client.query(query, [idInventario]);
    return rows.length ? inventoryMapper.toDomain(rows[0]) : null;
  },

  async findByItemAndBranch(idItem, idSucursal, client = pool) {
    const query = `
      SELECT 
        st.*,
        i.item_name,
        i.sku,
        s.name AS sucursal_nombre
      FROM inventario_stock st
      JOIN item i ON st.id_item = i.id_item
      JOIN sucursal s ON st.id_sucursal = s.id_sucursal
      WHERE st.id_item = $1 AND st.id_sucursal = $2
      ORDER BY st.tipo_almacen ASC;
    `;
    const { rows } = await client.query(query, [idItem, idSucursal]);
    return inventoryMapper.toDomainList(rows);
  },

  async findByItemAndWarehouseType(idItem, idSucursal, tipoAlmacen, client = pool) {
    const query = `
      SELECT 
        st.*,
        i.item_name,
        i.sku,
        s.name AS sucursal_nombre
      FROM inventario_stock st
      JOIN item i ON st.id_item = i.id_item
      JOIN sucursal s ON st.id_sucursal = s.id_sucursal
      WHERE st.id_item = $1 AND st.id_sucursal = $2 AND st.tipo_almacen = $3
      LIMIT 1;
    `;
    const { rows } = await client.query(query, [idItem, idSucursal, tipoAlmacen.toUpperCase()]);
    return rows.length ? inventoryMapper.toDomain(rows[0]) : null;
  },

  async upsertStock(stockData, client = pool) {
    const db = inventoryMapper.toPersistence(stockData);
    const query = `
      INSERT INTO inventario_stock (
        id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion,
        cantidad, stock_minimo, stock_maximo, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (id_item, id_sucursal, tipo_almacen, pasillo, estante, seccion)
      DO UPDATE SET
        cantidad = EXCLUDED.cantidad,
        stock_minimo = EXCLUDED.stock_minimo,
        stock_maximo = EXCLUDED.stock_maximo,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const values = [
      db.id_item,
      db.id_sucursal,
      db.tipo_almacen,
      db.pasillo,
      db.estante,
      db.seccion,
      db.cantidad,
      db.stock_minimo,
      db.stock_maximo
    ];
    const { rows } = await client.query(query, values);
    return inventoryMapper.toDomain(rows[0]);
  },

  async updateLocation(idInventario, { pasillo, estante, seccion }, client = pool) {
    const query = `
      UPDATE inventario_stock
      SET 
        pasillo = COALESCE($1, pasillo),
        estante = COALESCE($2, estante),
        seccion = COALESCE($3, seccion),
        updated_at = CURRENT_TIMESTAMP
      WHERE id_inventario = $4
      RETURNING *;
    `;
    const values = [
      pasillo ? pasillo.trim().toUpperCase() : null,
      estante ? estante.trim().toUpperCase() : null,
      seccion ? seccion.trim().toUpperCase() : null,
      idInventario
    ];
    const { rows } = await client.query(query, values);
    return rows.length ? inventoryMapper.toDomain(rows[0]) : null;
  },

  async updateStockQty(idInventario, newQty, client = pool) {
    const query = `
      UPDATE inventario_stock
      SET cantidad = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id_inventario = $2
      RETURNING *;
    `;
    const { rows } = await client.query(query, [newQty, idInventario]);
    return rows.length ? inventoryMapper.toDomain(rows[0]) : null;
  },

  /**
   * Bloqueo pesimista determinista para prevenir concurrencia y deadlocks
   */
  async lockStockRows(idSucursal, itemIds, tipoAlmacen = 'TIENDA', client = pool) {
    const query = `
      SELECT id_inventario, id_item, cantidad, stock_minimo, pasillo, estante, seccion, tipo_almacen
      FROM inventario_stock
      WHERE id_sucursal = $1 AND tipo_almacen = $2 AND id_item = ANY($3::int[])
      ORDER BY id_inventario ASC
      FOR UPDATE;
    `;
    const { rows } = await client.query(query, [idSucursal, tipoAlmacen.toUpperCase(), itemIds]);
    return rows;
  }
};
