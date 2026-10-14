export const returnMapper = {
  toDomain(row) {
    if (!row) return null;

    let details = [];
    if (Array.isArray(row.details)) {
      details = row.details;
    } else if (typeof row.details === 'string') {
      try { details = JSON.parse(row.details); } catch (_) { details = []; }
    }

    return {
      idDevolucion: row.id_devolucion,
      idVenta: row.id_venta,
      numeroFactura: row.numero_factura || null,
      idSucursal: row.id_sucursal,
      sucursalNombre: row.sucursal_nombre || null,
      tipoDevolucion: row.tipo_devolucion,
      motivo: row.motivo,
      montoReembolso: parseFloat(row.monto_reembolso || 0),
      metodoReembolso: row.metodo_reembolso,
      autorizadoPor: row.autorizado_por,
      estado: row.estado,
      createdAt: row.created_at,
      details: details.map(d => ({
        idDevolucionDetalle: d.id_devolucion_detalle,
        idDetalleVenta: d.id_detalle_venta,
        idItem: d.id_item,
        itemName: d.item_name || null,
        sku: d.sku || null,
        cantidad: parseInt(d.cantidad, 10),
        destinoAlmacen: d.destino_almacen,
        montoUnitario: parseFloat(d.monto_unitario || 0),
        subtotal: parseFloat(d.subtotal || 0)
      }))
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  }
};
