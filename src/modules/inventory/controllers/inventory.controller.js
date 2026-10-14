import { inventoryService } from '../services/inventory.service.js';

export const inventoryController = {
  async getStockByBranch(req, res, next) {
    try {
      const { idSucursal } = req.params;
      const result = await inventoryService.getStockByBranch(parseInt(idSucursal, 10), req.query);
      res.status(200).json({
        success: true,
        data: result.stock,
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
  },

  async updateItemLocation(req, res, next) {
    try {
      const { idSucursal, idItem } = req.params;
      const updated = await inventoryService.updateItemLocation(
        parseInt(idSucursal, 10),
        parseInt(idItem, 10),
        req.body
      );
      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  async assignStock(req, res, next) {
    try {
      const stock = await inventoryService.assignStock(req.body);
      res.status(200).json({
        success: true,
        data: stock
      });
    } catch (error) {
      next(error);
    }
  }
};
