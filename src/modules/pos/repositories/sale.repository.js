import pool from '../../../config/database.js';
import { saleMapper } from '../mappers/sale.mapper.js';

export const saleRepository = {
  async createHeader(saleData, client = pool) {
    const query = `
      INSERT INTO venta (
        numero_factura, id_sucursal, cliente_nombre, cliente_documento,
        vendedor_id, subtotal, impuesto, descuento, total, metodo_pago, estado
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *;
    `;
    const values = [
      saleData.numeroFactura,
      saleData.idSucursal,
      saleData.clienteNombre || 'CLIENTE GENERAL',
      saleData.clienteDocumento || null,
      saleData.vendedorId || null,
      saleData.subtotal,
      saleData.impuesto || 0,
      saleData.descuento || 0,
      saleData.total,
      saleData.metodoPago,
      saleData.estado || 'COMPLETADA'
    ];
    const { rows } = await client.query(query, values);
    return saleMapper.toDomain(rows[0]);
  },

  async createDetail(detailData, client = pool) {
    const query = `
      INSERT INTO venta_detalle (
        id_venta, id_item, tipo_almacen_origen, cantidad,
        precio_unitario, costo_unitario, descuento, subtotal
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      detailData.idVenta,
      detailData.idItem,
      detailData.tipoAlmacenOrigen || 'TIENDA',
      detailData.cantidad,
      detailData.precioUnitario,
      detailData.costoUnitario,
      detailData.descuento || 0,
      detailData.subtotal
    ];
    const { rows } = await client.query(query, values);
    return rows[0];
  },

  async findById(idVenta, client = pool) {
    const query = `
      SELECT 
        v.*,
        s.name AS sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', d.id_detalle,
              'id_item', d.id_item,
              'item_name', i.item_name,
              'sku', i.sku,
              'tipo_almacen_origen', d.tipo_almacen_origen,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_unitario,
              'costo_unitario', d.costo_unitario,
              'descuento', d.descuento,
              'subtotal', d.subtotal
            ) ORDER BY d.id_detalle ASC
          ) FILTER (WHERE d.id_detalle IS NOT NULL), '[]'
        ) AS details
      FROM venta v
      JOIN sucursal s ON v.id_sucursal = s.id_sucursal
      LEFT JOIN venta_detalle d ON v.id_venta = d.id_venta
      LEFT JOIN item i ON d.id_item = i.id_item
      WHERE v.id_venta = $1
      GROUP BY v.id_venta, s.name;
    `;
    const { rows } = await client.query(query, [idVenta]);
    return rows.length ? saleMapper.toDomain(rows[0]) : null;
  },

  async findAll({ idSucursal = null, estado = null, startDate = null, endDate = null, page = 1, limit = 20 } = {}, client = pool) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (idSucursal) {
      conditions.push(`v.id_sucursal = $${paramIndex++}`);
      values.push(idSucursal);
    }

    if (estado) {
      conditions.push(`v.estado = $${paramIndex++}`);
      values.push(estado.toUpperCase());
    }

    if (startDate) {
      conditions.push(`v.created_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`v.created_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) as total FROM venta v ${whereClause};`;
    const { rows: [{ total }] } = await client.query(countQuery, values);

    const dataQuery = `
      SELECT 
        v.*,
        s.name AS sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id_detalle', d.id_detalle,
              'id_item', d.id_item,
              'item_name', i.item_name,
              'sku', i.sku,
              'tipo_almacen_origen', d.tipo_almacen_origen,
              'cantidad', d.cantidad,
              'precio_unitario', d.precio_unitario,
              'costo_unitario', d.costo_unitario,
              'descuento', d.descuento,
              'subtotal', d.subtotal
            ) ORDER BY d.id_detalle ASC
          ) FILTER (WHERE d.id_detalle IS NOT NULL), '[]'
        ) AS details
      FROM venta v
      JOIN sucursal s ON v.id_sucursal = s.id_sucursal
      LEFT JOIN venta_detalle d ON v.id_venta = d.id_venta
      LEFT JOIN item i ON d.id_item = i.id_item
      ${whereClause}
      GROUP BY v.id_venta, s.name
      ORDER BY v.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const { rows } = await client.query(dataQuery, [...values, limit, offset]);

    return {
      sales: saleMapper.toDomainList(rows),
      total: parseInt(total, 10),
      page,
      limit,
      totalPages: Math.ceil(parseInt(total, 10) / limit)
    };
  },

  async updateStatus(idVenta, estado, client = pool) {
    const query = `
      UPDATE venta
      SET estado = $1
      WHERE id_venta = $2
      RETURNING *;
    `;
    const { rows } = await client.query(query, [estado.toUpperCase(), idVenta]);
    return rows.length ? saleMapper.toDomain(rows[0]) : null;
  }
};
