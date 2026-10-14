import pool from '../../../config/database.js';

export const analyticsRepository = {
  /**
   * Consulta agregada de rotación y ventas desglosadas por trimestre/temporada.
   */
  async getSeasonalDemand({ year = null, idItem = null, idSucursal = null } = {}) {
    const conditions = ["v.estado != 'ANULADA'"];
    const params = [];
    let paramIndex = 1;

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM v.created_at) = $${paramIndex}`);
      params.push(parseInt(year, 10));
      paramIndex++;
    }

    if (idItem) {
      conditions.push(`i.id_item = $${paramIndex}`);
      params.push(parseInt(idItem, 10));
      paramIndex++;
    }

    if (idSucursal) {
      conditions.push(`v.id_sucursal = $${paramIndex}`);
      params.push(parseInt(idSucursal, 10));
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        i.id_item,
        i.item_name,
        i.sku,
        b.brand_name,
        EXTRACT(YEAR FROM v.created_at) AS year,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (1, 2, 3) THEN vd.cantidad ELSE 0 END), 0) AS q1_quantity,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (1, 2, 3) THEN vd.subtotal ELSE 0 END), 0) AS q1_revenue,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (4, 5, 6) THEN vd.cantidad ELSE 0 END), 0) AS q2_quantity,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (4, 5, 6) THEN vd.subtotal ELSE 0 END), 0) AS q2_revenue,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (7, 8, 9) THEN vd.cantidad ELSE 0 END), 0) AS q3_quantity,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (7, 8, 9) THEN vd.subtotal ELSE 0 END), 0) AS q3_revenue,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (10, 11, 12) THEN vd.cantidad ELSE 0 END), 0) AS q4_quantity,
        COALESCE(SUM(CASE WHEN EXTRACT(MONTH FROM v.created_at) IN (10, 11, 12) THEN vd.subtotal ELSE 0 END), 0) AS q4_revenue,
        COALESCE(SUM(vd.cantidad), 0) AS total_quantity,
        COALESCE(SUM(vd.subtotal), 0) AS total_revenue
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      JOIN venta_detalle vd ON vd.id_item = i.id_item
      JOIN venta v ON vd.id_venta = v.id_venta
      ${whereClause}
      GROUP BY i.id_item, i.item_name, i.sku, b.brand_name, EXTRACT(YEAR FROM v.created_at)
      ORDER BY total_quantity DESC;
    `;

    const result = await pool.query(sql, params);
    return result.rows;
  },

  /**
   * Obtiene datos de demanda histórica y existencias actuales para el cálculo del Punto de Reorden (ROP).
   */
  async getReorderData({ lookbackDays = 90, idItem = null, idSucursal = null } = {}) {
    const params = [lookbackDays];
    let paramIndex = 2;
    const itemFilter = [];
    const stockFilter = [];
    const salesFilter = [];

    if (idItem) {
      itemFilter.push(`i.id_item = $${paramIndex}`);
      params.push(parseInt(idItem, 10));
      paramIndex++;
    }

    if (idSucursal) {
      stockFilter.push(`st.id_sucursal = $${paramIndex}`);
      salesFilter.push(`v.id_sucursal = $${paramIndex}`);
      params.push(parseInt(idSucursal, 10));
      paramIndex++;
    }

    const itemWhere = itemFilter.length > 0 ? `WHERE ${itemFilter.join(' AND ')}` : '';
    const stockSucursalAnd = stockFilter.length > 0 ? `AND ${stockFilter.join(' AND ')}` : '';
    const salesSucursalAnd = salesFilter.length > 0 ? `AND ${salesFilter.join(' AND ')}` : '';

    const sql = `
      SELECT 
        i.id_item,
        i.item_name,
        i.sku,
        b.brand_name,
        i.cost,
        i.price,
        COALESCE((
          SELECT SUM(st.cantidad)
          FROM inventario_stock st
          WHERE st.id_item = i.id_item AND st.tipo_almacen = 'TIENDA' ${stockSucursalAnd}
        ), 0) AS current_stock_tienda,
        COALESCE((
          SELECT SUM(st.cantidad)
          FROM inventario_stock st
          WHERE st.id_item = i.id_item AND st.tipo_almacen = 'DEPOSITO' ${stockSucursalAnd}
        ), 0) AS current_stock_deposito,
        COALESCE((
          SELECT SUM(vd.cantidad)
          FROM venta_detalle vd
          JOIN venta v ON vd.id_venta = v.id_venta
          WHERE vd.id_item = i.id_item
            AND v.estado != 'ANULADA'
            AND v.created_at >= NOW() - ($1 || ' days')::INTERVAL
            ${salesSucursalAnd}
        ), 0) AS units_sold_period
      FROM item i
      LEFT JOIN brand b ON i.id_brand = b.id_brand
      ${itemWhere}
      ORDER BY units_sold_period DESC, i.item_name ASC;
    `;

    const result = await pool.query(sql, params);
    return result.rows;
  },

  /**
   * Resumen ejecutivo y KPIs globales del sistema.
   */
  async getExecutiveMetrics() {
    const sql = `
      SELECT 
        (SELECT COUNT(*) FROM item WHERE is_active = TRUE) AS total_active_items,
        (SELECT COALESCE(SUM(cantidad), 0) FROM inventario_stock WHERE tipo_almacen = 'TIENDA') AS total_stock_tienda,
        (SELECT COALESCE(SUM(cantidad), 0) FROM inventario_stock WHERE tipo_almacen = 'DEPOSITO') AS total_stock_deposito,
        (
          SELECT COALESCE(SUM(st.cantidad * i.cost), 0)
          FROM inventario_stock st
          JOIN item i ON st.id_item = i.id_item
        ) AS total_inventory_cost_valuation,
        (
          SELECT COALESCE(SUM(st.cantidad * i.price), 0)
          FROM inventario_stock st
          JOIN item i ON st.id_item = i.id_item
        ) AS total_inventory_price_valuation,
        (SELECT COUNT(*) FROM venta WHERE estado != 'ANULADA') AS total_sales_count,
        (SELECT COALESCE(SUM(total), 0) FROM venta WHERE estado != 'ANULADA') AS total_sales_revenue,
        (SELECT COUNT(*) FROM devolucion WHERE estado = 'APROBADA') AS total_returns_count,
        (SELECT COALESCE(SUM(monto_reembolso), 0) FROM devolucion WHERE estado = 'APROBADA') AS total_refunded_amount,
        (SELECT COUNT(*) FROM v_alertas_reposicion_interna) AS active_internal_restock_alerts;
    `;
    const result = await pool.query(sql);
    return result.rows[0];
  }
};
