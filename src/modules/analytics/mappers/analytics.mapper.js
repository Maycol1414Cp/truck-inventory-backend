/**
 * Mappers para transformar datos analíticos a DTOs camelCase.
 */

export const toSeasonalDemandDTO = (row) => {
  if (!row) return null;

  const q1Qty = parseInt(row.q1_quantity, 10) || 0;
  const q2Qty = parseInt(row.q2_quantity, 10) || 0;
  const q3Qty = parseInt(row.q3_quantity, 10) || 0;
  const q4Qty = parseInt(row.q4_quantity, 10) || 0;

  // Determinar temporada pico
  const seasonMap = [
    { name: 'Q1', qty: q1Qty },
    { name: 'Q2', qty: q2Qty },
    { name: 'Q3', qty: q3Qty },
    { name: 'Q4', qty: q4Qty }
  ];
  seasonMap.sort((a, b) => b.qty - a.qty);
  const peakSeason = seasonMap[0].qty > 0 ? seasonMap[0].name : 'N/A';

  return {
    idItem: row.id_item,
    itemName: row.item_name,
    sku: row.sku,
    brandName: row.brand_name || null,
    year: row.year ? parseInt(row.year, 10) : null,
    seasons: {
      q1: {
        quarter: 'Q1 (Ene-Mar)',
        quantitySold: q1Qty,
        revenue: row.q1_revenue ? parseFloat(row.q1_revenue) : 0
      },
      q2: {
        quarter: 'Q2 (Abr-Jun)',
        quantitySold: q2Qty,
        revenue: row.q2_revenue ? parseFloat(row.q2_revenue) : 0
      },
      q3: {
        quarter: 'Q3 (Jul-Sep)',
        quantitySold: q3Qty,
        revenue: row.q3_revenue ? parseFloat(row.q3_revenue) : 0
      },
      q4: {
        quarter: 'Q4 (Oct-Dic)',
        quantitySold: q4Qty,
        revenue: row.q4_revenue ? parseFloat(row.q4_revenue) : 0
      }
    },
    totalQuantitySold: parseInt(row.total_quantity, 10) || 0,
    totalRevenue: row.total_revenue ? parseFloat(row.total_revenue) : 0,
    peakSeason
  };
};

export const toSeasonalDemandListDTO = (rows) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(toSeasonalDemandDTO);
};

export const toReorderPointDTO = (row, { lookbackDays, leadTimeDays, safetyStockDays }) => {
  if (!row) return null;

  const currentStockTienda = parseInt(row.current_stock_tienda, 10) || 0;
  const currentStockDeposito = parseInt(row.current_stock_deposito, 10) || 0;
  const totalStockActual = currentStockTienda + currentStockDeposito;
  const unitsSoldPeriod = parseInt(row.units_sold_period, 10) || 0;

  // Demanda Diaria Promedio (D_avg)
  const dailyAverageDemand = unitsSoldPeriod > 0 
    ? parseFloat((unitsSoldPeriod / lookbackDays).toFixed(4)) 
    : 0;

  // Stock de Seguridad (Safety Stock = D_avg * safetyStockDays)
  const safetyStock = Math.ceil(dailyAverageDemand * safetyStockDays);

  // Punto de Reorden (ROP = D_avg * LeadTime + SafetyStock)
  const leadTimeDemand = dailyAverageDemand * leadTimeDays;
  const rop = Math.ceil(leadTimeDemand + safetyStock);

  // Diagnóstico del estado del inventario
  let status = 'OPTIMAL';
  let requiresReorder = false;
  let urgencyLevel = 'BAJA';

  if (totalStockActual <= rop) {
    status = 'CRITICAL_REORDER';
    requiresReorder = true;
    urgencyLevel = 'ALTA';
  } else if (totalStockActual <= Math.ceil(rop * 1.25)) {
    status = 'WARNING_REORDER';
    requiresReorder = true;
    urgencyLevel = 'MEDIA';
  }

  // Cantidad sugerida de pedido para importación (Target de reposición a 1.5x ROP)
  const suggestedOrderQuantity = requiresReorder 
    ? Math.max(1, Math.ceil((rop * 1.5) - totalStockActual)) 
    : 0;

  return {
    idItem: row.id_item,
    itemName: row.item_name,
    sku: row.sku,
    brandName: row.brand_name || null,
    cost: row.cost ? parseFloat(row.cost) : 0,
    price: row.price ? parseFloat(row.price) : 0,
    metrics: {
      lookbackDays,
      unitsSoldInPeriod: unitsSoldPeriod,
      dailyAverageDemand,
      leadTimeDays,
      safetyStockDays,
      safetyStockUnits: safetyStock,
      reorderPoint: rop
    },
    stock: {
      tienda: currentStockTienda,
      deposito: currentStockDeposito,
      totalActual: totalStockActual
    },
    recommendation: {
      status,
      requiresReorder,
      urgencyLevel,
      suggestedOrderQuantity,
      estimatedPurchaseCost: parseFloat((suggestedOrderQuantity * (row.cost ? parseFloat(row.cost) : 0)).toFixed(2))
    }
  };
};

export const toReorderPointListDTO = (rows, options) => {
  if (!Array.isArray(rows)) return [];
  return rows.map(r => toReorderPointDTO(r, options));
};
