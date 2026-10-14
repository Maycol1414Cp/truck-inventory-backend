/**
 * Mapper para transformar filas de camiones entre snake_case (PostgreSQL) y camelCase (API REST).
 */
export const toTruckDTO = (row) => {
  if (!row) return null;

  return {
    idTruck: row.id_truck,
    truckBrand: row.truck_brand,
    truckModel: row.truck_model,
    engineModel: row.engine_model,
    firstYear: row.first_year,
    lastYear: row.last_year,
    notes: row.notes || null,
    createdAt: row.created_at || null
  };
};

export const toTruckListDTO = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(toTruckDTO);
};
