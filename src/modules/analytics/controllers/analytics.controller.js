import { analyticsService } from '../services/analytics.service.js';

export const analyticsController = {
  /**
   * GET /api/v1/analytics/seasonal-demand
   * Demanda y rotación estacional desglosada por trimestres (Q1..Q4).
   */
  async getSeasonalDemand(req, res, next) {
    try {
      const { year, idItem, idSucursal } = req.query;
      const result = await analyticsService.getSeasonalDemand({
        year,
        idItem,
        idSucursal
      });

      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/analytics/reorder-points
   * Reporte predictivo de Punto de Reorden (ROP) y sugerencias de compra para importaciones.
   */
  async getReorderPoints(req, res, next) {
    try {
      const {
        lookbackDays,
        leadTimeDays,
        safetyStockDays,
        onlyAlerts,
        page,
        limit,
        idItem,
        idSucursal
      } = req.query;

      const result = await analyticsService.getReorderPoints({
        lookbackDays,
        leadTimeDays,
        safetyStockDays,
        onlyAlerts,
        page,
        limit,
        idItem,
        idSucursal
      });

      res.status(200).json({
        success: true,
        summary: result.summary,
        data: result.items,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/analytics/dashboard
   * Dashboard ejecutivo de KPIs de inventario, valuación y ventas.
   */
  async getDashboard(req, res, next) {
    try {
      const data = await analyticsService.getDashboard();

      res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      next(error);
    }
  }
};
