import pool from '../../../config/database.js';

export const alertRepository = {
  async getRestockAlertsByBranch(idSucursal = null, client = pool) {
    let query = `
      SELECT 
        id_sucursal,
        sucursal_nombre,
        id_item,
        item_name,
        sku,
        brand_name,
        stock_tienda,
        stock_minimo_tienda,
        tienda_pasillo,
        tienda_estante,
        tienda_seccion,
        stock_deposito_disponible,
        deposito_pasillo,
        deposito_estante,
        deposito_seccion
      FROM v_alertas_reposicion_interna
    `;
    const values = [];

    if (idSucursal) {
      query += ` WHERE id_sucursal = $1`;
      values.push(idSucursal);
    }

    query += ` ORDER BY id_sucursal ASC, stock_tienda ASC, stock_deposito_disponible DESC;`;

    const { rows } = await client.query(query, values);
    return rows.map(r => ({
      idSucursal: r.id_sucursal,
      sucursalNombre: r.sucursal_nombre,
      idItem: r.id_item,
      itemName: r.item_name,
      sku: r.sku,
      brandName: r.brand_name,
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
