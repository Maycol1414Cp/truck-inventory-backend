import pool from '../../../config/database.js';
import { returnMapper } from '../mappers/return.mapper.js';

export const returnRepository = {
  async createHeader(returnData, client = pool) {
    const query = `
      INSERT INTO devolucion (
        id_venta, id_sucursal, tipo_devolucion, motivo,
        monto_reembolso, metodo_reembolso, autorizado_por, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      returnData.idVenta,
      returnData.idSucursal,
      returnData.tipoDevolucion,
      returnData.motivo,
      returnData.montoReembolso,
      returnData.metodoReembolso,
      returnData.autorizadoPor || 'SUPERVISOR_POS',
      returnData.estado || 'APROBADA'
    ];
    const { rows } = await client.query(query, values);
    return rows[0];
  },

  async createDetail(detailData, client = pool) {
    const query = `
      INSERT INTO devolucion_detalle (
        id_devolucion, id_detalle_venta, id_item,
        cantidad, destino_almacen, monto_unitario, subtotal
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;
    `;
    const values = [
      detailData.idDevolucion,
      detailData.idDetalleVenta,
      detailData.idItem,
      detailData.cantidad,
      detailData.destinoAlmacen || 'TIENDA',
      detailData.montoUnitario,
      detailData.subtotal
    ];
    const { rows } = await client.query(query, values);
    return rows[0];
  },

  async findById(idDevolucion, client = pool) {
    const query = `
      SELECT 
        dev.*,
        v.numero_factura,
        s.name AS sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id_devolucion_detalle', dd.id_devolucion_detalle,
              'id_detalle_venta', dd.id_detalle_venta,
              'id_item', dd.id_item,
              'item_name', i.item_name,
              'sku', i.sku,
              'cantidad', dd.cantidad,
              'destino_almacen', dd.destino_almacen,
              'monto_unitario', dd.monto_unitario,
              'subtotal', dd.subtotal
            ) ORDER BY dd.id_devolucion_detalle ASC
          ) FILTER (WHERE dd.id_devolucion_detalle IS NOT NULL), '[]'
        ) AS details
      FROM devolucion dev
      JOIN venta v ON dev.id_venta = v.id_venta
      JOIN sucursal s ON dev.id_sucursal = s.id_sucursal
      LEFT JOIN devolucion_detalle dd ON dev.id_devolucion = dd.id_devolucion
      LEFT JOIN item i ON dd.id_item = i.id_item
      WHERE dev.id_devolucion = $1
      GROUP BY dev.id_devolucion, v.numero_factura, s.name;
    `;
    const { rows } = await client.query(query, [idDevolucion]);
    return rows.length ? returnMapper.toDomain(rows[0]) : null;
  },

  async findBySaleId(idVenta, client = pool) {
    const query = `
      SELECT 
        dev.*,
        v.numero_factura,
        s.name AS sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id_devolucion_detalle', dd.id_devolucion_detalle,
              'id_detalle_venta', dd.id_detalle_venta,
              'id_item', dd.id_item,
              'item_name', i.item_name,
              'sku', i.sku,
              'cantidad', dd.cantidad,
              'destino_almacen', dd.destino_almacen,
              'monto_unitario', dd.monto_unitario,
              'subtotal', dd.subtotal
            ) ORDER BY dd.id_devolucion_detalle ASC
          ) FILTER (WHERE dd.id_devolucion_detalle IS NOT NULL), '[]'
        ) AS details
      FROM devolucion dev
      JOIN venta v ON dev.id_venta = v.id_venta
      JOIN sucursal s ON dev.id_sucursal = s.id_sucursal
      LEFT JOIN devolucion_detalle dd ON dev.id_devolucion = dd.id_devolucion
      LEFT JOIN item i ON dd.id_item = i.id_item
      WHERE dev.id_venta = $1
      GROUP BY dev.id_devolucion, v.numero_factura, s.name
      ORDER BY dev.created_at DESC;
    `;
    const { rows } = await client.query(query, [idVenta]);
    return returnMapper.toDomainList(rows);
  },

  async getReturnedQuantitiesBySale(idVenta, client = pool) {
    const query = `
      SELECT 
        dd.id_detalle_venta,
        SUM(dd.cantidad)::int AS total_devuelto
      FROM devolucion_detalle dd
      JOIN devolucion d ON dd.id_devolucion = d.id_devolucion
      WHERE d.id_venta = $1 AND d.estado = 'APROBADA'
      GROUP BY dd.id_detalle_venta;
    `;
    const { rows } = await client.query(query, [idVenta]);
    return rows;
  }
};
