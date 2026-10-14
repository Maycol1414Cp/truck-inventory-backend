import { returnService } from '../services/return.service.js';

export const returnController = {
  async processReturn(req, res, next) {
    try {
      const authorizedBy = req.user ? req.user.username : (req.body.autorizadoPor || 'SUPERVISOR_POS');
      const refund = await returnService.processReturn(req.body, authorizedBy);
      res.status(201).json({
        success: true,
        data: refund
      });
    } catch (error) {
      next(error);
    }
  },

  async getReturnById(req, res, next) {
    try {
      const { idDevolucion } = req.params;
      const refund = await returnService.getReturnById(parseInt(idDevolucion, 10));
      res.status(200).json({
        success: true,
        data: refund
      });
    } catch (error) {
      next(error);
    }
  },

  async getReturnsBySale(req, res, next) {
    try {
      const { idVenta } = req.params;
      const refunds = await returnService.getReturnsBySale(parseInt(idVenta, 10));
      res.status(200).json({
        success: true,
        data: refunds
      });
    } catch (error) {
      next(error);
    }
  }
};
