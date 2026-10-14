import { alertRepository } from '../repositories/alert.repository.js';
import { branchRepository } from '../repositories/branch.repository.js';
import { AppError } from '../../../common/errors/AppError.js';

export const restockAlertService = {
  async getRestockAlerts(idSucursal = null) {
    if (idSucursal) {
      const branch = await branchRepository.findById(idSucursal);
      if (!branch) {
        throw new AppError(`Sucursal con ID ${idSucursal} no encontrada.`, 404, 'BRANCH_NOT_FOUND');
      }
    }

    const alerts = await alertRepository.getRestockAlertsByBranch(idSucursal);
    const criticalZeroCount = alerts.filter(a => a.tienda.stockActual === 0).length;

    return {
      alerts,
      summary: {
        totalAlerts: alerts.length,
        criticalZeroStock: criticalZeroCount,
        warningLowStock: alerts.length - criticalZeroCount
      }
    };
  }
};
