export const inventoryMapper = {
  toDomain(row) {
    if (!row) return null;
    return {
      idInventario: row.id_inventario,
      idItem: row.id_item,
      itemName: row.item_name || null,
      sku: row.sku || null,
      idBrand: row.id_brand || null,
      brandName: row.brand_name || null,
      price: row.price !== undefined ? parseFloat(row.price) : null,
      cost: row.cost !== undefined ? parseFloat(row.cost) : null,
      idSucursal: row.id_sucursal,
      sucursalNombre: row.sucursal_nombre || row.name || null,
      tipoAlmacen: row.tipo_almacen,
      pasillo: row.pasillo,
      estante: row.estante,
      seccion: row.seccion,
      cantidad: parseInt(row.cantidad, 10),
      stockMinimo: parseInt(row.stock_minimo, 10),
      stockMaximo: row.stock_maximo !== null ? parseInt(row.stock_maximo, 10) : null,
      updatedAt: row.updated_at
    };
  },

  toDomainList(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.map(r => this.toDomain(r));
  },

  toPersistence(dto) {
    return {
      id_item: dto.idItem,
      id_sucursal: dto.idSucursal,
      tipo_almacen: dto.tipoAlmacen ? dto.tipoAlmacen.trim().toUpperCase() : 'TIENDA',
      pasillo: dto.pasillo ? dto.pasillo.trim().toUpperCase() : 'S/P',
      estante: dto.estante ? dto.estante.trim().toUpperCase() : 'S/E',
      seccion: dto.seccion ? dto.seccion.trim().toUpperCase() : 'S/S',
      cantidad: dto.cantidad !== undefined ? parseInt(dto.cantidad, 10) : 0,
      stock_minimo: dto.stockMinimo !== undefined ? parseInt(dto.stockMinimo, 10) : 0,
      stock_maximo: dto.stockMaximo !== undefined && dto.stockMaximo !== null ? parseInt(dto.stockMaximo, 10) : null
    };
  }
};
