import { posService } from '../services/pos.service.js';

export const posController = {
  async createSale(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sale = await posService.createSale(req.body, userId);
      res.status(201).json({
        success: true,
        data: sale
      });
    } catch (error) {
      next(error);
    }
  },

  async getSaleById(req, res, next) {
    try {
      const { idVenta } = req.params;
      const sale = await posService.getSaleById(parseInt(idVenta, 10));
      res.status(200).json({
        success: true,
        data: sale
      });
    } catch (error) {
      next(error);
    }
  },

  async getAllSales(req, res, next) {
    try {
      const result = await posService.getAllSales(req.query);
      res.status(200).json({
        success: true,
        data: result.sales,
        meta: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
