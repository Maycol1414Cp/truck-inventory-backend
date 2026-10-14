import { brandService } from '../services/brand.service.js';

export const brandController = {
  async getAllBrands(req, res, next) {
    try {
      const brands = await brandService.getAllBrands();
      res.status(200).json({
        success: true,
        data: brands
      });
    } catch (error) {
      next(error);
    }
  },

  async getBrandById(req, res, next) {
    try {
      const { idBrand } = req.params;
      const brand = await brandService.getBrandById(parseInt(idBrand, 10));
      res.status(200).json({
        success: true,
        data: brand
      });
    } catch (error) {
      next(error);
    }
  },

  async createBrand(req, res, next) {
    try {
      const newBrand = await brandService.createBrand(req.body);
      res.status(201).json({
        success: true,
        data: newBrand
      });
    } catch (error) {
      next(error);
    }
  }
};
