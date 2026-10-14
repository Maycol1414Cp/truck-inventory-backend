import pool from '../../../config/database.js';
import { inventoryMapper } from '../mappers/inventory.mapper.js';

export const inventoryRepository = {
  async findByBranch(idSucursal, { tipoAlmacen = null, search = null, page = 1, limit = 50 } = {}, client = pool) {
    const offset = (page - 1) * limit;
    const conditions = ['st.id_sucursal = $1'];
    const values = [idSucursal];
    let paramIndex = 2;

    if (tipoAlmacen) {
      conditions.push(`st.tipo_almacen = $${paramIndex++}`);
      values.push(tipoAlmacen.toUpperCase());
    }

    if (search && search.trim()) {
      conditions.push(`(
        i.item_name ILIKE $${paramIndex} 
        OR i.sku ILIKE $${paramIndex}
        OR b.brand_name ILIKE $${paramIndex}
        OR st.pasillo ILIKE $${paramIndex}
      )`);
      values.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM inventario_stock st
      JOIN item i ON st.id_item = i.id_item
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${whereClause};
    `;
    const { rows: [{ total }] } = await client.query(countQuery, values);

    const dataQuery = `
      SELECT 
        st.id_inventario,
        st.id_item,
        i.item_name,
        i.sku,
        i.price,
        i.cost,
        b.id_brand,
        b.brand_name,
        st.id_sucursal,
        s.name AS sucursal_nombre,
        st.tipo_almacen,
        st.pasillo,
        st.estante,
        st.seccion,
        st.cantidad,
        st.stock_minimo,
        st.stock_maximo,
        st.updated_at
      FROM inventario_stock st
      JOIN item i ON st.id_item = i.id_item
      JOIN sucursal s ON st.id_sucursal = s.id_sucursal
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${whereClause}
      ORDER BY i.item_name ASC, st.tipo_almacen ASC
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
