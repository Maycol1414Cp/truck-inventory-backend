import { compatibilityService } from '../services/compatibility.service.js';

export const compatibilityController = {
  /**
   * POST /api/v1/vehicles/compatibility
   * Vincula un repuesto a un camión.
   */
  async linkCompatibility(req, res, next) {
    try {
      const { idItem, idTruck, positionNote } = req.body;
      const result = await compatibilityService.linkItemToTruck({
        idItem,
        idTruck,
        positionNote
      });

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/vehicles/compatibility/:idItem/:idTruck
   * Desvincula un repuesto de un camión.
   */
  async unlinkCompatibility(req, res, next) {
    try {
      const { idItem, idTruck } = req.params;
      const result = await compatibilityService.unlinkItemFromTruck(idItem, idTruck);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/vehicles/trucks/:idTruck/items
   * BÚSQUEDA INVERSA: Lista repuestos compatibles con un camión.
   */
  async listItemsByTruck(req, res, next) {
    try {
      const { idTruck } = req.params;
      const { search, page, limit } = req.query;

      const result = await compatibilityService.getItemsByTruck(idTruck, { search, page, limit });

      res.status(200).json({
        success: true,
        truck: result.truck,
        data: result.items,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/vehicles/items/:idItem/trucks
   * Consulta camiones compatibles con un repuesto.
   */
  async listTrucksByItem(req, res, next) {
    try {
      const { idItem } = req.params;
      const result = await compatibilityService.getTrucksByItem(idItem);

      res.status(200).json({
        success: true,
        item: {
          idItem: result.idItem,
          itemName: result.itemName,
          sku: result.sku
        },
        data: result.trucks
      });
    } catch (error) {
      next(error);
    }
  }
};
