import { itemService } from '../services/item.service.js';

export const itemController = {
  async getAllItems(req, res, next) {
    try {
      const result = await itemService.getAllItems(req.query);
      res.status(200).json({
        success: true,
        data: result.items,
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

  async getItemById(req, res, next) {
    try {
      const { idItem } = req.params;
      const item = await itemService.getItemById(parseInt(idItem, 10));
      res.status(200).json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  },

  async createItem(req, res, next) {
    try {
      const newItem = await itemService.createItem(req.body);
      res.status(201).json({
        success: true,
        data: newItem
      });
    } catch (error) {
      next(error);
    }
  },

  async updateItem(req, res, next) {
    try {
      const { idItem } = req.params;
      const updatedItem = await itemService.updateItem(parseInt(idItem, 10), req.body);
      res.status(200).json({
        success: true,
        data: updatedItem
      });
    } catch (error) {
      next(error);
    }
  },

  async uploadImages(req, res, next) {
    try {
      const { idItem } = req.params;
      const itemWithImages = await itemService.uploadItemImages(parseInt(idItem, 10), req.files);
      res.status(200).json({
        success: true,
        data: itemWithImages
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteImage(req, res, next) {
    try {
      const { idItem, idImage } = req.params;
      const result = await itemService.deleteItemImage(parseInt(idItem, 10), parseInt(idImage, 10));
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async searchItems(req, res, next) {
    try {
      const { q = '', limit = '20' } = req.query;
      const results = await itemService.searchItems(q, parseInt(limit, 10));
      res.status(200).json({
        success: true,
        data: results,
        meta: {
          count: results.length,
          query: q
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
