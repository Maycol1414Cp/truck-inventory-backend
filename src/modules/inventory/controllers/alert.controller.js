import { restockAlertService } from '../services/restockAlert.service.js';

export const alertController = {
  async getRestockAlerts(req, res, next) {
    try {
      const { idSucursal } = req.params;
      const sucursalId = idSucursal ? parseInt(idSucursal, 10) : null;
      const result = await restockAlertService.getRestockAlerts(sucursalId);
      res.status(200).json({
        success: true,
        data: result.alerts,
        meta: result.summary
      });
    } catch (error) {
      next(error);
    }
  }
};
