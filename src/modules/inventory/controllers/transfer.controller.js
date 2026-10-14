import { transferService } from '../services/transfer.service.js';

export const transferController = {
  async executeTransfer(req, res, next) {
    try {
      const result = await transferService.executeInternalTransfer(req.body);
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async getKardexByItem(req, res, next) {
    try {
      const { idSucursal, idItem } = req.params;
      const history = await transferService.getKardexByItem(
        parseInt(idSucursal, 10),
        parseInt(idItem, 10),
        req.query
      );
      res.status(200).json({
        success: true,
        data: history
      });
    } catch (error) {
      next(error);
    }
  }
};
