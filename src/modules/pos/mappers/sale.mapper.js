export const saleMapper = {
  toDomain(row) {
    if (!row) return null;

    let details = [];
    if (Array.isArray(row.details)) {
      details = row.details;
    } else if (typeof row.details === 'string') {
      try { details = JSON.parse(row.details); } catch (_) { details = []; }
    }

    return {
      idVenta: row.id_venta,
      numeroFactura: row.numero_factura,
      idSucursal: row.id_sucursal,
      sucursalNombre: row.sucursal_nombre || null,
      clienteNombre: row.cliente_nombre,
      clienteDocumento: row.cliente_documento || null,
      vendedorId: row.vendedor_id || null,
      subtotal: parseFloat(row.subtotal || 0),
      impuesto: parseFloat(row.impuesto || 0),
      descuento: parseFloat(row.descuento || 0),
      total: parseFloat(row.total || 0),
      metodoPago: row.metodo_pago,
      estado: row.estado,
      createdAt: row.created_at,
      details: details.map(d => ({
        idDetalle: d.id_detalle,
        idItem: d.id_item,
        itemName: d.item_name || null,
        sku: d.sku || null,
        tipoAlmacenOrigen: d.tipo_almacen_origen,
        cantidad: parseInt(d.cantidad, 10),
        precioUnitario: parseFloat(d.precio_unitario || 0),
        costoUnitario: parseFloat(d.costo_unitario || 0),
        descuento: parseFloat(d.descuento || 0),
        subtotal: parseFloat(d.subtotal || 0)
      }))
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  }
};
