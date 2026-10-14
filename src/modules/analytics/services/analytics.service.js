import { analyticsRepository } from '../repositories/analytics.repository.js';
import {
  toSeasonalDemandListDTO,
  toReorderPointListDTO
} from '../mappers/analytics.mapper.js';
import { AppError } from '../../../common/errors/AppError.js';

export const analyticsService = {
  /**
   * Obtiene la analítica de demanda estacional por trimestres (Q1..Q4).
   */
  async getSeasonalDemand({ year = null, idItem = null, idSucursal = null } = {}) {
    let yearNum = null;
    if (year !== null && year !== undefined && year !== '') {
      yearNum = parseInt(year, 10);
      if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
        throw new AppError('El año especificado no es válido (rango 2000-2100).', 400, 'INVALID_YEAR');
      }
    }

    let itemNum = null;
    if (idItem !== null && idItem !== undefined && idItem !== '') {
      itemNum = parseInt(idItem, 10);
      if (isNaN(itemNum) || itemNum <= 0) {
        throw new AppError('El ID del repuesto debe ser un entero positivo.', 400, 'INVALID_ITEM_ID');
      }
    }

    let sucursalNum = null;
    if (idSucursal !== null && idSucursal !== undefined && idSucursal !== '') {
      sucursalNum = parseInt(idSucursal, 10);
      if (isNaN(sucursalNum) || sucursalNum <= 0) {
        throw new AppError('El ID de sucursal debe ser un entero positivo.', 400, 'INVALID_BRANCH_ID');
      }
    }

    const rows = await analyticsRepository.getSeasonalDemand({
      year: yearNum,
      idItem: itemNum,
      idSucursal: sucursalNum
    });

    const items = toSeasonalDemandListDTO(rows);

    return {
      items,
      meta: {
        totalItems: items.length,
        filterYear: yearNum || 'ALL_TIME',
        filterItem: itemNum,
        filterSucursal: sucursalNum
      }
    };
  },

  /**
   * Calcula el Punto de Reorden (ROP) y genera recomendaciones de importación.
   * ROP = (Demanda Diaria Promedio * Lead Time) + Stock de Seguridad
   */
  async getReorderPoints(params = {}) {
    const lookbackDays = Math.max(7, Math.min(365, parseInt(params.lookbackDays, 10) || 90));
    const leadTimeDays = Math.max(1, Math.min(180, parseInt(params.leadTimeDays, 10) || 30));
    const safetyStockDays = Math.max(0, Math.min(90, parseInt(params.safetyStockDays, 10) || 7));
    const onlyAlerts = params.onlyAlerts === true || params.onlyAlerts === 'true';
    const pageNum = Math.max(1, parseInt(params.page, 10) || 1);
    const limitNum = Math.max(1, Math.min(200, parseInt(params.limit, 10) || 50));

    let itemNum = null;
    if (params.idItem) {
      itemNum = parseInt(params.idItem, 10);
      if (isNaN(itemNum) || itemNum <= 0) {
        throw new AppError('ID de repuesto inválido.', 400, 'INVALID_ITEM_ID');
      }
    }

    let sucursalNum = null;
    if (params.idSucursal) {
      sucursalNum = parseInt(params.idSucursal, 10);
      if (isNaN(sucursalNum) || sucursalNum <= 0) {
        throw new AppError('ID de sucursal inválido.', 400, 'INVALID_BRANCH_ID');
      }
    }

    const rawRows = await analyticsRepository.getReorderData({
      lookbackDays,
      idItem: itemNum,
      idSucursal: sucursalNum
    });

    // Mapear y calcular ROP para cada ítem
    let allCalculated = toReorderPointListDTO(rawRows, {
      lookbackDays,
      leadTimeDays,
      safetyStockDays
    });

    // Si se solicitó solo ítems con alerta (CRITICAL o WARNING)
    if (onlyAlerts) {
      allCalculated = allCalculated.filter(item => item.recommendation.requiresReorder);
    }

    // Estadísticas globales del análisis
    const totalCount = allCalculated.length;
    const criticalCount = allCalculated.filter(i => i.recommendation.status === 'CRITICAL_REORDER').length;
    const warningCount = allCalculated.filter(i => i.recommendation.status === 'WARNING_REORDER').length;
    const optimalCount = allCalculated.filter(i => i.recommendation.status === 'OPTIMAL').length;
    const totalEstimatedCost = allCalculated.reduce((acc, i) => acc + i.recommendation.estimatedPurchaseCost, 0);

    // Paginación en memoria
    const offset = (pageNum - 1) * limitNum;
    const paginatedItems = allCalculated.slice(offset, offset + limitNum);

    return {
      items: paginatedItems,
      summary: {
        totalAnalyzed: rawRows.length,
        itemsRequiringOrder: criticalCount + warningCount,
        criticalAlerts: criticalCount,
        warningAlerts: warningCount,
        optimalStock: optimalCount,
        totalEstimatedPurchaseBudget: parseFloat(totalEstimatedCost.toFixed(2))
      },
      meta: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
        parametersApplied: {
          lookbackDays,
          leadTimeDays,
          safetyStockDays,
          onlyAlerts
        }
      }
    };
  },

  /**
   * Resumen ejecutivo y KPIs consolidados.
   */
  async getDashboard() {
    const raw = await analyticsRepository.getExecutiveMetrics();

    return {
      catalog: {
        totalActiveItems: parseInt(raw.total_active_items, 10) || 0
      },
      inventory: {
        totalStockUnits: (parseInt(raw.total_stock_tienda, 10) || 0) + (parseInt(raw.total_stock_deposito, 10) || 0),
        stockTiendaUnits: parseInt(raw.total_stock_tienda, 10) || 0,
        stockDepositoUnits: parseInt(raw.total_stock_deposito, 10) || 0,
        inventoryCostValuation: parseFloat(parseFloat(raw.total_inventory_cost_valuation || 0).toFixed(2)),
        inventoryPriceValuation: parseFloat(parseFloat(raw.total_inventory_price_valuation || 0).toFixed(2)),
        activeInternalRestockAlerts: parseInt(raw.active_internal_restock_alerts, 10) || 0
      },
      sales: {
        totalCompletedSales: parseInt(raw.total_sales_count, 10) || 0,
        grossRevenue: parseFloat(parseFloat(raw.total_sales_revenue || 0).toFixed(2)),
        totalApprovedReturns: parseInt(raw.total_returns_count, 10) || 0,
        refundedAmount: parseFloat(parseFloat(raw.total_refunded_amount || 0).toFixed(2)),
        netRevenue: parseFloat((parseFloat(raw.total_sales_revenue || 0) - parseFloat(raw.total_refunded_amount || 0)).toFixed(2))
      }
    };
  }
};
