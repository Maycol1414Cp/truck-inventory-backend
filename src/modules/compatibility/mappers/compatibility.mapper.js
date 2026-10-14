/**
 * Mapper para relaciones de compatibilidad entre repuestos e ítems.
 */

export const toCompatibilityDTO = (row) => {
  if (!row) return null;

  return {
    idItem: row.id_item,
    idTruck: row.id_truck,
    positionNote: row.position_note || null
  };
};

/**
 * Mapea la búsqueda inversa: repuestos compatibles con un camión específico.
 */
export const toCompatibleItemDTO = (row) => {
  if (!row) return null;

  return {
    idItem: row.id_item,
    itemName: row.item_name,
    sku: row.sku,
    brandName: row.brand_name || null,
    price: row.price ? parseFloat(row.price) : 0,
    cost: row.cost ? parseFloat(row.cost) : 0,
    positionNote: row.position_note || null,
    mainOemCode: row.main_oem_code || null,
    category: row.category || null,
    totalStockTienda: row.total_stock_tienda ? parseInt(row.total_stock_tienda, 10) : 0,
    totalStockDeposito: row.total_stock_deposito ? parseInt(row.total_stock_deposito, 10) : 0
  };
};

export const toCompatibleItemListDTO = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(toCompatibleItemDTO);
};

/**
 * Mapea los camiones compatibles con un repuesto específico.
 */
export const toCompatibleTruckDTO = (row) => {
  if (!row) return null;

  return {
    idTruck: row.id_truck,
    truckBrand: row.truck_brand,
    truckModel: row.truck_model,
    engineModel: row.engine_model,
    firstYear: row.first_year,
    lastYear: row.last_year,
    positionNote: row.position_note || null,
    notes: row.notes || null
  };
};

export const toCompatibleTruckListDTO = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(toCompatibleTruckDTO);
};
