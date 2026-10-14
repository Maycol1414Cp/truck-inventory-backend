import { truckService } from '../services/truck.service.js';

export const truckController = {
  /**
   * GET /api/v1/vehicles/trucks
   */
  async listTrucks(req, res, next) {
    try {
      const { search, brand, engine, page, limit } = req.query;
      const result = await truckService.getTrucks({ search, brand, engine, page, limit });

      res.status(200).json({
        success: true,
        data: result.trucks,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/vehicles/trucks/brands
   */
  async listBrands(req, res, next) {
    try {
      const brands = await truckService.getTruckBrands();
      res.status(200).json({
        success: true,
        data: brands
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/vehicles/trucks/:idTruck
   */
  async getTruckById(req, res, next) {
    try {
      const { idTruck } = req.params;
      const truck = await truckService.getTruckById(idTruck);

      res.status(200).json({
        success: true,
        data: truck
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/vehicles/trucks
   */
  async createTruck(req, res, next) {
    try {
      const created = await truckService.createTruck(req.body);

      res.status(201).json({
        success: true,
        data: created
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/vehicles/trucks/:idTruck
   */
  async updateTruck(req, res, next) {
    try {
      const { idTruck } = req.params;
      const updated = await truckService.updateTruck(idTruck, req.body);

      res.status(200).json({
        success: true,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/vehicles/trucks/:idTruck
   */
  async deleteTruck(req, res, next) {
    try {
      const { idTruck } = req.params;
      const result = await truckService.deleteTruck(idTruck);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};
