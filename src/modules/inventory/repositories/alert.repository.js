import pool from '../../../config/database.js';

export const alertRepository = {
  async getRestockAlertsByBranch(idSucursal = null, client = pool) {
    let query = `
      WITH hub AS (
        SELECT id_sucursal, name
        FROM sucursal
        WHERE is_main_hub = TRUE AND is_active = TRUE
        ORDER BY id_sucursal ASC
        LIMIT 1
      ),
      hub_stocks AS (
        SELECT 
          st.id_item,
          st.id_sucursal,
          COALESCE(SUM(st.cantidad), 0)::integer AS total_qty,
          COALESCE(SUM(CASE WHEN st.tipo_almacen = 'DEPOSITO' THEN st.cantidad ELSE 0 END), 0)::integer AS dep_qty,
          COALESCE(SUM(CASE WHEN st.tipo_almacen = 'TIENDA' THEN st.cantidad ELSE 0 END), 0)::integer AS tienda_qty,
          MAX(CASE WHEN st.tipo_almacen = 'DEPOSITO' THEN st.pasillo ELSE st.pasillo END) AS pasillo,
          MAX(CASE WHEN st.tipo_almacen = 'DEPOSITO' THEN st.estante ELSE st.estante END) AS estante,
          MAX(CASE WHEN st.tipo_almacen = 'DEPOSITO' THEN st.seccion ELSE st.seccion END) AS seccion
        FROM inventario_stock st
        JOIN hub h ON h.id_sucursal = st.id_sucursal
        GROUP BY st.id_item, st.id_sucursal
      ),
      branch_tienda AS (
        SELECT 
          id_sucursal,
          id_item,
          COALESCE(SUM(cantidad), 0)::integer AS stock_tienda,
          COALESCE(MAX(stock_minimo), 1)::integer AS stock_minimo,
          MAX(pasillo) AS pasillo,
          MAX(estante) AS estante,
          MAX(seccion) AS seccion
        FROM inventario_stock
        WHERE tipo_almacen = 'TIENDA'
        GROUP BY id_sucursal, id_item
      ),
      branch_deposito AS (
        SELECT 
          id_sucursal,
          id_item,
          COALESCE(SUM(cantidad), 0)::integer AS stock_deposito,
          MAX(pasillo) AS pasillo,
          MAX(estante) AS estante,
          MAX(seccion) AS seccion
        FROM inventario_stock
        WHERE tipo_almacen = 'DEPOSITO'
        GROUP BY id_sucursal, id_item
      )
      SELECT 
        s.id_sucursal,
        s.name AS sucursal_nombre,
        i.id_item,
        i.item_name,
        i.sku,
        b.brand_name,
        COALESCE(bt.stock_tienda, 0)::integer AS stock_tienda,
        COALESCE(bt.stock_minimo, 1)::integer AS stock_minimo_tienda,
        COALESCE(bt.pasillo, 'S/P') AS tienda_pasillo,
        COALESCE(bt.estante, 'S/E') AS tienda_estante,
        COALESCE(bt.seccion, 'S/S') AS tienda_seccion,
        CASE
          WHEN COALESCE(bd.stock_deposito, 0) > 0 THEN bd.stock_deposito
          WHEN s.id_sucursal != COALESCE(h.id_sucursal, 0) THEN COALESCE(hs.total_qty, 0)
          ELSE 0
        END::integer AS stock_deposito_disponible,
        CASE
          WHEN COALESCE(bd.stock_deposito, 0) > 0 THEN COALESCE(bd.pasillo, 'S/P')
          WHEN s.id_sucursal != COALESCE(h.id_sucursal, 0) THEN COALESCE(hs.pasillo, 'S/P')
          ELSE 'S/P'
        END AS deposito_pasillo,
        CASE
          WHEN COALESCE(bd.stock_deposito, 0) > 0 THEN COALESCE(bd.estante, 'S/E')
          WHEN s.id_sucursal != COALESCE(h.id_sucursal, 0) THEN COALESCE(hs.estante, 'S/E')
          ELSE 'S/E'
        END AS deposito_estante,
        CASE
          WHEN COALESCE(bd.stock_deposito, 0) > 0 THEN COALESCE(bd.seccion, 'S/S')
          WHEN s.id_sucursal != COALESCE(h.id_sucursal, 0) THEN COALESCE(hs.seccion, 'S/S')
          ELSE 'S/S'
        END AS deposito_seccion,
        CASE
          WHEN COALESCE(bd.stock_deposito, 0) > 0 THEN 'DEPOSITO_LOCAL'
          WHEN s.id_sucursal != COALESCE(h.id_sucursal, 0) AND COALESCE(hs.total_qty, 0) > 0 THEN 'MAIN_HUB'
          ELSE 'NINGUNO'
        END AS origen_reposicion,
        h.name AS hub_nombre
      FROM item i
      CROSS JOIN sucursal s
      LEFT JOIN hub h ON TRUE
      LEFT JOIN hub_stocks hs ON hs.id_item = i.id_item
      LEFT JOIN brand b ON b.id_brand = i.id_brand
      LEFT JOIN branch_tienda bt ON bt.id_sucursal = s.id_sucursal AND bt.id_item = i.id_item
      LEFT JOIN branch_deposito bd ON bd.id_sucursal = s.id_sucursal AND bd.id_item = i.id_item
      WHERE 
        s.is_active = TRUE
        AND i.is_active = TRUE
        AND COALESCE(bt.stock_tienda, 0) <= COALESCE(bt.stock_minimo, 1)
        AND (
          COALESCE(bd.stock_deposito, 0) > 0
          OR
          (s.id_sucursal != COALESCE(h.id_sucursal, 0) AND COALESCE(hs.total_qty, 0) > 0)
        )
    `;
    const values = [];

    if (idSucursal) {
      query += ` AND s.id_sucursal = $1`;
      values.push(idSucursal);
    }

    query += ` ORDER BY s.id_sucursal ASC, stock_tienda ASC, stock_deposito_disponible DESC;`;

    const { rows } = await client.query(query, values);
    return rows.map(r => ({
      idSucursal: r.id_sucursal,
      sucursalNombre: r.sucursal_nombre,
      idItem: r.id_item,
      itemName: r.item_name,
      sku: r.sku,
      brandName: r.brand_name,
      origenReposicion: r.origen_reposicion || 'DEPOSITO_LOCAL',
      hubNombre: r.hub_nombre || null,
      tienda: {
        stockActual: parseInt(r.stock_tienda, 10),
        stockMinimo: parseInt(r.stock_minimo_tienda, 10),
        pasillo: r.tienda_pasillo,
        estante: r.tienda_estante,
        seccion: r.tienda_seccion
      },
      deposito: {
        stockDisponible: parseInt(r.stock_deposito_disponible, 10),
        pasillo: r.deposito_pasillo,
        estante: r.deposito_estante,
        seccion: r.deposito_seccion
      },
      sugerenciaTraslado: Math.min(
        parseInt(r.stock_deposito_disponible, 10),
        Math.max(1, (parseInt(r.stock_minimo_tienda, 10) * 2) - parseInt(r.stock_tienda, 10))
      )
    }));
  }
};
