import { oemService } from '../services/oem.service.js';

export const oemController = {
  async getOemsByItem(req, res, next) {
    try {
      const { idItem } = req.params;
      const oems = await oemService.getOemsByItem(parseInt(idItem, 10));
      res.status(200).json({
        success: true,
        data: oems
      });
    } catch (error) {
      next(error);
    }
  },

  async addOemToItem(req, res, next) {
    try {
      const { idItem } = req.params;
      const newOem = await oemService.addOemToItem(parseInt(idItem, 10), req.body);
      res.status(201).json({
        success: true,
        data: newOem
      });
    } catch (error) {
      next(error);
    }
  },

  async removeOem(req, res, next) {
    try {
      const { idItemOem } = req.params;
      const result = await oemService.removeOem(parseInt(idItemOem, 10));
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};
